import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { getOriginalSignedUrl } from "@/lib/storage/buckets";
import {
  ExtractedDocumentSchema,
  type ExtractedDocument,
} from "@/lib/extractor/schema";
import { saveExtraction } from "@/lib/documents/save";

export const runtime = "nodejs";

/** GET /api/documents/[id] — full document with signed URL and line items. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const document = await db.query.documents.findFirst({
    where: eq(schema.documents.id, id),
  });
  if (!document)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (document.createdBy !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lineItems = await db.query.lineItems.findMany({
    where: eq(schema.lineItems.documentId, id),
    orderBy: (li, { asc }) => [asc(li.position)],
  });

  let signedUrl: string | null = null;
  try {
    signedUrl = await getOriginalSignedUrl(document.originalFilePath, 60 * 60);
  } catch {
    signedUrl = null;
  }

  return NextResponse.json({ document, lineItems, signedUrl });
}

/** PATCH /api/documents/[id] — save a draft of the user-edited extraction. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
