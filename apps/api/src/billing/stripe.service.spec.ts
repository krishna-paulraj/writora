import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { StripeService } from './stripe.service';

const WEBHOOK_SECRET = 'whsec_test_secret';

function makeConfig(overrides: Record<string, string | undefined> = {}) {
  const map: Record<string, string | undefined> = {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRICE_PRO: 'price_pro',
    STRIPE_PRICE_BUSINESS: 'price_business',
    APP_URL: 'https://app.example.com',
    ...overrides,
  };
  return { get: (k: string) => map[k] } as any;
}

const cache = () => ({ del: jest.fn().mockResolvedValue(undefined) }) as any;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function signature(body: string, t: number, secret = WEBHOOK_SECRET) {
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return { t, sig, header: `t=${t},v1=${sig}` };
}

describe('StripeService', () => {
  describe('verifyEvent (webhook signature)', () => {
    const service = new StripeService(makeConfig(), {} as any, cache());
    const body = JSON.stringify({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      data: { object: {} },
    });

    it('accepts a correctly-signed, in-tolerance event', () => {
      const { header } = signature(body, nowSeconds());
      const event = service.verifyEvent(body, header);
      expect(event.id).toBe('evt_1');
      expect(event.type).toBe('customer.subscription.updated');
    });

    it('accepts during secret rotation when ANY v1 matches', () => {
      const t = nowSeconds();
      const { sig } = signature(body, t);
      // A stale/rotated key produces a non-matching v1 alongside the good one.
      const header = `t=${t},v1=deadbeef,v1=${sig}`;
      expect(service.verifyEvent(body, header).id).toBe('evt_1');
    });

    it('rejects a missing signature header', () => {
      expect(() => service.verifyEvent(body, undefined)).toThrow(
        BadRequestException,
      );
    });

    it('rejects a malformed header (no v1)', () => {
      expect(() => service.verifyEvent(body, `t=${nowSeconds()}`)).toThrow(
        /Malformed signature/,
      );
    });

    it('rejects a timestamp outside the tolerance window', () => {
      const { header } = signature(body, nowSeconds() - 10_000);
      expect(() => service.verifyEvent(body, header)).toThrow(/tolerance/);
    });

    it('rejects a signature made with the wrong secret', () => {
      const { header } = signature(body, nowSeconds(), 'whsec_wrong');
      expect(() => service.verifyEvent(body, header)).toThrow(
        /verification failed/,
      );
    });

    it('rejects a tampered body (signature no longer matches)', () => {
      const { header } = signature(body, nowSeconds());
      const tampered = body.replace('evt_1', 'evt_evil');
      expect(() => service.verifyEvent(tampered, header)).toThrow(
        /verification failed/,
      );
    });

    it('503s when no webhook secret is configured', () => {
      const svc = new StripeService(
        makeConfig({ STRIPE_WEBHOOK_SECRET: undefined }),
        {} as any,
        cache(),
      );
      const { header } = signature(body, nowSeconds());
      expect(() => svc.verifyEvent(body, header)).toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('createCheckout (double-subscription guard)', () => {
    it('routes an existing live subscriber to the portal update flow, never a 2nd checkout', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            stripeCustomerId: 'cus_1',
            stripeSubscriptionId: 'sub_1',
            subscriptionStatus: 'active',
            email: 'a@b.c',
            name: 'A',
          }),
        },
      };
      const service = new StripeService(makeConfig(), prisma as any, cache());
      const fetchMock = jest.fn().mockResolvedValue({ url: 'https://portal' });
      (service as any).stripeFetch = fetchMock;

      const res = await service.createCheckout('u1', 'business');

      expect(res).toEqual({ url: 'https://portal' });
      const paths = fetchMock.mock.calls.map((c) => c[0]);
      expect(paths).toContain('billing_portal/sessions');
      expect(paths).not.toContain('checkout/sessions');
      const portalParams = fetchMock.mock.calls.find(
        (c) => c[0] === 'billing_portal/sessions',
      )![1];
      expect(portalParams['flow_data[type]']).toBe('subscription_update');
      expect(portalParams['flow_data[subscription_update][subscription]']).toBe(
        'sub_1',
      );
    });

    it('falls back to the plain portal if the deep-linked update flow errors', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            stripeCustomerId: 'cus_1',
            stripeSubscriptionId: 'sub_1',
            subscriptionStatus: 'active',
            email: 'a@b.c',
            name: 'A',
          }),
        },
      };
      const service = new StripeService(makeConfig(), prisma as any, cache());
      const fetchMock = jest
        .fn()
        .mockRejectedValueOnce(new Error('portal not configured for updates'))
        .mockResolvedValueOnce({ url: 'https://portal-home' });
      (service as any).stripeFetch = fetchMock;

      const res = await service.createCheckout('u1', 'business');

      expect(res).toEqual({ url: 'https://portal-home' });
      // Second (fallback) call carries no flow_data deep link.
      expect(fetchMock.mock.calls[1][1]['flow_data[type]']).toBeUndefined();
    });

    it('opens a normal checkout for a lapsed (canceled) user re-subscribing', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            stripeCustomerId: 'cus_1',
            stripeSubscriptionId: null,
            subscriptionStatus: 'canceled',
            email: 'a@b.c',
            name: 'A',
          }),
        },
      };
      const service = new StripeService(makeConfig(), prisma as any, cache());
      const fetchMock = jest
        .fn()
        .mockResolvedValue({ url: 'https://checkout', id: 'cs_1' });
      (service as any).stripeFetch = fetchMock;

      const res = await service.createCheckout('u1', 'pro');

      expect(res).toEqual({ url: 'https://checkout' });
      const paths = fetchMock.mock.calls.map((c) => c[0]);
      expect(paths).toContain('checkout/sessions');
      expect(paths).not.toContain('billing_portal/sessions');
    });

    it('rejects an unknown plan before any Stripe call', async () => {
      const prisma = { user: { findUnique: jest.fn() } };
      const service = new StripeService(makeConfig(), prisma as any, cache());
      const fetchMock = jest.fn();
      (service as any).stripeFetch = fetchMock;

      await expect(service.createCheckout('u1', 'enterprise')).rejects.toThrow(
        BadRequestException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('503s when Stripe is not configured', async () => {
      const service = new StripeService(
        makeConfig({ STRIPE_SECRET_KEY: undefined }),
        {} as any,
        cache(),
      );
      await expect(service.createCheckout('u1', 'pro')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('handleEvent (idempotency + mapping)', () => {
    it('applies a subscription.updated event exactly once', async () => {
      const prisma = {
        processedStripeEvent: { create: jest.fn().mockResolvedValue({}) },
        user: {
          findUnique: jest.fn().mockResolvedValue({ currentPeriodEnd: null }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const service = new StripeService(makeConfig(), prisma as any, cache());

      await service.handleEvent({
        id: 'evt_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1',
            status: 'active',
            customer: 'cus_1',
            metadata: { userId: 'u1' },
            items: {
              data: [
                {
                  price: { id: 'price_pro' },
                  current_period_end: 1_700_000_000,
                },
              ],
            },
          },
        },
      });

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.plan).toBe('pro');
      expect(data.subscriptionStatus).toBe('active');
      expect(data.stripeSubscriptionId).toBe('sub_1');
    });

    it('skips a duplicate event (idempotency-ledger conflict)', async () => {
      const prisma = {
        processedStripeEvent: {
          create: jest.fn().mockRejectedValue(new Error('unique constraint')),
        },
        user: { findUnique: jest.fn(), update: jest.fn() },
      };
      const service = new StripeService(makeConfig(), prisma as any, cache());

      await service.handleEvent({
        id: 'evt_1',
        type: 'customer.subscription.updated',
        data: { object: { metadata: { userId: 'u1' } } },
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('downgrades to free on subscription.deleted for the current sub', async () => {
      const prisma = {
        processedStripeEvent: { create: jest.fn().mockResolvedValue({}) },
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ stripeSubscriptionId: 'sub_1' }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const service = new StripeService(makeConfig(), prisma as any, cache());

      await service.handleEvent({
        id: 'evt_2',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1', metadata: { userId: 'u1' } } },
      });

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.plan).toBe('free');
      expect(data.subscriptionStatus).toBe('canceled');
    });
  });
});
