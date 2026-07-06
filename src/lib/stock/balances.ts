import "server-only";

import { prisma } from "@/lib/prisma";

export async function listBalances(options: { warehouseId?: string } = {}) {
  const rows = await prisma.mrpStockBalance.findMany({
    where: options.warehouseId
      ? { warehouseId: options.warehouseId }
      : undefined,
    include: { material: true, warehouse: true },
    orderBy: { material: { name: "asc" } },
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
