import {
  Controller,
  Get,
  Post,
  Put,
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
