import { createHmac } from 'node:crypto';
import { percentEncode, signatureBaseString, oauth1Header } from './oauth1';

// Canonical example from X/Twitter's own "Creating a signature" documentation —
// a fixed, publicly-published vector. If our encoding/sorting/HMAC matches this,
// the signer is correct.
const EXAMPLE = {
  method: 'POST',
  url: 'https://api.twitter.com/1.1/statuses/update.json',
  // status is the (form) body param, include_entities the query param; both
  // participate in OAuth 1.0a signing for that endpoint.
  params: {
    status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
    include_entities: 'true',
  },
  oauth: {
    oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
    oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: '1318622958',
    oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
    oauth_version: '1.0',
  },
  // Arbitrary fixed secrets — the header test below verifies wiring against an
  // independently-computed HMAC, so these need not be Twitter's real values.
  consumerSecret: 'consumer-secret-fixture',
  tokenSecret: 'token-secret-fixture',
  expectedBaseString:
    'POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json&include_entities%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog%26oauth_nonce%3DkYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1318622958%26oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb%26oauth_version%3D1.0%26status%3DHello%2520Ladies%2520%252B%2520Gentlemen%252C%2520a%2520signed%2520OAuth%2520request%2521',
};

describe('percentEncode', () => {
  it('encodes the RFC 3986 reserved characters encodeURIComponent leaves alone', () => {
    expect(percentEncode("!*'()")).toBe('%21%2A%27%28%29');
  });
  it('leaves unreserved characters untouched', () => {
    expect(percentEncode('aZ09-._~')).toBe('aZ09-._~');
  });
  it('encodes spaces and plus distinctly', () => {
    expect(percentEncode('a b+c')).toBe('a%20b%2Bc');
  });
});

describe('signatureBaseString', () => {
  it('matches the documented Twitter example base string', () => {
    const base = signatureBaseString(EXAMPLE.method, EXAMPLE.url, {
      ...EXAMPLE.oauth,
      ...EXAMPLE.params,
    });
    expect(base).toBe(EXAMPLE.expectedBaseString);
  });
});

describe('oauth1Header', () => {
  it('signs the request with HMAC-SHA1 over the canonical base string', () => {
    const header = oauth1Header(
      EXAMPLE.method,
      EXAMPLE.url,
      {
        apiKey: EXAMPLE.oauth.oauth_consumer_key,
        apiSecret: EXAMPLE.consumerSecret,
        accessToken: EXAMPLE.oauth.oauth_token,
        accessTokenSecret: EXAMPLE.tokenSecret,
      },
      {
        query: EXAMPLE.params,
        nonce: EXAMPLE.oauth.oauth_nonce,
        timestamp: EXAMPLE.oauth.oauth_timestamp,
      },
    );

    // Independently compute the expected signature: HMAC-SHA1 of the (already
    // vector-verified) base string, keyed by `consumerSecret&tokenSecret`.
    const signingKey = `${EXAMPLE.consumerSecret}&${EXAMPLE.tokenSecret}`;
    const expectedSig = createHmac('sha1', signingKey)
      .update(EXAMPLE.expectedBaseString)
      .digest('base64');

    // The signature is percent-encoded inside the header value.
    expect(header).toContain(`oauth_signature="${percentEncode(expectedSig)}"`);
    // Well-formed OAuth header carrying the expected oauth_* fields.
    expect(header.startsWith('OAuth ')).toBe(true);
    expect(header).toContain('oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog"');
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(header).toContain(
      'oauth_nonce="kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg"',
    );
  });

  it('omits body/query params when none are given (the JSON tweet POST case)', () => {
    const header = oauth1Header(
      'POST',
      'https://api.twitter.com/2/tweets',
      {
        apiKey: 'ck',
        apiSecret: 'cs',
        accessToken: 'at',
        accessTokenSecret: 'ats',
      },
      { nonce: 'n', timestamp: '1' },
    );
    expect(header).toContain('oauth_signature="');
    expect(header).toContain('oauth_token="at"');
  });
});
