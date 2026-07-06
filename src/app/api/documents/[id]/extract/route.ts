import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { invoiceScannerDisabledResponse, requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import { downloadOriginalBytes } from "@/lib/storage/buckets";
import { extractDocument } from "@/lib/extractor";
import { inferDeliveryZoneFromCountryCode } from "@/lib/extractor/zone";
import { findOrCreateSupplier } from "@/lib/suppliers/match";
import { loadSupplierProfileHints } from "@/lib/learning/profile";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/documents/[id]/extract — fetch the original from storage,
 * call the extractor, and persist the raw extraction + inferred fields.
 *
 * Idempotent: re-running this rewrites `raw_ai_extraction` and the inferred
 * header columns but does not delete user edits in `final_extraction`.
 */
export async function POST(
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
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (document.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let bytes: Uint8Array;
  try {
    bytes = await downloadOriginalBytes(document.storageKey);
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[extract] storage download failed:", msg);
    return NextResponse.json(
      { error: "Could not load original file from storage: " + msg },
      { status: 500 },
    );
  }

  // Look up supplier hints if we already have a candidate from a previous run.
  const supplierProfile = document.supplierId
    ? await loadSupplierProfileHints(document.supplierId)
    : undefined;

  let result;
  try {
    result = await extractDocument({
      bytes,
      mimeType: document.originalMimeType ?? "image/jpeg",
      typeHint: "auto",
      supplier: supplierProfile,
      locale: "bg",
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[extract] AI extraction failed:", e);
    return NextResponse.json(
      { error: "AI extraction failed: " + msg },
      { status: 500 },
    );
  }

  // Try to match (or create) a supplier from the extracted fields.
  let supplierId: string | null = document.supplierId ?? null;
  const ext = result.document;
  if (ext.supplier?.name || ext.supplier?.vatNumber || ext.supplier?.eik) {
    const matched = await findOrCreateSupplier({
      name: ext.supplier?.name ?? null,
      vatNumber: ext.supplier?.vatNumber ?? null,
      eik: ext.supplier?.eik ?? null,
      countryCode: ext.supplier?.countryCode ?? null,
      address: ext.supplier?.address ?? null,
      defaultCurrency: ext.currency ?? null,
    });
    supplierId = matched.id;
  }

  const inferredZone =
    ext.deliveryZone ??
    inferDeliveryZoneFromCountryCode(ext.supplier?.countryCode ?? null);

  try {
    await prisma.mrpDocument.update({
      where: { id },
      data: {
        type: ext.type,
        documentNumber: ext.documentNumber ?? null,
        issueDate: ext.issueDate ? new Date(ext.issueDate) : null,
        dueDate: ext.dueDate ? new Date(ext.dueDate) : null,
        deliveryDate: ext.deliveryDate ? new Date(ext.deliveryDate) : null,
        supplierId,
        supplierNameRaw: ext.supplier?.name ?? null,
        currency: ext.currency ?? null,
        subtotal: ext.subtotal ?? null,
        vatTotal: ext.vatTotal ?? null,
        total: ext.total ?? null,
        deliveryZone: inferredZone,
        customsRef: ext.customsRef ?? null,
        rawAiExtraction: result.document as unknown as Prisma.InputJsonValue,
        confidence: result.confidence as unknown as Prisma.InputJsonValue,
        extractorProvider: result.provider,
        updatedAt: new Date(),
      },
    });

    // Replace line items with the new extraction's lines.
    await prisma.mrpLineItem.deleteMany({ where: { documentId: id } });
    if (ext.lineItems.length > 0) {
      await prisma.mrpLineItem.createMany({
        data: ext.lineItems.map((li) => ({
          documentId: id,
          position: li.position,
          name: li.name,
          sku: li.sku ?? null,
          quantity: li.quantity ?? null,
          unit: li.unit ?? null,
          unitPrice: li.unitPrice ?? null,
          vatRate: li.vatRate ?? null,
          lineTotal: li.lineTotal ?? null,
        })),
      });
    }

    return NextResponse.json({ ok: true, provider: result.provider });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[extract] DB persist failed:", e);
    return NextResponse.json(
      { error: "Failed to save extraction: " + msg },
      { status: 500 },
    );
  }
}
