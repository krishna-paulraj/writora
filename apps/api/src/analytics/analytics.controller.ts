import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import * as express from 'express';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SiteContextGuard } from '../site/site-context.guard';
import { CurrentSite } from '../site/current-site.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  // Public: track a view (deduped per IP per 24h by the service)
  @Post('track/:blogId')
  trackView(@Param('blogId') blogId: string, @Req() req: express.Request) {
    // Use the trusted client IP resolved by Express (trust proxy is configured
    // in main.ts) — never the raw x-forwarded-for header, which a client can
    // spoof to evade the per-IP dedup and inflate view counts.
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return this.analyticsService.trackView(blogId, ip);
  }

  // Protected: dashboard stats
  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  getDashboardStats(@Req() req: express.Request) {
    const user = req.user as { id: string };
    return this.analyticsService.getDashboardStats(user.id);
  }

  // Protected: per-blog analytics
  @UseGuards(JwtAuthGuard)
  @Get('blogs')
  getBlogAnalytics(@Req() req: express.Request) {
    const user = req.user as { id: string };
    return this.analyticsService.getBlogAnalytics(user.id);
  }

  // Protected: calendar events (scoped to the active site, like the rest of the app)
  @UseGuards(JwtAuthGuard, SiteContextGuard)
  @Get('calendar')
  getCalendarEvents(
    @Req() req: express.Request,
    @CurrentSite() siteId: string,
  ) {
    const user = req.user as { id: string };
    return this.analyticsService.getCalendarEvents(user.id, siteId);
  }
}
