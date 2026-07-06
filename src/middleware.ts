import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoginPage = /^\/(bg|en)\/login/.test(pathname) || pathname === "/login";

  if (!req.auth && !isLoginPage) {
    const locale = pathname.match(/^\/(bg|en)(\/|$)/)?.[1] ?? routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, req.nextUrl.origin);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(req as unknown as NextRequest);
});

export const config = {
  // Match all paths except API/auth routes, Next internals, and static files.
  matcher: [
    "/((?!api|auth|_next|_vercel|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico|json|txt)).*)",
  ],
};
