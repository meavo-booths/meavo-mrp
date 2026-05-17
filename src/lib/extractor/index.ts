import "server-only";

import { extractWithGemini } from "./providers/gemini";
import type { ExtractionInput, ExtractionResult } from "./types";

export type { ExtractionInput, ExtractionResult } from "./types";
export * from "./schema";

/**
 * Run the configured extractor over an image/PDF and return a structured
 * extraction. Falls back to the stub provider if no API key is configured.
 */
export async function extractDocument(
  input: ExtractionInput,
): Promise<ExtractionResult> {
  return extractWithGemini(input);
}
