import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// No fallback secret — verify only when a real JWT_SECRET is configured (see
// apps/app/proxy.ts). A committed constant would let tokens be forged.
const JWT_SECRET = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const WWW_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getWwwHostname(): string {
  try {
    return new URL(WWW_URL).hostname;
  } catch {
    return "localhost";
  }
}

const WWW_HOSTNAME = getWwwHostname();

interface DomainSite {
  username: string;
  siteSlug: string;
  isPrimary: boolean;
}

async function resolveCustomDomain(host: string): Promise<DomainSite | null> {
  try {
    const res = await fetch(
      `${API_URL}/blogs/by-domain/${encodeURIComponent(host)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DomainSite | null;
    return data?.username ? data : null;
  } catch {
    return null;
  }
}

async function handleAuthGate(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token || !JWT_SECRET) return NextResponse.next();
  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.redirect(APP_URL);
  } catch {
    return NextResponse.next();
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/signup") {
    return handleAuthGate(request);
  }

  const hostHeader = request.headers.get("host") ?? "";
  const host = hostHeader.split(":")[0].toLowerCase();

  // Skip the canonical platform host and localhost — only rewrite for custom
  // domains pointed at the deployment.
  if (
    !host ||
    host === WWW_HOSTNAME ||
    host === "localhost" ||
    host === "127.0.0.1"
  ) {
    return NextResponse.next();
  }

  const site = await resolveCustomDomain(host);
  if (!site) return NextResponse.next();

  // Primary site is addressed by username (existing pages); secondary sites by
  // /s/[siteSlug]. Strip a leading base if already present so internal links
  // don't get double-prefixed, then prefix unconditionally.
  const base = site.isPrimary ? `/${site.username}` : `/s/${site.siteSlug}`;
  let scoped = pathname;
  if (scoped === base) {
    scoped = "";
  } else if (scoped.startsWith(`${base}/`)) {
    scoped = scoped.slice(base.length);
  }

  const url = request.nextUrl.clone();
  url.pathname = scoped === "" || scoped === "/" ? base : `${base}${scoped}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and obvious static assets.
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt).*)",
  ],
};
