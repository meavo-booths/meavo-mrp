import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ExtractedDocument } from "@/lib/extractor/schema";
import { diffExtractions } from "@/lib/extractor/diff";
import { findOrCreateSupplier } from "@/lib/suppliers/match";
import { recordApprovedExtraction } from "@/lib/learning/profile";

const toJsonInput = (value: unknown) =>
  value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);

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

  const existing = await prisma.mrpDocument.findUnique({
    where: { id: documentId },
  });
  if (!existing) throw new Error("Document not found");
  if (existing.createdById !== userId) {
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
      await prisma.mrpCorrectionLog.createMany({
        data: diffs.map((d) => ({
          documentId,
          supplierId,
          fieldPath: d.path,
          aiValue: toJsonInput(d.ai),
          userValue: toJsonInput(d.user),
          correctedById: userId,
        })),
      });
    }
  }

  // Persist the canonical fields in their own columns for sorting/filtering.
  await prisma.mrpDocument.update({
    where: { id: documentId },
    data: {
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
      finalExtraction: extraction as unknown as Prisma.InputJsonValue,
      status: finalize ? "approved" : existing.status,
      approvedAt: finalize ? new Date() : existing.approvedAt,
      approvedById: finalize ? userId : existing.approvedById,
      updatedAt: new Date(),
    },
  });

  // Replace line items (positions may have shifted, items added/removed).
  await prisma.mrpLineItem.deleteMany({ where: { documentId } });
  if (extraction.lineItems.length > 0) {
    await prisma.mrpLineItem.createMany({
      data: extraction.lineItems.map((li) => ({
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
    });
  }

  if (finalize && supplierId) {
    await recordApprovedExtraction({
      supplierId,
      finalExtraction: extraction as unknown as Record<string, unknown>,
    });
  }
}
