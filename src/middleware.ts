import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { canAccessRoute, getDefaultRoute } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const session = req.auth;

  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessRoute(session.user.role, pathname)) {
    return NextResponse.redirect(
      new URL(getDefaultRoute(session.user.role), req.url)
    );
  }

  return NextResponse.next();
});

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
