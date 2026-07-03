import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { invoiceScannerDisabledResponse, requireApiUser } from "@/lib/api/guard";
import { db, schema } from "@/lib/db/client";

export const runtime = "nodejs";

/** POST /api/documents/[id]/reject — mark a document as rejected. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const disabled = invoiceScannerDisabledResponse();
  if (disabled) return disabled;
  const { user, error } = await requireApiUser();
  if (error) return error;
  const { id } = await params;

  const existing = await db.query.documents.findFirst({
    where: eq(schema.documents.id, id),
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .update(schema.documents)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(schema.documents.id, id));

  return NextResponse.json({ ok: true });
}
