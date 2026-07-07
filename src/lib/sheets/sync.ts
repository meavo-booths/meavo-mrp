import "server-only";

import type { MrpManufacturingBatch } from "@prisma/client";

import {
  extractSpreadsheetId,
  fetchSheetGrid,
  fetchSheetValues,
} from "@/lib/google/sheets-client";
import { prisma } from "@/lib/prisma";
import { ensureStockReferenceData } from "@/lib/stock/seed";
import { postElementDeductions } from "@/lib/sheets/deductions";
import { parseAllMasterBatches, type ParsedMasterBatch } from "@/lib/sheets/master-status";
import {
  BATCH_PACKING_TAB_NAME,
  BATCH_STATUS_SECTIONS,
  BATCH_STATUS_TAB_NAME,
  DEFAULT_MASTER_SHEET_ID,
  mapSheetBatchStatus,
} from "@/lib/sheets/config";
import {
  normalizeSheetHeader,
  parseOpakovaneTab,
} from "@/lib/sheets/opakovane";

export type SheetSyncResult = {
  ok: boolean;
  logId: string;
  masterBatches: number;
  packingTabs: number;
  unitsUpserted: number;
  elementsUpserted: number;
  deductionsPosted: number;
  errors: string[];
  warnings: string[];
};

function masterSpreadsheetId(): string {
  return process.env.GOOGLE_SHEETS_MASTER_ID?.trim() || DEFAULT_MASTER_SHEET_ID;
}

async function resolveBoothModelId(modelName: string): Promise<string | null> {
  const name = modelName.trim();
  if (!name) return null;

  const existing = await prisma.mrpBoothModel.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.mrpBoothModel.create({
    data: { name },
    select: { id: true },
  });
  return created.id;
}

async function resolveWarehouseId(code: string): Promise<string | null> {
  const wh = await prisma.mrpWarehouse.findUnique({
    where: { code },
    select: { id: true },
  });
  return wh?.id ?? null;
}

async function upsertMasterBatch(
  parsed: ParsedMasterBatch,
): Promise<MrpManufacturingBatch> {
  const [boothModelId, warehouseId] = await Promise.all([
    resolveBoothModelId(parsed.modelName),
    resolveWarehouseId(
      BATCH_STATUS_SECTIONS.find((s) => s.factory === parsed.factory)!
        .warehouseCode,
    ),
  ]);

  return prisma.mrpManufacturingBatch.upsert({
    where: { masterSheetRowKey: parsed.rowKey },
    create: {
      name: parsed.batchCode,
      status: mapSheetBatchStatus(parsed.sheetStatus),
      boothModelId,
      qty: parsed.qty,
      warehouseId,
      masterSheetRowKey: parsed.rowKey,
      batchSpreadsheetId: parsed.batchSpreadsheetId,
      lastSyncedAt: new Date(),
    },
    update: {
      name: parsed.batchCode,
      status: mapSheetBatchStatus(parsed.sheetStatus),
      boothModelId,
      qty: parsed.qty,
      warehouseId,
      batchSpreadsheetId: parsed.batchSpreadsheetId ?? undefined,
      lastSyncedAt: new Date(),
    },
  });
}

