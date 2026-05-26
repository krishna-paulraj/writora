import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import * as express from 'express';
import { BlogService } from './blog.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

@Controller('blogs')
export class BlogController {
  constructor(private blogService: BlogService) {}

  // Public routes — declared first so generic `:id` route doesn't shadow them
  @Get('sitemap')
  sitemap() {
    return this.blogService.findAllPublishedForSitemap();
  }

  // Used by the www proxy to resolve a custom domain to its owner's username.
  @Get('by-domain/:domain')
  findByDomain(@Param('domain') domain: string) {
    return this.blogService.findUsernameByDomain(domain);
  }

  // Protected routes (require auth)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: express.Request, @Body() dto: CreateBlogDto) {
    const user = req.user as { id: string };
    return this.blogService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: express.Request) {
    const user = req.user as { id: string };
    return this.blogService.findAllByAuthor(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Req() req: express.Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.blogService.findOne(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Req() req: express.Request,
    @Param('id') id: string,
    @Body() dto: UpdateBlogDto,
  ) {
    const user = req.user as { id: string };
    return this.blogService.update(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: express.Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.blogService.remove(id, user.id);
  }

  // Set or clear the schedule for a post. Used by the calendar's drag-to-
  // reschedule handler. Body: { scheduledAt: ISO string | null }
  @UseGuards(JwtAuthGuard)
  @Patch(':id/schedule')
  setSchedule(
    @Req() req: express.Request,
    @Param('id') id: string,
    @Body() body: { scheduledAt: string | null },
  ) {
    const user = req.user as { id: string };
    return this.blogService.setSchedule(id, user.id, body?.scheduledAt ?? null);
  }

  // Preview (owner only)
  @UseGuards(JwtAuthGuard)
  @Get('preview/:slug')
  preview(@Req() req: express.Request, @Param('slug') slug: string) {
    const user = req.user as { id: string };
    return this.blogService.previewBySlug(user.id, slug);
  }

  // Public routes
  @Get('public/:username')
  findPublicByUsername(@Param('username') username: string) {
    return this.blogService.findPublicByUsername(username);
  }

  @Get('public/:username/:slug')
  findPublicByUsernameAndSlug(
    @Param('username') username: string,
    @Param('slug') slug: string,
  ) {
    return this.blogService.findPublicByUsernameAndSlug(username, slug);
  }
}
