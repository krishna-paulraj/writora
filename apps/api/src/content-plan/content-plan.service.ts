import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ArticleGenerationService } from '../ai/article-generation.service';
import {
  CreateContentPlanDto,
  PlanItemInput,
} from './dto/create-content-plan.dto';
import { UpdateContentPlanDto } from './dto/update-content-plan.dto';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

// Cadence → days between articles. `monthly` is approximated as 30 days.
const CADENCE_DAYS: Record<string, number> = {
  daily: 1,
  every_3_days: 3,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};
const DEFAULT_CADENCE = 'weekly';
const DAY_MS = 86_400_000;
const DEFAULT_ARTICLE_COUNT = 8;
const MAX_ARTICLE_COUNT = 30;
const PLAN_STATUSES = ['active', 'paused', 'completed'];
// Reserved title of the per-site singleton plan that holds calendar quick-adds.
const QUICK_ADD_PLAN_TITLE = 'Quick adds';

function strArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

@Injectable()
export class ContentPlanService {
  private readonly logger = new Logger(ContentPlanService.name);

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private articleGen: ArticleGenerationService,
    private notifications: NotificationsService,
    private entitlements: EntitlementsService,
  ) {}

  private cadenceDays(cadence: string): number {
    return CADENCE_DAYS[cadence] ?? CADENCE_DAYS[DEFAULT_CADENCE];
  }

  private nextRunFrom(from: Date, cadence: string): Date {
    return new Date(from.getTime() + this.cadenceDays(cadence) * DAY_MS);
  }

  async create(userId: string, siteId: string, dto: CreateContentPlanDto) {
    const title = dto.title?.trim();
    const topic = dto.topic?.trim();
    if (!title) throw new BadRequestException('title is required');
    if (!topic) throw new BadRequestException('topic is required');
    // Autopilot is plan-gated.
    await this.entitlements.assertAutopilot(userId);

    const cadence =
      dto.cadence && CADENCE_DAYS[dto.cadence] ? dto.cadence : DEFAULT_CADENCE;

    const seedTarget = dto.targetKeyword?.trim() || undefined;
    const seedRelated = (dto.relatedKeywords ?? [])
      .map((k) => k.trim())
      .filter(Boolean);

    // Build the planned ideas: explicit items if supplied, else AI brainstorm.
    const ideas = await this.buildIdeas(dto, topic, seedTarget, seedRelated);

    const totalTarget =
      dto.totalTarget === null
        ? null
        : typeof dto.totalTarget === 'number'
          ? Math.max(1, Math.floor(dto.totalTarget))
          : ideas.length;

    // Start the first article on the next tick unless told otherwise.
    const startNow = dto.startNow !== false;
    const now = new Date();
    const nextRunAt = startNow ? now : this.nextRunFrom(now, cadence);

    // Materialize the cadence forecast as real per-item dates the planner can
    // drag: item 0 == nextRunAt, then one cadence step apart. Keeps the invariant
    // plan.nextRunAt == min(scheduledFor of planned items).
    const stepMs = this.cadenceDays(cadence) * DAY_MS;

    return this.prisma.contentPlan.create({
      data: {
        userId,
        siteId,
        title,
        topic,
        audience: dto.audience?.trim() || null,
        tone: dto.tone ?? 'professional',
        length: dto.length ?? 'medium',
        category: dto.category?.trim() || null,
        cadence,
        status: 'active',
        autoPublish: dto.autoPublish ?? false,
        keywordData: {
          targetKeyword: seedTarget ?? null,
          relatedKeywords: seedRelated,
        },
        totalTarget,
        nextRunAt,
        items: {
          create: ideas.map((idea, i) => ({
            title: idea.title,
            targetKeyword: idea.targetKeyword ?? null,
            keywords: idea.keywords ?? [],
            position: i,
            scheduledFor: new Date(nextRunAt.getTime() + i * stepMs),
          })),
        },
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
  }

  private async buildIdeas(
    dto: CreateContentPlanDto,
    topic: string,
    seedTarget: string | undefined,
    seedRelated: string[],
  ): Promise<PlanItemInput[]> {
    if (dto.items && dto.items.length > 0) {
      const ideas = dto.items
        .map((i) => ({
          title: i.title?.trim() ?? '',
          targetKeyword: i.targetKeyword?.trim() || undefined,
          keywords: (i.keywords ?? []).map((k) => k.trim()).filter(Boolean),
        }))
        .filter((i) => i.title.length > 0);
      if (ideas.length === 0) {
        throw new BadRequestException(
          'items must contain at least one titled idea',
        );
      }
      return ideas;
    }

    if (!this.ai.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI is not configured on this server',
      );
    }
    const count = Math.min(
      Math.max(dto.articleCount ?? DEFAULT_ARTICLE_COUNT, 1),
      MAX_ARTICLE_COUNT,
    );
    const seedKeywords = [seedTarget, ...seedRelated].filter(
      (k): k is string => !!k,
    );
    const generated = await this.ai.generatePlanIdeas({
      topic,
      audience: dto.audience?.trim() || undefined,
      tone: dto.tone,
      count,
      seedKeywords: seedKeywords.length ? seedKeywords : undefined,
    });
    // Attach the cluster's related keywords to every article for SEO context.
    return generated.map((g) => ({
      title: g.title,
      targetKeyword: g.targetKeyword,
      keywords: seedRelated,
    }));
  }

  async list(userId: string, siteId: string) {
    return this.prisma.contentPlan.findMany({
      where: { userId, siteId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async get(userId: string, id: string) {
    const plan = await this.prisma.contentPlan.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Content plan not found');
    if (plan.userId !== userId) throw new ForbiddenException();

    // Join each dispatched item to its job's live progress + resulting draft.
    const jobIds = plan.items
      .map((i) => i.articleJobId)
      .filter((j): j is string => !!j);
    const jobs = jobIds.length
      ? await this.prisma.articleJob.findMany({
          where: { id: { in: jobIds } },
          select: {
            id: true,
            status: true,
            progress: true,
            blogId: true,
            error: true,
          },
        })
      : [];
    const jobById = new Map(jobs.map((j) => [j.id, j]));

    return {
      ...plan,
      items: plan.items.map((item) => ({
        ...item,
        job: (item.articleJobId && jobById.get(item.articleJobId)) || null,
      })),
    };
  }

  async update(userId: string, id: string, dto: UpdateContentPlanDto) {
    const plan = await this.ensureOwned(userId, id);
    const data: Prisma.ContentPlanUpdateInput = {};

    if (typeof dto.title === 'string') {
      const t = dto.title.trim();
      if (!t) throw new BadRequestException('title cannot be empty');
      data.title = t;
    }
    if (dto.cadence && CADENCE_DAYS[dto.cadence]) data.cadence = dto.cadence;
    if (typeof dto.autoPublish === 'boolean')
      data.autoPublish = dto.autoPublish;
    if (dto.totalTarget !== undefined) {
      data.totalTarget =
        dto.totalTarget === null
          ? null
          : Math.max(1, Math.floor(dto.totalTarget));
    }
    if (dto.status) {
      if (!PLAN_STATUSES.includes(dto.status)) {
        throw new BadRequestException('invalid status');
      }
      data.status = dto.status;
      // Resuming a plan that has no scheduled run → pick up on the next tick.
      if (dto.status === 'active' && !plan.nextRunAt) {
        data.nextRunAt = new Date();
      }
    }

    return this.prisma.contentPlan.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    // Items cascade; generated ArticleJobs/Blogs survive (contentPlanId → null).
    await this.prisma.contentPlan.delete({ where: { id } });
    return { ok: true as const };
  }

  async addItem(userId: string, id: string, body: PlanItemInput) {
    const plan = await this.ensureOwned(userId, id);
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('title is required');

    const agg = await this.prisma.contentPlanItem.aggregate({
      where: { planId: id },
      _max: { position: true, scheduledFor: true },
    });
    const keywords = (body.keywords ?? []).map((k) => k.trim()).filter(Boolean);

    // Default the date to one cadence step after the last scheduled item so a
    // manually-added idea lands on a sensible future day; an explicit date wins.
    const stepMs = this.cadenceDays(plan.cadence) * DAY_MS;
    const scheduledFor = body.scheduledFor
      ? new Date(body.scheduledFor)
      : agg._max.scheduledFor
        ? new Date(agg._max.scheduledFor.getTime() + stepMs)
        : (plan.nextRunAt ?? new Date());
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Invalid scheduledFor');
    }

    const item = await this.prisma.contentPlanItem.create({
      data: {
        planId: id,
        title,
        targetKeyword: body.targetKeyword?.trim() || null,
        keywords: keywords,
        position: (agg._max.position ?? -1) + 1,
        scheduledFor,
      },
    });

    // Adding work to a finished plan revives it; lift a reached cap by one so the
    // new item can actually dispatch (mirrors the revive-on-add behavior).
    const planData: Prisma.ContentPlanUpdateInput = {};
    if (plan.status === 'completed') planData.status = 'active';
    if (plan.totalTarget != null && plan.generatedCount >= plan.totalTarget) {
      planData.totalTarget = plan.generatedCount + 1;
    }
    if (Object.keys(planData).length) {
      await this.prisma.contentPlan.update({ where: { id }, data: planData });
    }
    // Keep the nextRunAt mirror correct (the new item may be the earliest).
    await this.refreshNextRunAt(id);
    return item;
  }

  /**
   * Reschedules (or otherwise edits) a single plan item. Only a still-`planned`
   * item can be moved — once queued/generating it has a job in flight or a blog,
   * so rescheduling is meaningless and would desync the cron's date gate.
   */
  async updateItem(
    userId: string,
    id: string,
    itemId: string,
    body: { scheduledFor?: string | null; title?: string },
  ) {
    await this.ensureOwned(userId, id);
    const item = await this.prisma.contentPlanItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.planId !== id) {
      throw new NotFoundException('Item not found');
    }

    const data: Prisma.ContentPlanItemUpdateInput = {};
    if (body.scheduledFor !== undefined) {
      if (item.status !== 'planned') {
        throw new BadRequestException(
          'Only planned articles can be rescheduled',
        );
      }
      if (body.scheduledFor === null) {
        data.scheduledFor = null; // parked — never auto-dispatched
      } else {
        const when = new Date(body.scheduledFor);
        if (Number.isNaN(when.getTime())) {
          throw new BadRequestException('Invalid scheduledFor');
        }
        data.scheduledFor = when; // past dates allowed → becomes immediately due
      }
    }
    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (!t) throw new BadRequestException('title cannot be empty');
      data.title = t;
    }

    const updated = await this.prisma.contentPlanItem.update({
      where: { id: itemId },
      data,
    });
    await this.refreshNextRunAt(id);
    return updated;
  }

  /**
   * Quick-add from the calendar: create a dated article on a lazily-created,
   * per-site "Quick adds" plan so one-off ideas ride the same autopilot pipeline
   * (entitlements, AI quota, atomic dispatch) and show up as a planned event.
   */
  async quickAdd(
    userId: string,
    siteId: string,
    body: {
      title?: string;
      scheduledFor?: string;
      targetKeyword?: string;
      keywords?: string[];
    },
  ) {
    await this.entitlements.assertAutopilot(userId);
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('title is required');
    if (!body.scheduledFor) {
      throw new BadRequestException('scheduledFor is required');
    }
    const when = new Date(body.scheduledFor);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException('Invalid scheduledFor');
    }

    const plan = await this.getOrCreateQuickAddPlan(userId, siteId);
    const item = await this.addItem(userId, plan.id, {
      title,
      targetKeyword: body.targetKeyword,
      keywords: body.keywords,
      scheduledFor: when.toISOString(),
    });
    return { planId: plan.id, item };
  }

  /** Find (or lazily create) the per-site uncapped "Quick adds" plan. */
  private async getOrCreateQuickAddPlan(userId: string, siteId: string) {
    const existing = await this.prisma.contentPlan.findFirst({
      where: {
        userId,
        siteId,
        title: QUICK_ADD_PLAN_TITLE,
        status: { not: 'completed' },
      },
    });
    if (existing) return existing;
    return this.prisma.contentPlan.create({
      data: {
        userId,
        siteId,
        title: QUICK_ADD_PLAN_TITLE,
        topic: 'Ad-hoc articles added from the planner',
        cadence: DEFAULT_CADENCE,
        status: 'active',
        autoPublish: false,
        totalTarget: null, // open-ended — never completes
        nextRunAt: null,
      },
    });
  }

  async removeItem(userId: string, id: string, itemId: string) {
    await this.ensureOwned(userId, id);
    const item = await this.prisma.contentPlanItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.planId !== id) {
      throw new NotFoundException('Item not found');
    }
    await this.prisma.contentPlanItem.delete({ where: { id: itemId } });
    return { ok: true as const };
  }

  /** Manually dispatch the next article now, bypassing the schedule. */
  async runNow(userId: string, id: string) {
    const plan = await this.ensureOwned(userId, id);
    if (plan.status === 'paused') {
      throw new BadRequestException('Resume the plan before generating');
    }
    if (!this.ai.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI is not configured on this server',
      );
    }
    const jobId = await this.dispatchNext(id);
    if (!jobId) {
      throw new BadRequestException(
        'No remaining planned articles to generate',
      );
    }
    return { jobId };
  }

  /** Scheduler entrypoint: dispatch the next article for every due plan. */
  async runDuePlans(): Promise<void> {
    // Crash recovery first — it needs no AI key, and it un-wedges state the
    // dispatch pass below would otherwise never look at again.
    await this.recoverWedgedPlans().catch((err) =>
      this.logger.warn(
        `recovery sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    if (!this.ai.isConfigured()) return; // generation impossible without AI
    const due = await this.prisma.contentPlan.findMany({
      where: { status: 'active', nextRunAt: { lte: new Date() } },
      select: { id: true },
      take: 25,
    });
    for (const { id } of due) {
      try {
        await this.dispatchNext(id, { enforceSchedule: true });
      } catch (err) {
        this.logger.warn(
          `dispatch for plan ${id} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  /**
   * Claims the next planned item and dispatches it as an autopilot ArticleJob,
   * then advances the plan's schedule. Returns the new job id, or null when
   * there was nothing to do (paused/completed/empty, or a lost race).
   *
   * Concurrency-safe via two atomic claims: the ITEM claim (planned→queued)
   * stops the same idea dispatching twice, and the PLAN-slot reserve (a single
   * conditional updateMany that increments generatedCount) enforces both the
   * totalTarget cap and — when `enforceSchedule` is set — the
   * one-article-per-cadence-slot invariant, even across overlapping cron ticks,
   * manual runs, and multiple app instances.
   *
   * Note: generatedCount tracks articles *dispatched*, not successful drafts —
   * a dispatched job that later fails generation still consumes a cap slot (the
   * item is left `failed`; per-item status reflects true success). This keeps
   * the cap atomically enforceable so autopilot can never over-generate (and,
   * under autoPublish, never over-publish).
   */
  async dispatchNext(
    planId: string,
    opts: { enforceSchedule?: boolean } = {},
  ): Promise<string | null> {
    const plan = await this.prisma.contentPlan.findUnique({
      where: { id: planId },
    });
    if (!plan || plan.status !== 'active') return null;

    // Non-throwing entitlement gate: a downgraded owner who lost autopilot
    // stops generating (can't break the cron loop with a throw).
    if (!(await this.entitlements.hasAutopilot(plan.userId))) return null;

    // Fast path: cap already reached → finish the plan.
    if (plan.totalTarget != null && plan.generatedCount >= plan.totalTarget) {
      await this.markCompleted(plan.id);
      return null;
    }

    const now = new Date();

    // Pick the next planned item. Under the scheduler, require it to be DUE by
    // its OWN date (scheduledFor <= now) and take the oldest-due first; a manual
    // "run now" ignores the date and takes the lowest position.
    const candidate = await this.prisma.contentPlanItem.findFirst({
      where: {
        planId: plan.id,
        status: 'planned',
        ...(opts.enforceSchedule
          ? { scheduledFor: { not: null, lte: now } }
          : {}),
      },
      orderBy: opts.enforceSchedule
        ? [{ scheduledFor: 'asc' }, { position: 'asc' }]
        : [{ position: 'asc' }],
    });
    if (!candidate) {
      // Cron: nothing due now (items may be due later) → refresh the mirror and
      // wait; do NOT complete. Manual: no planned items at all → complete.
      if (opts.enforceSchedule) {
        await this.refreshNextRunAt(plan.id);
        return null;
      }
      await this.markCompleted(plan.id);
      return null;
    }

    // Atomically claim the item AND re-prove it's due — one conditional
    // updateMany, so the same idea can never dispatch twice and an item dragged
    // into the future between select and claim is rejected (count !== 1).
    const itemClaim = await this.prisma.contentPlanItem.updateMany({
      where: {
        id: candidate.id,
        status: 'planned',
        ...(opts.enforceSchedule ? { scheduledFor: { lte: now } } : {}),
      },
      data: { status: 'queued' },
    });
    if (itemClaim.count !== 1) return null; // lost the item or no longer due

    // Reserve a generation slot on the PLAN atomically. The conditional
    // increment is evaluated server-side against the live row, so the cap can
    // never be exceeded. The item's date (claimed above) governs "due"; the plan
    // row only guards the cap and records lastRunAt.
    const reserve = await this.prisma.contentPlan.updateMany({
      where: {
        id: plan.id,
        status: 'active',
        ...(plan.totalTarget != null
          ? { generatedCount: { lt: plan.totalTarget } }
          : {}),
      },
      data: {
        generatedCount: { increment: 1 },
        lastRunAt: now,
      },
    });
    if (reserve.count !== 1) {
      // Hit the cap or the plan deactivated — release the item.
      await this.releaseItem(candidate.id);
      await this.refreshNextRunAt(plan.id);
      return null;
    }

    // Reserve a monthly AI slot for the owner (shared with manual generation).
    // reserveAiGeneration only increments when under limit, so an over-quota
    // result leaves the counter untouched — we just give back the plan slot. The
    // item keeps its scheduledFor, so it retries on the next due tick.
    if (!(await this.entitlements.reserveAiGeneration(plan.userId))) {
      await this.releaseItem(candidate.id);
      await this.prisma.contentPlan
        .update({
          where: { id: plan.id },
          data: { generatedCount: { decrement: 1 } },
        })
        .catch(() => {});
      await this.refreshNextRunAt(plan.id);
      return null;
    }

    let createdJobId: string | undefined;
    try {
      createdJobId = await this.articleGen.createJobForPlan({
        authorId: plan.userId,
        siteId: plan.siteId,
        contentPlanId: plan.id,
        topic: candidate.title,
        targetKeyword: candidate.targetKeyword,
        relatedKeywords: strArray(candidate.keywords),
        tone: plan.tone,
        length: plan.length,
        audience: plan.audience,
        category: plan.category,
      });

      // Link item → job BEFORE dispatch so the (possibly inline) consumer
      // reconciles the right item.
      await this.prisma.contentPlanItem.update({
        where: { id: candidate.id },
        data: { articleJobId: createdJobId },
      });

      await this.articleGen.dispatch(createdJobId);
    } catch (err) {
      // Dispatch never happened — drop the orphan job, give the reserved slot
      // back, and leave the item failed (terminal; the user can re-add it).
      if (createdJobId) {
        await this.prisma.articleJob
          .delete({ where: { id: createdJobId } })
          .catch(() => {});
      }
      await this.prisma.contentPlanItem
        .update({ where: { id: candidate.id }, data: { status: 'failed' } })
        .catch(() => {});
      await this.prisma.contentPlan
        .update({
          where: { id: plan.id },
          data: { generatedCount: { decrement: 1 } },
        })
        .catch(() => {});
      // The monthly AI slot was reserved but the generation never ran — refund
      // it so a dispatch outage doesn't silently eat the user's quota.
      await this.entitlements.releaseAiGeneration(plan.userId).catch(() => {});
      await this.refreshNextRunAt(plan.id);
      throw err;
    }

    // Refresh the nextRunAt mirror from the remaining planned items, then finish
    // the plan once the cap is hit or the queue is drained. Read the fresh count
    // so the decision is correct under concurrent dispatches.
    await this.refreshNextRunAt(plan.id);
    const fresh = await this.prisma.contentPlan.findUnique({
      where: { id: plan.id },
      select: { generatedCount: true, totalTarget: true },
    });
    const reachedCap =
      fresh?.totalTarget != null && fresh.generatedCount >= fresh.totalTarget;
    const moreLeft = await this.prisma.contentPlanItem.count({
      where: { planId: plan.id, status: 'planned' },
    });
    if (reachedCap || moreLeft === 0) {
      await this.markCompleted(plan.id);
    }

    return createdJobId;
  }

  /**
   * Repairs state a crash can strand, none of which the normal dispatch path
   * ever revisits (it only considers `planned` items and due `nextRunAt`s):
   *
   *  - `queued` items with no ArticleJob (process died between the item claim
   *    and job creation) → released back to `planned` so they retry. Any plan
   *    slot / monthly AI slot the crash may have leaked is deliberately NOT
   *    refunded: we can't tell whether the reservation happened, and an
   *    over-refund could overrun the plan cap — which, under autoPublish,
   *    means over-publishing. Under-generation is the safer failure.
   *  - active plans whose `nextRunAt` mirror is stale (NULL while dated
   *    planned items remain) → refreshed so the due-plan scan sees them again.
   *  - active plans with a reached cap and no due tick coming → completed.
   *  - active plans with no live work at all (no planned/queued/generating
   *    item, e.g. the final item failed) → completed, instead of sitting
   *    "active" forever.
   *
   * Stuck ArticleJobs themselves are reaped by ArticleGenerationService's
   * sweep; their plan items follow via syncPlanItem.
   */
  private async recoverWedgedPlans(): Promise<void> {
    const now = Date.now();
    const orphanCutoff = new Date(now - 15 * 60 * 1000);

    const orphans = await this.prisma.contentPlanItem.findMany({
      where: {
        status: 'queued',
        articleJobId: null,
        updatedAt: { lt: orphanCutoff },
      },
      select: { id: true, planId: true },
      take: 50,
    });
    if (orphans.length > 0) {
      await this.prisma.contentPlanItem.updateMany({
        where: { id: { in: orphans.map((o) => o.id) } },
        data: { status: 'planned' },
      });
      this.logger.warn(
        `released ${orphans.length} orphaned queued item(s) back to planned`,
      );
      for (const planId of new Set(orphans.map((o) => o.planId))) {
        await this.refreshNextRunAt(planId);
      }
    }

    // Stale mirror: the plan lost its nextRunAt (e.g. a crash between item
    // claim and the refresh) while dated planned items remain.
    const staleMirrors = await this.prisma.contentPlan.findMany({
      where: {
        status: 'active',
        nextRunAt: null,
        items: { some: { status: 'planned', scheduledFor: { not: null } } },
      },
      select: { id: true },
      take: 25,
    });
    for (const { id } of staleMirrors) {
      await this.refreshNextRunAt(id);
    }

    // Cap reached but no due tick will ever fire (undated items → nextRunAt
    // stays NULL after the refresh above): finish the plan here, mirroring
    // dispatchNext's fast path.
    const capCandidates = await this.prisma.contentPlan.findMany({
      where: { status: 'active', totalTarget: { not: null }, nextRunAt: null },
      select: { id: true, generatedCount: true, totalTarget: true },
      take: 50,
    });
    for (const p of capCandidates) {
      if (p.totalTarget != null && p.generatedCount >= p.totalTarget) {
        await this.markCompleted(p.id);
      }
    }

    // No live work left (last item finished as failed/skipped outside
    // dispatchNext, so its completion check never ran). The age guard keeps a
    // just-created plan from completing before its items are visible.
    const doneCutoff = new Date(now - 15 * 60 * 1000);
    const finished = await this.prisma.contentPlan.findMany({
      where: {
        status: 'active',
        createdAt: { lt: doneCutoff },
        items: {
          none: { status: { in: ['planned', 'queued', 'generating'] } },
        },
      },
      select: { id: true },
      take: 25,
    });
    for (const { id } of finished) {
      await this.markCompleted(id);
    }
  }

  /** Release a claimed item back to `planned` (best-effort). */
  private async releaseItem(itemId: string): Promise<void> {
    await this.prisma.contentPlanItem
      .updateMany({
        where: { id: itemId, status: 'queued' },
        data: { status: 'planned' },
      })
      .catch(() => {});
  }

  /**
   * Mirror plan.nextRunAt = min(scheduledFor) of remaining PLANNED items so the
   * list UI's "next article in …" stays correct and runDuePlans' cheap indexed
   * pre-filter still catches this plan. Never the source of dispatch truth — the
   * item's scheduledFor is. Only touches active plans.
   */
  private async refreshNextRunAt(planId: string): Promise<void> {
    const next = await this.prisma.contentPlanItem.aggregate({
      where: { planId, status: 'planned', scheduledFor: { not: null } },
      _min: { scheduledFor: true },
    });
    await this.prisma.contentPlan
      .updateMany({
        where: { id: planId, status: 'active' },
        data: { nextRunAt: next._min.scheduledFor ?? null },
      })
      .catch(() => {});
  }

  /**
   * Unified, site-scoped feed for the planner calendar: scheduled/published/draft
   * blog posts PLUS upcoming AI plan items (planned/queued/generating) on their
   * own dates. `done`/`failed`/`skipped` items are omitted — a done item already
   * shows as its draft Blog, so including it would draw the article twice.
   */
  async getCalendar(userId: string, siteId: string) {
    const [blogs, items] = await Promise.all([
      this.prisma.blog.findMany({
        where: { siteId, authorId: userId },
        select: {
          id: true,
          title: true,
          slug: true,
          published: true,
          scheduledAt: true,
          publishedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.contentPlanItem.findMany({
        where: {
          plan: { siteId, userId, status: { in: ['active', 'paused'] } },
          status: { in: ['planned', 'queued', 'generating'] },
          scheduledFor: { not: null },
        },
        select: {
          id: true,
          title: true,
          status: true,
          scheduledFor: true,
          planId: true,
          plan: { select: { title: true } },
        },
      }),
    ]);

    const blogEvents = blogs.map((b) => {
      let variant: 'scheduled' | 'published' | 'draft';
      let start: Date;
      if (b.scheduledAt) {
        variant = 'scheduled';
        start = b.scheduledAt;
      } else if (b.published) {
        variant = 'published';
        start = b.publishedAt ?? b.createdAt;
      } else {
        variant = 'draft';
        start = b.createdAt;
      }
      return {
        kind: 'blog' as const,
        id: b.id,
        title: b.title,
        slug: b.slug,
        start,
        end: start,
        allDay: true,
        variant,
        published: b.published,
        scheduledAt: b.scheduledAt,
      };
    });

    const planEvents = items.map((i) => ({
      kind: 'plan' as const,
      id: i.id,
      planId: i.planId,
      planTitle: i.plan.title,
      title: i.title,
      start: i.scheduledFor as Date,
      end: i.scheduledFor as Date,
      allDay: true,
      variant:
        i.status === 'planned'
          ? ('ai-planned' as const)
          : ('ai-generating' as const),
      status: i.status,
    }));

    return [...blogEvents, ...planEvents];
  }

  private async markCompleted(planId: string): Promise<void> {
    // Scope the transition to non-completed rows so overlapping dispatchers
    // (cron tick + manual run) can't each fire a "plan finished" notification.
    const res = await this.prisma.contentPlan.updateMany({
      where: { id: planId, status: { not: 'completed' } },
      data: { status: 'completed', nextRunAt: null },
    });
    if (res.count !== 1) return; // already completed elsewhere

    const plan = await this.prisma.contentPlan.findUnique({
      where: { id: planId },
      select: { userId: true, title: true, generatedCount: true },
    });
    if (!plan) return;
    await this.notifications.emit(plan.userId, {
      type: NotificationType.PlanCompleted,
      title: `Autopilot finished: ${plan.title}`,
      body: `Your content plan generated ${plan.generatedCount} article${
        plan.generatedCount === 1 ? '' : 's'
      }.`,
      link: `/autopilot/${planId}`,
      meta: { planId },
    });
  }

  private async ensureOwned(userId: string, id: string) {
    const plan = await this.prisma.contentPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Content plan not found');
    if (plan.userId !== userId) throw new ForbiddenException();
    return plan;
  }
}
