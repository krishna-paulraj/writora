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
import { ContentPlanService } from './content-plan.service';
import { CreateContentPlanDto } from './dto/create-content-plan.dto';
import type { PlanItemInput } from './dto/create-content-plan.dto';
import { UpdateContentPlanDto } from './dto/update-content-plan.dto';
import { UpdatePlanItemDto } from './dto/update-plan-item.dto';
import { QuickAddDto } from './dto/quick-add.dto';

const HOUR = 60 * 60_000;

@UseGuards(JwtAuthGuard, SiteContextGuard)
@Controller('content-plans')
export class ContentPlanController {
  constructor(private plans: ContentPlanService) {}

  // Creating a plan brainstorms ideas via one OpenAI call — cap like AI routes.
  @Throttle({ default: { limit: 20, ttl: HOUR } })
  @Post()
  create(
    @Req() req: Request,
    @CurrentSite() siteId: string,
    @Body() dto: CreateContentPlanDto,
  ) {
    const user = req.user as { id: string };
    return this.plans.create(user.id, siteId, dto);
  }

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Get()
  list(@Req() req: Request, @CurrentSite() siteId: string) {
    const user = req.user as { id: string };
    return this.plans.list(user.id, siteId);
  }

  // Unified planner feed (blogs + AI plan items). Declared before :id so the
  // literal route wins. Polled by the calendar, so a generous limit.
  @Throttle({ default: { limit: 600, ttl: HOUR } })
  @Get('calendar')
  calendar(@Req() req: Request, @CurrentSite() siteId: string) {
    const user = req.user as { id: string };
    return this.plans.getCalendar(user.id, siteId);
  }

  // Quick-add an article for a calendar day (rides a per-site "Quick adds" plan).
  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Post('quick-add')
  quickAdd(
    @Req() req: Request,
    @CurrentSite() siteId: string,
    @Body() body: QuickAddDto,
  ) {
    const user = req.user as { id: string };
    return this.plans.quickAdd(user.id, siteId, body);
  }

  // Polled by the detail page while an article generates — generous limit for
  // this cheap owner-scoped read so normal polling never trips the throttle.
  @Throttle({ default: { limit: 1000, ttl: HOUR } })
  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.plans.get(user.id, id);
  }

  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateContentPlanDto,
  ) {
    const user = req.user as { id: string };
    return this.plans.update(user.id, id, dto);
  }

  // Manual "generate next now" — cap harder since each run costs an AI article.
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post(':id/run')
  run(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.plans.runNow(user.id, id);
  }

  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Post(':id/items')
  addItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: PlanItemInput,
  ) {
    const user = req.user as { id: string };
    return this.plans.addItem(user.id, id, body);
  }

  // Reschedule/edit a single planned item (drag-to-reschedule on the calendar).
  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Patch(':id/items/:itemId')
  updateItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdatePlanItemDto,
  ) {
    const user = req.user as { id: string };
    return this.plans.updateItem(user.id, id, itemId, body);
  }

  // Defined before DELETE :id so the more specific route matches first.
  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Delete(':id/items/:itemId')
  removeItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    const user = req.user as { id: string };
    return this.plans.removeItem(user.id, id, itemId);
  }

  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.plans.remove(user.id, id);
  }
}
