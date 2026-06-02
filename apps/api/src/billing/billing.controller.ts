import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StripeService } from './stripe.service';

const HOUR = 60 * 60_000;

@Controller('billing')
export class BillingController {
  constructor(private stripe: StripeService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post('checkout')
  checkout(@Req() req: Request, @Body() body: { plan?: string }) {
    const user = req.user as { id: string };
    return this.stripe.createCheckout(user.id, body?.plan ?? '');
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @Post('portal')
  portal(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.stripe.createPortal(user.id);
  }

  // Public Stripe webhook: raw body (for HMAC verification) + no throttling.
  @SkipThrottle()
  @HttpCode(200)
  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const raw = req.rawBody?.toString('utf8') ?? '';
    const event = this.stripe.verifyEvent(raw, signature);
    await this.stripe.handleEvent(event);
    return { received: true };
  }
}
