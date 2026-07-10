import "server-only";

import { prisma } from "@/lib/prisma";
import {
  computeBomCostFromRows,
  loadBomRowsForElements,
  type BomLineWithCost,
} from "@/lib/stock/bom-cost";
import {
  applyMovementsInTx,
  resolveWarehouseCodesForMovements,
  type ApplyMovementInput,
} from "@/lib/stock/movements";

export type DeductionResult = {
  posted: number;
  skipped: number;
  errors: string[];
};

/**
 * Post `element_consumption` movements for newly completed checkboxes.
 * Uses standard BOM lines (recipe exceptions are not applied in v1).
 */
export async function postElementDeductions(input: {
  batchUnitElementIds: string[];
}): Promise<DeductionResult> {
  const result: DeductionResult = { posted: 0, skipped: 0, errors: [] };
  if (input.batchUnitElementIds.length === 0) return result;

  const rows = await prisma.mrpBatchUnitElement.findMany({
    where: {
      id: { in: input.batchUnitElementIds },
      isComplete: true,
      deductionPosted: false,
    },
    include: {
      boothElement: { select: { id: true } },
      batchUnit: {
        include: {
          manufacturingBatch: {
            include: { warehouse: true, boothModel: true },
          },
        },
      },
    },
  });
  if (rows.length === 0) return result;

  // One query for all BOM lines; resolution memoized per (element, colour).
  const bomRowsByElement = await loadBomRowsForElements(
    rows.map((row) => row.boothElementId),
  );
  const resolvedBomCache = new Map<string, BomLineWithCost[]>();
  const noBomElementIds: string[] = [];

  for (const row of rows) {
    const batch = row.batchUnit.manufacturingBatch;
    const warehouseId = batch.warehouseId;
    if (!warehouseId) {
      result.skipped++;
      result.errors.push(
        `Batch ${batch.name}: no warehouse — skipped deduction for ${row.id}`,
      );
      continue;
    }

    try {
      const cacheKey = `${row.boothElementId}\u0000${row.batchUnit.colour ?? ""}`;
      let lines = resolvedBomCache.get(cacheKey);
      if (!lines) {
        lines = computeBomCostFromRows(
          bomRowsByElement.get(row.boothElementId) ?? [],
          row.batchUnit.colour,
          "default",
        ).lines;
        resolvedBomCache.set(cacheKey, lines);
      }

      if (lines.length === 0) {
        noBomElementIds.push(row.id);
        result.skipped++;
        continue;
      }

      const movements: ApplyMovementInput[] = lines.map((line) => {
        const delta = -Math.abs(Number(line.quantity));
        return {
          warehouseId,
          materialId: line.materialId,
          movementType: "element_consumption" as const,
          quantityDelta: delta.toFixed(4),
          effectiveAt: row.completedAt ?? new Date(),
          referenceId: row.id,
          notes: `Production: ${batch.name} / ${row.batchUnit.boothIdText}`,
          metadata: {
            manufacturingBatchId: batch.id,
            batchUnitId: row.batchUnitId,
            boothElementId: row.boothElementId,
            materialCode: line.materialCode,
          },
        };
      });

      // Movements + the deductionPosted flag commit atomically per element,
      // so a deduction can never be posted twice or lost half-way.
      const warehouseCodes =
        await resolveWarehouseCodesForMovements(movements);
      await prisma.$transaction(async (tx) => {
        await applyMovementsInTx(tx, movements, warehouseCodes);
        await tx.mrpBatchUnitElement.update({
          where: { id: row.id },
          data: { deductionPosted: true },
        });
      });
      result.posted++;
    } catch (err) {
      result.errors.push(
        `${batch.name} ${row.batchUnit.boothIdText}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  if (noBomElementIds.length > 0) {
    await prisma.mrpBatchUnitElement.updateMany({
      where: { id: { in: noBomElementIds } },
      data: { deductionPosted: true },
    });
  }

  return result;
}
