import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/notifications.service';
import { sanitizeContent } from '../blog/sanitize';

// Minimum cosine similarity for a backlink to be considered relevant enough.
const MIN_SCORE = 0.25;
// How many existing posts to consider linking to a newly published post.
const BACKFILL_FANOUT = 5;
// Marker attribute on the managed links block — found/replaced/stripped
// idempotently and survives the HTML sanitizer via its data-* allowance.
const BLOCK_MARKER = 'data-writora-backlinks';

interface TargetRow {
  blogId: string;
  score: number;
  title: string;
  slug: string;
  siteId: string;
  siteSlug: string;
  isPrimary: boolean;
  username: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Cross-site backlink engine. Finds topically-relevant published posts on OTHER
 * consenting member sites and weaves links to them into a source post via a
 * single managed "Related across the network" block, recording each link as a
 * BacklinkEdge. All cross-tenant reads are restricted to enabled memberships +
 * published posts and exclude the same owner (no self-rings). The block in any
 * source post is always rebuilt from that post's active edges, which keeps
 * placement, backfill, and cleanup consistent and idempotent.
 */
@Injectable()
export class BacklinkService {
  private readonly logger = new Logger(BacklinkService.name);
  private readonly siteUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private embeddings: EmbeddingService,
    private entitlements: EntitlementsService,
    private notifications: NotificationsService,
  ) {
    this.siteUrl = (
      this.config.get<string>('SITE_URL') ||
      this.config.get<string>('NEXT_PUBLIC_WWW_URL') ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  /**
   * OUTBOUND (at generation): give relevant other-site posts a backlink from
   * this post. No-op unless the site is an entitled, enabled member.
   */
  async placeOutboundForBlog(blogId: string): Promise<number> {
    const ctx = await this.memberContext(blogId);
    if (!ctx) return 0;
    if (!this.embeddings.isConfigured()) return 0;

    const probe = await this.embeddings.embed(ctx.probeText);
    if (!probe) return 0;

    const targets = await this.findTargetsByVector(
      this.embeddings.toVectorLiteral(probe),
      ctx.siteId,
      ctx.userId,
      ctx.cap,
    );
    if (targets.length === 0) return 0;

    for (const t of targets) {
      await this.recordEdge(blogId, ctx.siteId, t, ctx.rel);
    }
    await this.rebuildBlockForSource(blogId);
    this.logger.log(
      `placed ${targets.length} outbound backlink(s) from ${blogId}`,
    );
    return targets.length;
  }

  /**
   * INBOUND (backfill): a post `newBlogId` just published — add a link to it
   * from relevant existing member posts on OTHER sites (respecting each source's
   * cap), so it earns inbound backlinks.
   */
  async backfillInbound(newBlogId: string): Promise<number> {
    const target = await this.memberContext(newBlogId, {
      requirePublished: true,
    });
    if (!target) return 0;
    if (!this.embeddings.isConfigured()) return 0;

    // Embed the new post's text on the fly (don't depend on its stored embedding,
    // which is computed by a concurrent job) to find existing member posts to
    // link FROM.
    const probe = await this.embeddings.embed(target.probeText);
    if (!probe) return 0;
    const sources = await this.findTargetsByVector(
      this.embeddings.toVectorLiteral(probe),
      target.siteId,
      target.userId,
      BACKFILL_FANOUT,
    );
    let added = 0;
    for (const source of sources) {
      if (await this.addInboundLink(source.blogId, newBlogId, source.score)) {
        added++;
      }
    }
    if (added > 0) {
      this.logger.log(
        `backfilled ${added} inbound backlink(s) to ${newBlogId}`,
      );
      await this.notifications.emit(target.userId, {
        type: NotificationType.BacklinkEarned,
        title: `Earned ${added} backlink${added === 1 ? '' : 's'}`,
        body: `“${target.title}” just earned ${added} backlink${
          added === 1 ? '' : 's'
        } from across the network.`,
        link: '/network',
        meta: { blogId: newBlogId },
      });
    }
    return added;
  }

  /**
   * CLEANUP: a post is no longer a valid target (unpublished or about to be
   * deleted). Mark inbound edges removed and rebuild each linking source so the
   * dead link disappears.
   */
  async onTargetUnavailable(targetBlogId: string): Promise<void> {
    const edges = await this.prisma.backlinkEdge.findMany({
      where: { toBlogId: targetBlogId, status: 'active' },
      select: { fromBlogId: true },
    });
    if (edges.length === 0) return;
    await this.prisma.backlinkEdge.updateMany({
      where: { toBlogId: targetBlogId },
      data: { status: 'removed' },
    });
    const sources = [...new Set(edges.map((e) => e.fromBlogId))];
    for (const sourceId of sources) {
      await this.rebuildBlockForSource(sourceId).catch(() => undefined);
    }
  }

  // --- internals -----------------------------------------------------------

  /** Resolve a blog's network context, or null if it can't participate. */
  private async memberContext(
    blogId: string,
    opts: { requirePublished?: boolean } = {},
  ): Promise<{
    siteId: string;
    userId: string;
    title: string;
    rel: string;
    cap: number;
    probeText: string;
  } | null> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      select: {
        siteId: true,
        title: true,
        description: true,
        targetKeyword: true,
        published: true,
        site: {
          select: {
            userId: true,
            networkMembership: {
              select: {
                enabled: true,
                relPolicy: true,
                maxOutboundPerPost: true,
              },
            },
          },
        },
      },
    });
    const m = blog?.site.networkMembership;
    if (!blog || !m?.enabled) return null;
    if (opts.requirePublished && !blog.published) return null;
    if (!(await this.entitlements.hasBacklinkNetwork(blog.site.userId)))
      return null;
    return {
      siteId: blog.siteId,
      userId: blog.site.userId,
      title: blog.title,
      rel: m.relPolicy === 'nofollow' ? 'nofollow' : 'dofollow',
      cap: m.maxOutboundPerPost,
      probeText: [blog.title, blog.targetKeyword ?? '', blog.description]
        .filter(Boolean)
        .join('\n'),
    };
  }

  /** Add a single B→A link if B is under its outbound cap. */
  private async addInboundLink(
    sourceBlogId: string,
    targetBlogId: string,
    score: number,
  ): Promise<boolean> {
    const ctx = await this.memberContext(sourceBlogId);
    if (!ctx) return false;
    const existing = await this.prisma.backlinkEdge.findUnique({
      where: {
        fromBlogId_toBlogId: {
          fromBlogId: sourceBlogId,
          toBlogId: targetBlogId,
        },
      },
      select: { status: true },
    });
    if (existing?.status === 'active') return false; // already linked
    const activeCount = await this.prisma.backlinkEdge.count({
      where: { fromBlogId: sourceBlogId, status: 'active' },
    });
    if (activeCount >= ctx.cap) return false; // respect the source's cap

    const [t] = await this.fetchTargetsByIds([targetBlogId]);
    if (!t) return false; // target not published/missing
    await this.recordEdge(sourceBlogId, ctx.siteId, { ...t, score }, ctx.rel);
    await this.rebuildBlockForSource(sourceBlogId);
    return true;
  }

  /** Rebuild a source post's managed block from its current active edges. */
  private async rebuildBlockForSource(sourceBlogId: string): Promise<void> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: sourceBlogId },
      select: {
        content: true,
        site: {
          select: { networkMembership: { select: { relPolicy: true } } },
        },
      },
    });
    if (!blog) return;
    const rel =
      blog.site.networkMembership?.relPolicy === 'nofollow'
        ? 'nofollow'
        : 'dofollow';

    const edges = await this.prisma.backlinkEdge.findMany({
      where: { fromBlogId: sourceBlogId, status: 'active' },
      orderBy: { score: 'desc' },
      select: { toBlogId: true },
    });
    const targets = await this.fetchTargetsByIds(edges.map((e) => e.toBlogId));
    // Drop edges whose target is no longer published.
    const liveIds = new Set(targets.map((t) => t.blogId));
    const dead = edges.filter((e) => !liveIds.has(e.toBlogId));
    if (dead.length > 0) {
      await this.prisma.backlinkEdge.updateMany({
        where: {
          fromBlogId: sourceBlogId,
          toBlogId: { in: dead.map((e) => e.toBlogId) },
        },
        data: { status: 'removed' },
      });
    }

    const html =
      targets.length > 0
        ? this.withBlock(blog.content, targets, rel)
        : this.stripBlock(blog.content);
    await this.prisma.blog.update({
      where: { id: sourceBlogId },
      data: { content: sanitizeContent(html) },
    });
  }

  // --- candidate search ----------------------------------------------------

  /** k-NN by a probe vector across OTHER enabled member sites (excludes owner). */
  async findTargetsByVector(
    vectorLiteral: string,
    excludeSiteId: string,
    excludeUserId: string,
    limit: number,
  ): Promise<TargetRow[]> {
    if (limit <= 0) return [];
    const rows = await this.prisma.$queryRawUnsafe<TargetRow[]>(
      `SELECT b."blogId" AS "blogId",
              1 - (b."embedding" <=> $1::vector) AS "score",
              bl."title" AS "title", bl."slug" AS "slug",
              s."id" AS "siteId", s."slug" AS "siteSlug",
              s."isPrimary" AS "isPrimary", u."username" AS "username"
       FROM "BlogEmbedding" b
       JOIN "Blog" bl ON bl."id" = b."blogId"
       JOIN "Site" s ON s."id" = bl."siteId"
       JOIN "User" u ON u."id" = s."userId"
       JOIN "NetworkMembership" nm ON nm."siteId" = s."id" AND nm."enabled" = true
       WHERE bl."published" = true AND s."id" <> $2 AND s."userId" <> $3
       ORDER BY b."embedding" <=> $1::vector ASC
       LIMIT $4`,
      vectorLiteral,
      excludeSiteId,
      excludeUserId,
      limit,
    );
    return rows.filter((r) => r.score >= MIN_SCORE);
  }

  /** k-NN using a stored blog's embedding (for backfill). Excludes self+owner. */
  async findTargetsByBlog(
    blogId: string,
    excludeSiteId: string,
    excludeUserId: string,
    limit: number,
  ): Promise<TargetRow[]> {
    if (limit <= 0) return [];
    const rows = await this.prisma.$queryRawUnsafe<TargetRow[]>(
      `SELECT b."blogId" AS "blogId",
              1 - (b."embedding" <=> probe."embedding") AS "score",
              bl."title" AS "title", bl."slug" AS "slug",
              s."id" AS "siteId", s."slug" AS "siteSlug",
              s."isPrimary" AS "isPrimary", u."username" AS "username"
       FROM "BlogEmbedding" b
       CROSS JOIN (SELECT "embedding" FROM "BlogEmbedding" WHERE "blogId" = $1) probe
       JOIN "Blog" bl ON bl."id" = b."blogId"
       JOIN "Site" s ON s."id" = bl."siteId"
       JOIN "User" u ON u."id" = s."userId"
       JOIN "NetworkMembership" nm ON nm."siteId" = s."id" AND nm."enabled" = true
       WHERE bl."published" = true AND b."blogId" <> $1
         AND s."id" <> $2 AND s."userId" <> $3
       ORDER BY b."embedding" <=> probe."embedding" ASC
       LIMIT $4`,
      blogId,
      excludeSiteId,
      excludeUserId,
      limit,
    );
    return rows.filter((r) => r.score >= MIN_SCORE);
  }

  /** Fetch link-rendering details for a set of blogs (published only). */
  private async fetchTargetsByIds(ids: string[]): Promise<TargetRow[]> {
    if (ids.length === 0) return [];
    return this.prisma.$queryRawUnsafe<TargetRow[]>(
      `SELECT bl."id" AS "blogId", 0 AS "score",
              bl."title" AS "title", bl."slug" AS "slug",
              s."id" AS "siteId", s."slug" AS "siteSlug",
              s."isPrimary" AS "isPrimary", u."username" AS "username"
       FROM "Blog" bl
       JOIN "Site" s ON s."id" = bl."siteId"
       JOIN "User" u ON u."id" = s."userId"
       WHERE bl."id" = ANY($1) AND bl."published" = true`,
      ids,
    );
  }

  // --- HTML block + edges --------------------------------------------------

  private targetUrl(t: TargetRow): string {
    return t.isPrimary
      ? `${this.siteUrl}/${t.username}/${t.slug}`
      : `${this.siteUrl}/s/${t.siteSlug}/${t.slug}`;
  }

  /** Insert/replace the managed links block in `html`. */
  private withBlock(html: string, targets: TargetRow[], rel: string): string {
    const relAttr = rel === 'nofollow' ? 'nofollow noopener' : 'noopener';
    const items = targets
      .map(
        (t) =>
          `<li><a href="${escapeHtml(this.targetUrl(t))}" rel="${relAttr}">${escapeHtml(t.title)}</a></li>`,
      )
      .join('');
    const block = `<div ${BLOCK_MARKER}="1"><hr /><p><strong>Related across the network</strong></p><ul>${items}</ul></div>`;
    return `${this.stripBlock(html)}\n${block}`;
  }

  /** Remove the managed block (idempotency + cleanup). */
  stripBlock(html: string): string {
    return html
      .replace(
        new RegExp(`<div [^>]*${BLOCK_MARKER}[^>]*>[\\s\\S]*?<\\/div>`, 'i'),
        '',
      )
      .trimEnd();
  }

  private async recordEdge(
    fromBlogId: string,
    fromSiteId: string,
    t: TargetRow,
    rel: string,
  ): Promise<void> {
    await this.prisma.backlinkEdge.upsert({
      where: { fromBlogId_toBlogId: { fromBlogId, toBlogId: t.blogId } },
      create: {
        fromBlogId,
        toBlogId: t.blogId,
        fromSiteId,
        toSiteId: t.siteId,
        anchorText: t.title,
        rel,
        score: t.score,
        placement: 'block',
        status: 'active',
      },
      update: { status: 'active', score: t.score, anchorText: t.title, rel },
    });
  }
}
