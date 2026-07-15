import "server-only";

import { cache } from "react";
import { get, put } from "@vercel/blob";

import type { MrpRole } from "@/lib/auth/roles";
import {
  normalizeEmail,
  normalizeEmailList,
  parseEmailList,
} from "@/lib/settings/parse-email-list";

const ADMIN_EMAILS_PATH = "mrp/settings/admin-emails.json";

/** Always have admin access — not removable via settings UI. */
export const BOOTSTRAP_ADMIN_EMAILS = [
  "todor@meavo.com",
  "boyan@meavo.com",
] as const;

type AdminEmailsConfig = {
  emails: string[];
  updatedAt: string;
  updatedBy?: string;
};

export type AdminAccessDetail = {
  bootstrapEmails: string[];
  configuredEmails: string[];
  effectiveEmails: string[];
  storageConfigured: boolean;
};

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function bootstrapSet(): Set<string> {
  return new Set(BOOTSTRAP_ADMIN_EMAILS.map(normalizeEmail));
}

export const getConfiguredAdminEmails = cache(async (): Promise<string[]> => {
  if (!blobConfigured()) return [];

  try {
    const result = await get(ADMIN_EMAILS_PATH, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return [];

    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as AdminEmailsConfig;
    const bootstrap = bootstrapSet();
    return normalizeEmailList(
      (parsed.emails ?? []).filter(
        (email) => !bootstrap.has(normalizeEmail(email)),
      ),
    );
  } catch {
    return [];
  }
});

export async function getEffectiveAdminEmails(): Promise<string[]> {
  const configured = await getConfiguredAdminEmails();
  return normalizeEmailList([...BOOTSTRAP_ADMIN_EMAILS, ...configured]);
}

export async function getAdminAccessDetail(): Promise<AdminAccessDetail> {
  const configuredEmails = await getConfiguredAdminEmails();
  const effectiveEmails = await getEffectiveAdminEmails();

  return {
    bootstrapEmails: [...BOOTSTRAP_ADMIN_EMAILS],
    configuredEmails,
    effectiveEmails,
    storageConfigured: blobConfigured(),
  };
}

export async function setConfiguredAdminEmails(
  emails: string[],
  updatedBy: string,
): Promise<string[]> {
  if (!blobConfigured()) {
    throw new Error("Admin access storage is not configured");
  }

  const bootstrap = bootstrapSet();
  const configured = normalizeEmailList(
    emails.filter((email) => !bootstrap.has(normalizeEmail(email))),
  );

  const payload: AdminEmailsConfig = {
    emails: configured,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await put(ADMIN_EMAILS_PATH, JSON.stringify(payload, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return configured;
}

export async function isEmailAppAdmin(
  email: string,
  dbRole?: MrpRole,
): Promise<boolean> {
  if (dbRole === "admin") return true;

  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const effective = await getEffectiveAdminEmails();
  return effective.includes(normalized);
}

export async function resolveEffectiveRole(
  email: string,
  dbRole: MrpRole,
): Promise<MrpRole> {
  if (await isEmailAppAdmin(email, dbRole)) return "admin";
  return dbRole;
}

export { normalizeEmailList, parseEmailList };
