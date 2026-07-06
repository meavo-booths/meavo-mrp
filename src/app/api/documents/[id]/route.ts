import { NextResponse } from "next/server";

import { invoiceScannerDisabledResponse, requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import {
  ExtractedDocumentSchema,
  type ExtractedDocument,
} from "@/lib/extractor/schema";
import { saveExtraction } from "@/lib/documents/save";

export const runtime = "nodejs";

/** BigInt columns cannot be JSON.stringify-ed — convert before returning. */
function serializeDocument<T extends { originalSizeBytes: bigint | null }>(
  doc: T,
) {
  return {
    ...doc,
    originalSizeBytes:
      doc.originalSizeBytes === null ? null : Number(doc.originalSizeBytes),
  };
}

/** GET /api/documents/[id] — full document with file URL and line items. */
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

  const lineItems = await prisma.mrpLineItem.findMany({
    where: { documentId: id },
    orderBy: { position: "asc" },
  });

  // Private blobs are streamed through the authorized file route.
  const signedUrl = `/api/documents/${id}/file`;

  return NextResponse.json({
    document: serializeDocument(document),
    lineItems,
    signedUrl,
  });
}

/** PATCH /api/documents/[id] — save a draft of the user-edited extraction. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const disabled = invoiceScannerDisabledResponse();
  if (disabled) return disabled;
  const { user, error } = await requireApiUser();
  if (error) return error;
  const { id } = await params;

  const body = (await request.json()) as { extraction?: unknown };
  const parsed = ExtractedDocumentSchema.safeParse(body.extraction);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid extraction", issues: parsed.error.format() },
      { status: 400 },
    );
  }

  await saveExtraction({
    documentId: id,
    userId: user.id,
    extraction: parsed.data as ExtractedDocument,
    finalize: false,
  });

  return NextResponse.json({ ok: true });
}
