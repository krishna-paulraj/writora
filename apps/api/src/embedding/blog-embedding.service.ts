import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { EmbeddingService } from './embedding.service';

export const EMBED_BLOG_QUEUE = 'embedding.blog';

interface EmbedJob {
  blogId: string;
}

export interface SimilarBlog {
  blogId: string;
  score: number; // cosine similarity in [0,1], higher = more similar
}

function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes and stores a blog's semantic embedding (pgvector), and exposes
 * nearest-neighbour search. Embedding is queued on publish/content-change and
 * is best-effort + idempotent (skips when the source text is unchanged).
 */
@Injectable()
export class BlogEmbeddingService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private embeddings: EmbeddingService,
  ) {}

  async onModuleInit() {
    await this.queue.consume<EmbedJob>(
      EMBED_BLOG_QUEUE,
      (job) => this.computeForBlog(job.blogId),
      { prefetch: 2 },
    );
  }

  /** Fire-and-forget enqueue (used from the publish path). */
  async enqueue(blogId: string): Promise<void> {
    await this.queue.enqueue<EmbedJob>(EMBED_BLOG_QUEUE, { blogId });
  }

  /** Idempotent: embeds a published blog and upserts the vector row. */
  async computeForBlog(blogId: string): Promise<void> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      select: {
        id: true,
        title: true,
        description: true,
        targetKeyword: true,
        content: true,
        published: true,
      },
    });
    // Only live posts participate in similarity/network matching.
    if (!blog || !blog.published) return;
    if (!this.embeddings.isConfigured()) return;

    const text = [
      blog.title,
      blog.targetKeyword ?? '',
      blog.description,
      toPlainText(blog.content).slice(0, 4000),
    ]
      .filter(Boolean)
      .join('\n');
    const contentHash = createHash('sha256').update(text).digest('hex');

    const existing = await this.prisma.blogEmbedding.findUnique({
      where: { blogId },
      select: { contentHash: true },
    });
    if (existing?.contentHash === contentHash) return; // unchanged — skip

    const vector = await this.embeddings.embed(text);
    if (!vector) return;
    const literal = this.embeddings.toVectorLiteral(vector);

    await this.prisma.$executeRaw`
      INSERT INTO "BlogEmbedding" ("blogId", "embedding", "model", "contentHash", "updatedAt")
      VALUES (${blogId}, ${literal}::vector, ${this.embeddings.model}, ${contentHash}, NOW())
      ON CONFLICT ("blogId") DO UPDATE SET
        "embedding" = EXCLUDED."embedding",
        "model" = EXCLUDED."model",
        "contentHash" = EXCLUDED."contentHash",
        "updatedAt" = NOW()
    `;
  }

  /** Remove a blog's embedding (e.g. on unpublish). */
  async remove(blogId: string): Promise<void> {
    await this.prisma.blogEmbedding
      .delete({ where: { blogId } })
      .catch(() => undefined);
  }

  /**
   * k-NN over embeddings, returning the most similar OTHER published blogs.
   * Cosine similarity = 1 - cosine distance (`<=>`). The optional `sameSiteId`
   * restricts to one site (related-posts); the broader network query lives in
   * the backlink service. All values are bound params — the only dynamic SQL is
   * a fixed, code-controlled clause string (no caller input is interpolated).
   */
  async findSimilar(
    blogId: string,
    opts: { limit?: number; minScore?: number; sameSiteId?: string } = {},
  ): Promise<SimilarBlog[]> {
    const limit = opts.limit ?? 5;
    const minScore = opts.minScore ?? 0;
    const select = (clause: string) =>
      `SELECT b."blogId" AS "blogId",
              1 - (b."embedding" <=> probe."embedding") AS "score"
       FROM "BlogEmbedding" b
       CROSS JOIN (SELECT "embedding" FROM "BlogEmbedding" WHERE "blogId" = $1) probe
       JOIN "Blog" bl ON bl."id" = b."blogId"
       WHERE b."blogId" <> $1 AND bl."published" = true ${clause}
       ORDER BY b."embedding" <=> probe."embedding" ASC
       LIMIT $2`;
    const rows = opts.sameSiteId
      ? await this.prisma.$queryRawUnsafe<{ blogId: string; score: number }[]>(
          select('AND bl."siteId" = $3'),
          blogId,
          limit,
          opts.sameSiteId,
        )
      : await this.prisma.$queryRawUnsafe<{ blogId: string; score: number }[]>(
          select(''),
          blogId,
          limit,
        );
    return rows.filter((r) => r.score >= minScore);
  }
}
