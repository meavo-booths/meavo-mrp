import "server-only";

import { prisma } from "@/lib/prisma";

export function stockPairKey(warehouseId: string, materialId: string): string {
  return `${warehouseId}\u0000${materialId}`;
}

/** Warehouse × material pairs with a recorded opening stock / inventory count. */
export async function getBaselinedPairKeys(): Promise<Set<string>> {
  const rows = await prisma.mrpInventoryCount.findMany({
    select: { warehouseId: true, materialId: true },
    distinct: ["warehouseId", "materialId"],
  });

  return new Set(
    rows.map((row) => stockPairKey(row.warehouseId, row.materialId)),
  );
}

export function pairHasBaseline(
  baselinedKeys: Set<string>,
  warehouseId: string,
  materialId: string,
): boolean {
  return baselinedKeys.has(stockPairKey(warehouseId, materialId));
}
