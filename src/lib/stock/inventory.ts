import "server-only";

import type { MrpInventoryCount } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { toDecimalString } from "./decimal";
import { resolveInventoryBatchCheckpoint } from "./inventory-batch";
import { applyMovement } from "./movements";

export type RecordInventoryCountInput = {
  warehouseId: string;
  materialId: string;
  countDate: Date;
  countedQuantity: string | number;
  notes?: string | null;
  countedThroughBatchId?: string | null;
  countedThroughBatchLabel?: string | null;
  createdBy?: string | null;
};

/** Physical count overwrites on-hand; variance row kept for audit. */
export async function recordInventoryCount(
  input: RecordInventoryCountInput,
): Promise<MrpInventoryCount> {
  const counted = toDecimalString(input.countedQuantity);
  const balance = await prisma.mrpStockBalance.findUnique({
    where: {
      warehouseId_materialId: {
        warehouseId: input.warehouseId,
        materialId: input.materialId,
      },
    },
  });
  const systemQty = balance?.quantity.toString() ?? "0";
  const variance = (
    Number(counted) - Number(systemQty)
  ).toFixed(4);

  const batch = await resolveInventoryBatchCheckpoint({
    countedThroughBatchId: input.countedThroughBatchId,
    countedThroughBatchLabel: input.countedThroughBatchLabel,
  });

  const movement = await applyMovement({
    warehouseId: input.warehouseId,
    materialId: input.materialId,
    movementType: "inventory_count",
    quantityDelta: variance,
    effectiveAt: input.countDate,
    notes: input.notes ?? null,
    createdBy: input.createdBy ?? null,
    referenceId: batch.countedThroughBatchId,
    metadata: {
      systemQuantity: systemQty,
      countedQuantity: counted,
      countedThroughBatchId: batch.countedThroughBatchId,
      countedThroughBatchLabel: batch.countedThroughBatchLabel,
    },
  });

  const row = await prisma.mrpInventoryCount.create({
    data: {
      warehouseId: input.warehouseId,
      materialId: input.materialId,
      countDate: input.countDate,
      systemQuantity: systemQty,
      countedQuantity: counted,
      variance,
      notes: input.notes ?? null,
      countedThroughBatchId: batch.countedThroughBatchId,
      countedThroughBatchLabel: batch.countedThroughBatchLabel,
      movementId: movement.id,
      createdById: input.createdBy ?? null,
    },
  });

  return row;
}
