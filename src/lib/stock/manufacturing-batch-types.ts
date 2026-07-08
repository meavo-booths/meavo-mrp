import type { MrpManufacturingBatchStatus } from "@prisma/client";

export type ManufacturingBatchRow = {
  id: string;
  name: string;
  status: MrpManufacturingBatchStatus;
  qty: number | null;
  modelName: string | null;
  warehouseName: string | null;
  warehouseCode: string | null;
  unitCount: number;
  completenessPct: number | null;
  batchSpreadsheetId: string | null;
  lastSyncedAt: Date | string | null;
};

export type BatchPanelColumn = {
  boothElementId: string;
  sheetHeader: string;
  simpleName: string;
  sortOrder: number;
};

export type BatchUnitRow = {
  id: string;
  boothIdText: string | null;
  colour: string | null;
  progressPct: number | null;
  panels: Record<string, boolean>;
};

export type ManufacturingBatchDetail = {
  id: string;
  name: string;
  status: MrpManufacturingBatchStatus;
  qty: number | null;
  modelName: string | null;
  warehouseName: string | null;
  completenessPct: number | null;
  batchSpreadsheetId: string | null;
  lastSyncedAt: Date | string | null;
  panels: BatchPanelColumn[];
  units: BatchUnitRow[];
};

function computeCompleteness(
  units: Array<{ elements: Array<{ isComplete: boolean }> }>,
): number | null {
  let total = 0;
  let complete = 0;
  for (const unit of units) {
    for (const element of unit.elements) {
      total++;
      if (element.isComplete) complete++;
    }
  }
  if (total === 0) return null;
  return Math.round((complete / total) * 1000) / 10;
}

const AKS_WAREHOUSE_CODE = "aksakovo";

function sortBatches<T extends { name: string; warehouseCode: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const aAks = a.warehouseCode === AKS_WAREHOUSE_CODE ? 0 : 1;
    const bAks = b.warehouseCode === AKS_WAREHOUSE_CODE ? 0 : 1;
    if (aAks !== bAks) return aAks - bAks;
    return b.name.localeCompare(a.name, "bg", { numeric: true });
  });
}

export { computeCompleteness, sortBatches, AKS_WAREHOUSE_CODE };
