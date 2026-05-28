import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AiService, EditAction, Tone } from './ai.service';
import { ArticleGenerationService } from './article-generation.service';
import { GenerateArticleDto } from './dto/generate-article.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface EditBody {
  action: EditAction;
  text: string;
  tone?: Tone;
}

interface ContentBody {
  content: string;
}

const HOUR = 60 * 60_000;

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private ai: AiService,
    private articleGen: ArticleGenerationService,
  ) {}

  // 60 AI edits per hour per IP — generous for active writing, expensive enough
  // that 60 is more than a single user needs and bots get capped.
  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Post('edit')
  async edit(@Body() body: EditBody, @Res() res: Response) {
    if (!body?.action || !body?.text) {
      throw new BadRequestException('action and text are required');
    }

    // Stream as text/event-stream-like plain chunks. Client reads via fetch +
    // ReadableStream; we don't need full SSE framing.
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

    try {
      for await (const chunk of this.ai.streamEdit(
        body.action,
        body.text,
        body.tone,
      )) {
        res.write(chunk);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      if (!res.headersSent) {
        res.status(500);
      }
      res.write(`\n[error: ${message}]`);
    } finally {
      res.end();
    }
  }

  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post('title')
  suggestTitles(@Body() body: ContentBody) {
    return this.ai.suggestTitles(body?.content ?? '');
  }

  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post('summarize')
  summarize(@Body() body: ContentBody) {
    return this.ai.summarize(body?.content ?? '');
  }

  // Full-article generation is expensive (one OpenAI call per section) — cap
  // hard. Returns a job id; the client polls the GET endpoints below.
  @Throttle({ default: { limit: 10, ttl: HOUR } })
  @Post('article')
  generateArticle(@Req() req: Request, @Body() dto: GenerateArticleDto) {
    const user = req.user as { id: string };
    return this.articleGen.enqueue(user.id, dto);
  }

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Get('articles')
  listArticleJobs(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.articleGen.listJobs(user.id);
  }

  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @Get('article/:jobId')
  getArticleJob(@Req() req: Request, @Param('jobId') jobId: string) {
    const user = req.user as { id: string };
    return this.articleGen.getJob(user.id, jobId);
  }
}
