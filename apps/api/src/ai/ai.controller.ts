import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AiService, EditAction, Tone } from './ai.service';
import { ArticleGenerationService } from './article-generation.service';
import { ImageGenerationService, ImageKind } from './image-generation.service';
import { GenerateArticleDto } from './dto/generate-article.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SiteContextGuard } from '../site/site-context.guard';
import { CurrentSite } from '../site/current-site.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

interface EditBody {
  action: EditAction;
  text: string;
  tone?: Tone;
}

interface ContentBody {
  content: string;
}

interface GenerateImageBody {
  kind?: ImageKind;
  title?: string;
  heading?: string;
  description?: string;
  keyword?: string;
  prompt?: string;
  style?: string;
}

const HOUR = 60 * 60_000;

@UseGuards(JwtAuthGuard, SiteContextGuard)
@Controller('ai')
export class AiController {
  constructor(
    private ai: AiService,
    private articleGen: ArticleGenerationService,
    private imageGen: ImageGenerationService,
    private prisma: PrismaService,
    private entitlements: EntitlementsService,
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
  generateArticle(
    @Req() req: Request,
    @CurrentSite() siteId: string,
    @Body() dto: GenerateArticleDto,
  ) {
    const user = req.user as { id: string };
    return this.articleGen.enqueue(user.id, siteId, dto);
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

  // On-demand image generation for the editor (cover + inline). Generating an
  // image is a paid Recraft call, so cap it tighter than text edits.
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post('image')
  async generateImage(
    @Req() req: Request,
    @CurrentSite() siteId: string,
    @Body() body: GenerateImageBody,
  ) {
    if (!this.imageGen.isConfigured()) {
      throw new ServiceUnavailableException(
        'Image generation is not configured on this server',
      );
    }
    const user = req.user as { id: string };
    // Image generation is a paid external (Recraft) call, so meter it against
    // the user's monthly AI quota and gate it by plan — same accounting as
    // article generation. Throws 403 when the monthly limit is exhausted.
    await this.entitlements.assertCanGenerateAi(user.id);
    try {
      // Style precedence: explicit request style → the site's default → fallback.
      let style = body.style;
      if (!style) {
        const site = await this.prisma.site.findUnique({
          where: { id: siteId },
          select: { imageStyle: true },
        });
        style = site?.imageStyle;
      }
      return await this.imageGen.generateImage({
        kind: body.kind ?? 'featured',
        style,
        title: body.title,
        heading: body.heading,
        description: body.description,
        keyword: body.keyword,
        prompt: body.prompt,
      });
    } catch (err) {
      // Refund the reserved slot when generation fails to produce an image.
      await this.entitlements.releaseAiGeneration(user.id);
      throw err;
    }
  }
}
