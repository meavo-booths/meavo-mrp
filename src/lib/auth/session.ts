import "server-only";

import { cache } from "react";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveEffectiveRole } from "@/lib/settings/admin-access";

import type { MrpRole } from "@/lib/auth/roles";

export type { MrpRole };

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: MrpRole;
};

/**
 * Returns the current NextAuth session user (gateway `User.id`) with the MRP
 * role from `MrpUserProfile`, or null if not signed in.
 * Use in Server Components / Route Handlers.
 * Wrapped in `React.cache` so layout + page share one DB lookup per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      email: true,
      name: true,
      image: true,
      mrpProfile: { select: { role: true } },
    },
  });
  if (!user) return null;

  const dbRole = user.mrpProfile?.role ?? "scanner";
  const role = await resolveEffectiveRole(user.email, dbRole);

  return {
    id,
    email: user.email,
    fullName: user.name,
    avatarUrl: user.image,
    role,
  };
});

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
