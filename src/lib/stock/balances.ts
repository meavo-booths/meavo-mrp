import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getBaselinedPairKeys,
  pairHasBaseline,
} from "@/lib/stock/stock-baseline";

export type BalanceRow = {
  balanceId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  materialId: string;
  materialCode: string | null;
  materialName: string;
  unit: string;
  quantity: string;
  hasBaseline: boolean;
  isShortage: boolean;
};

export async function listBalances(
  options: {
    warehouseId?: string;
    /** Cap the number of rows; combined with `orderBy: "quantity"` gives a "lowest stock first" list. */
    take?: number;
    orderBy?: "name" | "quantity";
    /** When true, only rows with a recorded inventory/opening count are returned. */
    baselinedOnly?: boolean;
  } = {},
): Promise<BalanceRow[]> {
  const baselinedKeys = await getBaselinedPairKeys();

  const rows = await prisma.mrpStockBalance.findMany({
    where: options.warehouseId
      ? { warehouseId: options.warehouseId }
      : undefined,
    select: {
      id: true,
      warehouseId: true,
      quantity: true,
      material: { select: { id: true, code: true, name: true, unit: true } },
      warehouse: { select: { code: true, name: true } },
    },
    orderBy:
      options.orderBy === "quantity"
        ? { quantity: "asc" }
        : { material: { name: "asc" } },
    take: options.take,
  });

  const mapped = rows.map((row) => {
    const hasBaseline = pairHasBaseline(
      baselinedKeys,
      row.warehouseId,
      row.material.id,
    );
    const quantity = row.quantity.toString();
    return {
      balanceId: row.id,
      warehouseId: row.warehouseId,
      warehouseCode: row.warehouse.code,
      warehouseName: row.warehouse.name,
      materialId: row.material.id,
      materialCode: row.material.code,
      materialName: row.material.name,
      unit: row.material.unit,
      quantity,
      hasBaseline,
      isShortage: hasBaseline && Number(quantity) <= 0,
    };
  });

  if (options.baselinedOnly) {
    return mapped.filter((row) => row.hasBaseline);
  }

  return mapped;
}

/** Aggregate stats for dashboards — only materials with a recorded baseline count. */
export async function getBalanceStats(
  options: { warehouseId?: string } = {},
) {
  const rows = await listBalances({
    warehouseId: options.warehouseId,
    baselinedOnly: true,
  });

  const tracked = rows.filter((row) => Number(row.quantity) > 0).length;

  return {
    total: rows.length,
    tracked,
    shortages: rows.length - tracked,
  };
}
