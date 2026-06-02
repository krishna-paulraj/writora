import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { BlogService } from '../blog/blog.service';
import { AiService, ArticleInput, ArticleLength, Tone } from './ai.service';
import { GenerateArticleDto } from './dto/generate-article.dto';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

const ARTICLE_GEN_QUEUE = 'article.generate';

interface ArticleGenJob {
  jobId: string;
}

export interface PlanJobInput {
  authorId: string;
  siteId: string;
  contentPlanId: string;
  topic: string;
  targetKeyword?: string | null;
  relatedKeywords?: string[];
  tone?: string;
  length?: string;
  audience?: string | null;
  category?: string | null;
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || 'article';
}

@Injectable()
export class ArticleGenerationService implements OnModuleInit {
  private readonly logger = new Logger(ArticleGenerationService.name);

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private blog: BlogService,
    private queue: QueueService,
    private notifications: NotificationsService,
    private entitlements: EntitlementsService,
  ) {}

  async onModuleInit() {
    await this.queue.consume<ArticleGenJob>(
      ARTICLE_GEN_QUEUE,
      (job) => this.run(job.jobId),
      { prefetch: 1 },
    );
  }

  async enqueue(authorId: string, siteId: string, dto: GenerateArticleDto) {
    if (!dto?.topic || dto.topic.trim().length === 0) {
      throw new BadRequestException('topic is required');
    }
    if (!this.ai.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI is not configured on this server',
      );
    }
    // Reserve a monthly AI slot atomically (throws 403 over-limit) BEFORE
    // creating the job, so failed retries can't farm extra generations.
    await this.entitlements.assertCanGenerateAi(authorId);

    const related = (dto.relatedKeywords ?? [])
      .map((k) => k.trim())
      .filter(Boolean);

    const job = await this.prisma.articleJob.create({
      data: {
        authorId,
        siteId,
        status: 'pending',
        topic: dto.topic.trim(),
        targetKeyword: dto.targetKeyword?.trim() || null,
        keywordData: {
          targetKeyword: dto.targetKeyword?.trim() || null,
          relatedKeywords: related,
        },
        tone: dto.tone ?? 'professional',
        length: dto.length ?? 'medium',
        audience: dto.audience?.trim() || null,
        category: dto.category?.trim() || null,
      },
    });

    await this.queue.enqueue<ArticleGenJob>(ARTICLE_GEN_QUEUE, {
      jobId: job.id,
    });

    return { jobId: job.id, status: job.status };
  }

  /**
   * Creates an autopilot ArticleJob row WITHOUT enqueuing it. The caller (the
   * content-plan dispatcher) links the originating ContentPlanItem to the
   * returned id before calling {@link dispatch}, so the queue consumer — which
   * may run inline when RabbitMQ is disabled — always sees the linked item.
   */
  async createJobForPlan(input: PlanJobInput): Promise<string> {
    const related = (input.relatedKeywords ?? [])
      .map((k) => k.trim())
      .filter(Boolean);

    const job = await this.prisma.articleJob.create({
      data: {
        authorId: input.authorId,
        siteId: input.siteId,
        status: 'pending',
        topic: input.topic.trim(),
        targetKeyword: input.targetKeyword?.trim() || null,
        keywordData: {
          targetKeyword: input.targetKeyword?.trim() || null,
          relatedKeywords: related,
        },
        tone: input.tone ?? 'professional',
        length: input.length ?? 'medium',
        audience: input.audience?.trim() || null,
        category: input.category?.trim() || null,
        source: 'autopilot',
        contentPlanId: input.contentPlanId,
      },
    });

    return job.id;
  }

  /** Enqueues an already-created job onto the generation queue. */
  async dispatch(jobId: string): Promise<void> {
    await this.queue.enqueue<ArticleGenJob>(ARTICLE_GEN_QUEUE, { jobId });
  }

  async getJob(authorId: string, jobId: string) {
    const job = await this.prisma.articleJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        progress: true,
        topic: true,
        blogId: true,
        error: true,
        authorId: true,
        createdAt: true,
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.authorId !== authorId) throw new ForbiddenException();
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      topic: job.topic,
      blogId: job.blogId,
      error: job.error,
      createdAt: job.createdAt,
    };
  }

  async listJobs(authorId: string) {
    return this.prisma.articleJob.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        progress: true,
        topic: true,
        blogId: true,
        error: true,
        createdAt: true,
      },
    });
  }

  /**
   * Queue handler. Idempotent: a redelivered or duplicate message is a no-op
   * once the job has left `pending` — the atomic pending→running claim below
   * guarantees only one delivery generates, so a redelivery can never create a
   * second (possibly auto-published) draft. Deterministic failures are recorded
   * on the job and NOT rethrown, so the queue doesn't pointlessly re-run them.
   */
  private async run(jobId: string): Promise<void> {
    const job = await this.prisma.articleJob.findUnique({
      where: { id: jobId },
    });
    if (!job) return;
    if (job.status === 'done' || job.blogId) return; // already produced a draft

    // Atomically claim the job. Only the delivery that flips pending→running
    // proceeds; concurrent/redelivered messages (status already running/done)
    // see count 0 and bail, so generation never runs twice for one job.
    const claim = await this.prisma.articleJob.updateMany({
      where: { id: jobId, status: 'pending' },
      data: { status: 'running', progress: 0, startedAt: new Date() },
    });
    if (claim.count !== 1) return;
    if (job.contentPlanId) await this.syncPlanItem(jobId, 'generating');

    try {
      const kd = (job.keywordData ?? {}) as unknown as {
        relatedKeywords?: unknown;
      };
      const relatedKeywords = Array.isArray(kd.relatedKeywords)
        ? kd.relatedKeywords.filter((k): k is string => typeof k === 'string')
        : undefined;
      const input: ArticleInput = {
        topic: job.topic,
        targetKeyword: job.targetKeyword ?? undefined,
        relatedKeywords,
        tone: job.tone as Tone,
        length: job.length as ArticleLength,
        audience: job.audience ?? undefined,
      };

      const article = await this.ai.generateArticle(input, (progress) =>
        this.updateProgress(jobId, progress),
      );

      const title = article.titleOptions[0]?.trim() || job.topic;
      const slug = await this.uniqueSlug(job.authorId, title);
      const description =
        article.metaDescription.trim() || job.topic.slice(0, 160);

      // The background worker reads siteId off the job (it can't derive an
      // "active site" — there's no request), landing the draft on the right site.
      const draft = await this.blog.create(job.authorId, job.siteId, {
        title,
        slug,
        description,
        content: article.contentHtml,
        category: job.category?.trim() || 'General',
        targetKeyword: job.targetKeyword ?? undefined,
        published: false,
      });

      await this.prisma.articleJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          progress: 100,
          blogId: draft.id,
          outline: article.outline as unknown as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });

      if (job.contentPlanId) {
        await this.syncPlanItem(jobId, 'done');
        await this.maybeAutoPublish(job.contentPlanId, job.authorId, draft.id);
      }

      await this.notifications.emit(job.authorId, {
        type: NotificationType.ArticleCompleted,
        title: `Article ready: ${title}`,
        body: 'Your draft has been generated and is ready to review.',
        link: job.contentPlanId ? `/autopilot/${job.contentPlanId}` : '/blogs',
        meta: { blogId: draft.id, jobId, planId: job.contentPlanId },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`article job ${jobId} failed: ${message}`);
      await this.prisma.articleJob.update({
        where: { id: jobId },
        data: { status: 'failed', error: message, finishedAt: new Date() },
      });
      if (job.contentPlanId) await this.syncPlanItem(jobId, 'failed');

      await this.notifications.emit(job.authorId, {
        type: NotificationType.ArticleFailed,
        title: 'Article generation failed',
        body: `“${job.topic}” couldn’t be generated: ${message}`,
        link: job.contentPlanId ? `/autopilot/${job.contentPlanId}` : '/blogs',
        meta: { jobId, planId: job.contentPlanId },
      });
      // Intentionally not rethrown — see method docstring.
    }
  }

  /**
   * Mirrors a finished/running job's state onto its originating
   * ContentPlanItem (linked by articleJobId). Best-effort — the plan UI can
   * also derive state from the job directly, so a race here is harmless.
   */
  private async syncPlanItem(jobId: string, status: string): Promise<void> {
    try {
      await this.prisma.contentPlanItem.updateMany({
        where: { articleJobId: jobId },
        data: { status },
      });
    } catch {
      // best-effort
    }
  }

  /**
   * If the owning plan has autoPublish on, publish the freshly-drafted post
   * through BlogService.update so it follows the normal publish path
   * (sets publishedAt, fires the newsletter + webhook fanout exactly once).
   */
  private async maybeAutoPublish(
    contentPlanId: string,
    authorId: string,
    blogId: string,
  ): Promise<void> {
    try {
      const plan = await this.prisma.contentPlan.findUnique({
        where: { id: contentPlanId },
        select: { autoPublish: true },
      });
      if (!plan?.autoPublish) return;
      await this.blog.update(blogId, authorId, { published: true });
    } catch (err) {
      this.logger.warn(
        `autopilot auto-publish for blog ${blogId} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async updateProgress(jobId: string, progress: number): Promise<void> {
    try {
      await this.prisma.articleJob.update({
        where: { id: jobId },
        data: { progress },
      });
    } catch {
      // Progress is best-effort; ignore races (e.g. job deleted mid-run).
    }
  }

  private async uniqueSlug(authorId: string, title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let n = 1;
    // Probe until a free slug is found; the @@unique([authorId, slug]) still
    // guards against races, but this avoids BlogService.create throwing.
    while (
      await this.prisma.blog.findUnique({
        where: { authorId_slug: { authorId, slug: candidate } },
        select: { id: true },
      })
    ) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }
}
