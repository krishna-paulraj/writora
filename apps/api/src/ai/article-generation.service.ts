import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { BlogService } from '../blog/blog.service';
import { AiService, ArticleInput, ArticleLength, Tone } from './ai.service';
import { ImageGenerationService } from './image-generation.service';
import { BacklinkService } from '../backlink/backlink.service';
import { GenerateArticleDto } from './dto/generate-article.dto';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

const ARTICLE_GEN_QUEUE = 'article.generate';

// Cap auto-generated inline images per article to bound Recraft spend + latency.
const MAX_INLINE_IMAGES = 3;

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

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
    private imageGen: ImageGenerationService,
    private backlinks: BacklinkService,
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

      // Best-effort imagery: a featured cover + inline section images. Failures
      // here must never fail the article, so illustrate() swallows its own
      // errors and falls back to the un-illustrated content.
      await this.updateProgress(jobId, 92);
      const { contentHtml, imageUrl } = await this.illustrate(
        {
          siteId: job.siteId,
          topic: job.topic,
          targetKeyword: job.targetKeyword,
        },
        {
          title,
          contentHtml: article.contentHtml,
          metaDescription: article.metaDescription,
        },
      );

      // The background worker reads siteId off the job (it can't derive an
      // "active site" — there's no request), landing the draft on the right site.
      const draft = await this.blog.create(job.authorId, job.siteId, {
        title,
        slug,
        description,
        content: contentHtml,
        imageUrl,
        category: job.category?.trim() || 'General',
        targetKeyword: job.targetKeyword ?? undefined,
        published: false,
      });

      // Best-effort: weave outbound cross-site network backlinks into the draft
      // (no-op unless the site is an entitled, enabled network member).
      await this.backlinks
        .placeOutboundForBlog(draft.id)
        .catch((err) =>
          this.logger.warn(`backlink placement failed: ${errMessage(err)}`),
        );

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

  // --- Stuck-job recovery ----------------------------------------------------
  //
  // run() records `failed` only for errors it can catch. A hard crash, OOM, or
  // redeploy mid-generation leaves the row `running` forever: the redelivered
  // queue message no-ops against the pending→running claim and is acked, so
  // nothing ever finishes the job, the user's monthly AI slot stays consumed,
  // and an autopilot item shows "generating" indefinitely. This sweep is the
  // recovery path the claim design otherwise lacks.

  /**
   * A job `running` longer than this is presumed interrupted. Real generations
   * finish well inside it — every provider call carries its own timeout (the
   * slowest legitimate path is a long article plus 4 Recraft calls at 30s each).
   */
  private static readonly STUCK_RUNNING_MS = 30 * 60 * 1000;
  /** A job still `pending` after this long lost its queue message. */
  private static readonly STALE_PENDING_MS = 15 * 60 * 1000;
  /** Pending jobs older than this are abandoned outright instead of re-queued. */
  private static readonly ABANDONED_PENDING_MS = 24 * 60 * 60 * 1000;

  private reaping = false;

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reapStuckJobs(): Promise<void> {
    // Re-entrancy guard: with RabbitMQ off, re-dispatch runs generations inline
    // and a sweep can outlive the cron interval. Never throws — this is also
    // awaited from the external /internal/cron/tick fan-out.
    if (this.reaping) return;
    this.reaping = true;
    try {
      await this.failInterruptedJobs();
      await this.redispatchStalePendingJobs();
    } catch (err) {
      this.logger.warn(`stuck-job sweep failed: ${errMessage(err)}`);
    } finally {
      this.reaping = false;
    }
  }

  private async failInterruptedJobs(): Promise<void> {
    const cutoff = new Date(
      Date.now() - ArticleGenerationService.STUCK_RUNNING_MS,
    );
    const stuck = await this.prisma.articleJob.findMany({
      where: { status: 'running', startedAt: { lt: cutoff } },
      select: { id: true, authorId: true, topic: true, contentPlanId: true },
      take: 20,
    });
    for (const job of stuck) {
      await this.failStrandedJob(
        job,
        'running',
        'Generation was interrupted by a server restart',
      );
    }
  }

  private async redispatchStalePendingJobs(): Promise<void> {
    const now = Date.now();
    const staleCutoff = new Date(
      now - ArticleGenerationService.STALE_PENDING_MS,
    );
    const abandonedCutoff = new Date(
      now - ArticleGenerationService.ABANDONED_PENDING_MS,
    );

    // Pending for a day means re-dispatches haven't landed either — stop
    // retrying and surface the failure.
    const abandoned = await this.prisma.articleJob.findMany({
      where: { status: 'pending', createdAt: { lt: abandonedCutoff } },
      select: { id: true, authorId: true, topic: true, contentPlanId: true },
      take: 20,
    });
    for (const job of abandoned) {
      await this.failStrandedJob(
        job,
        'pending',
        'Generation never started (queue unavailable)',
      );
    }

    // Lost message: enqueue again. Duplicates are harmless — only the delivery
    // that wins the pending→running claim in run() generates.
    const stale = await this.prisma.articleJob.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: staleCutoff, gte: abandonedCutoff },
      },
      select: { id: true },
      take: 20,
    });
    for (const { id } of stale) {
      this.logger.warn(`re-dispatching stale pending job ${id}`);
      await this.dispatch(id).catch((err) =>
        this.logger.warn(`re-dispatch of ${id} failed: ${errMessage(err)}`),
      );
    }
  }

  private async failStrandedJob(
    job: {
      id: string;
      authorId: string;
      topic: string;
      contentPlanId: string | null;
    },
    fromStatus: 'running' | 'pending',
    error: string,
  ): Promise<void> {
    // Atomic flip: if the generation somehow completes concurrently (or another
    // instance reaps first), exactly one transition wins and we bail.
    const claim = await this.prisma.articleJob.updateMany({
      where: { id: job.id, status: fromStatus },
      data: { status: 'failed', error, finishedAt: new Date() },
    });
    if (claim.count !== 1) return;
    this.logger.warn(`reaped stuck ${fromStatus} job ${job.id}: ${error}`);

    // The reserved monthly slot bought the user nothing — give it back.
    await this.entitlements
      .releaseAiGeneration(job.authorId)
      .catch(() => undefined);
    if (job.contentPlanId) await this.syncPlanItem(job.id, 'failed');

    await this.notifications.emit(job.authorId, {
      type: NotificationType.ArticleFailed,
      title: 'Article generation failed',
      body: `“${job.topic}” couldn’t be generated: ${error}`,
      link: job.contentPlanId ? `/autopilot/${job.contentPlanId}` : '/blogs',
      meta: { jobId: job.id, planId: job.contentPlanId },
    });
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

  /**
   * Best-effort imagery for a freshly generated article: a featured cover image
   * (returned as imageUrl) plus inline images spliced after the first
   * {@link MAX_INLINE_IMAGES} H2 sections. Honors the site's imageStyle and
   * autoGenerateImages toggle, and never throws — any failure logs and falls
   * back to the original content so the article still ships.
   */
  private async illustrate(
    job: { siteId: string; topic: string; targetKeyword: string | null },
    article: { title: string; contentHtml: string; metaDescription: string },
  ): Promise<{ contentHtml: string; imageUrl?: string }> {
    const fallback = { contentHtml: article.contentHtml };
    if (!this.imageGen.isConfigured()) return fallback;

    const site = await this.prisma.site
      .findUnique({
        where: { id: job.siteId },
        select: { imageStyle: true, autoGenerateImages: true },
      })
      .catch(() => null);
    if (!site?.autoGenerateImages) return fallback;

    const style = site.imageStyle;

    let imageUrl: string | undefined;
    try {
      const r = await this.imageGen.generateImage({
        kind: 'featured',
        style,
        title: article.title,
        description: article.metaDescription,
        keyword: job.targetKeyword ?? undefined,
      });
      imageUrl = r.url;
    } catch (err) {
      this.logger.warn(`featured image generation failed: ${errMessage(err)}`);
    }

    const contentHtml = await this.illustrateInline(
      article.contentHtml,
      article.title,
      style,
    );

    return { contentHtml, imageUrl };
  }

  /** Generate and splice inline images after each of the first N H2 headings. */
  private async illustrateInline(
    html: string,
    title: string,
    style: string,
  ): Promise<string> {
    const matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
    if (matches.length === 0) return html;
    const targets = matches.slice(0, MAX_INLINE_IMAGES);
    if (matches.length > targets.length) {
      this.logger.log(
        `inline images capped at ${MAX_INLINE_IMAGES} (article has ${matches.length} sections)`,
      );
    }

    const inserts = await Promise.all(
      targets.map(async (m) => {
        const heading = stripTags(m[1]);
        try {
          const r = await this.imageGen.generateImage({
            kind: 'inline',
            style,
            title,
            heading,
          });
          const alt = escapeHtmlAttr(heading || title);
          return {
            end: (m.index ?? 0) + m[0].length,
            html: `\n<figure><img src="${escapeHtmlAttr(r.url)}" alt="${alt}" /></figure>`,
          };
        } catch (err) {
          this.logger.warn(
            `inline image generation failed: ${errMessage(err)}`,
          );
          return null;
        }
      }),
    );

    // Apply insertions back-to-front so earlier match offsets stay valid.
    let out = html;
    const ordered = inserts
      .filter((x): x is { end: number; html: string } => x !== null)
      .sort((a, b) => b.end - a.end);
    for (const ins of ordered) {
      out = out.slice(0, ins.end) + ins.html + out.slice(ins.end);
    }
    return out;
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
