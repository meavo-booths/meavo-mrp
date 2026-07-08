import type { MrpManufacturingBatchStatus } from "@prisma/client";

export type ManufacturingBatchRow = {
  id: string;
  name: string;
  status: MrpManufacturingBatchStatus;
  qty: number | null;
  modelName: string | null;
  warehouseName: string | null;
  unitCount: number;
  batchSpreadsheetId: string | null;
  lastSyncedAt: Date | string | null;
};
