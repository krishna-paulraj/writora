import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// SSRF egress guard for adapters that fetch a USER-CONTROLLED URL (the
// WordPress site URL). Blocks loopback/private/link-local/reserved targets so a
// tenant can't make the API server probe internal services (e.g. the cloud
// metadata endpoint 169.254.169.254). DNS-resolution check at request time
// also defeats hostnames that resolve to private space (basic rebinding guard).

function isBlockedIp(input: string): boolean {
  // Unwrap IPv4-mapped IPv6 (::ffff:127.0.0.1) to its v4 form.
  const mapped = input.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const ip = mapped ? mapped[1] : input;

  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true; // this-net, private, loopback
    if (a === 169 && b === 254) return true; // link-local (incl. metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  const v6 = input.toLowerCase();
  if (v6 === '::1' || v6 === '::') return true; // loopback / unspecified
  if (v6.startsWith('fe80') || v6.startsWith('fec0')) return true; // link/site-local
  if (/^f[cd]/.test(v6)) return true; // unique-local fc00::/7
  return false;
}

/** Synchronous structural check: scheme + obviously-internal host literals. */
export function assertSafeUrlSyntax(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('URL must use http(s)');
  }
  const host = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (host === 'localhost' || host.toLowerCase().endsWith('.localhost')) {
    throw new BadRequestException('URL host is not allowed');
  }
  if (isIP(host) && isBlockedIp(host)) {
    throw new BadRequestException(
      'URL points to a private or reserved address',
    );
  }
  return url;
}

/**
 * Full check including DNS resolution — call right before issuing the request.
 * NB: a TOCTOU window remains vs. fetch's own resolution; pair with
 * `redirect: 'manual'` so a public host can't 30x-bounce into private space.
 */
export async function assertPublicUrl(raw: string): Promise<void> {
  const url = assertSafeUrlSyntax(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return; // already validated as a public literal above

  const results = await lookup(host, { all: true }).catch(
    () => [] as { address: string }[],
  );
  if (results.length === 0) {
    throw new BadRequestException('Could not resolve host');
  }
  for (const { address } of results) {
    if (isBlockedIp(address)) {
      throw new BadRequestException(
        'URL resolves to a private or reserved address',
      );
    }
  }
}
