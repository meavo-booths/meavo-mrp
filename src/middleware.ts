import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all paths except API/auth routes, Next internals, and static files.
  matcher: [
    "/((?!api|auth|_next|_vercel|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico|json|txt)).*)",
  ],
};
