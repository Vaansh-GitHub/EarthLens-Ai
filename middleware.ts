import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PROTECTED_ROUTES = ["/discover", "/journal", "/insight", "/studio", "/profile"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const cookieName = process.env.AUTH_COOKIE_NAME || "earthlens_token";
  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (secret && secret.length >= 32) {
      const secretKey = new TextEncoder().encode(secret);
      await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    }
    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(cookieName);
    return response;
  }
}

export const config = {
  matcher: [
    "/discover/:path*",
    "/journal/:path*",
    "/insight/:path*",
    "/studio/:path*",
    "/profile/:path*",
  ],
};
