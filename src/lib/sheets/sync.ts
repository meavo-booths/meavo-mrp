import "server-only";

import type { MrpManufacturingBatch, MrpManufacturingBatchStatus } from "@prisma/client";

import {
  extractSpreadsheetId,
  fetchSheetGrid,
  fetchSheetValues,
  findSpreadsheetIdByBatchName,
} from "@/lib/google/sheets-client";
import { prisma } from "@/lib/prisma";
import { syncBomMissingFromMasterSheet } from "@/lib/stock/bom-missing";
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
  type ParsedOpakovaneUnit,
} from "@/lib/sheets/opakovane";

export type SheetSyncResult = {
  ok: boolean;
  logId: string;
  masterBatches: number;
  packingTabs: number;
  packingTabsSkipped: number;
  unitsUpserted: number;
  elementsUpserted: number;
  deductionsPosted: number;
  errors: string[];
  warnings: string[];
};

const PACKING_CONCURRENCY = 4;

function masterSpreadsheetId(): string {
  return process.env.GOOGLE_SHEETS_MASTER_ID?.trim() || DEFAULT_MASTER_SHEET_ID;
}

function shouldSyncPacking(status: MrpManufacturingBatchStatus): boolean {
  return status === "planned" || status === "in_production";
}

/** Run async work over items with a fixed concurrency limit. */
async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;

  async function runOne() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runOne()),
  );
  return results;
}

type LookupCaches = {
  boothModelId: Map<string, string>;
  boothModelInFlight: Map<string, Promise<string>>;
  warehouseId: Map<string, string>;
  elementsByModelId: Map<string, Map<string, string>>;
};

async function buildLookupCaches(): Promise<LookupCaches> {
  const [boothModels, warehouses, elements] = await Promise.all([
    prisma.mrpBoothModel.findMany({ select: { id: true, name: true } }),
    prisma.mrpWarehouse.findMany({ select: { id: true, code: true } }),
    prisma.mrpBoothElement.findMany({
      where: { isActive: true },
      select: { id: true, sheetHeader: true, boothModelId: true },
    }),
  ]);

  const boothModelId = new Map(
    boothModels.map((m) => [m.name.trim().toLowerCase(), m.id]),
  );
  const warehouseId = new Map(warehouses.map((w) => [w.code, w.id]));
  const elementsByModelId = new Map<string, Map<string, string>>();

  for (const element of elements) {
    const header = normalizeSheetHeader(element.sheetHeader);
    let modelMap = elementsByModelId.get(element.boothModelId);
    if (!modelMap) {
      modelMap = new Map();
      elementsByModelId.set(element.boothModelId, modelMap);
    }
    modelMap.set(header, element.id);
  }

  return {
    boothModelId,
    boothModelInFlight: new Map(),
    warehouseId,
    elementsByModelId,
  };
}

async function resolveBoothModelId(
  caches: LookupCaches,
  modelName: string,
): Promise<string | null> {
  const trimmed = modelName.trim();
  const key = trimmed.toLowerCase();
  if (!key) return null;

  const cached = caches.boothModelId.get(key);
  if (cached) return cached;

  const inFlight = caches.boothModelInFlight.get(key);
  if (inFlight) return inFlight;

  const promise = prisma.mrpBoothModel
    .upsert({
      where: { name: trimmed },
      create: { name: trimmed },
      update: {},
      select: { id: true },
    })
    .then((row) => {
      caches.boothModelId.set(key, row.id);
      return row.id;
    })
    .finally(() => {
      caches.boothModelInFlight.delete(key);
    });

  caches.boothModelInFlight.set(key, promise);
  return promise;
}

async function upsertMasterBatch(
  parsed: ParsedMasterBatch,
  caches: LookupCaches,
): Promise<MrpManufacturingBatch> {
  const section = BATCH_STATUS_SECTIONS.find((s) => s.factory === parsed.factory)!;
  const [boothModelId, warehouseId, batchSpreadsheetId] = await Promise.all([
    resolveBoothModelId(caches, parsed.modelName),
    Promise.resolve(caches.warehouseId.get(section.warehouseCode) ?? null),
    (async () => {
      if (parsed.batchSpreadsheetId) return parsed.batchSpreadsheetId;
      try {
        return await findSpreadsheetIdByBatchName(parsed.batchCode);
      } catch {
        return null;
      }
    })(),
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
      batchSpreadsheetId,
      lastSyncedAt: new Date(),
    },
    update: {
      name: parsed.batchCode,
      status: mapSheetBatchStatus(parsed.sheetStatus),
      boothModelId,
      qty: parsed.qty,
      warehouseId,
      batchSpreadsheetId: batchSpreadsheetId ?? undefined,
      lastSyncedAt: new Date(),
    },
  });
}

