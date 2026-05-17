import type { ZeronAdapter, ZeronPushPayload, ZeronPushResult } from "./adapter";

/**
 * Plan-C adapter — posts to a small desktop helper that automates Zeron's
 * web UI on the user's machine. Implementation deferred to Phase 4; this
 * stub throws a clear error so it cannot be activated by accident.
 */
export const agentAdapter: ZeronAdapter = {
  name: "agent",
  async pushDocument(_payload: ZeronPushPayload): Promise<ZeronPushResult> {
    throw new Error(
      "Zeron desktop agent adapter is not implemented yet (Phase 4 fallback).",
    );
  },
};
