/**
 * Gemini response_schema description (a JSON-Schema-like object).
 *
 * Note: Gemini 2.x supports a constrained subset of JSON Schema with field
 * ordering via `propertyOrdering`. We deliberately list properties in a
 * sensible reading order so the model fills the header before tackling line
 * items. Decimals/currencies/dates are constrained as strings — we validate
 * them again with zod after parse.
 */

import { Type, type Schema } from "@google/genai";

const supplierSchema: Schema = {
  type: Type.OBJECT,
  description: "The supplier (issuer) of the document.",
  properties: {
    name: {
      type: Type.STRING,
      description: "Supplier company name as printed.",
      nullable: true,
    },
    vatNumber: {
      type: Type.STRING,
      description: "VAT/ДДС number including country prefix (e.g. BG123456789).",
      nullable: true,
    },
    eik: {
      type: Type.STRING,
      description: "Bulgarian ЕИК / Булстат (9 or 13 digits).",
      nullable: true,
    },
    countryCode: {
      type: Type.STRING,
      description: "ISO-3166-1 alpha-2 country code (e.g. BG, DE, US).",
      nullable: true,
    },
    address: {
      type: Type.STRING,
      description: "Postal address as printed.",
      nullable: true,
    },
  },
  propertyOrdering: ["name", "vatNumber", "eik", "countryCode", "address"],
};

const lineItemSchema: Schema = {
  type: Type.OBJECT,
  description: "A single line item from the document body.",
  properties: {
    position: {
      type: Type.INTEGER,
      description: "1-based row index in the line-item table.",
    },
    name: { type: Type.STRING, description: "Item / service description." },
    sku: {
      type: Type.STRING,
      description: "Item code / SKU if printed.",
      nullable: true,
    },
    quantity: {
      type: Type.STRING,
      description: "Decimal as string (e.g. '12.5'). Period decimal separator.",
      nullable: true,
    },
    unit: {
      type: Type.STRING,
      description: "Unit of measure (бр., кг, l, m, etc.).",
      nullable: true,
    },
    unitPrice: {
      type: Type.STRING,
      description: "Decimal as string. No currency symbol.",
      nullable: true,
    },
    vatRate: {
      type: Type.STRING,
      description: "VAT percent as a string (e.g. '20', '0', '9').",
      nullable: true,
    },
    lineTotal: {
      type: Type.STRING,
      description: "Decimal as string. No currency symbol.",
      nullable: true,
    },
  },
  required: ["position", "name"],
  propertyOrdering: [
    "position",
    "name",
    "sku",
    "quantity",
    "unit",
    "unitPrice",
    "vatRate",
    "lineTotal",
  ],
};

const documentSchema: Schema = {
  type: Type.OBJECT,
  description: "Structured fields extracted from the document.",
  required: ["type", "supplier", "lineItems", "needsReview"],
  properties: {
    type: {
      type: Type.STRING,
      enum: ["invoice", "proforma", "delivery_note"],
      description: "Document type.",
    },
    documentNumber: { type: Type.STRING, nullable: true },
    issueDate: {
      type: Type.STRING,
      description: "ISO date YYYY-MM-DD.",
      nullable: true,
    },
    dueDate: { type: Type.STRING, nullable: true },
    deliveryDate: { type: Type.STRING, nullable: true },
    supplier: supplierSchema,
    currency: {
      type: Type.STRING,
      description: "ISO 4217 (e.g. BGN, EUR, USD).",
      nullable: true,
    },
    subtotal: { type: Type.STRING, nullable: true },
    vatTotal: { type: Type.STRING, nullable: true },
    total: { type: Type.STRING, nullable: true },
    deliveryZone: {
      type: Type.STRING,
      enum: ["local", "eu", "non_eu"],
      nullable: true,
    },
    customsRef: { type: Type.STRING, nullable: true },
    lineItems: {
      type: Type.ARRAY,
      items: lineItemSchema,
    },
    needsReview: {
      type: Type.BOOLEAN,
      description: "Set true when a human should double-check the extraction.",
    },
    notes: { type: Type.STRING, nullable: true },
  },
  propertyOrdering: [
    "type",
    "documentNumber",
    "issueDate",
    "dueDate",
    "deliveryDate",
    "supplier",
    "currency",
    "subtotal",
    "vatTotal",
    "total",
    "deliveryZone",
    "customsRef",
    "lineItems",
    "needsReview",
    "notes",
  ],
};

const confidenceSchema: Schema = {
  type: Type.OBJECT,
  description:
    "Per-field confidence map. Keys are field paths (e.g. 'documentNumber', 'supplier.vatNumber', 'lineItems[2].unitPrice'). Values are 0..1 floats.",
  properties: {},
};

export const responseSchema: Schema = {
  type: Type.OBJECT,
  description: "Result of extracting structured data from the document.",
  required: ["document"],
  properties: {
    document: documentSchema,
    confidence: confidenceSchema,
  },
  propertyOrdering: ["document", "confidence"],
};
