import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

const DASHBOARD_TTL = 60;
const BLOGS_TTL = 60;
const VIEW_DEDUP_TTL = 24 * 60 * 60; // 24h

function dashboardKey(userId: string) {
  return `analytics:dashboard:${userId}`;
}
function blogsKey(userId: string) {
  return `analytics:blogs:${userId}`;
}
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  // Record a view, deduplicated per (blogId, IP-hash) per 24h to stop refresh spam.
  async trackView(blogId: string, ip: string) {
    const dedupKey = `view:dedup:${blogId}:${hashIp(ip)}`;
    const fresh = await this.cache.setIfAbsent(dedupKey, '1', VIEW_DEDUP_TTL);
    if (!fresh) {
      return { counted: false };
    }
    const view = await this.prisma.blogView.create({ data: { blogId } });
    // Invalidate analytics caches for the blog's author
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      select: { authorId: true },
    });
    if (blog) {
      await this.cache.del(
        dashboardKey(blog.authorId),
        blogsKey(blog.authorId),
      );
    }
    return { counted: true, id: view.id };
  }

  // Dashboard stats for the authenticated user
  getDashboardStats(userId: string) {
    return this.cache.wrap(dashboardKey(userId), DASHBOARD_TTL, () =>
      this.computeDashboardStats(userId),
    );
  }

  private async computeDashboardStats(userId: string) {
    const blogs = await this.prisma.blog.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        createdAt: true,
        _count: { select: { views: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalBlogs = blogs.length;
    const publishedBlogs = blogs.filter((b) => b.published).length;
    const totalViews = blogs.reduce((sum, b) => sum + b._count.views, 0);

    // Top posts by views
    const topPosts = [...blogs]
      .sort((a, b) => b._count.views - a._count.views)
      .slice(0, 5)
      .map((b) => ({
        id: b.id,
        title: b.title,
        slug: b.slug,
        views: b._count.views,
      }));

    // Recent activity (last 5 blogs)
    const recentBlogs = blogs.slice(0, 5).map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      published: b.published,
      createdAt: b.createdAt,
      views: b._count.views,
    }));

    // Views over the last 30 days (daily breakdown)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const blogIds = blogs.map((b) => b.id);

    const dailyViews = await this.prisma.blogView.groupBy({
      by: ['createdAt'],
      where: {
        blogId: { in: blogIds },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: true,
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by date
    const viewsByDate: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const key = date.toISOString().split('T')[0];
      viewsByDate[key] = 0;
    }
    for (const view of dailyViews) {
      const key = view.createdAt.toISOString().split('T')[0];
      viewsByDate[key] = (viewsByDate[key] || 0) + view._count;
    }

    const chartData = Object.entries(viewsByDate).map(([date, views]) => ({
      date,
      views,
    }));

    // Views this week vs last week for trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const viewsThisWeek = await this.prisma.blogView.count({
      where: {
        blogId: { in: blogIds },
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const viewsLastWeek = await this.prisma.blogView.count({
      where: {
        blogId: { in: blogIds },
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    });

    const viewsTrend =
      viewsLastWeek > 0
        ? ((viewsThisWeek - viewsLastWeek) / viewsLastWeek) * 100
        : viewsThisWeek > 0
          ? 100
          : 0;

    return {
      totalBlogs,
      publishedBlogs,
      totalViews,
      viewsThisWeek,
      viewsTrend: Math.round(viewsTrend * 10) / 10,
      topPosts,
      recentBlogs,
      chartData,
    };
  }

  // Per-blog analytics
  getBlogAnalytics(userId: string) {
    return this.cache.wrap(blogsKey(userId), BLOGS_TTL, () =>
      this.computeBlogAnalytics(userId),
    );
  }

  private async computeBlogAnalytics(userId: string) {
    const blogs = await this.prisma.blog.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        published: true,
        createdAt: true,
        readTime: true,
        _count: { select: { views: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blogs.map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      category: b.category,
      published: b.published,
      createdAt: b.createdAt,
      readTime: b.readTime,
      views: b._count.views,
    }));
  }

  // Calendar data — blog events. Returns one event per post, anchored on
  // its most meaningful date:
  //   scheduledAt (if set)  → "scheduled" — drag-to-reschedule lives here
  //   publishedAt (if set)  → "published" — historical record
  //   createdAt (fallback)  → "draft"
  async getCalendarEvents(userId: string) {
    const blogs = await this.prisma.blog.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        scheduledAt: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return blogs.map((b) => {
      let variant: 'scheduled' | 'published' | 'draft';
      let start: Date;
      if (b.scheduledAt) {
        variant = 'scheduled';
        start = b.scheduledAt;
      } else if (b.published) {
        variant = 'published';
        start = b.publishedAt ?? b.createdAt;
      } else {
        variant = 'draft';
        start = b.createdAt;
      }
      return {
        id: b.id,
        title: b.title,
        slug: b.slug,
        start,
        end: start,
        allDay: true,
        variant,
        published: b.published,
        scheduledAt: b.scheduledAt,
      };
    });
  }
}
