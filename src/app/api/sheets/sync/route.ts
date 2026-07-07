import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/guard";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runSheetSync } from "@/lib/sheets/sync";

export const runtime = "nodejs";
export const maxDuration = 120;

async function authorize(request: Request): Promise<NextResponse | null> {
  if (isAuthorizedCronRequest(request)) return null;

  const { user, error } = await requireApiUser();
  if (error) return error;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Manual sync (admin) or Vercel cron (`Authorization: Bearer $CRON_SECRET`). */
export async function POST(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  try {
    const result = await runSheetSync();
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Sheet sync failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
