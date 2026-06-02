import { createHmac, randomBytes } from 'node:crypto';

/**
 * OAuth 1.0a (HMAC-SHA1) request signing — what the X (Twitter) API requires
 * for user-context writes like POST /2/tweets. Kept dependency-free and
 * self-contained so it's easy to unit-test against the canonical Twitter
 * example vector (see oauth1.spec.ts).
 *
 * Only the oauth_* parameters and any URL query parameters participate in the
 * signature base string. A JSON request body does NOT — which is exactly the
 * shape of the v2 tweet endpoint (`{ "text": "…" }` posted as JSON).
 */
export interface OAuth1Tokens {
  apiKey: string; // consumer key
  apiSecret: string; // consumer secret
  accessToken: string; // user access token
  accessTokenSecret: string; // user access token secret
}

/**
 * RFC 3986 percent-encoding. encodeURIComponent leaves !*'() unescaped, which
 * OAuth requires to be encoded — fix those up.
 */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * Builds the signature base string: METHOD&pct(url)&pct(sorted-param-string).
 * `params` must already merge the oauth_* params with any query params.
 */
export function signatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const paramString = Object.keys(params)
    .map((k) => [percentEncode(k), percentEncode(params[k])] as const)
    // Sort by encoded key, then by encoded value (RFC 5849 §3.4.1.3.2).
    .sort((a, b) => {
      if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
      if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
      return 0;
    })
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  return [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&');
}

/**
 * Returns the value for an `Authorization: OAuth …` header. `query` holds any
 * URL query parameters (none for the JSON tweet POST). `nonce`/`timestamp` are
 * injectable for deterministic tests; in production they're random/now.
 */
export function oauth1Header(
  method: string,
  url: string,
  tokens: OAuth1Tokens,
  opts: {
    query?: Record<string, string>;
    nonce?: string;
    timestamp?: string;
  } = {},
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: tokens.apiKey,
    oauth_nonce: opts.nonce ?? randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: opts.timestamp ?? Math.floor(Date.now() / 1000).toString(),
    oauth_token: tokens.accessToken,
    oauth_version: '1.0',
  };

  const baseString = signatureBaseString(method, url, {
    ...oauth,
    ...(opts.query ?? {}),
  });
  const signingKey = `${percentEncode(tokens.apiSecret)}&${percentEncode(
    tokens.accessTokenSecret,
  )}`;
  const oauth_signature = createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  const headerParams = { ...oauth, oauth_signature };
  return (
    'OAuth ' +
    Object.keys(headerParams)
      .sort()
      .map(
        (k) =>
          `${percentEncode(k)}="${percentEncode(
            headerParams[k as keyof typeof headerParams],
          )}"`,
      )
      .join(', ')
  );
}
