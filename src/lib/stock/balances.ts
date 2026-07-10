import "server-only";

import { prisma } from "@/lib/prisma";

export async function listBalances(
  options: {
    warehouseId?: string;
    /** Cap the number of rows; combined with `orderBy: "quantity"` gives a "lowest stock first" list. */
    take?: number;
    orderBy?: "name" | "quantity";
  } = {},
) {
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

  return rows.map((row) => ({
    balanceId: row.id,
    warehouseId: row.warehouseId,
    warehouseCode: row.warehouse.code,
    warehouseName: row.warehouse.name,
    materialId: row.material.id,
    materialCode: row.material.code,
    materialName: row.material.name,
    unit: row.material.unit,
    quantity: row.quantity.toString(),
  }));
}

/** Aggregate stats for dashboards without loading every balance row. */
export async function getBalanceStats(
  options: { warehouseId?: string } = {},
) {
  const where = options.warehouseId
    ? { warehouseId: options.warehouseId }
    : undefined;

  const [total, tracked] = await Promise.all([
    prisma.mrpStockBalance.count({ where }),
    prisma.mrpStockBalance.count({
      where: { ...where, quantity: { gt: 0 } },
    }),
  ]);

  return { total, tracked, shortages: total - tracked };
}
