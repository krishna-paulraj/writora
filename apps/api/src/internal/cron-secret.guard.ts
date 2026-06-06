import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Protects the internal cron-trigger endpoint with a shared secret. The external
 * scheduler (e.g. cron-job.org) presents the secret as either an
 * `Authorization: Bearer <secret>` header or an `X-Cron-Secret: <secret>` header.
 *
 * Fails closed: if CRON_SECRET is unset, every request is rejected, so the
 * endpoint can never run unauthenticated. The comparison is constant-time.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  private readonly logger = new Logger(CronSecretGuard.name);
  private readonly secret: string | undefined;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('CRON_SECRET');
    if (!this.secret) {
      this.logger.warn(
        'CRON_SECRET not set — /internal/cron/tick is disabled (returns 401). ' +
          'Set it and point your scheduler at the endpoint.',
      );
    }
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.secret) throw new UnauthorizedException();

    const req = ctx.switchToHttp().getRequest<Request>();
    const presented = this.extract(req);
    if (!presented || !this.matches(presented)) {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extract(req: Request): string | null {
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    const header = req.headers['x-cron-secret'];
    const value = Array.isArray(header) ? header[0] : header;
    return value?.trim() || null;
  }

  /**
   * Constant-time comparison. Hashing both sides first gives fixed-length
   * buffers — this avoids leaking the secret's length and sidesteps
   * timingSafeEqual's throw on unequal-length inputs.
   */
  private matches(presented: string): boolean {
    const a = createHash('sha256').update(presented).digest();
    const b = createHash('sha256').update(this.secret!).digest();
    return timingSafeEqual(a, b);
  }
}
