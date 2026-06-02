import { Test, TestingModule } from '@nestjs/testing';
import { ContentPlanService } from './content-plan.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ArticleGenerationService } from '../ai/article-generation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

describe('ContentPlanService', () => {
  let service: ContentPlanService;
  let prisma: any;
  let ai: any;
  let articleGen: any;
  let notifications: any;
  let entitlements: any;

  beforeEach(async () => {
    prisma = {
      contentPlan: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      contentPlanItem: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'it1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
        // refreshNextRunAt / addItem read aggregates of the planned items.
        aggregate: jest.fn().mockResolvedValue({
          _min: { scheduledFor: null },
          _max: { position: null, scheduledFor: null },
        }),
      },
      articleJob: {
        findMany: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    ai = {
      isConfigured: jest.fn().mockReturnValue(true),
      generatePlanIdeas: jest.fn(),
    };
    articleGen = { createJobForPlan: jest.fn(), dispatch: jest.fn() };
    notifications = { emit: jest.fn() };
    entitlements = {
      assertAutopilot: jest.fn(),
      hasAutopilot: jest.fn().mockResolvedValue(true),
      reserveAiGeneration: jest.fn().mockResolvedValue(true),
      releaseAiGeneration: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentPlanService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: ai },
        { provide: ArticleGenerationService, useValue: articleGen },
        { provide: NotificationsService, useValue: notifications },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get(ContentPlanService);
  });

  describe('create', () => {
    it('uses explicit items and does not call the AI', async () => {
      prisma.contentPlan.create.mockResolvedValue({ id: 'p1', items: [] });
      await service.create('u1', 'site1', {
        title: 'Plan',
        topic: 'Topic',
        items: [{ title: 'A' }, { title: 'B' }],
      });

      expect(ai.generatePlanIdeas).not.toHaveBeenCalled();
      const data = prisma.contentPlan.create.mock.calls[0][0].data;
      expect(data.userId).toBe('u1');
      expect(data.items.create).toHaveLength(2);
      // Defaults to one article per supplied idea.
      expect(data.totalTarget).toBe(2);
      // Each item gets a real date; the first equals the plan's nextRunAt and
      // the second is one cadence step (weekly default = 7 days) later.
      const [i0, i1] = data.items.create;
      expect(i0.scheduledFor).toEqual(data.nextRunAt);
      expect(i1.scheduledFor.getTime() - i0.scheduledFor.getTime()).toBe(
        7 * 86_400_000,
      );
    });

    it('brainstorms ideas via the AI when none are supplied', async () => {
      ai.generatePlanIdeas.mockResolvedValue([
        { title: 'X', targetKeyword: 'x' },
      ]);
      prisma.contentPlan.create.mockResolvedValue({ id: 'p1', items: [] });

      await service.create('u1', 'site1', {
        title: 'Plan',
        topic: 'Topic',
        articleCount: 1,
      });

      expect(ai.generatePlanIdeas).toHaveBeenCalled();
      const data = prisma.contentPlan.create.mock.calls[0][0].data;
      expect(data.items.create).toHaveLength(1);
    });

    it('throws when brainstorming is needed but AI is unconfigured', async () => {
      ai.isConfigured.mockReturnValue(false);
      await expect(
        service.create('u1', 'site1', {
          title: 'Plan',
          topic: 'Topic',
        }),
      ).rejects.toThrow();
    });

    it('rejects a missing title', async () => {
      await expect(
        service.create('u1', 'site1', { title: '', topic: 'T' }),
      ).rejects.toThrow();
    });
  });

  describe('dispatchNext', () => {
    const activePlan = {
      id: 'p1',
      userId: 'u1',
      status: 'active',
      cadence: 'weekly',
      tone: 'professional',
      length: 'medium',
      audience: null,
      category: null,
      totalTarget: 5,
      generatedCount: 0,
      nextRunAt: new Date(),
    };

    it('claims the item + reserves a plan slot atomically, links before dispatch', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({ ...activePlan });
      prisma.contentPlanItem.findFirst.mockResolvedValue({
        id: 'i1',
        title: 'A',
        targetKeyword: 'a',
        keywords: ['k1'],
      });
      prisma.contentPlanItem.updateMany.mockResolvedValue({ count: 1 }); // item claim
      prisma.contentPlan.updateMany.mockResolvedValue({ count: 1 }); // slot reserve
      articleGen.createJobForPlan.mockResolvedValue('job1');
      prisma.contentPlanItem.update.mockResolvedValue({});
      prisma.contentPlanItem.count.mockResolvedValue(2);
      prisma.contentPlan.update.mockResolvedValue({});

      const jobId = await service.dispatchNext('p1');

      expect(jobId).toBe('job1');
      // The slot reserve is a conditional, atomic increment gated on the cap.
      const reserve = prisma.contentPlan.updateMany.mock.calls[0][0];
      expect(reserve.data.generatedCount).toEqual({ increment: 1 });
      expect(reserve.where.generatedCount).toEqual({ lt: 5 });
      expect(reserve.where.nextRunAt).toBeUndefined(); // manual run: no schedule gate
      expect(articleGen.createJobForPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: 'u1',
          contentPlanId: 'p1',
          topic: 'A',
          relatedKeywords: ['k1'],
        }),
      );
      // Item must be linked to its job BEFORE the job is dispatched.
      expect(prisma.contentPlanItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { articleJobId: 'job1' },
      });
      expect(articleGen.dispatch).toHaveBeenCalledWith('job1');
    });

    it('gates the item claim on the item date when enforceSchedule is set', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({ ...activePlan });
      prisma.contentPlanItem.findFirst.mockResolvedValue({
        id: 'i1',
        title: 'A',
        keywords: [],
        scheduledFor: new Date(),
      });
      prisma.contentPlanItem.updateMany.mockResolvedValue({ count: 1 });
      prisma.contentPlan.updateMany.mockResolvedValue({ count: 1 });
      articleGen.createJobForPlan.mockResolvedValue('job1');
      prisma.contentPlanItem.update.mockResolvedValue({});
      prisma.contentPlanItem.count.mockResolvedValue(2);

      await service.dispatchNext('p1', { enforceSchedule: true });

      // The due-gate now lives on the atomic item claim (first item updateMany)…
      const itemClaim = prisma.contentPlanItem.updateMany.mock.calls[0][0];
      expect(itemClaim.where.scheduledFor).toEqual({ lte: expect.any(Date) });
      // …the candidate query also restricts to due items…
      const find = prisma.contentPlanItem.findFirst.mock.calls[0][0];
      expect(find.where.scheduledFor).toEqual({
        not: null,
        lte: expect.any(Date),
      });
      // …and the plan reserve no longer gates on nextRunAt.
      const reserve = prisma.contentPlan.updateMany.mock.calls[0][0];
      expect(reserve.where.nextRunAt).toBeUndefined();
    });

    it('returns null without dispatching when it loses the item claim', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({ ...activePlan });
      prisma.contentPlanItem.findFirst.mockResolvedValue({
        id: 'i1',
        title: 'A',
        keywords: [],
      });
      prisma.contentPlanItem.updateMany.mockResolvedValue({ count: 0 });

      const jobId = await service.dispatchNext('p1');

      expect(jobId).toBeNull();
      expect(prisma.contentPlan.updateMany).not.toHaveBeenCalled();
      expect(articleGen.createJobForPlan).not.toHaveBeenCalled();
    });

    it('releases the claimed item and bails when the slot reserve is lost (cap/race)', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({ ...activePlan });
      prisma.contentPlanItem.findFirst.mockResolvedValue({
        id: 'i1',
        title: 'A',
        keywords: [],
      });
      prisma.contentPlanItem.updateMany.mockResolvedValue({ count: 1 }); // claim ok
      prisma.contentPlan.updateMany.mockResolvedValue({ count: 0 }); // reserve lost

      const jobId = await service.dispatchNext('p1');

      expect(jobId).toBeNull();
      expect(articleGen.createJobForPlan).not.toHaveBeenCalled();
      // The item is put back to 'planned' so a later slot can use it.
      expect(prisma.contentPlanItem.updateMany).toHaveBeenLastCalledWith({
        where: { id: 'i1', status: 'queued' },
        data: { status: 'planned' },
      });
    });

    it('cleans up the orphan job and gives back the slot when dispatch fails', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({ ...activePlan });
      prisma.contentPlanItem.findFirst.mockResolvedValue({
        id: 'i1',
        title: 'A',
        keywords: [],
      });
      prisma.contentPlanItem.updateMany.mockResolvedValue({ count: 1 });
      prisma.contentPlan.updateMany.mockResolvedValue({ count: 1 });
      articleGen.createJobForPlan.mockResolvedValue('job1');
      prisma.contentPlanItem.update.mockResolvedValue({});
      articleGen.dispatch.mockRejectedValue(new Error('queue down'));
      prisma.articleJob.delete.mockResolvedValue({});
      prisma.contentPlan.update.mockResolvedValue({});

      await expect(service.dispatchNext('p1')).rejects.toThrow('queue down');
      expect(prisma.articleJob.delete).toHaveBeenCalledWith({
        where: { id: 'job1' },
      });
      // The reserved slot is returned so the cap accounting stays correct.
      expect(prisma.contentPlan.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { generatedCount: { decrement: 1 } },
      });
      // ...and the monthly AI slot is refunded since nothing actually generated.
      expect(entitlements.releaseAiGeneration).toHaveBeenCalledWith('u1');
    });

    it('refunds the plan slot when the AI quota is exhausted', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({ ...activePlan });
      prisma.contentPlanItem.findFirst.mockResolvedValue({
        id: 'i1',
        title: 'A',
        keywords: [],
        scheduledFor: new Date(),
      });
      prisma.contentPlanItem.updateMany.mockResolvedValue({ count: 1 }); // claim ok
      prisma.contentPlan.updateMany.mockResolvedValue({ count: 1 }); // plan slot ok
      entitlements.reserveAiGeneration.mockResolvedValue(false); // over monthly quota
      prisma.contentPlan.update.mockResolvedValue({});

      const jobId = await service.dispatchNext('p1');

      expect(jobId).toBeNull();
      expect(articleGen.createJobForPlan).not.toHaveBeenCalled();
      // The plan slot is given back. The item keeps its own scheduledFor, so it
      // simply retries on the next due tick — no nextRunAt rewind needed.
      expect(prisma.contentPlan.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { generatedCount: { decrement: 1 } },
      });
      // No AI slot was consumed, so there is nothing to refund here.
      expect(entitlements.releaseAiGeneration).not.toHaveBeenCalled();
    });

    it('does not complete the plan when items remain but none are due (cron)', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({
        ...activePlan,
        totalTarget: null,
      });
      prisma.contentPlanItem.findFirst.mockResolvedValue(null); // nothing due now

      const jobId = await service.dispatchNext('p1', { enforceSchedule: true });

      expect(jobId).toBeNull();
      // Refreshes the mirror but must NOT mark the plan completed or notify.
      const completed = prisma.contentPlan.updateMany.mock.calls.find(
        (c: any[]) => c[0].data?.status === 'completed',
      );
      expect(completed).toBeUndefined();
      expect(notifications.emit).not.toHaveBeenCalled();
    });

    it('completes the plan when no planned items remain', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({
        ...activePlan,
        totalTarget: null,
      });
      prisma.contentPlanItem.findFirst.mockResolvedValue(null);
      // markCompleted transitions atomically (updateMany scoped to non-completed).
      prisma.contentPlan.updateMany.mockResolvedValue({ count: 1 });

      const jobId = await service.dispatchNext('p1');

      expect(jobId).toBeNull();
      expect(prisma.contentPlan.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', status: { not: 'completed' } },
        data: { status: 'completed', nextRunAt: null },
      });
      // It notifies the owner exactly once on the winning transition.
      expect(notifications.emit).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ type: 'plan.completed' }),
      );
    });

    it('does not notify when the plan was already completed (lost race)', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({
        ...activePlan,
        totalTarget: null,
      });
      prisma.contentPlanItem.findFirst.mockResolvedValue(null);
      prisma.contentPlan.updateMany.mockResolvedValue({ count: 0 }); // already completed

      await service.dispatchNext('p1');

      expect(notifications.emit).not.toHaveBeenCalled();
    });

    it('stops once the article cap is reached', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({
        ...activePlan,
        generatedCount: 5,
        totalTarget: 5,
      });
      prisma.contentPlan.updateMany.mockResolvedValue({ count: 1 });

      const jobId = await service.dispatchNext('p1');

      expect(jobId).toBeNull();
      expect(prisma.contentPlanItem.findFirst).not.toHaveBeenCalled();
    });

    it('does nothing for a paused plan', async () => {
      prisma.contentPlan.findUnique.mockResolvedValue({
        ...activePlan,
        status: 'paused',
      });
      const jobId = await service.dispatchNext('p1');
      expect(jobId).toBeNull();
    });
  });

  describe('runDuePlans', () => {
    it('no-ops when AI is not configured', async () => {
      ai.isConfigured.mockReturnValue(false);
      await service.runDuePlans();
      expect(prisma.contentPlan.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    beforeEach(() => {
      prisma.contentPlan.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        status: 'active',
      });
    });

    it('reschedules a planned item and refreshes the mirror', async () => {
      prisma.contentPlanItem.findUnique.mockResolvedValue({
        id: 'i1',
        planId: 'p1',
        status: 'planned',
      });
      const when = new Date('2026-07-01T09:00:00.000Z').toISOString();

      await service.updateItem('u1', 'p1', 'i1', { scheduledFor: when });

      expect(prisma.contentPlanItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { scheduledFor: new Date(when) },
      });
      // refreshNextRunAt recomputes the mirror.
      expect(prisma.contentPlanItem.aggregate).toHaveBeenCalled();
    });

    it('rejects rescheduling an item past the planned stage', async () => {
      prisma.contentPlanItem.findUnique.mockResolvedValue({
        id: 'i1',
        planId: 'p1',
        status: 'generating',
      });

      await expect(
        service.updateItem('u1', 'p1', 'i1', {
          scheduledFor: new Date().toISOString(),
        }),
      ).rejects.toThrow('Only planned articles can be rescheduled');
    });
  });

  describe('quickAdd', () => {
    it('creates the singleton "Quick adds" plan and adds a dated item', async () => {
      // No existing quick-add plan → it gets created.
      prisma.contentPlan.findFirst.mockResolvedValue(null);
      prisma.contentPlan.create.mockResolvedValue({
        id: 'qa1',
        userId: 'u1',
        siteId: 'site1',
        status: 'active',
        cadence: 'weekly',
        totalTarget: null,
        generatedCount: 0,
        nextRunAt: null,
      });
      // addItem → ensureOwned reads the plan back.
      prisma.contentPlan.findUnique.mockResolvedValue({
        id: 'qa1',
        userId: 'u1',
        status: 'active',
        cadence: 'weekly',
        totalTarget: null,
        generatedCount: 0,
        nextRunAt: null,
      });
      prisma.contentPlanItem.create.mockResolvedValue({ id: 'it1' });
      const when = new Date('2026-07-01T09:00:00.000Z').toISOString();

      const res = await service.quickAdd('u1', 'site1', {
        title: 'Hello',
        scheduledFor: when,
      });

      expect(entitlements.assertAutopilot).toHaveBeenCalledWith('u1');
      expect(prisma.contentPlan.create).toHaveBeenCalled();
      expect(res.planId).toBe('qa1');
      const createArg = prisma.contentPlanItem.create.mock.calls[0][0].data;
      expect(createArg.scheduledFor).toEqual(new Date(when));
    });

    it('rejects a missing title', async () => {
      await expect(
        service.quickAdd('u1', 'site1', {
          title: '',
          scheduledFor: new Date().toISOString(),
        }),
      ).rejects.toThrow();
    });
  });
});
