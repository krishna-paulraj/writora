import type { NextConfig } from "next";

// Security headers for the authenticated dashboard. Unlike the public blog
// (apps/www) we deliberately avoid a restrictive `default-src`/`script-src`
// CSP here — the dashboard relies on Next's inline/eval hydration and cross-
// origin API calls, and a mismatched script policy would silently break it.
// Instead we ship the high-value, app-agnostic directives: `frame-ancestors
// 'none'` (+ legacy `X-Frame-Options: DENY`) for anti-clickjacking, plus
// `object-src`/`base-uri` hardening. nosniff and a sane Referrer-Policy round
// it out. A nonce-based script CSP is a worthwhile follow-up.
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
