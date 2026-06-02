import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import * as express from 'express';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SiteContextGuard } from '../site/site-context.guard';
import { CurrentSite } from '../site/current-site.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard, SiteContextGuard)
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  @Post()
  create(
    @Req() req: express.Request,
    @CurrentSite() siteId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    const user = req.user as { id: string };
    return this.categoryService.create(user.id, siteId, dto);
  }

  @Get()
  findAll(@Req() req: express.Request, @CurrentSite() siteId: string) {
    const user = req.user as { id: string };
    return this.categoryService.findAll(user.id, siteId);
  }

  @Delete(':id')
  remove(@Req() req: express.Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.categoryService.remove(id, user.id);
  }
}
