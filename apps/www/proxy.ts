import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "writora_jwt_secret_change_in_production_k9x2m4p7"
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.next();
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.redirect(APP_URL);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/login", "/signup"],
};
