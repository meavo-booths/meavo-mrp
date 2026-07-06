/**
 * Common interface for any "push approved document into Zeron" implementation.
 *
 * Three concrete adapters live alongside this file:
 *  - `stubAdapter`  : no-op (just logs); used during early build
 *  - `apiAdapter`   : posts to Zeron's REST API (Plan A — pending vendor docs)
 *  - `exportAdapter`: writes XLSX/XML for manual import (Plan B)
 *  - `agentAdapter` : posts to a desktop helper (Plan C, Phase 4)
 *
 * The exact payload sent to Zeron depends on the adapter; from the queue's
 * point of view the contract is just "given this approved doc + supplier +
 * line items, push it and return a result".
 */

import type {
  MrpDocument,
  MrpLineItem,
  MrpSupplier,
} from "@prisma/client";

export type ZeronPushPayload = {
  document: MrpDocument;
  supplier: MrpSupplier | null;
  lineItems: MrpLineItem[];
};

export type ZeronPushResult = {
  /** Provider-supplied identifier for the synced record (URL, file path, API id). */
  externalId?: string;
  /** Human-readable summary. */
  message: string;
  /** Raw response for the audit log. */
  raw?: unknown;
};

export interface ZeronAdapter {
  readonly name: "stub" | "export" | "api" | "agent";
  pushDocument(payload: ZeronPushPayload): Promise<ZeronPushResult>;
}
