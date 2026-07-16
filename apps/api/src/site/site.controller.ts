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
import { SiteService } from './site.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SetDomainDto } from './dto/set-domain.dto';

const HOUR = 60 * 60_000;

@UseGuards(JwtAuthGuard)
@Controller('sites')
export class SiteController {
  constructor(private sites: SiteService) {}

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Get()
  list(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.sites.list(user.id);
  }

  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post()
  create(@Req() req: Request, @Body() dto: CreateSiteDto) {
    const user = req.user as { id: string };
    return this.sites.create(user.id, dto);
  }

  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
  ) {
    const user = req.user as { id: string };
    return this.sites.update(user.id, id, dto);
  }

  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Patch(':id/domain')
  setDomain(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: SetDomainDto,
  ) {
    const user = req.user as { id: string };
    return this.sites.setCustomDomain(user.id, id, body?.customDomain ?? null);
  }

  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.sites.remove(user.id, id);
  }
}
