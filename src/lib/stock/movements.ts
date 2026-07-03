import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import type { StockMovement } from "@/lib/db/schema";

import { addDecimal, toDecimalString } from "./decimal";

export type ApplyMovementInput = {
  warehouseId: string;
  materialId: string;
  movementType: (typeof schema.stockMovementTypeEnum.enumValues)[number];
  quantityDelta: string | number;
  effectiveAt: Date;
  notes?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

async function upsertBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  warehouseId: string,
  materialId: string,
  delta: string,
) {
  const existing = await tx.query.stockBalances.findFirst({
    where: and(
      eq(schema.stockBalances.warehouseId, warehouseId),
      eq(schema.stockBalances.materialId, materialId),
    ),
  });

  if (existing) {
    const next = addDecimal(existing.quantity, delta);
    await tx
      .update(schema.stockBalances)
      .set({ quantity: next, updatedAt: sql`now()` })
      .where(eq(schema.stockBalances.id, existing.id));
  } else {
    await tx.insert(schema.stockBalances).values({
      warehouseId,
      materialId,
      quantity: toDecimalString(delta),
    });
  }
}

/** Append ledger row and update stock_balances (+ materials.currentQuantity for default warehouse). */
export async function applyMovement(
  input: ApplyMovementInput,
): Promise<StockMovement> {
  const delta = toDecimalString(input.quantityDelta);

  return db.transaction(async (tx) => {
    const [movement] = await tx
      .insert(schema.stockMovements)
      .values({
        warehouseId: input.warehouseId,
        materialId: input.materialId,
        movementType: input.movementType,
        quantityDelta: delta,
        effectiveAt: input.effectiveAt,
        notes: input.notes ?? null,
        referenceId: input.referenceId ?? null,
        metadata: input.metadata ?? {},
        createdBy: input.createdBy ?? null,
      })
      .returning();

    await upsertBalance(tx, input.warehouseId, input.materialId, delta);

    const warehouse = await tx.query.warehouses.findFirst({
      where: eq(schema.warehouses.id, input.warehouseId),
    });
    if (warehouse?.code === "aksakovo") {
      const material = await tx.query.materials.findFirst({
        where: eq(schema.materials.id, input.materialId),
      });
      if (material) {
        await tx
          .update(schema.materials)
          .set({
            currentQuantity: addDecimal(material.currentQuantity, delta),
            updatedAt: sql`now()`,
          })
          .where(eq(schema.materials.id, input.materialId));
      }
    }

    return movement;
  });
}
