import type { ZeronAdapter, ZeronPushPayload, ZeronPushResult } from "./adapter";

/**
 * No-op adapter. Records that we tried, returns success — useful for
 * developing the queue UI without hitting external systems.
 */
export const stubAdapter: ZeronAdapter = {
  name: "stub",
  async pushDocument(payload: ZeronPushPayload): Promise<ZeronPushResult> {
    return {
      message: `[stub] would push document ${payload.document.id} (${payload.lineItems.length} line items) to Zeron.`,
    };
  },
};
