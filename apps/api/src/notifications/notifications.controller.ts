import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

const HOUR = 60 * 60_000;

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  // Polled by the bell inbox; generous cap so background polling never trips it.
  @Throttle({ default: { limit: 1000, ttl: HOUR } })
  @Get()
  list(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.notifications.list(user.id);
  }

  @Post('read-all')
  markAllRead(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  markRead(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.notifications.markRead(user.id, id);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.notifications.remove(user.id, id);
  }
}
