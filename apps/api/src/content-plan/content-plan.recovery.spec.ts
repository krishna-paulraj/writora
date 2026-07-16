import { Test, TestingModule } from '@nestjs/testing';
import { ContentPlanService } from './content-plan.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ArticleGenerationService } from '../ai/article-generation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

describe('ContentPlanService — recoverWedgedPlans (via runDuePlans)', () => {
  let service: ContentPlanService;
  let prisma: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      contentPlan: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      contentPlanItem: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _min: { scheduledFor: null } }),
      },
    };
    notifications = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentPlanService,
        { provide: PrismaService, useValue: prisma },
        // AI unconfigured: proves recovery runs even without a key.
        { provide: AiService, useValue: { isConfigured: () => false } },
        { provide: ArticleGenerationService, useValue: {} },
        { provide: NotificationsService, useValue: notifications },
        { provide: EntitlementsService, useValue: {} },
      ],
    }).compile();

    service = module.get(ContentPlanService);
  });

  it('releases orphaned queued items (no job) back to planned', async () => {
    prisma.contentPlanItem.findMany.mockResolvedValueOnce([
      { id: 'i1', planId: 'p1' },
      { id: 'i2', planId: 'p1' },
    ]);

    await service.runDuePlans();

    expect(prisma.contentPlanItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['i1', 'i2'] } },
      data: { status: 'planned' },
    });
    // nextRunAt mirror refreshed for the affected plan
    expect(prisma.contentPlanItem.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ planId: 'p1' }),
      }),
    );
  });

  it('completes an active plan whose cap is reached and never ticks again', async () => {
    prisma.contentPlan.findMany
      .mockResolvedValueOnce([]) // stale mirrors
      .mockResolvedValueOnce([
        { id: 'p2', generatedCount: 5, totalTarget: 5 },
        { id: 'p3', generatedCount: 2, totalTarget: 5 },
      ]) // cap candidates
      .mockResolvedValueOnce([]); // finished sweep
    prisma.contentPlan.findUnique.mockResolvedValue({
      userId: 'u1',
      title: 'Plan',
      generatedCount: 5,
    });

    await service.runDuePlans();

    // only the capped plan is completed
    expect(prisma.contentPlan.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.contentPlan.updateMany).toHaveBeenCalledWith({
      where: { id: 'p2', status: { not: 'completed' } },
      data: { status: 'completed', nextRunAt: null },
    });
  });

  it('completes an active plan with no live items left', async () => {
    prisma.contentPlan.findMany
      .mockResolvedValueOnce([]) // stale mirrors
      .mockResolvedValueOnce([]) // cap candidates
      .mockResolvedValueOnce([{ id: 'p4' }]); // finished sweep
    prisma.contentPlan.findUnique.mockResolvedValue({
      userId: 'u1',
      title: 'Plan',
      generatedCount: 3,
    });

    await service.runDuePlans();

    expect(prisma.contentPlan.updateMany).toHaveBeenCalledWith({
      where: { id: 'p4', status: { not: 'completed' } },
      data: { status: 'completed', nextRunAt: null },
    });
    expect(notifications.emit).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        title: expect.stringContaining('Autopilot finished'),
      }),
    );
  });

  it('swallows recovery errors so the scheduler tick survives', async () => {
    prisma.contentPlanItem.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.runDuePlans()).resolves.toBeUndefined();
  });
});
