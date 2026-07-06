import { NextResponse } from "next/server";

import { invoiceScannerDisabledResponse, requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import { getOriginalStream } from "@/lib/storage/buckets";

export const runtime = "nodejs";

/**
 * GET /api/documents/[id]/file — stream the private original blob for an
 * authorized user. Replaces the previous Supabase signed-URL flow.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const disabled = invoiceScannerDisabledResponse();
  if (disabled) return disabled;
  const { user, error } = await requireApiUser();
  if (error) return error;
  const { id } = await params;

  const document = await prisma.mrpDocument.findUnique({
    where: { id },
  });
  if (!document)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (document.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await getOriginalStream(document.storageKey);
  if (!result)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": "inline",
    },
  });
}
