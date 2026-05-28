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

const ARTICLE_GEN_QUEUE = 'article.generate';

interface ArticleGenJob {
  jobId: string;
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
  ) {}

  async onModuleInit() {
    await this.queue.consume<ArticleGenJob>(
      ARTICLE_GEN_QUEUE,
      (job) => this.run(job.jobId),
      { prefetch: 1 },
    );
  }

  async enqueue(authorId: string, dto: GenerateArticleDto) {
    if (!dto?.topic || dto.topic.trim().length === 0) {
      throw new BadRequestException('topic is required');
    }
    if (!this.ai.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI is not configured on this server',
      );
    }

    const related = (dto.relatedKeywords ?? [])
      .map((k) => k.trim())
      .filter(Boolean);

    const job = await this.prisma.articleJob.create({
      data: {
        authorId,
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
   * Queue handler. Idempotent: a redelivered message for an already-finished
   * job is a no-op. Deterministic failures are recorded on the job and NOT
   * rethrown, so the queue doesn't pointlessly re-run them.
   */
  private async run(jobId: string): Promise<void> {
    const job = await this.prisma.articleJob.findUnique({
      where: { id: jobId },
    });
    if (!job) return;
    if (job.status === 'done' || job.blogId) return; // already produced a draft

    await this.prisma.articleJob.update({
      where: { id: jobId },
      data: { status: 'running', progress: 0, startedAt: new Date() },
    });

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

      const draft = await this.blog.create(job.authorId, {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`article job ${jobId} failed: ${message}`);
      await this.prisma.articleJob.update({
        where: { id: jobId },
        data: { status: 'failed', error: message, finishedAt: new Date() },
      });
      // Intentionally not rethrown — see method docstring.
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
