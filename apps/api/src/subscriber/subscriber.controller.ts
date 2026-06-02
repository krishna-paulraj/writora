import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { SubscriberService } from './subscriber.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SiteContextGuard } from '../site/site-context.guard';
import { CurrentSite } from '../site/current-site.decorator';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

@Controller('subscribers')
export class SubscriberController {
  constructor(private subscriberService: SubscriberService) {}

  // Public: anyone can subscribe to an author.
  // Spam / email-bomb cap: 10 attempts per hour per IP across all authors.
  @Throttle({ default: { limit: 10, ttl: HOUR } })
  @Post(':username')
  subscribe(
    @Param('username') username: string,
    @Body() body: { email: string },
  ) {
    return this.subscriberService.subscribe(username, body.email);
  }

  // Public: confirm subscription via emailed token
  @Get('confirm')
  confirm(@Query('token') token: string) {
    return this.subscriberService.confirm(token);
  }

  // Public: one-click unsubscribe via emailed token
  @Get('unsubscribe')
  unsubscribe(@Query('token') token: string) {
    return this.subscriberService.unsubscribe(token);
  }

  // Authenticated: list my subscribers for the active site
  @UseGuards(JwtAuthGuard, SiteContextGuard)
  @Get('me')
  listMine(@Req() req: Request, @CurrentSite() siteId: string) {
    const user = req.user as { id: string };
    return this.subscriberService.listForAuthor(user.id, siteId);
  }

  // Authenticated: manually remove one of my subscribers
  @UseGuards(JwtAuthGuard)
  @Delete('me/:id')
  removeMine(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.subscriberService.removeForAuthor(user.id, id);
  }
}
