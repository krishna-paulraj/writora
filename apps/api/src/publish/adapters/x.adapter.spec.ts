import { BadRequestException } from '@nestjs/common';
import { XAdapter } from './x.adapter';
import type { AiService } from '../../ai/ai.service';
import type { PublishBlogInput } from './types';

const CREDS = {
  apiKey: 'consumer-key',
  apiSecret: 'consumer-secret',
  accessToken: 'access-token',
  accessTokenSecret: 'access-token-secret',
};

const INPUT: PublishBlogInput = {
  blogId: 'b1',
  title: 'Ten ways to ship faster',
  slug: 'ten-ways',
  description: 'A practical guide.',
  contentHtml: '<p>hi</p>',
  imageUrl: null,
  category: 'Engineering',
  canonicalUrl: 'https://writora.test/jane/ten-ways',
  existingExternalId: null,
};

function mockFetch(status: number, json: unknown) {
  const fn = jest.fn().mockResolvedValue({
    status,
    type: 'default',
    json: () => Promise.resolve(json),
  });
  global.fetch = fn;
  return fn;
}

function makeAdapter(ai: Partial<AiService>): XAdapter {
  return new XAdapter(ai as AiService);
}

function postedText(fetchFn: jest.Mock): string {
  const [, opts] = fetchFn.mock.calls[0] as [string, { body: string }];
  return (JSON.parse(opts.body) as { text: string }).text;
}

describe('XAdapter.validate', () => {
  const adapter = makeAdapter({ isConfigured: () => true });

  it('accepts a full credential set', () => {
    expect(() => adapter.validate(CREDS)).not.toThrow();
  });

  it.each(Object.keys(CREDS))('rejects when %s is missing', (field) => {
    const partial = { ...CREDS, [field]: '' };
    expect(() => adapter.validate(partial)).toThrow(BadRequestException);
  });
});

describe('XAdapter.publish', () => {
  afterEach(() => jest.restoreAllMocks());

  it('posts an AI-composed tweet with the canonical link appended', async () => {
    const composeTweet = jest
      .fn()
      .mockResolvedValue('🚀 Ship 10x faster today');
    const adapter = makeAdapter({ isConfigured: () => true, composeTweet });
    const fetchFn = mockFetch(201, { data: { id: '1750000000000000000' } });

    const result = await adapter.publish(CREDS, INPUT);

    expect(composeTweet).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchFn.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string> },
    ];
    expect(url).toBe('https://api.twitter.com/2/tweets');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toMatch(/^OAuth /);
    expect(postedText(fetchFn)).toBe(
      '🚀 Ship 10x faster today\n\nhttps://writora.test/jane/ten-ways',
    );
    expect(result).toEqual({
      externalId: '1750000000000000000',
      externalUrl: 'https://x.com/i/web/status/1750000000000000000',
    });
  });

  it('falls back to the title when AI is not configured', async () => {
    const composeTweet = jest.fn();
    const adapter = makeAdapter({ isConfigured: () => false, composeTweet });
    const fetchFn = mockFetch(201, { data: { id: '42' } });

    await adapter.publish(CREDS, INPUT);

    expect(composeTweet).not.toHaveBeenCalled();
    expect(postedText(fetchFn)).toBe(
      'Ten ways to ship faster\n\nhttps://writora.test/jane/ten-ways',
    );
  });

  it('falls back to the title when composition throws', async () => {
    const composeTweet = jest.fn().mockRejectedValue(new Error('rate limited'));
    const adapter = makeAdapter({ isConfigured: () => true, composeTweet });
    const fetchFn = mockFetch(201, { data: { id: '42' } });

    await adapter.publish(CREDS, INPUT);

    expect(postedText(fetchFn)).toContain('Ten ways to ship faster');
  });

  it('keeps the tweet within 280 chars, reserving room for the link', async () => {
    const longHook = 'x'.repeat(400);
    const composeTweet = jest.fn().mockResolvedValue(longHook);
    const adapter = makeAdapter({ isConfigured: () => true, composeTweet });
    const fetchFn = mockFetch(201, { data: { id: '42' } });

    await adapter.publish(CREDS, INPUT);

    const text = postedText(fetchFn);
    const hook = text.split('\n\n')[0];
    // 280 - 23 (t.co link) - 2 (separator) = 255 char hook budget.
    expect(hook.length).toBe(255);
    expect(hook.endsWith('…')).toBe(true);
  });

  it('does not re-tweet on re-publish (X cannot edit tweets)', async () => {
    const composeTweet = jest.fn();
    const adapter = makeAdapter({ isConfigured: () => true, composeTweet });
    const fetchFn = mockFetch(201, { data: { id: 'should-not-be-used' } });

    const result = await adapter.publish(CREDS, {
      ...INPUT,
      existingExternalId: '999',
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(composeTweet).not.toHaveBeenCalled();
    expect(result).toEqual({
      externalId: '999',
      externalUrl: 'https://x.com/i/web/status/999',
    });
  });

  it('surfaces an API error as a thrown failure', async () => {
    const adapter = makeAdapter({ isConfigured: () => false });
    mockFetch(403, { detail: 'not permitted' });
    await expect(adapter.publish(CREDS, INPUT)).rejects.toThrow();
  });
});

describe('XAdapter.test', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports the connected handle', async () => {
    const adapter = makeAdapter({ isConfigured: () => true });
    const fetchFn = mockFetch(200, { data: { username: 'jane' } });

    const result = await adapter.test(CREDS);

    const [url] = fetchFn.mock.calls[0] as [string];
    expect(url).toBe('https://api.twitter.com/2/users/me');
    expect(result).toEqual({ ok: true, info: '@jane' });
  });

  it('reports failure on a bad credential response', async () => {
    const adapter = makeAdapter({ isConfigured: () => true });
    mockFetch(401, { title: 'Unauthorized' });

    const result = await adapter.test(CREDS);

    expect(result.ok).toBe(false);
  });
});
