import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const isProd = process.env.NODE_ENV === "production";
const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "";

// Baseline CSP for the public blog origin. `frame-ancestors`/`object-src`/
// `base-uri`/`form-action` are the high-value directives (clickjacking + base-
// tag/redirect hardening); `script-src 'unsafe-inline'` is currently required
// by Next's hydration (nonce-based CSP is a worthwhile follow-up). Combined with
// the server-side HTML sanitizer this contains stored-content XSS.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${apiOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`.trim(),
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
