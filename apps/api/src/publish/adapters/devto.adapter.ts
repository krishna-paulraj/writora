import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { htmlToMarkdown } from '../html-to-markdown';
import { requestJson } from './http';
import { PublishAdapter, PublishBlogInput, PublishResult } from './types';

interface DevtoCreds {
  apiKey: string;
}

const DEVTO_BASE = 'https://dev.to/api';

// Dev.to tags: lowercase alphanumeric, no spaces, max 4. Derive one from the
// post category so the article isn't tagless.
function toTag(category: string): string[] {
  const t = category
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
  return t ? [t] : [];
}

/**
 * Publishes to Dev.to (Forem) via its REST API. Dev.to is markdown-only, so the
 * post HTML is converted with {@link htmlToMarkdown}; `canonical_url` points at
 * the Writora original. Re-publishing updates the existing article (PUT) when a
 * prior external id is known.
 */
@Injectable()
export class DevtoAdapter implements PublishAdapter {
  readonly platform = 'devto';
  // Dev.to's create endpoint has no idempotency key — a retried create whose
  // first outcome is unknown would publish a duplicate article.
  readonly idempotentCreate = false;

  validate(creds: Record<string, unknown>): void {
    const c = creds as Partial<DevtoCreds>;
    if (typeof c.apiKey !== 'string' || c.apiKey.trim().length < 8) {
      throw new BadRequestException('A Dev.to API key is required');
    }
  }

  private headers(apiKey: string): Record<string, string> {
    return { 'api-key': apiKey };
  }

  async test(
    creds: Record<string, unknown>,
  ): Promise<{ ok: boolean; info?: string }> {
    const c = creds as unknown as DevtoCreds;
    const res = await requestJson(`${DEVTO_BASE}/users/me`, {
      method: 'GET',
      headers: this.headers(c.apiKey),
    });
    if (!res.ok) return { ok: false, info: res.error ?? undefined };
    const username =
      res.json && typeof res.json === 'object'
        ? (res.json as Record<string, unknown>).username
        : undefined;
    return {
      ok: true,
      info: typeof username === 'string' ? username : undefined,
    };
  }

  async publish(
    creds: Record<string, unknown>,
    input: PublishBlogInput,
  ): Promise<PublishResult> {
    const c = creds as unknown as DevtoCreds;
    const article = {
      title: input.title,
      body_markdown: htmlToMarkdown(input.contentHtml),
      published: true,
      canonical_url: input.canonicalUrl,
      description: input.description || undefined,
      main_image: input.imageUrl || undefined,
      tags: toTag(input.category),
    };

    const isUpdate = !!input.existingExternalId;
    const url = isUpdate
      ? `${DEVTO_BASE}/articles/${input.existingExternalId}`
      : `${DEVTO_BASE}/articles`;

    const res = await requestJson(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: this.headers(c.apiKey),
      body: { article },
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(
        res.error ?? 'Dev.to publish failed',
      );
    }
    const data = (res.json ?? {}) as Record<string, unknown>;
    const id = data.id;
    const articleUrl = data.url;
    if (
      (typeof id !== 'string' && typeof id !== 'number') ||
      typeof articleUrl !== 'string'
    ) {
      throw new ServiceUnavailableException(
        'Dev.to returned an unexpected response (no article id/url)',
      );
    }
    return { externalId: String(id), externalUrl: articleUrl };
  }
}
