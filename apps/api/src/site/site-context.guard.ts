import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SiteService } from './site.service';

/**
 * Resolves the active site for an authenticated request and stamps it on
 * req.siteId for the @CurrentSite() decorator. Runs AFTER JwtAuthGuard. Signal
 * order: X-Writora-Site header → writora_site cookie → the user's primary site.
 * Ownership is validated in resolveCurrentSite, so a spoofed header can't select
 * another tenant's site (and authorId/userId still gates every query anyway).
 */
@Injectable()
export class SiteContextGuard implements CanActivate {
  constructor(private sites: SiteService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<
      Request & {
        user?: { id: string };
        siteId?: string;
        cookies?: Record<string, string>;
      }
    >();
    const userId = req.user?.id;
    if (!userId) return true; // JwtAuthGuard owns auth; nothing to resolve.

    const headerRaw = req.headers['x-writora-site'];
    const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    const cookies = req.cookies as Record<string, string> | undefined;
    const requested: string | null = header || cookies?.writora_site || null;
    req.siteId = await this.sites.resolveCurrentSite(userId, requested);
    return true;
  }
}
