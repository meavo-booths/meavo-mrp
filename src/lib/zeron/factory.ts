import "server-only";

import { env } from "@/lib/env";
import type { ZeronAdapter } from "./adapter";
import { stubAdapter } from "./stubAdapter";
import { apiAdapter } from "./apiAdapter";
import { exportAdapter } from "./exportAdapter";
import { agentAdapter } from "./agentAdapter";

/** Pick the adapter selected via the `ZERON_ADAPTER` env var. */
export function getZeronAdapter(): ZeronAdapter {
  switch (env.ZERON_ADAPTER) {
    case "api":
      return apiAdapter;
    case "export":
      return exportAdapter;
    case "agent":
      return agentAdapter;
    case "stub":
    default:
      return stubAdapter;
  }
}
