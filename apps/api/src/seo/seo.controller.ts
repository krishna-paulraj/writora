import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SeoService } from './seo.service';
import { ScoreSeoDto } from './dto/score-seo.dto';

const HOUR = 60 * 60_000;

@UseGuards(JwtAuthGuard)
@Controller('seo')
export class SeoController {
  constructor(private seo: SeoService) {}

  // Local computation — cheap, so a generous limit for live editor scoring.
  @Throttle({ default: { limit: 240, ttl: HOUR } })
  @Post('score')
  score(@Body() dto: ScoreSeoDto) {
    return this.seo.score(dto);
  }
}
