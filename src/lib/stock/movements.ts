import "server-only";

import type { MrpStockMovement, MrpStockMovementType } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DEFAULT_WAREHOUSE_CODE } from "@/lib/stock/seed";

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

// Warehouse ids/codes are immutable seed data — cache for the process lifetime.
const warehouseCodeCache = new Map<string, string>();

async function getWarehouseCodes(
  warehouseIds: string[],
): Promise<Map<string, string>> {
  const missing = warehouseIds.filter((id) => !warehouseCodeCache.has(id));
  if (missing.length > 0) {
    const rows = await prisma.mrpWarehouse.findMany({
      where: { id: { in: missing } },
      select: { id: true, code: true },
    });
    for (const row of rows) {
      warehouseCodeCache.set(row.id, row.code);
    }
  }
  return warehouseCodeCache;
}

/**
 * Apply a batch of movements inside an existing transaction.
 * Appends ledger rows, applies atomic balance increments grouped by
 * (warehouse, material), and keeps `materials.currentQuantity` in sync for
 * the default warehouse. Prefer this over per-movement calls in loops.
 */
export async function applyMovementsInTx(
  tx: Prisma.TransactionClient,
  inputs: ApplyMovementInput[],
  warehouseCodes: Map<string, string>,
): Promise<MrpStockMovement[]> {
  if (inputs.length === 0) return [];

  const deltas = inputs.map((input) => toDecimalString(input.quantityDelta));

  const movements = await tx.mrpStockMovement.createManyAndReturn({
    data: inputs.map((input, i) => ({
      warehouseId: input.warehouseId,
      materialId: input.materialId,
      movementType: input.movementType,
      quantityDelta: deltas[i]!,
      effectiveAt: input.effectiveAt,
      notes: input.notes ?? null,
      referenceId: input.referenceId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      createdById: input.createdBy ?? null,
    })),
  });

  // Net balance delta per (warehouse, material) so each pair gets one atomic upsert.
  const balanceDeltas = new Map<
    string,
    { warehouseId: string; materialId: string; delta: string }
  >();
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!;
    const key = `${input.warehouseId}\u0000${input.materialId}`;
    const entry = balanceDeltas.get(key);
    if (entry) {
      entry.delta = addDecimal(entry.delta, deltas[i]!);
    } else {
      balanceDeltas.set(key, {
        warehouseId: input.warehouseId,
        materialId: input.materialId,
        delta: deltas[i]!,
      });
    }
  }

  // Net delta per material for the denormalized default-warehouse quantity.
  const defaultWarehouseMaterialDeltas = new Map<string, string>();

  for (const { warehouseId, materialId, delta } of balanceDeltas.values()) {
    await tx.mrpStockBalance.upsert({
      where: { warehouseId_materialId: { warehouseId, materialId } },
      create: { warehouseId, materialId, quantity: delta },
      update: { quantity: { increment: delta } },
    });

    if (warehouseCodes.get(warehouseId) === DEFAULT_WAREHOUSE_CODE) {
      const existing = defaultWarehouseMaterialDeltas.get(materialId);
      defaultWarehouseMaterialDeltas.set(
        materialId,
        existing ? addDecimal(existing, delta) : delta,
      );
    }
  }

  for (const [materialId, delta] of defaultWarehouseMaterialDeltas) {
    await tx.mrpMaterial.update({
      where: { id: materialId },
      data: { currentQuantity: { increment: delta } },
    });
  }

  return movements;
}

/** Resolve warehouse codes (cached) for a set of movement inputs. */
export async function resolveWarehouseCodesForMovements(
  inputs: ApplyMovementInput[],
): Promise<Map<string, string>> {
  return getWarehouseCodes([...new Set(inputs.map((i) => i.warehouseId))]);
}

/**
 * Apply a batch of movements in a single transaction.
 * This is the only sanctioned way to change stock quantities in bulk.
 */
export async function applyMovements(
  inputs: ApplyMovementInput[],
): Promise<MrpStockMovement[]> {
  if (inputs.length === 0) return [];
  const warehouseCodes = await resolveWarehouseCodesForMovements(inputs);
  return prisma.$transaction((tx) =>
    applyMovementsInTx(tx, inputs, warehouseCodes),
  );
}

/** Append ledger row and update stock_balances (+ materials.currentQuantity for default warehouse). */
export async function applyMovement(
  input: ApplyMovementInput,
): Promise<MrpStockMovement> {
  const [movement] = await applyMovements([input]);
  if (!movement) {
    throw new Error("Failed to apply stock movement");
  }
  return movement;
}
