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
import { Prisma } from "@prisma/client";

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

type BatchAggregateRow = {
  batchId: string;
  unitCount: bigint;
  elementCount: bigint;
  completeCount: bigint;
};

export async function listManufacturingBatches(): Promise<ManufacturingBatchRow[]> {
  // Aggregate unit/element counts in SQL instead of loading every element row
  // (a batch can have hundreds of units × dozens of elements).
  const [rows, aggregates] = await Promise.all([
    prisma.mrpManufacturingBatch.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        qty: true,
        batchSpreadsheetId: true,
        lastSyncedAt: true,
        boothModel: { select: { name: true } },
        warehouse: { select: { name: true, code: true } },
      },
    }),
    prisma.$queryRaw<BatchAggregateRow[]>(Prisma.sql`
      SELECT
        u."manufacturingBatchId" AS "batchId",
        COUNT(DISTINCT u.id) AS "unitCount",
        COUNT(e.id) AS "elementCount",
        COUNT(e.id) FILTER (WHERE e."isComplete") AS "completeCount"
      FROM "MrpBatchUnit" u
      LEFT JOIN "MrpBatchUnitElement" e ON e."batchUnitId" = u.id
      GROUP BY u."manufacturingBatchId"
    `),
  ]);

  const aggregateByBatch = new Map(aggregates.map((a) => [a.batchId, a]));

  const mapped = rows.map((row) => {
    const agg = aggregateByBatch.get(row.id);
    const elementCount = Number(agg?.elementCount ?? 0);
    const completeCount = Number(agg?.completeCount ?? 0);
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      qty: row.qty,
      modelName: row.boothModel?.name ?? null,
      warehouseName: row.warehouse?.name ?? null,
      warehouseCode: row.warehouse?.code ?? null,
      unitCount: Number(agg?.unitCount ?? 0),
      completenessPct:
        elementCount === 0
          ? null
          : Math.round((completeCount / elementCount) * 1000) / 10,
      batchSpreadsheetId: row.batchSpreadsheetId,
      lastSyncedAt: row.lastSyncedAt,
    };
  });

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
