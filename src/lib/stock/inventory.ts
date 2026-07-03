import "server-only";

import { and, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import type { InventoryCount } from "@/lib/db/schema";

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
): Promise<InventoryCount> {
  const counted = toDecimalString(input.countedQuantity);
  const balance = await db.query.stockBalances.findFirst({
    where: and(
      eq(schema.stockBalances.warehouseId, input.warehouseId),
      eq(schema.stockBalances.materialId, input.materialId),
    ),
  });
  const systemQty = balance?.quantity ?? "0";
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

  const [row] = await db
    .insert(schema.inventoryCounts)
    .values({
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
      createdBy: input.createdBy ?? null,
    })
    .returning();

  return row;
}
