import "server-only";

import type { MrpStockMovement, MrpStockMovementType } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { addDecimal, toDecimalString } from "./decimal";

export type ApplyMovementInput = {
  warehouseId: string;
  materialId: string;
  movementType: MrpStockMovementType;
  quantityDelta: string | number;
  effectiveAt: Date;
  notes?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

async function upsertBalance(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  materialId: string,
  delta: string,
) {
  const existing = await tx.mrpStockBalance.findUnique({
    where: { warehouseId_materialId: { warehouseId, materialId } },
  });

  if (existing) {
    const next = addDecimal(existing.quantity.toString(), delta);
    await tx.mrpStockBalance.update({
      where: { id: existing.id },
      data: { quantity: next },
    });
  } else {
    await tx.mrpStockBalance.create({
      data: {
        warehouseId,
        materialId,
        quantity: toDecimalString(delta),
      },
    });
  }
}

/** Append ledger row and update stock_balances (+ materials.currentQuantity for default warehouse). */
export async function applyMovement(
  input: ApplyMovementInput,
): Promise<MrpStockMovement> {
  const delta = toDecimalString(input.quantityDelta);

  return prisma.$transaction(async (tx) => {
    const movement = await tx.mrpStockMovement.create({
      data: {
        warehouseId: input.warehouseId,
        materialId: input.materialId,
        movementType: input.movementType,
        quantityDelta: delta,
        effectiveAt: input.effectiveAt,
        notes: input.notes ?? null,
        referenceId: input.referenceId ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        createdById: input.createdBy ?? null,
      },
    });

    await upsertBalance(tx, input.warehouseId, input.materialId, delta);

    const warehouse = await tx.mrpWarehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (warehouse?.code === "aksakovo") {
      const material = await tx.mrpMaterial.findUnique({
        where: { id: input.materialId },
      });
      if (material) {
        await tx.mrpMaterial.update({
          where: { id: input.materialId },
          data: {
            currentQuantity: addDecimal(
              material.currentQuantity.toString(),
              delta,
            ),
          },
        });
      }
    }

    return movement;
  });
}
