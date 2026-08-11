import { auth } from "@/lib/auth";
import { canAccessRoute, getDefaultRoute } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // API routes handle their own auth and return JSON errors — never redirect them to login HTML
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const session = await auth();

  if (!session?.user?.id) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessRoute(session.user.role, pathname)) {
    return NextResponse.redirect(
      new URL(getDefaultRoute(session.user.role), request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/provider",
    "/provider/:path*",
    "/rep",
    "/rep/:path*",
    "/company",
    "/company/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
