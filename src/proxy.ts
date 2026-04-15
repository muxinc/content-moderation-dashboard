import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";

function expectedToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHash("sha256").update(`${password}:cm-session`).digest("hex");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for the login page and static assets
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // If no ADMIN_PASSWORD is set, allow all access
  const token = expectedToken();
  if (!token) return NextResponse.next();

  const cookie = request.cookies.get("admin_session");
  if (cookie?.value === token) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