function decimalEquals(
  a: { toString(): string } | null,
  b: string | null,
): boolean {
  if (a === null || b === null) return a === null && b === null;
  return Number(a.toString()) === Number(b);
}

async function syncBatchPackingTab(
  batch: MrpManufacturingBatch,
  units: ParsedOpakovaneUnit[],
  headerToElementId: Map<string, string>,
): Promise<{
  unitsUpserted: number;
  elementsUpserted: number;
  newlyCompletedIds: string[];
}> {
  if (units.length === 0) {
    return { unitsUpserted: 0, elementsUpserted: 0, newlyCompletedIds: [] };
  }

  const existingUnits = await prisma.mrpBatchUnit.findMany({
    where: { manufacturingBatchId: batch.id },
    include: { elements: true },
  });
  const existingByRow = new Map(
    existingUnits.map((unit) => [unit.sheetRowIndex, unit]),
  );

  // Diff sheet state against the DB in memory; only changed rows get writes.
  const parsedRowIndices = new Set(units.map((unit) => unit.sheetRowIndex));
  const unitIdsToDelete = existingUnits
    .filter((unit) => !parsedRowIndices.has(unit.sheetRowIndex))
    .map((unit) => unit.id);

  const unitsToCreate: ParsedOpakovaneUnit[] = [];
  const unitUpdates: Array<{
    id: string;
    data: {
      boothIdText: string | null;
      colour: string | null;
      progressPct: string | null;
    };
  }> = [];

  type ElementCreate = {
    sheetRowIndex: number;
    boothElementId: string;
    isComplete: boolean;
    completedAt: Date | null;
  };
  const elementCreates: ElementCreate[] = [];
  const elementIdsToComplete: string[] = [];
  const elementIdsToUncomplete: string[] = [];
  const elementIdsMissingCompletedAt: string[] = [];
  const newlyCompletedIds: string[] = [];

  let unitsUpserted = 0;
  let elementsUpserted = 0;
  const now = new Date();

  for (const unit of units) {
    const existingUnit = existingByRow.get(unit.sheetRowIndex);
    unitsUpserted++;

    if (!existingUnit) {
      unitsToCreate.push(unit);
    } else if (
      existingUnit.boothIdText !== unit.boothIdText ||
      existingUnit.colour !== unit.colour ||
      !decimalEquals(existingUnit.progressPct, unit.progressPct)
    ) {
      unitUpdates.push({
        id: existingUnit.id,
        data: {
          boothIdText: unit.boothIdText,
          colour: unit.colour,
          progressPct: unit.progressPct,
        },
      });
    }

    const existingElements = new Map(
      (existingUnit?.elements ?? []).map((element) => [
        element.boothElementId,
        element,
      ]),
    );

    for (const element of unit.elements) {
      const boothElementId = headerToElementId.get(element.sheetHeader);
      if (!boothElementId) continue;
      elementsUpserted++;

      const existing = existingElements.get(boothElementId);
      const isComplete = element.isComplete;

      if (!existing) {
        elementCreates.push({
          sheetRowIndex: unit.sheetRowIndex,
          boothElementId,
          isComplete,
          completedAt: isComplete ? now : null,
        });
        continue;
      }

      const wasComplete = existing.isComplete;
      if (isComplete && !wasComplete) {
        elementIdsToComplete.push(existing.id);
        if (!existing.deductionPosted) {
          newlyCompletedIds.push(existing.id);
        }
      } else if (!isComplete && wasComplete) {
        elementIdsToUncomplete.push(existing.id);
      } else if (isComplete && existing.completedAt === null) {
        elementIdsMissingCompletedAt.push(existing.id);
      }
    }
  }

  await prisma.$transaction(
    async (tx) => {
      if (unitIdsToDelete.length > 0) {
        // Elements cascade via the schema relation.
        await tx.mrpBatchUnit.deleteMany({
          where: { id: { in: unitIdsToDelete } },
        });
      }

      const unitIdByRow = new Map<number, string>();
      if (unitsToCreate.length > 0) {
        const created = await tx.mrpBatchUnit.createManyAndReturn({
          data: unitsToCreate.map((unit) => ({
            manufacturingBatchId: batch.id,
            sheetRowIndex: unit.sheetRowIndex,
            boothIdText: unit.boothIdText,
            colour: unit.colour,
            progressPct: unit.progressPct,
          })),
          select: { id: true, sheetRowIndex: true },
        });
        for (const unit of created) {
          unitIdByRow.set(unit.sheetRowIndex, unit.id);
        }
      }

      for (const update of unitUpdates) {
        await tx.mrpBatchUnit.update({
          where: { id: update.id },
          data: update.data,
        });
      }

      if (elementCreates.length > 0) {
        await tx.mrpBatchUnitElement.createMany({
          data: elementCreates.flatMap((element) => {
            const batchUnitId =
              unitIdByRow.get(element.sheetRowIndex) ??
              existingByRow.get(element.sheetRowIndex)?.id;
            if (!batchUnitId) return [];
            return [
              {
                batchUnitId,
                boothElementId: element.boothElementId,
                isComplete: element.isComplete,
                completedAt: element.completedAt,
                // Pre-completed elements never deduct (bootstrap rule).
                deductionPosted: element.isComplete,
              },
            ];
          }),
        });
      }

      if (elementIdsToComplete.length > 0) {
        await tx.mrpBatchUnitElement.updateMany({
          where: { id: { in: elementIdsToComplete } },
          data: { isComplete: true, completedAt: now },
        });
      }
      if (elementIdsToUncomplete.length > 0) {
        await tx.mrpBatchUnitElement.updateMany({
          where: { id: { in: elementIdsToUncomplete } },
          data: { isComplete: false, completedAt: null },
        });
      }
      if (elementIdsMissingCompletedAt.length > 0) {
        await tx.mrpBatchUnitElement.updateMany({
          where: { id: { in: elementIdsMissingCompletedAt } },
          data: { completedAt: now },
        });
      }
    },
    { timeout: 60_000 },
  );

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
  let packingTabsSkipped = 0;
  let unitsUpserted = 0;
  let elementsUpserted = 0;
  let deductionsPosted = 0;
  const allNewlyCompleted: string[] = [];

  try {
    const caches = await buildLookupCaches();
    const spreadsheetId = masterSpreadsheetId();

    const [values, grids] = await Promise.all([
      fetchSheetValues(spreadsheetId, BATCH_STATUS_TAB_NAME, "A1:Y500"),
      fetchSheetGrid(
        spreadsheetId,
        BATCH_STATUS_SECTIONS.map((section) => {
          const col = String.fromCharCode("A".charCodeAt(0) + section.batch);
          return `'${BATCH_STATUS_TAB_NAME}'!${col}3:${col}500`;
        }),
      ),
    ]);

    const parsedBatches = parseAllMasterBatches(values, grids);
    const savedBatches = await runPool(parsedBatches, 8, async (parsed) => {
      try {
        return { parsed, batch: await upsertMasterBatch(parsed, caches) };
      } catch (err) {
        errors.push(
          `${parsed.batchCode}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }
    });

    const packingJobs: Array<{
      batch: MrpManufacturingBatch;
      spreadsheetId: string;
      headerToElementId: Map<string, string>;
    }> = [];

    for (const saved of savedBatches) {
      if (!saved) continue;
      masterBatches++;

      const { parsed, batch } = saved;
      if (!parsed.batchSpreadsheetId) {
        warnings.push(`Batch ${parsed.batchCode}: no spreadsheet link in master tab`);
        continue;
      }

      if (!shouldSyncPacking(batch.status)) {
        packingTabsSkipped++;
        continue;
      }

      if (!batch.boothModelId) {
        warnings.push(`Batch ${parsed.batchCode}: missing booth model — skipped packing tab`);
        continue;
      }

      const headerToElementId =
        caches.elementsByModelId.get(batch.boothModelId) ?? new Map();
      if (headerToElementId.size === 0) {
        warnings.push(`Batch ${parsed.batchCode}: no booth elements for model`);
        continue;
      }

      packingJobs.push({
        batch,
        spreadsheetId: parsed.batchSpreadsheetId,
        headerToElementId,
      });
    }

    const packingResults = await runPool(
      packingJobs,
      PACKING_CONCURRENCY,
      async (job) => {
        try {
          const rows = await fetchSheetValues(
            job.spreadsheetId,
            BATCH_PACKING_TAB_NAME,
            "A1:ZZ300",
          );
          const knownHeaders = new Set(job.headerToElementId.keys());
          const units = parseOpakovaneTab(rows, knownHeaders);
          if (units.length === 0) {
            warnings.push(`Batch ${job.batch.name}: no packing rows parsed`);
            return null;
          }

          packingTabs++;
          return await syncBatchPackingTab(job.batch, units, job.headerToElementId);
        } catch (err) {
          errors.push(
            `${job.batch.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
          return null;
        }
      },
    );

    for (const result of packingResults) {
      if (!result) continue;
      unitsUpserted += result.unitsUpserted;
      elementsUpserted += result.elementsUpserted;
      allNewlyCompleted.push(...result.newlyCompletedIds);
    }

    const deduction = await postElementDeductions({
      batchUnitElementIds: allNewlyCompleted,
    });
    deductionsPosted = deduction.posted;
    errors.push(...deduction.errors);

    // Refresh the BOM-missing materials cache (previously done on materials page render).
    try {
      await syncBomMissingFromMasterSheet();
    } catch (err) {
      warnings.push(
        `BOM missing refresh: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

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
      packingTabsSkipped,
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

export { extractSpreadsheetId };
