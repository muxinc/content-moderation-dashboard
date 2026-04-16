import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for the login page, API routes, and static assets
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // If no ADMIN_PASSWORD is set, allow all access
  if (!process.env.ADMIN_PASSWORD) return NextResponse.next();

  // Check for session cookie (actual validation happens in Convex)
  const cookie = request.cookies.get("admin_session");
  if (cookie?.value) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
