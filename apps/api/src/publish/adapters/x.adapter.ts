import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { requestJson } from './http';
import { oauth1Header, OAuth1Tokens } from './oauth1';
import { PublishAdapter, PublishBlogInput, PublishResult } from './types';

interface XCreds {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

const TWEETS_URL = 'https://api.twitter.com/2/tweets';
const ME_URL = 'https://api.twitter.com/2/users/me';
const TWEET_LIMIT = 280;
// t.co wraps every link to a fixed length regardless of the real URL, so the
// canonical link always costs this much against the 280 budget.
const TCO_URL_LEN = 23;
const SEPARATOR = '\n\n';
const HOOK_BUDGET = TWEET_LIMIT - TCO_URL_LEN - SEPARATOR.length;

function trimTo(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

/**
 * Auto-posts a freshly published article to X (Twitter) as a single tweet:
 * an AI-written hook plus the canonical Writora link. Authenticated with the
 * user's own OAuth 1.0a tokens (consumer key/secret + access token/secret),
 * which are long-lived and fit the encrypted-credentials model — no connect
 * flow or token refresh needed.
 *
 * X has no API to edit a tweet, so re-publishing a post is a deliberate no-op
 * (returns the prior tweet) rather than firing a duplicate.
 */
@Injectable()
export class XAdapter implements PublishAdapter {
  readonly platform = 'x';
  private readonly logger = new Logger(XAdapter.name);

  constructor(private readonly ai: AiService) {}

  validate(creds: Record<string, unknown>): void {
    const c = creds as Partial<XCreds>;
    const fields: (keyof XCreds)[] = [
      'apiKey',
      'apiSecret',
      'accessToken',
      'accessTokenSecret',
    ];
    for (const f of fields) {
      const v = c[f];
      if (typeof v !== 'string' || v.trim().length < 5) {
        throw new BadRequestException(
          'X requires apiKey, apiSecret, accessToken, and accessTokenSecret (from your X developer app, with Read and Write permissions)',
        );
      }
    }
  }

  private tokens(c: XCreds): OAuth1Tokens {
    return {
      apiKey: c.apiKey,
      apiSecret: c.apiSecret,
      accessToken: c.accessToken,
      accessTokenSecret: c.accessTokenSecret,
    };
  }

  async test(
    creds: Record<string, unknown>,
  ): Promise<{ ok: boolean; info?: string }> {
    const c = creds as unknown as XCreds;
    const res = await requestJson(ME_URL, {
      method: 'GET',
      headers: { Authorization: oauth1Header('GET', ME_URL, this.tokens(c)) },
    });
    if (!res.ok) return { ok: false, info: res.error ?? undefined };
    const data =
      res.json && typeof res.json === 'object'
        ? (res.json as { data?: { username?: unknown } }).data
        : undefined;
    const username = data?.username;
    return {
      ok: true,
      info: typeof username === 'string' ? `@${username}` : undefined,
    };
  }

  async publish(
    creds: Record<string, unknown>,
    input: PublishBlogInput,
  ): Promise<PublishResult> {
    const c = creds as unknown as XCreds;

    // X can't edit a tweet via API — re-publishing must not duplicate it.
    if (input.existingExternalId) {
      return {
        externalId: input.existingExternalId,
        externalUrl: this.tweetUrl(input.existingExternalId),
      };
    }

    const text = await this.composeText(input);
    const res = await requestJson(TWEETS_URL, {
      method: 'POST',
      headers: {
        Authorization: oauth1Header('POST', TWEETS_URL, this.tokens(c)),
      },
      body: { text },
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(res.error ?? 'X publish failed');
    }
    const id = (res.json as { data?: { id?: unknown } } | null)?.data?.id;
    if (typeof id !== 'string' && typeof id !== 'number') {
      throw new ServiceUnavailableException(
        'X returned an unexpected response (no tweet id)',
      );
    }
    return { externalId: String(id), externalUrl: this.tweetUrl(String(id)) };
  }

  /**
   * AI-written hook + link, kept under 280. Falls back to the post title when
   * AI is unconfigured or errors, so auto-post never fails just because the
   * model is unavailable.
   */
  private async composeText(input: PublishBlogInput): Promise<string> {
    let hook = input.title;
    if (this.ai.isConfigured()) {
      try {
        const composed = await this.ai.composeTweet({
          title: input.title,
          description: input.description,
          maxChars: HOOK_BUDGET,
        });
        if (composed) hook = composed;
      } catch (err) {
        this.logger.warn(
          `tweet composition fell back to title: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return `${trimTo(hook, HOOK_BUDGET)}${SEPARATOR}${input.canonicalUrl}`;
  }

  // X redirects the handle-less /i/web/status/<id> form to the canonical tweet,
  // so we don't need an extra API call to learn the author's @handle.
  private tweetUrl(id: string): string {
    return `https://x.com/i/web/status/${id}`;
  }
}
