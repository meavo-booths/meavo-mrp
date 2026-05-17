import type { ExtractedDocumentType } from "./schema";
import type { ExtractionResult } from "./schema";

export type SupplierProfileHints = {
  /** Supplier display name (used in prompt context). */
  supplierName?: string;
  /** Hints injected into the prompt as JSON. */
  hints?: Record<string, unknown>;
  /** Recent approved extractions (used as few-shot examples). */
  recentExamples?: Array<Record<string, unknown>>;
};

export type ExtractionInput = {
  /** Raw bytes of the image or PDF (single page recommended). */
  bytes: Uint8Array;
  /** MIME type, e.g. `image/jpeg`, `image/png`, `application/pdf`. */
  mimeType: string;
  /**
   * Optional hint at the document type. If "auto" the model will infer it.
   * If known up-front, set to the specific type to bias the prompt.
   */
  typeHint?: ExtractedDocumentType | "auto";
  /** Optional supplier profile to inject as few-shot context. */
  supplier?: SupplierProfileHints;
  /** Per-call locale hint for prompt language ("bg" | "en"). Default: "bg". */
  locale?: "bg" | "en";
};

export type { ExtractionResult };
