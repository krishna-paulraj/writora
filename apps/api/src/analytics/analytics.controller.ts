import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import * as express from 'express';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  // Public: track a view (deduped per IP per 24h by the service)
  @Post('track/:blogId')
  trackView(@Param('blogId') blogId: string, @Req() req: express.Request) {
    const fwd = req.headers['x-forwarded-for'];
    const ip =
      (typeof fwd === 'string' ? fwd.split(',')[0].trim() : undefined) ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
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

  // Protected: calendar events
  @UseGuards(JwtAuthGuard)
  @Get('calendar')
  getCalendarEvents(@Req() req: express.Request) {
    const user = req.user as { id: string };
    return this.analyticsService.getCalendarEvents(user.id);
  }
}
