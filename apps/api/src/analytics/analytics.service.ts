import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // Record a view (called from public blog page)
  async trackView(blogId: string) {
    return this.prisma.blogView.create({
      data: { blogId },
    });
  }

  // Dashboard stats for the authenticated user
  async getDashboardStats(userId: string) {
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
  async getBlogAnalytics(userId: string) {
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

  // Calendar data — blog events
  async getCalendarEvents(userId: string) {
    const blogs = await this.prisma.blog.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return blogs.map((b) => ({
      id: b.id,
      title: b.title,
      start: b.createdAt,
      end: b.createdAt,
      allDay: true,
      variant: b.published ? 'primary' : 'secondary',
    }));
  }
}
