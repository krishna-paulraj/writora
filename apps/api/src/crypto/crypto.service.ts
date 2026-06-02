import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // GCM standard nonce length
const PREFIX = 'v1';

/**
 * AES-256-GCM encryption for third-party secrets (e.g. a user's WordPress
 * connection token or Dev.to API key) stored at rest. The key comes from
 * ENCRYPTION_KEY (32 bytes as 64 hex chars or base64). When unset/invalid, the
 * service reports notConfigured and credential features degrade to 503 — the
 * same graceful-disable pattern the AI/keyword modules use.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    this.key = CryptoService.parseKey(config.get<string>('ENCRYPTION_KEY'));
    if (!this.key) {
      this.logger.warn(
        'ENCRYPTION_KEY not set or invalid (need 32 bytes as 64 hex chars or base64) — features that store credentials will return 503',
      );
    }
  }

  private static parseKey(raw: string | undefined): Buffer | null {
    if (!raw) return null;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    // base64 / base64url. Buffer.from is lenient (drops invalid chars and never
    // throws), so accept only canonical input that round-trips to 32 bytes.
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(raw)) return null;
    const b = Buffer.from(raw, 'base64');
    if (b.length !== 32) return null;
    const normalized = raw
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/=+$/, '');
    return b.toString('base64').replace(/=+$/, '') === normalized ? b : null;
  }

  isConfigured(): boolean {
    return this.key !== null;
  }

  private ensureKey(): Buffer {
    if (!this.key) {
      throw new ServiceUnavailableException(
        'Encryption is not configured on this server (set ENCRYPTION_KEY)',
      );
    }
    return this.key;
  }

  /** Encrypts UTF-8 text → `v1:<iv b64>:<tag b64>:<ciphertext b64>`. */
  encrypt(plaintext: string): string {
    const key = this.ensureKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const ct = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  }

  decrypt(packed: string): string {
    const key = this.ensureKey();
    const parts = packed.split(':');
    if (parts.length !== 4 || parts[0] !== PREFIX) {
      throw new Error('malformed ciphertext');
    }
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ct = Buffer.from(parts[3], 'base64');
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
      'utf8',
    );
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(packed: string): T {
    return JSON.parse(this.decrypt(packed)) as T;
  }
}
