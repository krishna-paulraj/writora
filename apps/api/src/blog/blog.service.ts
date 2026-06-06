import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CacheService } from '../cache/cache.service';
import { QueueService } from '../queue/queue.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { sanitizeContent, computeReadTime } from './sanitize';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { BlogEmbeddingService } from '../embedding/blog-embedding.service';
import { BacklinkService } from '../backlink/backlink.service';
import { BacklinkBackfillService } from '../backlink/backlink-backfill.service';

const NEWSLETTER_QUEUE = 'newsletter.blast';
interface NewsletterJob {
  blogId: string;
}

// Webhook fanout queue — consumed by WebhookModule. Inlined here to avoid a
// circular import on WebhookService (Webhook → Blog already exists).
const WEBHOOK_BLOG_PUBLISHED_QUEUE = 'webhook.blog.published';
interface WebhookPublishedEvent {
  blogId: string;
  authorId: string;
}

// CMS publish-out fanout queue — consumed by PublishModule. Its own queue (not
// the webhook one) since RabbitMQ consumers on a shared queue compete. Constant
// inlined here, like the webhook one, to avoid a circular import.
const CMS_PUBLISH_FANOUT_QUEUE = 'cms.publish.fanout';
interface CmsPublishEvent {
  blogId: string;
  authorId: string;
}

const SITEMAP_KEY = 'blog:sitemap:all';
const PUBLIC_LIST_TTL = 60;
const PUBLIC_DETAIL_TTL = 60;
const SITEMAP_TTL = 3600;
const DOMAIN_TTL = 300;

function publicListKey(username: string) {
  return `blog:public:list:${username}`;
}
function publicDetailKey(username: string, slug: string) {
  return `blog:public:detail:${username}:${slug}`;
}
function authorBlogsPattern(username: string) {
  return `blog:public:*:${username}*`;
}
function domainKey(domain: string) {
  return `blog:domain:${domain}`;
}
function siteListKey(slug: string) {
  return `blog:public:site:list:${slug}`;
}
function siteDetailKey(slug: string, postSlug: string) {
  return `blog:public:site:detail:${slug}:${postSlug}`;
}

// The per-publication public fields, sourced from Site (moved off User).
const SITE_PUBLIC_SELECT = {
  id: true,
  blogTheme: true,
  bio: true,
  avatarUrl: true,
  twitterHandle: true,
  websiteUrl: true,
} satisfies Prisma.SiteSelect;

interface SitePublic {
  id: string;
  blogTheme: string;
  bio: string | null;
  avatarUrl: string | null;
  twitterHandle: string | null;
  websiteUrl: string | null;
}

