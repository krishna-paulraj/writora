import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// No fallback secret: if JWT_SECRET is unset we fail CLOSED (treat every
// request as unauthenticated) rather than verifying tokens against a committed
// constant, which would let anyone forge a valid session for the dashboard.
const JWT_SECRET = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

const LOGIN_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token || !JWT_SECRET) {
    return NextResponse.redirect(`${LOGIN_URL}/login`);
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(`${LOGIN_URL}/login`);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
