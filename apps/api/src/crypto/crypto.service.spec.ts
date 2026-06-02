import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

// 32 bytes as 64 hex chars.
const KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function make(key: string | undefined): CryptoService {
  const config = {
    get: (k: string) => (k === 'ENCRYPTION_KEY' ? key : undefined),
  } as unknown as ConfigService;
  return new CryptoService(config);
}

describe('CryptoService', () => {
  it('reports configured only with a valid 32-byte key', () => {
    expect(make(KEY).isConfigured()).toBe(true);
    expect(make(undefined).isConfigured()).toBe(false);
    expect(make('tooshort').isConfigured()).toBe(false);
  });

  it('round-trips text through encrypt/decrypt', () => {
    const svc = make(KEY);
    const secret = 'wp-app-password-😀-with-unicode';
    const packed = svc.encrypt(secret);
    expect(packed).toMatch(/^v1:/);
    expect(packed).not.toContain(secret);
    expect(svc.decrypt(packed)).toBe(secret);
  });

  it('round-trips JSON credential blobs', () => {
    const svc = make(KEY);
    const creds = { siteUrl: 'https://x.com', token: 'abc123' };
    expect(svc.decryptJson(svc.encryptJson(creds))).toEqual(creds);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const svc = make(KEY);
    expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
  });

  it('fails to decrypt tampered ciphertext (GCM auth)', () => {
    const svc = make(KEY);
    const packed = svc.encrypt('secret');
    const parts = packed.split(':');
    const ct = Buffer.from(parts[3], 'base64');
    ct[0] ^= 0xff; // flip a bit
    parts[3] = ct.toString('base64');
    expect(() => svc.decrypt(parts.join(':'))).toThrow();
  });

  it('throws ServiceUnavailable when unconfigured', () => {
    const svc = make(undefined);
    expect(() => svc.encrypt('x')).toThrow();
  });
});