async function syncBatchPackingTab(
  batch: MrpManufacturingBatch,
  warnings: string[],
  errors: string[],
): Promise<{
  unitsUpserted: number;
  elementsUpserted: number;
  newlyCompletedIds: string[];
}> {
  const spreadsheetId = batch.batchSpreadsheetId;
  if (!spreadsheetId) {
    return { unitsUpserted: 0, elementsUpserted: 0, newlyCompletedIds: [] };
  }

  if (!batch.boothModelId) {
    warnings.push(`Batch ${batch.name}: missing booth model — skipped packing tab`);
    return { unitsUpserted: 0, elementsUpserted: 0, newlyCompletedIds: [] };
  }

  const elements = await prisma.mrpBoothElement.findMany({
    where: { boothModelId: batch.boothModelId, isActive: true },
    select: { id: true, sheetHeader: true },
  });

  const headerToElementId = new Map(
    elements.map((e) => [normalizeSheetHeader(e.sheetHeader), e.id]),
  );
  const knownHeaders = new Set(headerToElementId.keys());

  const rows = await fetchSheetValues(
    spreadsheetId,
    BATCH_PACKING_TAB_NAME,
    "A1:ZZ500",
  );
  const units = parseOpakovaneTab(rows, knownHeaders);

  if (units.length === 0) {
    warnings.push(`Batch ${batch.name}: no packing rows parsed`);
    return { unitsUpserted: 0, elementsUpserted: 0, newlyCompletedIds: [] };
  }

  let unitsUpserted = 0;
  let elementsUpserted = 0;
  const newlyCompletedIds: string[] = [];

  for (const unit of units) {
    const batchUnit = await prisma.mrpBatchUnit.upsert({
      where: {
        manufacturingBatchId_sheetRowIndex: {
          manufacturingBatchId: batch.id,
          sheetRowIndex: unit.sheetRowIndex,
        },
      },
      create: {
        manufacturingBatchId: batch.id,
        sheetRowIndex: unit.sheetRowIndex,
        boothIdText: unit.boothIdText,
        colour: unit.colour,
        progressPct: unit.progressPct,
      },
      update: {
        boothIdText: unit.boothIdText,
        colour: unit.colour,
        progressPct: unit.progressPct,
      },
    });
    unitsUpserted++;

    for (const element of unit.elements) {
      const boothElementId = headerToElementId.get(element.sheetHeader);
      if (!boothElementId) continue;

      const existing = await prisma.mrpBatchUnitElement.findUnique({
        where: {
          batchUnitId_boothElementId: {
            batchUnitId: batchUnit.id,
            boothElementId,
          },
        },
      });

      const wasComplete = existing?.isComplete ?? false;
      const isComplete = element.isComplete;
      const completedAt =
        isComplete && !wasComplete
          ? new Date()
          : isComplete
            ? (existing?.completedAt ?? new Date())
            : null;

      const saved = await prisma.mrpBatchUnitElement.upsert({
        where: {
          batchUnitId_boothElementId: {
            batchUnitId: batchUnit.id,
            boothElementId,
          },
        },
        create: {
          batchUnitId: batchUnit.id,
          boothElementId,
          isComplete,
          completedAt,
          // Historical TRUE on first import — opening stock already reflects these.
          deductionPosted: isComplete,
        },
        update: {
          isComplete,
          completedAt,
        },
      });
      elementsUpserted++;

      if (
        existing &&
        isComplete &&
        !wasComplete &&
        !saved.deductionPosted
      ) {
        newlyCompletedIds.push(saved.id);
      }
    }
  }

  return { unitsUpserted, elementsUpserted, newlyCompletedIds };
}

export async function runSheetSync(): Promise<SheetSyncResult> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  }

  await ensureStockReferenceData();

  const log = await prisma.mrpSheetSyncLog.create({ data: {} });
  const errors: string[] = [];
  const warnings: string[] = [];

  let masterBatches = 0;
  let packingTabs = 0;
  let unitsUpserted = 0;
  let elementsUpserted = 0;
  let deductionsPosted = 0;
  const allNewlyCompleted: string[] = [];

  try {
    const spreadsheetId = masterSpreadsheetId();
    const values = await fetchSheetValues(
      spreadsheetId,
      BATCH_STATUS_TAB_NAME,
      "A1:Y500",
    );

    const linkRanges = BATCH_STATUS_SECTIONS.map((section) => {
      const col = String.fromCharCode("A".charCodeAt(0) + section.batch);
      return `'${BATCH_STATUS_TAB_NAME}'!${col}3:${col}500`;
    });

    const grids = await fetchSheetGrid(spreadsheetId, linkRanges);
    const parsedBatches = parseAllMasterBatches(values, grids);

    for (const parsed of parsedBatches) {
      try {
        const batch = await upsertMasterBatch(parsed);
        masterBatches++;

        if (parsed.batchSpreadsheetId) {
          packingTabs++;
          const packing = await syncBatchPackingTab(batch, warnings, errors);
          unitsUpserted += packing.unitsUpserted;
          elementsUpserted += packing.elementsUpserted;
          allNewlyCompleted.push(...packing.newlyCompletedIds);
        } else {
          warnings.push(`Batch ${parsed.batchCode}: no spreadsheet link in master tab`);
        }
      } catch (err) {
        errors.push(
          `${parsed.batchCode}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const deduction = await postElementDeductions({
      batchUnitElementIds: allNewlyCompleted,
    });
    deductionsPosted = deduction.posted;
    errors.push(...deduction.errors);

    await prisma.mrpSheetSyncLog.update({
      where: { id: log.id },
      data: {
        completedAt: new Date(),
        tabsRead: 1 + packingTabs,
        rowsUpserted: masterBatches + unitsUpserted,
        errors: [...errors, ...warnings],
      },
    });

    return {
      ok: errors.length === 0,
      logId: log.id,
      masterBatches,
      packingTabs,
      unitsUpserted,
      elementsUpserted,
      deductionsPosted,
      errors,
      warnings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(message);
    await prisma.mrpSheetSyncLog.update({
      where: { id: log.id },
      data: {
        completedAt: new Date(),
        errors,
      },
    });
    throw err;
  }
}

/** Extract spreadsheet id from a batch hyperlink (for tests). */
export { extractSpreadsheetId };
