import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SiteContextGuard } from '../site/site-context.guard';
import { CurrentSite } from '../site/current-site.decorator';
import { PublishService } from './publish.service';
import { CreateTargetDto } from './dto/create-target.dto';
import { UpdateTargetDto } from './dto/update-target.dto';
import { PublishBlogDto } from './dto/publish-blog.dto';

const HOUR = 60 * 60_000;

@UseGuards(JwtAuthGuard, SiteContextGuard)
@Controller('publish')
export class PublishController {
  constructor(private publish: PublishService) {}

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Get('targets')
  listTargets(@Req() req: Request, @CurrentSite() siteId: string) {
    const user = req.user as { id: string };
    return this.publish.listTargets(user.id, siteId);
  }

  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post('targets')
  addTarget(
    @Req() req: Request,
    @CurrentSite() siteId: string,
    @Body() dto: CreateTargetDto,
  ) {
    const user = req.user as { id: string };
    return this.publish.addTarget(user.id, siteId, dto);
  }

  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Patch('targets/:id')
  updateTarget(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateTargetDto,
  ) {
    const user = req.user as { id: string };
    return this.publish.updateTarget(user.id, id, dto);
  }

  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Delete('targets/:id')
  removeTarget(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.publish.removeTarget(user.id, id);
  }

  // Each test/publish makes an outbound network call — cap modestly.
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post('targets/:id/test')
  testTarget(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.publish.testTarget(user.id, id);
  }

  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Post('blogs/:blogId')
  publishBlog(
    @Req() req: Request,
    @Param('blogId') blogId: string,
    @Body() dto: PublishBlogDto,
  ) {
    const user = req.user as { id: string };
    return this.publish.publishBlog(user.id, blogId, dto?.targetIds);
  }

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Get('blogs/:blogId/records')
  listRecords(@Req() req: Request, @Param('blogId') blogId: string) {
    const user = req.user as { id: string };
    return this.publish.listRecords(user.id, blogId);
  }
}
