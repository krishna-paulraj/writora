import { ForbiddenException } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  let prisma: any;
  let service: EntitlementsService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), updateMany: jest.fn() },
      site: { count: jest.fn() },
      publishTarget: { count: jest.fn() },
    };
    service = new EntitlementsService(prisma);
  });

  describe('effectivePlan (paid features gated on subscription status)', () => {
    it.each([
      ['pro', 'active', 'pro'],
      ['pro', 'trialing', 'pro'],
      ['pro', 'past_due', 'pro'], // short grace window
      ['pro', 'canceled', 'free'],
      ['pro', 'incomplete', 'free'], // never paid
      ['pro', 'unpaid', 'free'],
      ['pro', null, 'free'],
      ['business', 'active', 'business'],
      ['free', 'active', 'free'],
    ])('plan=%s status=%s → %s', async (plan, status, expected) => {
      prisma.user.findUnique.mockResolvedValue({
        plan,
        subscriptionStatus: status,
      });
      expect(await service.effectivePlan('u1')).toBe(expected);
    });

    it('treats an unknown user as free', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      expect(await service.effectivePlan('u1')).toBe('free');
    });
  });

  describe('reserveAiGeneration (atomic monthly quota)', () => {
    it('reserves a slot under the free limit and gates the reserve on that limit', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'free',
        subscriptionStatus: null,
      });
      prisma.user.updateMany
        .mockResolvedValueOnce({ count: 0 }) // month rollover (already current)
        .mockResolvedValueOnce({ count: 1 }); // atomic reserve succeeds

      expect(await service.reserveAiGeneration('u1')).toBe(true);
      // The reserve is the 2nd updateMany; its guard uses the free limit (5).
      expect(prisma.user.updateMany.mock.calls[1][0].where.aiUsageCount).toEqual(
        { lt: 5 },
      );
    });

    it('returns false when the monthly limit is already reached', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'free',
        subscriptionStatus: null,
      });
      prisma.user.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 }); // reserve found no row under the cap

      expect(await service.reserveAiGeneration('u1')).toBe(false);
    });

    it('uses the higher pro limit for an entitled pro user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'pro',
        subscriptionStatus: 'active',
      });
      prisma.user.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      await service.reserveAiGeneration('u1');
      expect(prisma.user.updateMany.mock.calls[1][0].where.aiUsageCount).toEqual(
        { lt: 100 },
      );
    });

    it('uses only the free limit for a pro user whose subscription lapsed', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'pro',
        subscriptionStatus: 'canceled',
      });
      prisma.user.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      await service.reserveAiGeneration('u1');
      expect(prisma.user.updateMany.mock.calls[1][0].where.aiUsageCount).toEqual(
        { lt: 5 },
      );
    });
  });

  describe('assertCanGenerateAi', () => {
    it('throws Forbidden when no slot is available', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'free',
        subscriptionStatus: null,
      });
      prisma.user.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(service.assertCanGenerateAi('u1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertCanCreateSite', () => {
    it('throws once the site count reaches the plan limit', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'free',
        subscriptionStatus: null,
      });
      prisma.site.count.mockResolvedValue(1); // free allows 1
      await expect(service.assertCanCreateSite('u1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows creation under the limit', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'pro',
        subscriptionStatus: 'active',
      });
      prisma.site.count.mockResolvedValue(2); // pro allows 5
      await expect(service.assertCanCreateSite('u1')).resolves.toBeUndefined();
    });
  });
});
