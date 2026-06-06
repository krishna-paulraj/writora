import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

const STRIPE_API = 'https://api.stripe.com/v1';
const TIMEOUT_MS = 20_000;
const WEBHOOK_TOLERANCE_S = 300;

type PlanName = 'free' | 'pro' | 'business';

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

function profileKey(userId: string) {
  return `auth:profile:${userId}`;
}

/**
 * Stripe integration via the raw REST API (no SDK to install) + node:crypto
 * webhook signature verification. Degrades to 503 when STRIPE_SECRET_KEY is
 * unset — self-host stays fully usable on the free plan.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly secretKey: string | null;
  private readonly webhookSecret: string | null;
  private readonly pricePro: string | null;
  private readonly priceBusiness: string | null;
  private readonly appUrl: string;

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private cache: CacheService,
  ) {
    this.secretKey = config.get<string>('STRIPE_SECRET_KEY') || null;
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') || null;
    this.pricePro = config.get<string>('STRIPE_PRICE_PRO') || null;
    this.priceBusiness = config.get<string>('STRIPE_PRICE_BUSINESS') || null;
    this.appUrl =
      config.get<string>('APP_URL') ||
      config.get<string>('NEXT_PUBLIC_APP_URL') ||
      'http://localhost:3001';
    if (!this.secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — billing endpoints will return 503',
      );
    }
  }

  isConfigured(): boolean {
    return this.secretKey !== null;
  }

  private ensureConfigured(): void {
    if (!this.secretKey) {
      throw new ServiceUnavailableException(
        'Billing is not configured on this server',
      );
    }
  }

  private priceForPlan(plan: string): string | null {
    if (plan === 'pro') return this.pricePro;
    if (plan === 'business') return this.priceBusiness;
    return null;
  }

  private planForPrice(priceId: string | undefined): PlanName | null {
    if (!priceId) return null;
    if (priceId === this.pricePro) return 'pro';
    if (priceId === this.priceBusiness) return 'business';
    return null;
  }

  /** POST form-encoded to the Stripe REST API. Stripe wants form, not JSON. */
  private async stripeFetch(
    path: string,
    params: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<Record<string, unknown>> {
    this.ensureConfigured();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${STRIPE_API}/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: new URLSearchParams(params).toString(),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      if (!res.ok) {
        const err = json?.error as { message?: string } | undefined;
        throw new ServiceUnavailableException(
          `Stripe error: ${err?.message ?? `HTTP ${res.status}`}`.slice(0, 300),
        );
      }
      return json ?? {};
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException('Stripe request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async ensureCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true, name: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripeFetch(
      'customers',
      { email: user.email, name: user.name, 'metadata[userId]': userId },
      `customer_${userId}`, // idempotent — avoids a duplicate-customer race
    );
    const customerId = String(customer.id);
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
    return customerId;
  }

  async createCheckout(userId: string, plan: string): Promise<{ url: string }> {
    this.ensureConfigured();
    const priceId = this.priceForPlan(plan);
    if (!priceId) {
      throw new BadRequestException('Unknown or unavailable plan');
    }
    const customer = await this.ensureCustomer(userId);
    const session = await this.stripeFetch('checkout/sessions', {
      mode: 'subscription',
      customer,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      client_reference_id: userId,
      'subscription_data[metadata][userId]': userId,
      success_url: `${this.appUrl}/billing?status=success`,
      cancel_url: `${this.appUrl}/billing?status=cancelled`,
    });
    const url = session.url;
    if (typeof url !== 'string') {
      throw new ServiceUnavailableException(
        'Stripe did not return a checkout URL',
      );
    }
    return { url };
  }

  async createPortal(userId: string): Promise<{ url: string }> {
    this.ensureConfigured();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No active subscription to manage');
    }
    const session = await this.stripeFetch('billing_portal/sessions', {
      customer: user.stripeCustomerId,
      return_url: `${this.appUrl}/billing`,
    });
    const url = session.url;
    if (typeof url !== 'string') {
      throw new ServiceUnavailableException(
        'Stripe did not return a portal URL',
      );
    }
    return { url };
  }

  /**
   * Verifies a Stripe webhook signature (`Stripe-Signature: t=…,v1=…`) — the
   * same HMAC-SHA256-over `${t}.${payload}` scheme as our outbound webhooks.
   * Throws on a missing/invalid signature or stale timestamp.
   */
  verifyEvent(
    rawBody: string,
    signatureHeader: string | undefined,
  ): StripeEvent {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException(
        'Billing webhook is not configured',
      );
    }
    if (!signatureHeader) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }
    // Parse all k=v pairs. There can be MULTIPLE v1 entries during a webhook
    // secret rotation — accept the event if ANY of them matches (Stripe's own
    // verifier does the same).
    const pairs = signatureHeader.split(',').map((p) => p.split('=', 2));
    const t = pairs.find(([k]) => k === 't')?.[1];
    const v1s = pairs
      .filter(([k]) => k === 'v1')
      .map(([, v]) => v)
      .filter((v): v is string => !!v);
    if (!t || v1s.length === 0) {
      throw new BadRequestException('Malformed signature');
    }

    const ts = Number(t);
    if (
      !Number.isFinite(ts) ||
      Math.abs(Date.now() / 1000 - ts) > WEBHOOK_TOLERANCE_S
    ) {
      throw new BadRequestException('Signature timestamp outside tolerance');
    }

    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${t}.${rawBody}`)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const matches = v1s.some((v1) => {
      const b = Buffer.from(v1, 'hex');
      return a.length === b.length && timingSafeEqual(a, b);
    });
    if (!matches) {
      throw new BadRequestException('Signature verification failed');
    }

    try {
      return JSON.parse(rawBody) as StripeEvent;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }
  }

  /** Applies a verified subscription-lifecycle event to the owning user. */
  async handleEvent(event: StripeEvent): Promise<void> {
    // Idempotency: record the event id before processing. A duplicate (Stripe
    // auto-retry, or a replayed signed body within the tolerance window) hits
    // the primary-key conflict and is skipped, so each lifecycle event is
    // applied at most once.
    if (event.id) {
      try {
        await this.prisma.processedStripeEvent.create({
          data: { id: event.id, type: event.type },
        });
      } catch {
        return; // already processed
      }
    }

    const obj = event.data?.object ?? {};
    switch (event.type) {
      // NB: checkout.session.completed is intentionally NOT mapped here — the
      // session object has no subscription items/status, so it would mis-map the
      // plan to a default and write a non-subscription status. The customer link
      // is already persisted by ensureCustomer at checkout time; the real plan
      // arrives via customer.subscription.created/updated below.
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.applySubscription(obj);
        break;
      case 'customer.subscription.deleted':
        await this.applyCancellation(obj);
        break;
      case 'invoice.payment_failed':
        await this.applyPastDue(obj);
        break;
      default:
        break; // ignore unrelated events
    }
  }

  private async userIdFromObject(
    obj: Record<string, unknown>,
  ): Promise<string | null> {
    const ref = obj.client_reference_id;
    if (typeof ref === 'string' && ref) return ref;
    const meta = obj.metadata as { userId?: string } | undefined;
    if (meta?.userId) return meta.userId;
    const customer =
      typeof obj.customer === 'string' ? obj.customer : undefined;
    if (customer) {
      const u = await this.prisma.user.findUnique({
        where: { stripeCustomerId: customer },
        select: { id: true },
      });
      return u?.id ?? null;
    }
    return null;
  }

  private firstItem(
    obj: Record<string, unknown>,
  ): { price?: { id?: string }; current_period_end?: number } | undefined {
    const items = obj.items as
      | {
          data?: Array<{
            price?: { id?: string };
            current_period_end?: number;
          }>;
        }
      | undefined;
    return items?.data?.[0];
  }

  private extractPriceId(obj: Record<string, unknown>): string | undefined {
    return this.firstItem(obj)?.price?.id;
  }

  // current_period_end moved from the subscription root onto each item in the
  // Stripe "Basil" (2025-03-31+) API versions — read both.
  private extractPeriodEnd(obj: Record<string, unknown>): Date | undefined {
    const root =
      typeof obj.current_period_end === 'number'
        ? obj.current_period_end
        : this.firstItem(obj)?.current_period_end;
    return typeof root === 'number' ? new Date(root * 1000) : undefined;
  }

  private async applySubscription(obj: Record<string, unknown>): Promise<void> {
    const userId = await this.userIdFromObject(obj);
    if (!userId) return;
    const plan = this.planForPrice(this.extractPriceId(obj)) ?? 'pro';
    const status = typeof obj.status === 'string' ? obj.status : 'active';
    const periodEnd = this.extractPeriodEnd(obj);
    const subId = typeof obj.id === 'string' ? obj.id : undefined;

    // Ordering guard: webhooks can arrive out of order, so ignore an event
    // whose period end is older than what we already stored (a stale event
    // must not re-up/downgrade a more recent state).
    if (periodEnd) {
      const existing = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { currentPeriodEnd: true },
      });
      if (existing?.currentPeriodEnd && periodEnd < existing.currentPeriodEnd) {
        return;
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan,
        subscriptionStatus: status,
        ...(subId ? { stripeSubscriptionId: subId } : {}),
        ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
      },
    });
    await this.cache.del(profileKey(userId));
  }

  private async applyCancellation(obj: Record<string, unknown>): Promise<void> {
    const userId = await this.userIdFromObject(obj);
    if (!userId) return;
    // Ordering guard: ignore a cancellation that doesn't pertain to the user's
    // CURRENT subscription. A late/out-of-order `deleted` event for a replaced
    // subscription must not downgrade an already-active newer one.
    const subId = typeof obj.id === 'string' ? obj.id : undefined;
    if (subId && !(await this.isCurrentSubscription(userId, subId))) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: 'free', subscriptionStatus: 'canceled' },
    });
    await this.cache.del(profileKey(userId));
  }

  private async applyPastDue(obj: Record<string, unknown>): Promise<void> {
    const userId = await this.userIdFromObject(obj);
    if (!userId) return;
    // The object here is an invoice; its subscription id lives on .subscription.
    const subId =
      typeof obj.subscription === 'string' ? obj.subscription : undefined;
    if (subId && !(await this.isCurrentSubscription(userId, subId))) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'past_due' },
    });
    await this.cache.del(profileKey(userId));
  }

  /**
   * True when `subId` is the user's recorded current subscription (or none is
   * recorded yet). Guards lifecycle handlers against stale events for old subs.
   */
  private async isCurrentSubscription(
    userId: string,
    subId: string,
  ): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true },
    });
    return !u?.stripeSubscriptionId || u.stripeSubscriptionId === subId;
  }
}
