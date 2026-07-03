import "server-only";

import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";

export async function listBalances(options: { warehouseId?: string } = {}) {
  const rows = await db
    .select({
      balanceId: schema.stockBalances.id,
      warehouseId: schema.stockBalances.warehouseId,
      warehouseCode: schema.warehouses.code,
      warehouseName: schema.warehouses.name,
      materialId: schema.materials.id,
      materialCode: schema.materials.code,
      materialName: schema.materials.name,
      unit: schema.materials.unit,
      quantity: schema.stockBalances.quantity,
    })
    .from(schema.stockBalances)
    .innerJoin(
      schema.materials,
      eq(schema.stockBalances.materialId, schema.materials.id),
    )
    .innerJoin(
      schema.warehouses,
      eq(schema.stockBalances.warehouseId, schema.warehouses.id),
    )
    .where(
      options.warehouseId
        ? eq(schema.stockBalances.warehouseId, options.warehouseId)
        : undefined,
    )
    .orderBy(asc(schema.materials.name));

  return rows;
}
