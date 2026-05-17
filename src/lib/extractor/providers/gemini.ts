import "server-only";

import { GoogleGenAI, type ContentListUnion } from "@google/genai";

import { env } from "@/lib/env";
import { SYSTEM_INSTRUCTIONS } from "../prompts/system";
import { responseSchema } from "../response-schema";
import {
  ConfidenceMapSchema,
  ExtractedDocumentSchema,
  type ExtractionResult,
} from "../schema";
import type { ExtractionInput } from "../types";

/**
 * Extract structured fields from a document image/PDF using Gemini
 * (default model: `gemini-2.5-flash`). Returns a result that always
 * conforms to {@link ExtractedDocumentSchema}.
 */
export async function extractWithGemini(
  input: ExtractionInput,
): Promise<ExtractionResult> {
  if (!env.GEMINI_API_KEY) {
    return stubExtraction(input);
  }

  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const model = env.GEMINI_MODEL;

  const userParts = buildUserParts(input);

  const response = await client.models.generateContent({
    model,
    contents: userParts,
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0,
      // Disable thinking for predictable latency on structured OCR.
      thinkingConfig: { thinkingBudget: env.GEMINI_THINKING_BUDGET },
    },
  });

  const text =
    typeof response.text === "string" ? response.text : (response as { text?: string }).text ?? "";

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "Gemini did not return valid JSON. Raw response: " +
        text.slice(0, 400) +
        (text.length > 400 ? "…" : ""),
    );
  }

  const root = parsed as { document?: unknown; confidence?: unknown };
  const document = ExtractedDocumentSchema.parse(root.document ?? root);
  const confidence = ConfidenceMapSchema.parse(root.confidence ?? {});

  return {
    document,
    confidence,
    provider: model,
    usage: extractUsage(response),
    raw: parsed,
  };
}

function extractUsage(
  response: unknown,
): { inputTokens?: number; outputTokens?: number } | undefined {
  const r = response as {
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };
  if (!r?.usageMetadata) return undefined;
  return {
    inputTokens: r.usageMetadata.promptTokenCount,
    outputTokens: r.usageMetadata.candidatesTokenCount,
  };
}

function buildUserParts(input: ExtractionInput): ContentListUnion {
  const parts: Array<
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  > = [];

  // Few-shot block from supplier profile, if any.
  if (input.supplier) {
    const meta: string[] = [];
    if (input.supplier.supplierName) {
      meta.push(`Supplier name (likely): ${input.supplier.supplierName}`);
    }
    if (
      input.supplier.hints &&
      Object.keys(input.supplier.hints).length > 0
    ) {
      meta.push("Supplier hints: " + JSON.stringify(input.supplier.hints));
    }
    if (
      input.supplier.recentExamples &&
      input.supplier.recentExamples.length > 0
    ) {
      meta.push(
        "Recently approved extractions for this supplier (use as reference):\n" +
          input.supplier.recentExamples
            .map((e, i) => `Example ${i + 1}: ${JSON.stringify(e)}`)
            .join("\n"),
      );
    }
    if (meta.length > 0) parts.push({ text: meta.join("\n") });
  }

  parts.push({
    inlineData: {
      data: bytesToBase64(input.bytes),
      mimeType: input.mimeType,
    },
  });

  if (input.typeHint && input.typeHint !== "auto") {
    parts.push({
      text: `Document type hint: this is a ${input.typeHint.replace("_", " ")}.`,
    });
  }

  parts.push({
    text:
      input.locale === "en"
        ? "Extract the structured data per the schema. Respond ONLY with JSON."
        : "Извлечете структурираните данни според схемата. Отговорете САМО с JSON.",
  });

  return parts;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Returns a deterministic placeholder extraction so the rest of the app
 * can be developed/tested without a Gemini API key.
 */
function stubExtraction(input: ExtractionInput): ExtractionResult {
  return {
    provider: "stub",
    confidence: {},
    document: {
      type: input.typeHint === "auto" || !input.typeHint ? "invoice" : input.typeHint,
      documentNumber: null,
      issueDate: null,
      dueDate: null,
      deliveryDate: null,
      supplier: {
        name: input.supplier?.supplierName ?? null,
        vatNumber: null,
        eik: null,
        countryCode: null,
        address: null,
      },
      currency: null,
      subtotal: null,
      vatTotal: null,
      total: null,
      deliveryZone: null,
      customsRef: null,
      lineItems: [],
      needsReview: true,
      notes:
        "Configure GEMINI_API_KEY in .env.local to enable real extraction. This is a placeholder result.",
    },
  };
}
