import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import type { ExtractedDocument } from "@/lib/extractor/schema";
import { diffExtractions } from "@/lib/extractor/diff";
import { findOrCreateSupplier } from "@/lib/suppliers/match";
import { recordApprovedExtraction } from "@/lib/learning/profile";

/**
 * Persist a (possibly user-edited) extraction back to the database, log the
 * field-level corrections vs the AI's original output, and optionally mark
 * the document `approved`.
 */
export async function saveExtraction(opts: {
  documentId: string;
  userId: string;
  extraction: ExtractedDocument;
  finalize: boolean;
}) {
  const { documentId, userId, extraction, finalize } = opts;

  const existing = await db.query.documents.findFirst({
    where: eq(schema.documents.id, documentId),
  });
  if (!existing) throw new Error("Document not found");
  if (existing.createdBy !== userId) {
    throw new Error("Forbidden");
  }

  // Match (or create) the supplier from the edited values.
  let supplierId = existing.supplierId;
  if (
    extraction.supplier?.name ||
    extraction.supplier?.vatNumber ||
    extraction.supplier?.eik
  ) {
    const matched = await findOrCreateSupplier({
      name: extraction.supplier?.name ?? null,
      vatNumber: extraction.supplier?.vatNumber ?? null,
      eik: extraction.supplier?.eik ?? null,
      countryCode: extraction.supplier?.countryCode ?? null,
      address: extraction.supplier?.address ?? null,
      defaultCurrency: extraction.currency ?? null,
    });
    supplierId = matched.id;
  }

  // Diff against the previous final_extraction (or, on first save, the AI raw)
  const prevFinal = (existing.finalExtraction ??
    existing.rawAiExtraction ??
    null) as ExtractedDocument | null;

  if (prevFinal) {
    const diffs = diffExtractions(prevFinal, extraction);
    if (diffs.length > 0) {
      await db.insert(schema.correctionLogs).values(
        diffs.map((d) => ({
          documentId,
          supplierId,
          fieldPath: d.path,
          aiValue: d.ai as never,
          userValue: d.user as never,
          correctedBy: userId,
        })),
      );
    }
  }

  // Persist the canonical fields in their own columns for sorting/filtering.
  await db
    .update(schema.documents)
    .set({
      type: extraction.type,
      documentNumber: extraction.documentNumber ?? null,
      issueDate: extraction.issueDate ? new Date(extraction.issueDate) : null,
      dueDate: extraction.dueDate ? new Date(extraction.dueDate) : null,
      deliveryDate: extraction.deliveryDate
        ? new Date(extraction.deliveryDate)
        : null,
      supplierId,
      supplierNameRaw: extraction.supplier?.name ?? null,
      currency: extraction.currency ?? null,
      subtotal: extraction.subtotal ?? null,
      vatTotal: extraction.vatTotal ?? null,
      total: extraction.total ?? null,
      deliveryZone: extraction.deliveryZone ?? null,
      customsRef: extraction.customsRef ?? null,
      finalExtraction: extraction,
      status: finalize ? "approved" : existing.status,
      approvedAt: finalize ? new Date() : existing.approvedAt,
      approvedBy: finalize ? userId : existing.approvedBy,
      updatedAt: new Date(),
    })
    .where(eq(schema.documents.id, documentId));

  // Replace line items (positions may have shifted, items added/removed).
  await db
    .delete(schema.lineItems)
    .where(eq(schema.lineItems.documentId, documentId));
  if (extraction.lineItems.length > 0) {
    await db.insert(schema.lineItems).values(
      extraction.lineItems.map((li) => ({
        documentId,
        position: li.position,
        name: li.name,
        sku: li.sku ?? null,
        quantity: li.quantity ?? null,
        unit: li.unit ?? null,
        unitPrice: li.unitPrice ?? null,
        vatRate: li.vatRate ?? null,
        lineTotal: li.lineTotal ?? null,
      })),
    );
  }

  if (finalize && supplierId) {
    await recordApprovedExtraction({
      supplierId,
      finalExtraction: extraction as unknown as Record<string, unknown>,
    });
  }
}
