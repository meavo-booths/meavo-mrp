import "server-only";

import { prisma } from "@/lib/prisma";
import { computeElementBomCostForMarket } from "@/lib/stock/bom-cost";
import { applyMovement } from "@/lib/stock/movements";

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
      const { lines } = await computeElementBomCostForMarket({
        boothElementId: row.boothElementId,
        boothColour: row.batchUnit.colour,
        boothMarket: "default",
      });

      if (lines.length === 0) {
        await prisma.mrpBatchUnitElement.update({
          where: { id: row.id },
          data: { deductionPosted: true },
        });
        result.skipped++;
        continue;
      }

      for (const line of lines) {
        const delta = -Math.abs(Number(line.quantity));
        await applyMovement({
          warehouseId,
          materialId: line.materialId,
          movementType: "element_consumption",
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
        });
      }

      await prisma.mrpBatchUnitElement.update({
        where: { id: row.id },
        data: { deductionPosted: true },
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

  return result;
}
