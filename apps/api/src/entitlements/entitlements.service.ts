import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

export type PlanName = 'free' | 'pro' | 'business';

export interface PlanLimits {
  sites: number;
  aiArticlesPerMonth: number;
  /** In-editor AI assists (edit/title/summarize) per day — cheap but not free. */
  aiAssistsPerDay: number;
  autopilot: boolean;
  destinations: number;
  customDomain: boolean;
  backlinkNetwork: boolean;
  /** DataForSEO-backed keyword research (each lookup costs provider credits). */
  keywordResearch: boolean;
}

// Static plan→limits table. Limits live in code (not the DB); usage is counted
// from User.aiUsageCount + row counts.
export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: {
    sites: 1,
    aiArticlesPerMonth: 5,
    aiAssistsPerDay: 50,
    autopilot: false,
    destinations: 0,
    customDomain: false,
    backlinkNetwork: false,
    keywordResearch: false,
  },
  pro: {
    sites: 5,
    aiArticlesPerMonth: 100,
    aiAssistsPerDay: 500,
    autopilot: true,
    destinations: 10,
    customDomain: true,
    backlinkNetwork: true,
    keywordResearch: true,
  },
  business: {
    sites: 25,
    aiArticlesPerMonth: 1000,
    aiAssistsPerDay: 2000,
    autopilot: true,
    destinations: 100,
    customDomain: true,
    backlinkNetwork: true,
    keywordResearch: true,
  },
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// A paid plan only confers entitlements while the Stripe subscription is in one
// of these states. Notably this EXCLUDES `incomplete`, `incomplete_expired`,
// and `unpaid` (no successful payment) and `canceled`. `past_due` is kept as a
// short grace window. Anything else falls back to the free plan.
const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

function isEntitled(status: string | null | undefined): boolean {
  return ENTITLED_STATUSES.has(status ?? '');
}

