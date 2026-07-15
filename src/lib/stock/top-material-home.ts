import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getTopMaterialCodes,
  getTopMaterialsDetail,
} from "@/lib/settings/top-materials";
import { getDefaultWarehouseId } from "@/lib/stock/seed";
import {
  getBaselinedPairKeys,
  pairHasBaseline,
} from "@/lib/stock/stock-baseline";

export type TopMaterialHomeRow = {
  code: string;
  materialId: string | null;
  materialName: string | null;
  unit: string | null;
  warehouseName: string;
  quantity: string | null;
  hasBaseline: boolean;
  isShortage: boolean;
  found: boolean;
};

export async function listTopMaterialHomeRows(): Promise<TopMaterialHomeRow[]> {
  const codes = await getTopMaterialCodes();
  if (codes.length === 0) return [];

  const defaultWarehouseId = await getDefaultWarehouseId();

  const [detail, baselinedKeys, defaultWarehouse, materials] =
    await Promise.all([
      getTopMaterialsDetail(),
      getBaselinedPairKeys(),
      prisma.mrpWarehouse.findUnique({
        where: { id: defaultWarehouseId },
        select: { name: true },
      }),
      prisma.mrpMaterial.findMany({
        where: { isActive: true, code: { not: null } },
        select: { id: true, code: true, name: true, unit: true },
      }),
    ]);

  const warehouseName = defaultWarehouse?.name ?? "—";
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
        where: {
          warehouseId: defaultWarehouseId,
          materialId: { in: materialIds },
        },
        select: { materialId: true, quantity: true },
      });

  const balanceByMaterialId = new Map(
    balances.map((row) => [row.materialId, row.quantity.toString()]),
  );

  return codes.map((code) => {
    const entry = entryByCode.get(code.toLowerCase());
    if (!entry?.found || !entry.materialId) {
      return {
        code,
        materialId: entry?.materialId ?? null,
        materialName: entry?.name ?? null,
        unit: null,
        warehouseName,
        quantity: null,
        hasBaseline: false,
        isShortage: false,
        found: false,
      };
    }

    const hasBaseline = pairHasBaseline(
      baselinedKeys,
      defaultWarehouseId,
      entry.materialId,
    );
    const quantity = balanceByMaterialId.get(entry.materialId) ?? null;
    const isShortage =
      hasBaseline && quantity != null && Number(quantity) <= 0;

    return {
      code,
      materialId: entry.materialId,
      materialName: entry.name,
      unit: unitByMaterialId.get(entry.materialId) ?? null,
      warehouseName,
      quantity,
      hasBaseline,
      isShortage,
      found: true,
    };
  });
}

export async function getTopMaterialHomeStats(): Promise<{
  total: number;
  tracked: number;
  shortages: number;
}> {
  const rows = await listTopMaterialHomeRows();
  const baselined = rows.filter((row) => row.found && row.hasBaseline);
  const tracked = baselined.filter(
    (row) => row.quantity != null && Number(row.quantity) > 0,
  ).length;

  return {
    total: rows.filter((row) => row.found).length,
    tracked,
    shortages: baselined.length - tracked,
  };
}
