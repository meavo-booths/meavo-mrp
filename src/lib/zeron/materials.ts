import "server-only";

import { parseOptionalPrice } from "@/lib/import/schemas";
import { prisma } from "@/lib/prisma";
import { clearBomMissingMaterialCodes } from "@/lib/stock/bom-missing";
import { resolveMaterialUnit } from "@/lib/stock/material-units";

export type UpsertMaterialFromZeronInput = {
  code: string;
  name?: string | null;
  unit?: string | null;
  unitPriceEur?: string | null;
};

export type UpsertMaterialFromZeronResult = {
  id: string;
  created: boolean;
  flaggedUnit: boolean;
};

/** Create or update a material from a Zeron push — unknown units are kept and flagged. */
export async function upsertMaterialFromZeron(
  input: UpsertMaterialFromZeronInput,
): Promise<UpsertMaterialFromZeronResult> {
  const code = input.code.trim();
  if (!code) {
    throw new Error("Material code is required");
  }

  const resolved = resolveMaterialUnit(input.unit ?? "", "zeron");
  if (!resolved) {
    throw new Error("Material unit is required");
  }

  const unitPriceEur =
    input.unitPriceEur?.trim() ?
      parseOptionalPrice(input.unitPriceEur)
    : null;

  const existing = await prisma.mrpMaterial.findFirst({
    where: { code },
    select: { id: true, name: true, unitPriceEur: true },
  });

  if (existing) {
    const material = await prisma.mrpMaterial.update({
      where: { id: existing.id },
      data: {
        name: input.name?.trim() || existing.name,
        unit: resolved.unit,
        unitPriceEur: unitPriceEur ?? existing.unitPriceEur,
        updatedAt: new Date(),
      },
    });
    await clearBomMissingMaterialCodes([code]);
    return {
      id: material.id,
      created: false,
      flaggedUnit: resolved.flagged,
    };
  }

  const material = await prisma.mrpMaterial.create({
    data: {
      code,
      name: input.name?.trim() || code,
      unit: resolved.unit,
      unitPriceEur,
    },
  });
  await clearBomMissingMaterialCodes([code]);
  return {
    id: material.id,
    created: true,
    flaggedUnit: resolved.flagged,
  };
}
