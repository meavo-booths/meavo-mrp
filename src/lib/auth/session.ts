import "server-only";

import { redirect } from "next/navigation";

import { getServerSupabase } from "./supabase-server";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

/**
 * Returns the current Supabase session user, or null if not signed in.
 * Use in Server Components / Route Handlers.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !data.user.email) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    fullName:
      (data.user.user_metadata?.full_name as string | undefined) ??
      (data.user.user_metadata?.name as string | undefined) ??
      null,
    avatarUrl:
      (data.user.user_metadata?.avatar_url as string | undefined) ??
      (data.user.user_metadata?.picture as string | undefined) ??
      null,
  };
}

/** Redirect to login if not signed in. Returns a guaranteed-non-null user. */
export async function requireSessionUser(
  options: { redirectTo?: string } = {},
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(options.redirectTo ?? "/login");
  }
  return user;
}
