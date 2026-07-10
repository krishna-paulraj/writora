/**
 * Fail-closed environment validation, wired into `ConfigModule.forRoot({ validate })`.
 *
 * In production the process refuses to boot with an insecure or misconfigured
 * secret (a weak JWT_SECRET is a full auth bypass; a malformed ENCRYPTION_KEY
 * silently disables at-rest encryption). In local dev we only warn — never block
 * the developer loop.
 *
 * Deliberately dependency-free (no Joi/zod): a plain function that reads the raw
 * env map, checks the security-critical vars, and returns it unchanged.
 */

// The placeholder JWT_SECRET that ships in dev configs. Must never reach prod.
const WEAK_JWT_SECRET = 'writora_jwt_secret_change_in_production_k9x2m4p7';
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Mirrors CryptoService.parseKey's accepted format: 32 bytes provided as either
 * 64 hex chars or canonical base64/base64url. Kept in sync by hand — we must not
 * import from crypto.service.ts here (that would pull the Nest DI graph into
 * config bootstrap). Returns true when `raw` is a key the service will accept.
 */
function isValidEncryptionKey(raw: string): boolean {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return true;
  // Buffer.from(base64) is lenient (drops invalid chars, never throws), so only
  // accept canonical input that round-trips to exactly 32 bytes.
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(raw)) return false;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) return false;
  const normalized = raw
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/=+$/, '');
  return buf.toString('base64').replace(/=+$/, '') === normalized;
}

export function validate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const isProduction = config.NODE_ENV === 'production';
  const problems: string[] = [];

  const jwtSecret =
    typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET : '';
  if (!jwtSecret) {
    problems.push('JWT_SECRET is missing');
  } else if (jwtSecret === WEAK_JWT_SECRET) {
    problems.push(
      'JWT_SECRET is the known weak dev placeholder — generate a fresh one (openssl rand -base64 48)',
    );
  } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (got ${jwtSecret.length})`,
    );
  }

  // ENCRYPTION_KEY is optional (credential features degrade to 503 without it),
  // but if provided it MUST be valid — a malformed key silently disables
  // encryption, which is worse than a loud failure.
  const encryptionKey = config.ENCRYPTION_KEY;
  if (
    typeof encryptionKey === 'string' &&
    encryptionKey.length > 0 &&
    !isValidEncryptionKey(encryptionKey)
  ) {
    problems.push(
      'ENCRYPTION_KEY is set but invalid — expected 32 bytes as 64 hex chars or base64 (openssl rand -hex 32)',
    );
  }

  if (problems.length > 0) {
    const message = `Invalid environment configuration:\n  - ${problems.join('\n  - ')}`;
    if (isProduction) {
      throw new Error(message);
    }
    // Local dev: surface the issue but never block the developer loop.
    console.warn(`[env.validation] ${message}`);
  }

  return config;
}
