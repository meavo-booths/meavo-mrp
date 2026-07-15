import "server-only";

import { randomUUID } from "node:crypto";

import { put } from "@vercel/blob";

const INBOUND_PREFIX = "mrp/zeron-inbound";

export type ZeronInboundReceipt = {
  id: string;
  receivedAt: string;
  contentType: string;
  bytes: number;
  storageKey?: string;
};

/**
 * Accept a raw Zeron webhook body and archive it for later processing.
 *
 * The payload schema is not finalized yet — we store the body as-is (JSON or
 * XML) so Zeron can start sending while we clarify field mappings.
 */
export async function receiveZeronInbound(input: {
  body: string;
  contentType: string;
}): Promise<ZeronInboundReceipt> {
  const id = randomUUID();
  const receivedAt = new Date().toISOString();
  const bytes = Buffer.byteLength(input.body, "utf8");

  const receipt: ZeronInboundReceipt = {
    id,
    receivedAt,
    contentType: input.contentType,
    bytes,
  };

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const ext = input.contentType.includes("xml") ? "xml" : "json";
    const storageKey = `${INBOUND_PREFIX}/${receivedAt.slice(0, 10)}/${id}.${ext}`;
    await put(storageKey, input.body, {
      access: "private",
      contentType: input.contentType,
      addRandomSuffix: false,
    });
    receipt.storageKey = storageKey;
  } else if (process.env.NODE_ENV !== "production") {
    console.info("[zeron:inbound] received payload (blob not configured)", {
      id,
      contentType: input.contentType,
      bytes,
      preview: input.body.slice(0, 500),
    });
  }

  return receipt;
}
