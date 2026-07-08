import "server-only";

import { prisma } from "@/lib/prisma";
import type {
  BatchPanelColumn,
  BatchUnitRow,
  ManufacturingBatchDetail,
  ManufacturingBatchRow,
} from "@/lib/stock/manufacturing-batch-types";
import {
  computeCompleteness,
  sortBatches,
} from "@/lib/stock/manufacturing-batch-types";

export type {
  BatchPanelColumn,
  BatchUnitRow,
  ManufacturingBatchDetail,
  ManufacturingBatchRow,
} from "@/lib/stock/manufacturing-batch-types";

export function batchSpreadsheetUrl(spreadsheetId: string | null): string | null {
  if (!spreadsheetId?.trim()) return null;
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId.trim()}`;
}

export async function listManufacturingBatches(): Promise<ManufacturingBatchRow[]> {
  const rows = await prisma.mrpManufacturingBatch.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      qty: true,
      batchSpreadsheetId: true,
      lastSyncedAt: true,
      boothModel: { select: { name: true } },
      warehouse: { select: { name: true, code: true } },
      units: {
        select: {
          elements: { select: { isComplete: true } },
        },
      },
    },
  });

  const mapped = rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    qty: row.qty,
    modelName: row.boothModel?.name ?? null,
    warehouseName: row.warehouse?.name ?? null,
    warehouseCode: row.warehouse?.code ?? null,
    unitCount: row.units.length,
    completenessPct: computeCompleteness(row.units),
    batchSpreadsheetId: row.batchSpreadsheetId,
    lastSyncedAt: row.lastSyncedAt,
  }));

  return sortBatches(mapped);
}

function buildPanelColumns(
  units: Array<{
    elements: Array<{
      boothElementId: string;
      boothElement: {
        sheetHeader: string;
        simpleName: string;
        sortOrder: number;
      };
    }>;
  }>,
): BatchPanelColumn[] {
  const byId = new Map<string, BatchPanelColumn>();
  for (const unit of units) {
    for (const element of unit.elements) {
      if (!byId.has(element.boothElementId)) {
        byId.set(element.boothElementId, {
          boothElementId: element.boothElementId,
          sheetHeader: element.boothElement.sheetHeader,
          simpleName: element.boothElement.simpleName,
          sortOrder: element.boothElement.sortOrder,
        });
      }
    }
  }
  return [...byId.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.simpleName.localeCompare(b.simpleName, "bg"),
  );
}

export async function getManufacturingBatchDetail(
  id: string,
): Promise<ManufacturingBatchDetail | null> {
  const batch = await prisma.mrpManufacturingBatch.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      qty: true,
      batchSpreadsheetId: true,
      lastSyncedAt: true,
      boothModel: { select: { name: true } },
      warehouse: { select: { name: true } },
      units: {
        orderBy: { sheetRowIndex: "asc" },
        select: {
          id: true,
          boothIdText: true,
          colour: true,
          progressPct: true,
          elements: {
            select: {
              boothElementId: true,
              isComplete: true,
              boothElement: {
                select: {
                  sheetHeader: true,
                  simpleName: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!batch) return null;

  const panels = buildPanelColumns(batch.units);
  const units: BatchUnitRow[] = batch.units.map((unit) => {
    const panelState: Record<string, boolean> = {};
    for (const element of unit.elements) {
      panelState[element.boothElementId] = element.isComplete;
    }
    return {
      id: unit.id,
      boothIdText: unit.boothIdText,
      colour: unit.colour,
      progressPct:
        unit.progressPct != null ? Number(unit.progressPct.toString()) : null,
      panels: panelState,
    };
  });

  return {
    id: batch.id,
    name: batch.name,
    status: batch.status,
    qty: batch.qty,
    modelName: batch.boothModel?.name ?? null,
    warehouseName: batch.warehouse?.name ?? null,
    completenessPct: computeCompleteness(batch.units),
    batchSpreadsheetId: batch.batchSpreadsheetId,
    lastSyncedAt: batch.lastSyncedAt,
    panels,
    units,
  };
}
