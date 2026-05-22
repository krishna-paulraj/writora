import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

@Controller('webhooks')
export class WebhookController {
  constructor(private webhooks: WebhookService) {}

  // --- Inbound: external systems POST to create blogs -----------------------

  // Public endpoint. Authenticated via `Authorization: Bearer <token>` where
  // `<token>` is the user's inboundWebhookSecret.
  @Throttle({ default: { limit: 60, ttl: HOUR } })
  @Post('blogs/in')
  async inboundCreate(@Req() req: Request, @Body() body: unknown) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const userId = await this.webhooks.resolveInboundToken(match[1].trim());
    if (!userId) {
      throw new UnauthorizedException('Invalid webhook token');
    }
    return this.webhooks.createBlogFromInbound(
      userId,
      body as Parameters<WebhookService['createBlogFromInbound']>[1],
    );
  }

  // --- Inbound config (authenticated owner) ---------------------------------

  @UseGuards(JwtAuthGuard)
  @Get('inbound')
  getInbound(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.webhooks.getInboundConfig(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('inbound/regenerate')
  regenerateInbound(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.webhooks.regenerateInbound(user.id);
  }

  // --- Outbound endpoint CRUD ----------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Get('outbound')
  list(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.webhooks.listEndpoints(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('outbound')
  add(
    @Req() req: Request,
    @Body() body: { url: string; description?: string },
  ) {
    const user = req.user as { id: string };
    return this.webhooks.addEndpoint(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('outbound/:id')
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.webhooks.removeEndpoint(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('outbound/:id/test')
  test(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    return this.webhooks.testEndpoint(user.id, id);
  }
}
