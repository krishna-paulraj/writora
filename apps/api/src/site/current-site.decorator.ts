import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Injects the active site id resolved by SiteContextGuard onto a handler param.
 * Always paired with `@UseGuards(JwtAuthGuard, SiteContextGuard)`.
 */
export const CurrentSite = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ siteId?: string }>();
    return req.siteId ?? '';
  },
);
