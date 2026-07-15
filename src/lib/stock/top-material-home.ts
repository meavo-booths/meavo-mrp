import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getTopMaterialCodes,
  getTopMaterialsDetail,
} from "@/lib/settings/top-materials";
import {
  getBaselinedPairKeys,
  pairHasBaseline,
} from "@/lib/stock/stock-baseline";
import { sumTopMaterialQuantities } from "@/lib/stock/top-material-display";
import type {
  TopMaterialHomeRow,
  TopMaterialWarehouseOption,
  TopMaterialWarehouseQuantity,
} from "@/lib/stock/top-material-types";

export type {
  TopMaterialHomeRow,
  TopMaterialWarehouseOption,
} from "@/lib/stock/top-material-types";

export async function listActiveWarehouses(): Promise<
  TopMaterialWarehouseOption[]
> {
  return prisma.mrpWarehouse.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function listTopMaterialHomeRows(): Promise<TopMaterialHomeRow[]> {
  const codes = await getTopMaterialCodes();
  if (codes.length === 0) return [];

  const [detail, baselinedKeys, warehouses, materials] = await Promise.all([
    getTopMaterialsDetail(),
    getBaselinedPairKeys(),
    listActiveWarehouses(),
    prisma.mrpMaterial.findMany({
      where: { isActive: true, code: { not: null } },
      select: { id: true, code: true, name: true, unit: true },
    }),
  ]);

  const entryByCode = new Map(
    detail.entries.map((entry) => [entry.code.toLowerCase(), entry]),
  );

  const materialIds = detail.entries
    .map((entry) => entry.materialId)
    .filter((id): id is string => Boolean(id));

  const unitByMaterialId = new Map(
    materials.map((material) => [material.id, material.unit]),
  );

  const balances =
    materialIds.length === 0 ?
      []
    : await prisma.mrpStockBalance.findMany({
        where: { materialId: { in: materialIds } },
        select: { warehouseId: true, materialId: true, quantity: true },
      });

  const balanceByPair = new Map(
    balances.map((row) => [
      `${row.materialId}\u0000${row.warehouseId}`,
      row.quantity.toString(),
    ]),
  );

  function buildWarehouseQuantities(
    materialId: string,
  ): TopMaterialWarehouseQuantity[] {
    return warehouses.map((warehouse) => {
      const quantity =
        balanceByPair.get(`${materialId}\u0000${warehouse.id}`) ?? null;
      return {
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        quantity,
        hasBaseline: pairHasBaseline(
          baselinedKeys,
          warehouse.id,
          materialId,
        ),
      };
    });
  }

  return codes.map((code) => {
    const entry = entryByCode.get(code.toLowerCase());
    if (!entry?.found || !entry.materialId) {
      return {
        code,
        materialId: entry?.materialId ?? null,
        materialName: entry?.name ?? null,
        unit: null,
        found: false,
        warehouses: [],
      };
    }

    return {
      code,
      materialId: entry.materialId,
      materialName: entry.name,
      unit: unitByMaterialId.get(entry.materialId) ?? null,
      found: true,
      warehouses: buildWarehouseQuantities(entry.materialId),
    };
  });
}

export async function getTopMaterialHomeStats(): Promise<{
  total: number;
  tracked: number;
  shortages: number;
}> {
  const rows = await listTopMaterialHomeRows();
  const foundRows = rows.filter((row) => row.found);
  const baselined = foundRows.filter((row) =>
    row.warehouses.some((warehouse) => warehouse.hasBaseline),
  );
  const tracked = baselined.filter(
    (row) => sumTopMaterialQuantities(row.warehouses) > 0,
  ).length;

  return {
    total: foundRows.length,
    tracked,
    shortages: baselined.length - tracked,
  };
}
