import "server-only";

import {
  isCanonicalMaterialUnit,
  normalizeMaterialUnit,
} from "@/lib/stock/material-units";
import { prisma } from "@/lib/prisma";

export type MaterialInvalidUnit = {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  suggestedUnit: string | null;
};

export async function listMaterialsWithInvalidUnits(): Promise<
  MaterialInvalidUnit[]
> {
  const rows = await prisma.mrpMaterial.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, unit: true },
    orderBy: { code: "asc" },
  });

  return rows
    .filter((row) => !isCanonicalMaterialUnit(row.unit.trim()))
    .map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      unit: row.unit,
      suggestedUnit: normalizeMaterialUnit(row.unit),
    }));
}
