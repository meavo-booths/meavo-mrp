import { NextResponse } from "next/server";

import { invoiceScannerDisabledResponse, requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";

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

  const existing = await prisma.mrpDocument.findUnique({
    where: { id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.mrpDocument.update({
    where: { id },
    data: { status: "rejected", updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
