/**
 * Zod schemas describing the shape of an AI extraction.
 *
 * The same schemas are used to:
 *  - validate Gemini's structured JSON response (server),
 *  - drive the review form (`react-hook-form` + zodResolver),
 *  - serialize to/from the `documents.final_extraction` jsonb column.
 *
 * NOTE: these are the "extracted" shape, not the database row shape; the
 * server projects them into Drizzle tables on approval.
 */

import { z } from "zod";

// ----------------------- Shared primitives -----------------------

/** ISO-3166-1 alpha-2 country code or null. */
export const CountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Expected 2-letter country code (e.g. BG, DE, US)")
  .nullable()
  .optional();

/** ISO-4217 currency. */
export const CurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Expected 3-letter currency code (e.g. BGN, EUR, USD)")
  .nullable()
  .optional();

/** ISO date string (YYYY-MM-DD), kept as string for round-tripping. */
export const IsoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Expected ISO date (YYYY-MM-DD)")
  .nullable()
  .optional();

/** Decimal as string to avoid float drift; e.g. "12345.67". */
export const DecimalSchema = z
  .string()
  .trim()
  .regex(/^-?\d+(?:\.\d+)?$/u, "Expected decimal string")
  .nullable()
  .optional();

export const DeliveryZoneSchema = z
  .enum(["local", "eu", "non_eu"])
  .nullable()
  .optional();

export const DocumentTypeSchema = z.enum([
  "invoice",
  "proforma",
  "delivery_note",
]);
export type ExtractedDocumentType = z.infer<typeof DocumentTypeSchema>;

// ----------------------- Sub-objects ------------------------------

export const SupplierSchema = z.object({
  name: z.string().trim().min(1).nullable().optional(),
  vatNumber: z.string().trim().nullable().optional(),
  /** Bulgarian company identifier (ЕИК / Булстат). */
  eik: z.string().trim().nullable().optional(),
  countryCode: CountryCodeSchema,
  address: z.string().trim().nullable().optional(),
});
export type ExtractedSupplier = z.infer<typeof SupplierSchema>;

export const LineItemSchema = z.object({
  position: z.number().int().min(1),
  name: z.string().trim().min(1),
  sku: z.string().trim().nullable().optional(),
  quantity: DecimalSchema,
  unit: z.string().trim().nullable().optional(),
  unitPrice: DecimalSchema,
  vatRate: DecimalSchema,
  lineTotal: DecimalSchema,
});
export type ExtractedLineItem = z.infer<typeof LineItemSchema>;

// ----------------------- Document --------------------------------

export const ExtractedDocumentSchema = z.object({
  type: DocumentTypeSchema,
  documentNumber: z.string().trim().nullable().optional(),
  issueDate: IsoDateSchema,
  dueDate: IsoDateSchema,
  deliveryDate: IsoDateSchema,
  supplier: SupplierSchema,
  currency: CurrencySchema,
  subtotal: DecimalSchema,
  vatTotal: DecimalSchema,
  total: DecimalSchema,
  /**
   * Inferred from supplier country + VAT number prefix.
   * - "local"  : BG supplier, standard VAT
   * - "eu"     : VAT-registered EU supplier (reverse charge)
   * - "non_eu" : import (customs)
   */
  deliveryZone: DeliveryZoneSchema,
  /** Customs declaration reference (only relevant when deliveryZone="non_eu"). */
  customsRef: z.string().trim().nullable().optional(),
  lineItems: z.array(LineItemSchema).default([]),
  /** Whether the model wants a human to double-check before approval. */
  needsReview: z.boolean().default(true),
  /** Free-form notes the AI wants to surface to the reviewer. */
  notes: z.string().trim().nullable().optional(),
});

export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;

// ----------------------- Confidence map --------------------------

/**
 * Per-field confidence in the range 0..1.
 * Keys are dot/bracket paths matching the document shape, e.g.:
 *   "documentNumber"
 *   "supplier.vatNumber"
 *   "lineItems[2].unitPrice"
 *
 * Missing keys are treated as "unknown" (high) — only flag a field as
 * "needs review" when its key exists AND value < threshold.
 */
export const ConfidenceMapSchema = z.record(z.string(), z.number().min(0).max(1));
export type ConfidenceMap = z.infer<typeof ConfidenceMapSchema>;

export const ExtractionResultSchema = z.object({
  document: ExtractedDocumentSchema,
  confidence: ConfidenceMapSchema.default({}),
  /** Provider/model identifier for traceability. */
  provider: z.string(),
  /** Tokens used (when available). */
  usage: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
    })
    .partial()
    .optional(),
  raw: z.unknown().optional(),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
