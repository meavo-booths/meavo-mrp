import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAppAdmin } from "@/lib/api/guard";
import {
  getAdminAccessDetail,
  normalizeEmailList,
  parseEmailList,
  setConfiguredAdminEmails,
} from "@/lib/settings/admin-access";

export const runtime = "nodejs";

const PutSchema = z
  .object({
    emails: z.array(z.string()).optional(),
    paste: z.string().optional(),
  })
  .refine((body) => body.emails !== undefined || body.paste !== undefined, {
    message: "Provide emails or paste",
  });

export async function GET() {
  const { error } = await requireAppAdmin();
  if (error) return error;

  const detail = await getAdminAccessDetail();
  return NextResponse.json(detail);
}

export async function PUT(request: Request) {
  const { user, error } = await requireAppAdmin();
  if (error) return error;

  const body = PutSchema.parse(await request.json());
  const emails =
    body.paste !== undefined ?
      parseEmailList(body.paste)
    : normalizeEmailList(body.emails ?? []);

  try {
    const saved = await setConfiguredAdminEmails(emails, user.id);
    const detail = await getAdminAccessDetail();
    return NextResponse.json({ emails: saved, ...detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
