import { Test, TestingModule } from '@nestjs/testing';
import { ArticleGenerationService } from './article-generation.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { BlogService } from '../blog/blog.service';
import { AiService } from './ai.service';
import { ImageGenerationService } from './image-generation.service';
import { BacklinkService } from '../backlink/backlink.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

describe('ArticleGenerationService — reapStuckJobs', () => {
  let service: ArticleGenerationService;
  let prisma: any;
  let queue: any;
  let notifications: any;
  let entitlements: any;

  beforeEach(async () => {
    prisma = {
      articleJob: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      contentPlanItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    queue = { enqueue: jest.fn(), consume: jest.fn() };
    notifications = { emit: jest.fn() };
    entitlements = {
      releaseAiGeneration: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleGenerationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: { isConfigured: () => true } },
        { provide: BlogService, useValue: {} },
        { provide: QueueService, useValue: queue },
        { provide: NotificationsService, useValue: notifications },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: ImageGenerationService, useValue: {} },
        { provide: BacklinkService, useValue: {} },
      ],
    }).compile();

    service = module.get(ArticleGenerationService);
  });

  const stuckJob = {
    id: 'job1',
    authorId: 'u1',
    topic: 'Topic',
    contentPlanId: null,
  };

  it('fails a long-running job, refunds the AI slot, and notifies', async () => {
    prisma.articleJob.findMany
      .mockResolvedValueOnce([stuckJob]) // running sweep
      .mockResolvedValue([]); // pending sweeps

    await service.reapStuckJobs();

    expect(prisma.articleJob.updateMany).toHaveBeenCalledWith({
      where: { id: 'job1', status: 'running' },
      data: expect.objectContaining({ status: 'failed' }),
    });
    expect(entitlements.releaseAiGeneration).toHaveBeenCalledWith('u1');
    expect(notifications.emit).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ title: 'Article generation failed' }),
    );
  });

  it('does nothing further when the atomic flip loses the race', async () => {
    prisma.articleJob.findMany
      .mockResolvedValueOnce([stuckJob])
      .mockResolvedValue([]);
    prisma.articleJob.updateMany.mockResolvedValue({ count: 0 });

    await service.reapStuckJobs();

    expect(entitlements.releaseAiGeneration).not.toHaveBeenCalled();
    expect(notifications.emit).not.toHaveBeenCalled();
  });

  it('mirrors failure onto the plan item for autopilot jobs', async () => {
    prisma.articleJob.findMany
      .mockResolvedValueOnce([{ ...stuckJob, contentPlanId: 'plan1' }])
      .mockResolvedValue([]);

    await service.reapStuckJobs();

    expect(prisma.contentPlanItem.updateMany).toHaveBeenCalledWith({
      where: { articleJobId: 'job1' },
      data: { status: 'failed' },
    });
  });

  it('re-dispatches a stale pending job instead of failing it', async () => {
    prisma.articleJob.findMany
      .mockResolvedValueOnce([]) // running sweep
      .mockResolvedValueOnce([]) // abandoned sweep
      .mockResolvedValueOnce([{ id: 'job2' }]); // stale sweep

    await service.reapStuckJobs();

    expect(queue.enqueue).toHaveBeenCalledWith('article.generate', {
      jobId: 'job2',
    });
    expect(notifications.emit).not.toHaveBeenCalled();
  });

  it('fails day-old pending jobs outright with a refund', async () => {
    prisma.articleJob.findMany
      .mockResolvedValueOnce([]) // running sweep
      .mockResolvedValueOnce([stuckJob]) // abandoned sweep
      .mockResolvedValue([]);

    await service.reapStuckJobs();

    expect(prisma.articleJob.updateMany).toHaveBeenCalledWith({
      where: { id: 'job1', status: 'pending' },
      data: expect.objectContaining({ status: 'failed' }),
    });
    expect(entitlements.releaseAiGeneration).toHaveBeenCalledWith('u1');
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('never rejects even when the sweep queries fail', async () => {
    prisma.articleJob.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.reapStuckJobs()).resolves.toBeUndefined();
  });
});
