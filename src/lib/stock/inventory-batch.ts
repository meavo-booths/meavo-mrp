import "server-only";

import type { MrpManufacturingBatch } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type BatchOption = {
  id: string;
  name: string;
  status: MrpManufacturingBatch["status"];
};

/** Batches for inventory checkpoint dropdown (newest last in sheet order ≈ name). */
export async function listManufacturingBatchOptions(): Promise<BatchOption[]> {
  const rows = await prisma.mrpManufacturingBatch.findMany({
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });

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
    const batch = await prisma.mrpManufacturingBatch.findUnique({
      where: { id: input.countedThroughBatchId },
      select: { id: true, name: true },
    });
    if (batch) {
      return {
        countedThroughBatchId: batch.id,
        countedThroughBatchLabel: batch.name,
      };
    }
  }

  if (label) {
    const byName = await prisma.mrpManufacturingBatch.findFirst({
      where: { name: label },
      select: { id: true, name: true },
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
): Promise<MrpManufacturingBatch[]> {
  const checkpoint = await prisma.mrpManufacturingBatch.findUnique({
    where: { id: countedThroughBatchId },
  });
  if (!checkpoint) return [];

  const all = await prisma.mrpManufacturingBatch.findMany({
    orderBy: { name: "asc" },
  });

  const idx = all.findIndex((b) => b.id === countedThroughBatchId);
  if (idx < 0) return [];
  return all.slice(idx + 1);
}
