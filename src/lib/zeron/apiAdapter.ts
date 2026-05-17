import { env } from "@/lib/env";

import type { ZeronAdapter, ZeronPushPayload, ZeronPushResult } from "./adapter";

/**
 * REST adapter for Zeron's API.
 *
 * The exact endpoint shape is unknown until Zeron returns docs to our outreach
 * email (see `docs/zeron-outreach.md`). Until then, this adapter throws a
 * descriptive error when invoked so administrators know to switch to the
 * `export` adapter (Plan B) or wait.
 */
export const apiAdapter: ZeronAdapter = {
  name: "api",
  async pushDocument(payload: ZeronPushPayload): Promise<ZeronPushResult> {
    if (!env.ZERON_API_BASE_URL || !env.ZERON_API_KEY) {
      throw new Error(
        "Zeron API adapter is not configured. Set ZERON_API_BASE_URL and ZERON_API_KEY, " +
          "or switch ZERON_ADAPTER to 'export' for the manual XLSX/XML fallback.",
      );
    }

    // TODO(zeron-api): once docs arrive, implement the real endpoint.
    // Expected shape (placeholder):
    //   POST {base}/v1/purchase-invoices
    //   Authorization: Bearer {ZERON_API_KEY}
    //   body: { document: {...}, supplier: {...}, lineItems: [...] }
    const body = {
      document: {
        id: payload.document.id,
        type: payload.document.type,
        number: payload.document.documentNumber,
        issueDate: payload.document.issueDate,
        currency: payload.document.currency,
        subtotal: payload.document.subtotal,
        vatTotal: payload.document.vatTotal,
        total: payload.document.total,
        deliveryZone: payload.document.deliveryZone,
        customsRef: payload.document.customsRef,
      },
      supplier: payload.supplier,
      lineItems: payload.lineItems,
    };

    const url = new URL("/v1/purchase-invoices", env.ZERON_API_BASE_URL);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.ZERON_API_KEY}`,
        "Accept-Language": "bg",
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(
        `Zeron API error (${res.status} ${res.statusText}): ${raw.slice(0, 400)}`,
      );
    }

    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = { raw };
    }

    const externalId =
      (parsed as { id?: string; reference?: string } | null)?.id ??
      (parsed as { id?: string; reference?: string } | null)?.reference ??
      undefined;

    return {
      externalId,
      message: externalId
        ? `Synced as Zeron #${externalId}.`
        : "Posted to Zeron API.",
      raw: parsed,
    };
  },
};
