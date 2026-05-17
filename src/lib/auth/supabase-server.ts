import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Supabase client for use in React Server Components, Server Actions, and Route Handlers.
 * Reads/writes auth cookies via Next's cookie store.
 */
export async function getServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: CookieOptions;
        }>,
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // The `setAll` method was called from a Server Component.
          // This is fine if you have middleware refreshing the session.
        }
      },
    },
  });
}

/**
 * Service-role Supabase client (server only) for admin operations such as
 * creating storage buckets, listing users, and inserting trusted rows.
 * NEVER expose this client (or its key) to the browser.
 */
export function getServiceSupabase(): SupabaseClient {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for admin Supabase calls.",
    );
  }
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        // No-op cookie handlers: service-role client is request-less.
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
