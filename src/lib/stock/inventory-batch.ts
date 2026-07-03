import "server-only";

import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import type { ManufacturingBatch } from "@/lib/db/schema";

export type BatchOption = {
  id: string;
  name: string;
  status: ManufacturingBatch["status"];
};

/** Batches for inventory checkpoint dropdown (newest last in sheet order ≈ name). */
export async function listManufacturingBatchOptions(): Promise<BatchOption[]> {
  const rows = await db
    .select({
      id: schema.manufacturingBatches.id,
      name: schema.manufacturingBatches.name,
      status: schema.manufacturingBatches.status,
    })
    .from(schema.manufacturingBatches)
    .orderBy(asc(schema.manufacturingBatches.name));

  return rows;
}

export type ResolvedInventoryBatch = {
  countedThroughBatchId: string | null;
  countedThroughBatchLabel: string | null;
};

/** Resolve FK + label from dropdown id and/or free-text batch name. */
export async function resolveInventoryBatchCheckpoint(input: {
  countedThroughBatchId?: string | null;
  countedThroughBatchLabel?: string | null;
}): Promise<ResolvedInventoryBatch> {
  const label = input.countedThroughBatchLabel?.trim() || null;

  if (input.countedThroughBatchId) {
    const batch = await db.query.manufacturingBatches.findFirst({
      where: eq(schema.manufacturingBatches.id, input.countedThroughBatchId),
      columns: { id: true, name: true },
    });
    if (batch) {
      return {
        countedThroughBatchId: batch.id,
        countedThroughBatchLabel: batch.name,
      };
    }
  }

  if (label) {
    const byName = await db.query.manufacturingBatches.findFirst({
      where: eq(schema.manufacturingBatches.name, label),
      columns: { id: true, name: true },
    });
    if (byName) {
      return {
        countedThroughBatchId: byName.id,
        countedThroughBatchLabel: byName.name,
      };
    }
    return {
      countedThroughBatchId: null,
      countedThroughBatchLabel: label,
    };
  }

  return { countedThroughBatchId: null, countedThroughBatchLabel: null };
}

/**
 * Batches after the inventory checkpoint — their consumption is not yet in the
 * physical count and should be subtracted when production sync runs.
 */
export async function listBatchesAfterCheckpoint(
  countedThroughBatchId: string,
): Promise<ManufacturingBatch[]> {
  const checkpoint = await db.query.manufacturingBatches.findFirst({
    where: eq(schema.manufacturingBatches.id, countedThroughBatchId),
  });
  if (!checkpoint) return [];

  const all = await db
    .select()
    .from(schema.manufacturingBatches)
    .orderBy(asc(schema.manufacturingBatches.name));

  const idx = all.findIndex((b) => b.id === countedThroughBatchId);
  if (idx < 0) return [];
  return all.slice(idx + 1);
}
