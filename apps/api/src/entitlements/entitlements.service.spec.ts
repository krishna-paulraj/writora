import { ForbiddenException } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  let prisma: any;
  let cache: any;
  let service: EntitlementsService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), updateMany: jest.fn() },
      site: { count: jest.fn() },
      publishTarget: { count: jest.fn() },
    };
    cache = { incrWithTtl: jest.fn().mockResolvedValue(1) };
    service = new EntitlementsService(prisma, cache);
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
      expect(
        prisma.user.updateMany.mock.calls[1][0].where.aiUsageCount,
      ).toEqual({ lt: 5 });
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
      expect(
        prisma.user.updateMany.mock.calls[1][0].where.aiUsageCount,
      ).toEqual({ lt: 100 });
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
      expect(
        prisma.user.updateMany.mock.calls[1][0].where.aiUsageCount,
      ).toEqual({ lt: 5 });
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

  describe('assertKeywordResearch (DataForSEO credits are paid-plan only)', () => {
    it('blocks the free plan', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'free',
        subscriptionStatus: null,
      });
      await expect(service.assertKeywordResearch('u1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows an active pro plan', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'pro',
        subscriptionStatus: 'active',
      });
      await expect(
        service.assertKeywordResearch('u1'),
      ).resolves.toBeUndefined();
    });

    it('blocks a pro plan whose subscription lapsed', async () => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'pro',
        subscriptionStatus: 'canceled',
      });
      await expect(service.assertKeywordResearch('u1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertAiAssist (daily windowed meter)', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        plan: 'free',
        subscriptionStatus: null,
      });
    });

    it('allows a call under the daily allowance', async () => {
      cache.incrWithTtl.mockResolvedValue(50); // at the free limit, not over
      await expect(service.assertAiAssist('u1')).resolves.toBeUndefined();
    });

    it('throws once the daily allowance is exceeded', async () => {
      cache.incrWithTtl.mockResolvedValue(51);
      await expect(service.assertAiAssist('u1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('fails open when Redis is unavailable (self-host without metering)', async () => {
      cache.incrWithTtl.mockResolvedValue(null);
      await expect(service.assertAiAssist('u1')).resolves.toBeUndefined();
    });

    it('meters against a user+day key', async () => {
      cache.incrWithTtl.mockResolvedValue(1);
      await service.assertAiAssist('u1');
      expect(cache.incrWithTtl).toHaveBeenCalledWith(
        expect.stringMatching(/^ai:assist:u1:\d{4}-\d{2}-\d{2}$/),
        24 * 60 * 60,
      );
    });
  });
});
