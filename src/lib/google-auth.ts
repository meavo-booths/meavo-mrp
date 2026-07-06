import type { Account, User } from "next-auth";
import { prisma } from "@/lib/prisma";

export function isGoogleAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export async function authorizeInvitedGoogleUser({
  user,
  account,
  image,
  name,
  validate,
}: {
  user: User;
  account: Account | null;
  image?: string | null;
  name?: string | null;
  validate?: (existingUser: { id: string; email: string }) => Promise<boolean>;
}): Promise<boolean> {
  const email = user.email?.trim().toLowerCase();
  if (!email || account?.provider !== "google") return false;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) return false;

  if (validate && !(await validate(existing))) return false;

  if (account) {
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      },
      create: {
        userId: existing.id,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
        session_state: typeof account.session_state === "string" ? account.session_state : null,
      },
      update: {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
      },
    });
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: existing.name ?? name ?? undefined,
      image: image ?? existing.image ?? undefined,
      emailVerified: new Date(),
    },
  });

  user.id = existing.id;
  user.email = existing.email;
  user.name = existing.name ?? name ?? null;

  return true;
}