@Injectable()
export class BlogService implements OnModuleInit {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    private cache: CacheService,
    private queue: QueueService,
    private notifications: NotificationsService,
    private entitlements: EntitlementsService,
    private blogEmbeddings: BlogEmbeddingService,
    private backlinks: BacklinkService,
    private backfill: BacklinkBackfillService,
  ) {}

  async onModuleInit() {
    await this.queue.consume<NewsletterJob>(
      NEWSLETTER_QUEUE,
      (job) => this.sendNewsletterBlast(job.blogId),
      { prefetch: 1 },
    );
  }

  private async invalidateAuthorCache(authorId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { username: true },
    });
    if (!user) return;
    await Promise.all([
      this.cache.delPattern(authorBlogsPattern(user.username)),
      this.cache.del(
        SITEMAP_KEY,
        `analytics:dashboard:${authorId}`,
        `analytics:blogs:${authorId}`,
      ),
    ]);
  }

  private wwwUrl(): string {
    return (
      this.configService.get<string>('SITE_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_WWW_URL') ||
      'http://localhost:3000'
    );
  }

  async create(authorId: string, siteId: string, dto: CreateBlogDto) {
    const existing = await this.prisma.blog.findUnique({
      where: { authorId_slug: { authorId, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException('A blog with this slug already exists');
    }

    const content = sanitizeContent(dto.content ?? '');
    const created = await this.prisma.blog.create({
      data: {
        ...dto,
        content,
        readTime: computeReadTime(content),
        // Keep publishedAt consistent with `published` even on the create path
        // (the full publish side-effects live in update()), so a post created
        // already-published doesn't end up live with a null publishedAt.
        publishedAt: dto.published ? new Date() : null,
        authorId,
        siteId,
      },
    });
    await this.invalidateAuthorCache(authorId);
    // Embed + earn backlinks immediately if created already-published (rare).
    if (created.published) {
      await this.blogEmbeddings.enqueue(created.id);
      await this.backfill.enqueue(created.id);
    }
    return created;
  }

  async findAllByAuthor(authorId: string, siteId: string) {
    return this.prisma.blog.findMany({
      where: { authorId, siteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, authorId: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    if (blog.authorId !== authorId) {
      throw new ForbiddenException();
    }
    return blog;
  }

  async update(id: string, authorId: string, dto: UpdateBlogDto) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    if (blog.authorId !== authorId) {
      throw new ForbiddenException();
    }

    if (dto.slug && dto.slug !== blog.slug) {
      const slugExists = await this.prisma.blog.findUnique({
        where: { authorId_slug: { authorId, slug: dto.slug } },
      });
      if (slugExists) {
        throw new ConflictException('A blog with this slug already exists');
      }
    }

    const { scheduledAt: scheduledAtRaw, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (dto.content !== undefined) {
      data.content = sanitizeContent(dto.content);
      data.readTime = computeReadTime(data.content as string);
    }

    // Scheduling: if `scheduledAt` is in the payload, normalize it.
    if (scheduledAtRaw !== undefined) {
      if (scheduledAtRaw === null) {
        data.scheduledAt = null;
      } else {
        const when = new Date(scheduledAtRaw);
        if (Number.isNaN(when.getTime())) {
          throw new ConflictException('Invalid scheduledAt date');
        }
        data.scheduledAt = when;
        // Scheduling implies the post isn't live yet — never let scheduledAt
        // and published=true coexist.
        data.published = false;
      }
    }

    // Track when a post goes live via the manual-publish path
    if (dto.published === true && !blog.published) {
      data.publishedAt = new Date();
      data.scheduledAt = null; // clear any pending schedule
    }
    // Reverting to draft clears publishedAt so analytics stays honest
    if (dto.published === false && blog.published) {
      data.publishedAt = null;
    }

    const updated = await this.prisma.blog.update({
      where: { id },
      data,
    });
    await this.invalidateAuthorCache(authorId);

    // Newsletter blast on first publish (drafts → published, only once per post).
    // This branch covers manual publish; the scheduler reuses the same queue
    // separately in publishDuePosts().
    const justPublished =
      !blog.published && updated.published && !updated.newsletterSent;
    if (justPublished) {
      await this.queue.enqueue<NewsletterJob>(NEWSLETTER_QUEUE, {
        blogId: updated.id,
      });
    }
    // Outbound webhook fanout on every transition to published — separate
    // from newsletter because users may add a webhook after the post is live.
    if (!blog.published && updated.published) {
      await this.queue.enqueue<WebhookPublishedEvent>(
        WEBHOOK_BLOG_PUBLISHED_QUEUE,
        { blogId: updated.id, authorId },
      );
      // CMS auto cross-post fanout (separate consumer/queue).
      await this.queue.enqueue<CmsPublishEvent>(CMS_PUBLISH_FANOUT_QUEUE, {
        blogId: updated.id,
        authorId,
      });
    }

    // Keep the semantic embedding in sync: (re)embed on publish or live-content
    // edits; drop it when unpublished (so it leaves similarity/network results).
    if (!blog.published && updated.published) {
      await this.blogEmbeddings.enqueue(updated.id);
      await this.backfill.enqueue(updated.id);
    } else if (updated.published && dto.content !== undefined) {
      await this.blogEmbeddings.enqueue(updated.id);
    } else if (blog.published && !updated.published) {
      await this.blogEmbeddings.remove(updated.id);
      // No longer a valid backlink target — strip inbound links from sources.
      await this.backlinks
        .onTargetUnavailable(updated.id)
        .catch(() => undefined);
    }

    return updated;
  }

  /**
   * Updates `scheduledAt` directly. Used by the calendar's drag-to-reschedule
   * handler. `null` unschedules.
   */
  async setSchedule(id: string, authorId: string, scheduledAt: string | null) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException('Blog not found');
    if (blog.authorId !== authorId) throw new ForbiddenException();

    let value: Date | null = null;
    if (scheduledAt) {
      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) {
        throw new ConflictException('Invalid scheduledAt date');
      }
      value = when;
    }

    const updated = await this.prisma.blog.update({
      where: { id },
      data: {
        scheduledAt: value,
        // Scheduling unpublishes; unscheduling leaves published as-is.
        ...(value ? { published: false } : {}),
      },
    });
    await this.invalidateAuthorCache(authorId);
    return updated;
  }

  /**
   * Called every minute by BlogSchedulerService. Atomically claims due
   * scheduled posts and triggers the newsletter blast for each. Safe to run
   * across multiple API replicas — `updateMany` with the same WHERE clause
   * ensures exactly one replica wins each claim.
   */
  async publishDuePosts(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.blog.findMany({
      where: { published: false, scheduledAt: { lte: now } },
      select: { id: true, title: true, authorId: true, newsletterSent: true },
    });
    if (due.length === 0) return 0;

    let publishedCount = 0;
    for (const post of due) {
      const claimed = await this.prisma.blog.updateMany({
        where: {
          id: post.id,
          published: false,
          scheduledAt: { lte: new Date() },
        },
        data: {
          published: true,
          publishedAt: new Date(),
          scheduledAt: null,
        },
      });
      if (claimed.count !== 1) continue; // lost the race to another replica
      publishedCount++;

      if (!post.newsletterSent) {
        await this.queue.enqueue<NewsletterJob>(NEWSLETTER_QUEUE, {
          blogId: post.id,
        });
      }
      // Outbound webhook fanout for scheduled-publish path
      await this.queue.enqueue<WebhookPublishedEvent>(
        WEBHOOK_BLOG_PUBLISHED_QUEUE,
        { blogId: post.id, authorId: post.authorId },
      );
      // CMS auto cross-post fanout for scheduled-publish path
      await this.queue.enqueue<CmsPublishEvent>(CMS_PUBLISH_FANOUT_QUEUE, {
        blogId: post.id,
        authorId: post.authorId,
      });
      // (Re)embed the now-live post for similarity/network matching, then earn
      // inbound network backlinks.
      await this.blogEmbeddings.enqueue(post.id);
      await this.backfill.enqueue(post.id);
      // Notify the author their scheduled post went live (they weren't watching).
      await this.notifications.emit(post.authorId, {
        type: NotificationType.BlogPublished,
        title: `Scheduled post published: ${post.title}`,
        body: 'Your scheduled post is now live.',
        link: '/blogs',
        meta: { blogId: post.id },
      });
      await this.invalidateAuthorCache(post.authorId);
    }

    if (publishedCount > 0) {
      this.logger.log(`autopublished ${publishedCount} scheduled post(s)`);
    }
    return publishedCount;
  }

  private async sendNewsletterBlast(blogId: string): Promise<void> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      include: {
        author: { select: { name: true, username: true } },
      },
    });
    if (!blog || !blog.published) return;

    const subscribers = await this.prisma.subscriber.findMany({
      where: { siteId: blog.siteId, confirmedAt: { not: null } },
      select: { email: true, unsubscribeToken: true },
    });
    if (subscribers.length === 0) {
      await this.prisma.blog.update({
        where: { id: blogId },
        data: { newsletterSent: true },
      });
      return;
    }

    const postUrl = `${this.wwwUrl()}/${blog.author.username}/${blog.slug}`;
    const description = blog.description || '';

    this.logger.log(
      `Sending "${blog.title}" to ${subscribers.length} subscribers`,
    );

    // Sequential to stay under provider rate limits; trivial volume in MVP
    for (const sub of subscribers) {
      const unsubscribeUrl = `${this.wwwUrl()}/${blog.author.username}/unsubscribe/${sub.unsubscribeToken}`;
      await this.emailService.sendNewPost({
        to: sub.email,
        authorName: blog.author.name,
        title: blog.title,
        description,
        imageUrl: blog.imageUrl,
        postUrl,
        unsubscribeUrl,
      });
    }

    await this.prisma.blog.update({
      where: { id: blogId },
      data: { newsletterSent: true },
    });
  }

  async remove(id: string, authorId: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    if (blog.authorId !== authorId) {
      throw new ForbiddenException();
    }
    // Strip inbound network links from source posts BEFORE the delete (the FK
    // cascade removes the edges but can't touch the HTML in other posts).
    await this.backlinks.onTargetUnavailable(id).catch(() => undefined);
    const deleted = await this.prisma.blog.delete({ where: { id } });
    await this.invalidateAuthorCache(authorId);
    return deleted;
  }

  // Preview (owner only, works for drafts). Theme comes from the post's site.
  async previewBySlug(authorId: string, slug: string) {
    const blog = await this.prisma.blog.findUnique({
      where: { authorId_slug: { authorId, slug } },
      include: {
        author: { select: { id: true, name: true, username: true } },
        site: { select: { blogTheme: true } },
      },
    });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    return {
      blog,
      blogTheme: blog.site.blogTheme,
      previousPost: null,
      nextPost: null,
      relatedPosts: [],
      draft: !blog.published,
    };
  }

  async findAllPublishedForSitemap() {
    return this.cache.wrap(SITEMAP_KEY, SITEMAP_TTL, async () => {
      const blogs = await this.prisma.blog.findMany({
        where: { published: true },
        orderBy: { updatedAt: 'desc' },
        select: {
          slug: true,
          updatedAt: true,
          author: { select: { username: true } },
          site: { select: { slug: true, isPrimary: true } },
        },
      });
      // Primary sites stay addressed by username (back-compat); secondary sites
      // by their slug. The www sitemap builds the URL from these.
      return blogs.map((b) => ({
        username: b.author.username,
        siteSlug: b.site.slug,
        isPrimary: b.site.isPrimary,
        slug: b.slug,
        updatedAt: b.updatedAt,
      }));
    });
  }

  /**
   * Resolves a custom domain to the owning site. Caches hits and misses so
   * unknown-host traffic doesn't keep hitting the DB. Returns the owner's
   * username + the site's slug + whether it's the primary site, so the proxy
   * can rewrite to /[username] (primary) or /s/[siteSlug] (secondary).
   */
  async findUsernameByDomain(domain: string): Promise<{
    username: string;
    siteSlug: string;
    isPrimary: boolean;
  } | null> {
    const normalized = domain.toLowerCase().trim();
    if (!normalized) return null;

    const key = domainKey(normalized);
    // Wrap in { value } so a cached MISS (value:null) is distinguishable from a
    // cache-absent get (which returns null) — otherwise misses never cache.
    type DomainResult = {
      username: string;
      siteSlug: string;
      isPrimary: boolean;
    } | null;
    const cached = await this.cache.get<{ value: DomainResult }>(key);
    if (cached) return cached.value;

    const site = await this.prisma.site.findFirst({
      where: { customDomain: normalized },
      select: {
        slug: true,
        isPrimary: true,
        user: { select: { id: true, username: true } },
      },
    });
    // Custom domains are a paid feature: only resolve one while the owner is
    // still entitled, so a domain set on Pro stops working after a downgrade
    // (rather than persisting indefinitely). Bounded by the domain cache TTL.
    let entitled = false;
    if (site) {
      const plan = await this.entitlements.effectivePlan(site.user.id);
      entitled = this.entitlements.limitsFor(plan).customDomain;
    }
    const result: DomainResult =
      site && entitled
        ? {
            username: site.user.username,
            siteSlug: site.slug,
            isPrimary: site.isPrimary,
          }
        : null;
    await this.cache.set(key, { value: result }, DOMAIN_TTL);
    return result;
  }

  // --- Public endpoints (primary site addressed by username) ----------------

  async findPublicByUsername(username: string) {
    return this.cache.wrap(publicListKey(username), PUBLIC_LIST_TTL, () =>
      this.findPublicByUsernameUncached(username),
    );
  }

  private async findPublicByUsernameUncached(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        sites: {
          where: { isPrimary: true },
          take: 1,
          select: SITE_PUBLIC_SELECT,
        },
      },
    });
    if (!user || !user.sites[0]) {
      throw new NotFoundException('User not found');
    }
    return this.buildPublicList(user.sites[0], {
      id: user.id,
      name: user.name,
      username: user.username,
    });
  }

  async findPublicByUsernameAndSlug(username: string, slug: string) {
    return this.cache.wrap(
      publicDetailKey(username, slug),
      PUBLIC_DETAIL_TTL,
      () => this.findPublicByUsernameAndSlugUncached(username, slug),
    );
  }

  private async findPublicByUsernameAndSlugUncached(
    username: string,
    slug: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        sites: {
          where: { isPrimary: true },
          take: 1,
          select: SITE_PUBLIC_SELECT,
        },
      },
    });
    const site = user?.sites[0];
    if (!site) throw new NotFoundException('Blog not found');
    return this.buildPublicDetail(site, slug);
  }

  // --- Public endpoints (secondary site addressed by /s/[siteSlug]) ---------

  async findPublicBySiteSlug(siteSlug: string) {
    return this.cache.wrap(siteListKey(siteSlug), PUBLIC_LIST_TTL, async () => {
      const site = await this.prisma.site.findUnique({
        where: { slug: siteSlug },
        select: {
          ...SITE_PUBLIC_SELECT,
          user: { select: { id: true, name: true, username: true } },
        },
      });
      if (!site) throw new NotFoundException('Site not found');
      return this.buildPublicList(site, site.user);
    });
  }

  async findPublicBySiteSlugAndPostSlug(siteSlug: string, slug: string) {
    return this.cache.wrap(
      siteDetailKey(siteSlug, slug),
      PUBLIC_DETAIL_TTL,
      async () => {
        const site = await this.prisma.site.findUnique({
          where: { slug: siteSlug },
          select: SITE_PUBLIC_SELECT,
        });
        if (!site) throw new NotFoundException('Blog not found');
        return this.buildPublicDetail(site, slug);
      },
    );
  }

  // --- Shared public builders (scope strictly by siteId) --------------------

  private async buildPublicList(
    site: SitePublic,
    author: { id: string; name: string; username: string },
  ) {
    const blogs = await this.prisma.blog.findMany({
      where: { siteId: site.id, published: true },
      orderBy: { createdAt: 'desc' },
      // Cap the public list so a prolific site can't force an unbounded
      // payload/render. (Cursor pagination for the full archive is a follow-up.)
      take: 100,
      include: { author: { select: { id: true, name: true, username: true } } },
    });
    return { user: this.publicProfile(site, author), blogs };
  }

  private async buildPublicDetail(site: SitePublic, slug: string) {
    const blog = await this.prisma.blog.findUnique({
      where: { siteId_slug: { siteId: site.id, slug } },
      include: { author: { select: { id: true, name: true, username: true } } },
    });
    if (!blog || !blog.published) {
      throw new NotFoundException('Blog not found');
    }

    const allBlogs = await this.prisma.blog.findMany({
      where: { siteId: site.id, published: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, slug: true, title: true },
    });
    const currentIndex = allBlogs.findIndex((b) => b.id === blog.id);
    const previousPost = currentIndex > 0 ? allBlogs[currentIndex - 1] : null;
    const nextPost =
      currentIndex >= 0 && currentIndex < allBlogs.length - 1
        ? allBlogs[currentIndex + 1]
        : null;

    const relatedBlogs = await this.prisma.blog.findMany({
      where: { siteId: site.id, published: true, id: { not: blog.id } },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
      take: 3,
      include: { author: { select: { id: true, name: true, username: true } } },
    });
    const sameCat = relatedBlogs.filter((b) => b.category === blog.category);
    const otherCat = relatedBlogs.filter((b) => b.category !== blog.category);
    let related = [...sameCat, ...otherCat].slice(0, 3);

    // Prefer semantic similarity (same site) when embeddings exist; otherwise
    // keep the category heuristic above as the fallback.
    try {
      const similar = await this.blogEmbeddings.findSimilar(blog.id, {
        sameSiteId: site.id,
        limit: 3,
        minScore: 0.2,
      });
      if (similar.length > 0) {
        const byId = await this.prisma.blog.findMany({
          where: { id: { in: similar.map((s) => s.blogId) } },
          include: {
            author: { select: { id: true, name: true, username: true } },
          },
        });
        const rank = new Map(similar.map((s, i) => [s.blogId, i]));
        related = byId.sort(
          (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0),
        );
      }
    } catch {
      // similarity unavailable (e.g. embeddings off) — use category fallback
    }

    return {
      blog,
      blogTheme: site.blogTheme,
      previousPost,
      nextPost,
      relatedPosts: related,
    };
  }

  private publicProfile(
    site: SitePublic,
    author: { id: string; name: string; username: string },
  ) {
    return {
      id: author.id,
      name: author.name,
      username: author.username,
      blogTheme: site.blogTheme,
      bio: site.bio,
      avatarUrl: site.avatarUrl,
      twitterHandle: site.twitterHandle,
      websiteUrl: site.websiteUrl,
    };
  }
}
