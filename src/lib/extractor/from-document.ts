/**
 * Build an {@link ExtractedDocument} from a {@link MrpDocument} and its line
 * items — used to produce the form's default values when there is no
 * `final_extraction` yet (e.g. the user has just finished an extraction and
 * is reviewing it for the first time).
 */

import type { MrpDocument, MrpLineItem } from "@prisma/client";

import type { ExtractedDocument } from "./schema";

const isoDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

export function buildDefaultsFromDocument(
  doc: MrpDocument,
  lineItems: MrpLineItem[],
): ExtractedDocument {
  const ai = (doc.rawAiExtraction ?? null) as Partial<ExtractedDocument> | null;
  const final = (doc.finalExtraction ?? null) as Partial<ExtractedDocument> | null;

  // Prefer final (user-saved) over ai over column values.
  return {
    type: (final?.type ?? ai?.type ?? doc.type) as ExtractedDocument["type"],
    documentNumber: final?.documentNumber ?? ai?.documentNumber ?? doc.documentNumber ?? null,
    issueDate: final?.issueDate ?? ai?.issueDate ?? isoDate(doc.issueDate),
    dueDate: final?.dueDate ?? ai?.dueDate ?? isoDate(doc.dueDate),
    deliveryDate: final?.deliveryDate ?? ai?.deliveryDate ?? isoDate(doc.deliveryDate),
    supplier: {
      name: final?.supplier?.name ?? ai?.supplier?.name ?? doc.supplierNameRaw ?? null,
      vatNumber: final?.supplier?.vatNumber ?? ai?.supplier?.vatNumber ?? null,
      eik: final?.supplier?.eik ?? ai?.supplier?.eik ?? null,
      countryCode: final?.supplier?.countryCode ?? ai?.supplier?.countryCode ?? null,
      address: final?.supplier?.address ?? ai?.supplier?.address ?? null,
    },
    currency: final?.currency ?? ai?.currency ?? doc.currency ?? null,
    subtotal: final?.subtotal ?? ai?.subtotal ?? doc.subtotal?.toString() ?? null,
    vatTotal: final?.vatTotal ?? ai?.vatTotal ?? doc.vatTotal?.toString() ?? null,
    total: final?.total ?? ai?.total ?? doc.total?.toString() ?? null,
    deliveryZone:
      final?.deliveryZone ?? ai?.deliveryZone ?? doc.deliveryZone ?? null,
    customsRef: final?.customsRef ?? ai?.customsRef ?? doc.customsRef ?? null,
    lineItems:
      final?.lineItems ??
      ai?.lineItems ??
      lineItems.map((li) => ({
        position: li.position,
        name: li.name,
        sku: li.sku ?? null,
        quantity: li.quantity?.toString() ?? null,
        unit: li.unit ?? null,
        unitPrice: li.unitPrice?.toString() ?? null,
        vatRate: li.vatRate?.toString() ?? null,
        lineTotal: li.lineTotal?.toString() ?? null,
      })),
    needsReview: ai?.needsReview ?? true,
    notes: ai?.notes ?? null,
  };
}
