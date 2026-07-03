import { NextResponse } from "next/server";

import { invoiceScannerDisabledResponse, requireApiUser } from "@/lib/api/guard";
import {
  ExtractedDocumentSchema,
  type ExtractedDocument,
} from "@/lib/extractor/schema";
import { saveExtraction } from "@/lib/documents/save";
import { enqueueZeronSync } from "@/lib/zeron/queue";

export const runtime = "nodejs";

/**
 * POST /api/documents/[id]/approve
 * Body: { extraction: ExtractedDocument }
 *
 * Saves the extraction as the canonical `final_extraction`, marks the
 * document `approved`, logs corrections, updates the supplier learning
 * profile, and kicks off a Zeron sync attempt.
 */
export async function POST(
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
    finalize: true,
  });

  // Fire-and-forget the sync — failures end up in sync_attempts.
  void enqueueZeronSync({ documentId: id, requestedBy: user.id });

  return NextResponse.json({ ok: true });
}
