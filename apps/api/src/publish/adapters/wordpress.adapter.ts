import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { requestJson } from './http';
import { assertPublicUrl, assertSafeUrlSyntax } from '../../common/ssrf-guard';
import { PublishAdapter, PublishBlogInput, PublishResult } from './types';

interface WpCreds {
  siteUrl: string;
  token: string;
}

function normSite(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Publishes to WordPress through the companion "Writora Connector" plugin,
 * which exposes a token-authenticated REST route that upserts the post by
 * `writoraBlogId` (so re-publishing updates rather than duplicates), sideloads
 * the featured image, and sets the canonical URL back to the Writora original.
 */
@Injectable()
export class WordPressAdapter implements PublishAdapter {
  readonly platform = 'wordpress';
  // The Writora Connector plugin looks posts up by writoraBlogId before
  // creating, so a retried create updates the existing post instead.
  readonly idempotentCreate = true;

  validate(creds: Record<string, unknown>): void {
    const c = creds as Partial<WpCreds>;
    if (typeof c.siteUrl !== 'string' || !/^https?:\/\//i.test(c.siteUrl)) {
      throw new BadRequestException(
        'A valid WordPress site URL (https://…) is required',
      );
    }
    // Reject obviously-internal hosts at connect time (DNS-resolved private
    // hosts are caught at request time by assertPublicUrl).
    assertSafeUrlSyntax(c.siteUrl);
    if (typeof c.token !== 'string' || c.token.trim().length < 8) {
      throw new BadRequestException(
        'A Writora Connector connection token is required',
      );
    }
  }

  private headers(token: string): Record<string, string> {
    return { 'X-Writora-Token': token };
  }

  async test(
    creds: Record<string, unknown>,
  ): Promise<{ ok: boolean; info?: string }> {
    const c = creds as unknown as WpCreds;
    try {
      await assertPublicUrl(c.siteUrl);
    } catch (err) {
      return {
        ok: false,
        info: err instanceof Error ? err.message : 'Unsafe site URL',
      };
    }
    const res = await requestJson(
      `${normSite(c.siteUrl)}/wp-json/writora/v1/ping`,
      { method: 'GET', headers: this.headers(c.token), redirect: 'manual' },
    );
    if (!res.ok) return { ok: false, info: res.error ?? undefined };
    const site =
      res.json && typeof res.json === 'object'
        ? (res.json as Record<string, unknown>).site
        : undefined;
    return { ok: true, info: typeof site === 'string' ? site : undefined };
  }

  async publish(
    creds: Record<string, unknown>,
    input: PublishBlogInput,
  ): Promise<PublishResult> {
    const c = creds as unknown as WpCreds;
    await assertPublicUrl(c.siteUrl);
    const res = await requestJson(
      `${normSite(c.siteUrl)}/wp-json/writora/v1/publish`,
      {
        method: 'POST',
        headers: this.headers(c.token),
        redirect: 'manual',
        body: {
          writoraBlogId: input.blogId,
          title: input.title,
          slug: input.slug,
          html: input.contentHtml,
          excerpt: input.description,
          canonicalUrl: input.canonicalUrl,
          featuredImageUrl: input.imageUrl,
          category: input.category,
          status: 'publish',
        },
      },
    );
    if (!res.ok) {
      throw new ServiceUnavailableException(
        res.error ?? 'WordPress publish failed',
      );
    }
    const data = (res.json ?? {}) as Record<string, unknown>;
    const id = data.id;
    const url = data.url;
    if (
      (typeof id !== 'string' && typeof id !== 'number') ||
      typeof url !== 'string'
    ) {
      throw new ServiceUnavailableException(
        'WordPress returned an unexpected response (no post id/url)',
      );
    }
    return { externalId: String(id), externalUrl: url };
  }
}
