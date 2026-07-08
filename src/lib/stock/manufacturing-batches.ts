import "server-only";

import { prisma } from "@/lib/prisma";
import type { ManufacturingBatchRow } from "@/lib/stock/manufacturing-batch-types";

export type { ManufacturingBatchRow } from "@/lib/stock/manufacturing-batch-types";

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
      warehouse: { select: { name: true } },
      _count: { select: { units: true } },
    },
    orderBy: { name: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    qty: row.qty,
    modelName: row.boothModel?.name ?? null,
    warehouseName: row.warehouse?.name ?? null,
    unitCount: row._count.units,
    batchSpreadsheetId: row.batchSpreadsheetId,
    lastSyncedAt: row.lastSyncedAt,
  }));
}