@Injectable()
export class EntitlementsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  normalizePlan(plan: string | null | undefined): PlanName {
    return plan === 'pro' || plan === 'business' ? plan : 'free';
  }

  limitsFor(plan: string | null | undefined): PlanLimits {
    return PLAN_LIMITS[this.normalizePlan(plan)];
  }

  /**
   * Effective plan. A paid plan only counts while the subscription is in an
   * entitled status (active/trialing/past_due) — incomplete/unpaid/canceled
   * subscriptions (no successful payment) fall back to free, so a never-paid or
   * lapsed checkout can't grant paid features.
   */
  async effectivePlan(userId: string): Promise<PlanName> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, subscriptionStatus: true },
    });
    if (!u) return 'free';
    const plan = this.normalizePlan(u.plan);
    if (plan === 'free') return 'free';
    return isEntitled(u.subscriptionStatus) ? plan : 'free';
  }

  async assertCanCreateSite(userId: string): Promise<void> {
    const limit = this.limitsFor(await this.effectivePlan(userId)).sites;
    const count = await this.prisma.site.count({ where: { userId } });
    if (count >= limit) {
      throw new ForbiddenException(
        `Your plan allows ${limit} site${limit === 1 ? '' : 's'}. Upgrade to add more.`,
      );
    }
  }

  async assertAutopilot(userId: string): Promise<void> {
    if (!this.limitsFor(await this.effectivePlan(userId)).autopilot) {
      throw new ForbiddenException(
        'Autopilot is not available on your plan. Upgrade to enable it.',
      );
    }
  }

  /** Non-throwing autopilot check for the scheduler (must not break the cron loop). */
  async hasAutopilot(userId: string): Promise<boolean> {
    return this.limitsFor(await this.effectivePlan(userId)).autopilot;
  }

  async assertCanAddDestination(userId: string): Promise<void> {
    const limit = this.limitsFor(await this.effectivePlan(userId)).destinations;
    if (limit <= 0) {
      throw new ForbiddenException(
        'Publishing destinations are not available on your plan. Upgrade to enable them.',
      );
    }
    const count = await this.prisma.publishTarget.count({ where: { userId } });
    if (count >= limit) {
      throw new ForbiddenException(
        `Your plan allows ${limit} destination${limit === 1 ? '' : 's'}. Upgrade to add more.`,
      );
    }
  }

  async assertCustomDomain(userId: string): Promise<void> {
    if (!this.limitsFor(await this.effectivePlan(userId)).customDomain) {
      throw new ForbiddenException(
        'Custom domains are not available on your plan. Upgrade to enable them.',
      );
    }
  }

  async assertBacklinkNetwork(userId: string): Promise<void> {
    if (!this.limitsFor(await this.effectivePlan(userId)).backlinkNetwork) {
      throw new ForbiddenException(
        'The backlink network is not available on your plan. Upgrade to join.',
      );
    }
  }

  /** Keyword research spends DataForSEO credits — paid plans only. */
  async assertKeywordResearch(userId: string): Promise<void> {
    if (!this.limitsFor(await this.effectivePlan(userId)).keywordResearch) {
      throw new ForbiddenException(
        'Keyword research is not available on your plan. Upgrade to enable it.',
      );
    }
  }

  /**
   * Meter one in-editor AI assist (edit/title/summarize) against the plan's
   * daily allowance. These are cheap per call but real OpenAI spend, so they
   * get a generous windowed counter instead of consuming monthly article
   * slots. Without Redis the counter is unavailable and the call is allowed —
   * self-hosters aren't forced to run Redis just for metering.
   */
  async assertAiAssist(userId: string): Promise<void> {
    const limit = this.limitsFor(
      await this.effectivePlan(userId),
    ).aiAssistsPerDay;
    const day = new Date().toISOString().slice(0, 10);
    const count = await this.cache.incrWithTtl(
      `ai:assist:${userId}:${day}`,
      24 * 60 * 60,
    );
    if (count !== null && count > limit) {
      throw new ForbiddenException(
        'You have reached your daily AI assist limit. Try again tomorrow or upgrade.',
      );
    }
  }

  /** Non-throwing check for background workers (must not break the loop). */
  async hasBacklinkNetwork(userId: string): Promise<boolean> {
    return this.limitsFor(await this.effectivePlan(userId)).backlinkNetwork;
  }

  /**
   * Atomically reserve one monthly AI generation. Returns true if a slot was
   * available. Resets the counter at most once per calendar month (inline, no
   * cron). Same conditional-updateMany idiom as the autopilot generatedCount
   * reserve — replica-safe, O(1), counted at enqueue (so failed retries can't
   * farm extra generations).
   */
  async reserveAiGeneration(userId: string): Promise<boolean> {
    const month = currentMonth();
    const limit = this.limitsFor(
      await this.effectivePlan(userId),
    ).aiArticlesPerMonth;
    // Roll the window over once per month.
    await this.prisma.user.updateMany({
      where: { id: userId, NOT: { aiUsageMonth: month } },
      data: { aiUsageMonth: month, aiUsageCount: 0 },
    });
    const reserved = await this.prisma.user.updateMany({
      where: { id: userId, aiUsageMonth: month, aiUsageCount: { lt: limit } },
      data: { aiUsageCount: { increment: 1 } },
    });
    return reserved.count === 1;
  }

  /**
   * Give back one reserved monthly AI slot — used when a dispatched generation
   * never actually ran (e.g. autopilot dispatch failed after the reserve).
   */
  async releaseAiGeneration(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        aiUsageMonth: currentMonth(),
        aiUsageCount: { gt: 0 },
      },
      data: { aiUsageCount: { decrement: 1 } },
    });
  }

  /** Throwing variant for the request-path (manual AI generation). */
  async assertCanGenerateAi(userId: string): Promise<void> {
    if (!(await this.reserveAiGeneration(userId))) {
      throw new ForbiddenException(
        'You have reached your monthly AI generation limit. Upgrade for more.',
      );
    }
  }

  /** Plan + limits + current usage, for /auth/me and the billing UI. */
  async summary(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        aiUsageMonth: true,
        aiUsageCount: true,
      },
    });
    const normalized = this.normalizePlan(u?.plan);
    const plan =
      normalized !== 'free' && isEntitled(u?.subscriptionStatus)
        ? normalized
        : 'free';
    const limits = PLAN_LIMITS[plan];
    const month = currentMonth();
    const aiUsed = u?.aiUsageMonth === month ? u.aiUsageCount : 0;
    const [sites, destinations] = await Promise.all([
      this.prisma.site.count({ where: { userId } }),
      this.prisma.publishTarget.count({ where: { userId } }),
    ]);
    return {
      plan,
      status: u?.subscriptionStatus ?? null,
      currentPeriodEnd: u?.currentPeriodEnd ?? null,
      limits,
      usage: { aiArticlesThisMonth: aiUsed, sites, destinations },
    };
  }
}
