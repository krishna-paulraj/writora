import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CacheService } from '../cache/cache.service';
import { QueueService } from '../queue/queue.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { sanitizeContent, computeReadTime } from './sanitize';

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

@Injectable()
export class BlogService implements OnModuleInit {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    private cache: CacheService,
    private queue: QueueService,
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

  async create(authorId: string, dto: CreateBlogDto) {
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
        authorId,
      },
    });
    await this.invalidateAuthorCache(authorId);
    return created;
  }

  async findAllByAuthor(authorId: string) {
    return this.prisma.blog.findMany({
      where: { authorId },
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
      select: { id: true, authorId: true, newsletterSent: true },
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
      where: { authorId: blog.authorId, confirmedAt: { not: null } },
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
    const deleted = await this.prisma.blog.delete({ where: { id } });
    await this.invalidateAuthorCache(authorId);
    return deleted;
  }

  // Preview (owner only, works for drafts)
  async previewBySlug(authorId: string, slug: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: authorId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const blog = await this.prisma.blog.findUnique({
      where: { authorId_slug: { authorId, slug } },
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    });
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    return {
      blog,
      blogTheme: user.blogTheme,
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
        },
      });
      return blogs.map((b) => ({
        username: b.author.username,
        slug: b.slug,
        updatedAt: b.updatedAt,
      }));
    });
  }

  /**
   * Resolves a custom domain to its owner's username. Caches both hits and
   * misses (as null) so unrelated traffic on unknown hosts doesn't keep
   * hitting the DB.
   */
  async findUsernameByDomain(
    domain: string,
  ): Promise<{ username: string } | null> {
    const normalized = domain.toLowerCase().trim();
    if (!normalized) return null;

    const key = domainKey(normalized);
    const cached = await this.cache.get<{ username: string | null }>(key);
    if (cached !== null) {
      return cached.username ? { username: cached.username } : null;
    }

    const user = await this.prisma.user.findFirst({
      where: { customDomain: normalized },
      select: { username: true },
    });
    await this.cache.set(key, { username: user?.username ?? null }, DOMAIN_TTL);
    return user ? { username: user.username } : null;
  }

  // Public endpoints
  async findPublicByUsername(username: string) {
    return this.cache.wrap(publicListKey(username), PUBLIC_LIST_TTL, () =>
      this.findPublicByUsernameUncached(username),
    );
  }

  private async findPublicByUsernameUncached(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const blogs = await this.prisma.blog.findMany({
      where: { authorId: user.id, published: true },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        blogTheme: user.blogTheme,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        twitterHandle: user.twitterHandle,
        websiteUrl: user.websiteUrl,
      },
      blogs,
    };
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
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const blog = await this.prisma.blog.findUnique({
      where: { authorId_slug: { authorId: user.id, slug } },
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    });
    if (!blog || !blog.published) {
      throw new NotFoundException('Blog not found');
    }

    // Get adjacent posts for navigation
    const allBlogs = await this.prisma.blog.findMany({
      where: { authorId: user.id, published: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, slug: true, title: true },
    });

    const currentIndex = allBlogs.findIndex((b) => b.id === blog.id);
    const previousPost = currentIndex > 0 ? allBlogs[currentIndex - 1] : null;
    const nextPost =
      currentIndex < allBlogs.length - 1 ? allBlogs[currentIndex + 1] : null;

    // Get related posts (same category first, then others)
    const relatedBlogs = await this.prisma.blog.findMany({
      where: {
        authorId: user.id,
        published: true,
        id: { not: blog.id },
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
      take: 3,
      include: {
        author: { select: { id: true, name: true, username: true } },
      },
    });

    // Sort related: same category first
    const sameCat = relatedBlogs.filter((b) => b.category === blog.category);
    const otherCat = relatedBlogs.filter((b) => b.category !== blog.category);
    const related = [...sameCat, ...otherCat].slice(0, 3);

    return {
      blog,
      blogTheme: user.blogTheme,
      previousPost,
      nextPost,
      relatedPosts: related,
    };
  }
}
