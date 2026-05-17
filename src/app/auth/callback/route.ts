import { NextResponse } from "next/server";

import { getServerSupabase } from "@/lib/auth/supabase-server";

/**
 * Supabase OAuth callback. Exchanges the `?code=...` for a session,
 * sets the HTTP-only cookies, then redirects to `next` (or home).
 *
 * Note: this route is NOT under `[locale]` so it is locale-agnostic.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    const back = new URL("/bg/login", url.origin);
    back.searchParams.set("error", errorDescription);
    return NextResponse.redirect(back);
  }

  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const back = new URL("/bg/login", url.origin);
      back.searchParams.set("error", error.message);
      return NextResponse.redirect(back);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
