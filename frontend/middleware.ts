import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = new Set(["/login", "/forgot-password", "/reset-password"]);

export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "api") return NextResponse.next();
  const isPublic = publicRoutes.has(request.nextUrl.pathname);
  const refreshCookieName = process.env.NEXT_PUBLIC_REFRESH_COOKIE_NAME ?? "boticas_refresh";
  const hasRefreshCookie = Boolean(request.cookies.get(refreshCookieName)?.value);

  if (!isPublic && !hasRefreshCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|legacy/).*)"],
};
