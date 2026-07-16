import {
  Body,
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
import { EntitlementsService } from '../entitlements/entitlements.service';
import { KeywordService } from './keyword.service';
import { ResearchKeywordDto } from './dto/research-keyword.dto';
import { SaveKeywordDto } from './dto/save-keyword.dto';

const HOUR = 60 * 60_000;

@UseGuards(JwtAuthGuard)
@Controller('keywords')
export class KeywordController {
  constructor(
    private keywords: KeywordService,
    private entitlements: EntitlementsService,
  ) {}

  // Each research call costs DataForSEO credits — plan-gated (free tier has no
  // keyword research) and capped hard (results cache 24h).
  @Throttle({ default: { limit: 20, ttl: HOUR } })
  @Post('research')
  async research(@Req() req: Request, @Body() dto: ResearchKeywordDto) {
    const user = req.user as { id: string };
    await this.entitlements.assertKeywordResearch(user.id);
    return this.keywords.research(dto?.seed ?? '', {
      locationCode: dto?.locationCode,
      languageCode: dto?.languageCode,
      limit: dto?.limit,
    });
  }

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Get('saved')
  listSaved(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.keywords.listSaved(user.id);
  }

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Post('saved')
  save(@Req() req: Request, @Body() dto: SaveKeywordDto) {
    const user = req.user as { id: string };
    return this.keywords.saveKeyword(user.id, dto);
  }

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Delete('saved/:id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.keywords.deleteSaved(user.id, id);
  }
}
