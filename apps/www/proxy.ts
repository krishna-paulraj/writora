import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "writora_jwt_secret_change_in_production_k9x2m4p7",
);

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

async function resolveCustomDomain(host: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${API_URL}/blogs/by-domain/${encodeURIComponent(host)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { username?: string } | null;
    return data?.username ?? null;
  } catch {
    return null;
  }
}

async function handleAuthGate(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.next();
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

  const username = await resolveCustomDomain(host);
  if (!username) return NextResponse.next();

  // Strip a leading `/{username}` if it's already present so internal links
  // don't get double-prefixed. Then prefix unconditionally.
  let scoped = pathname;
  if (scoped === `/${username}`) {
    scoped = "";
  } else if (scoped.startsWith(`/${username}/`)) {
    scoped = scoped.slice(`/${username}`.length);
  }

  const url = request.nextUrl.clone();
  url.pathname =
    scoped === "" || scoped === "/" ? `/${username}` : `/${username}${scoped}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and obvious static assets.
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt).*)",
  ],
};
