import "server-only";

import { prisma } from "@/lib/prisma";

/** Map sheet abbreviations and names to warehouse codes in DB. */
const WAREHOUSE_ALIASES: Record<string, string> = {
  aks: "aksakovo",
  aksakovo: "aksakovo",
  аксаково: "aksakovo",
  var: "varna",
  varna: "varna",
  варна: "varna",
  kaz: "kazanlak",
  kazanlak: "kazanlak",
  казанлък: "kazanlak",
  top: "top",
  тополи: "top",
};

export async function resolveWarehouseId(raw: string): Promise<string | null> {
  const key = raw.trim().toLowerCase();
  const code = WAREHOUSE_ALIASES[key];
  if (!code) return null;

  const wh = await prisma.mrpWarehouse.findUnique({
    where: { code },
  });
  return wh?.id ?? null;
}

export function warehouseCodeFromAlias(raw: string): string | null {
  return WAREHOUSE_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export async function ensureBoothModelId(name: string): Promise<string> {
  const existing = await prisma.mrpBoothModel.findUnique({
    where: { name },
  });
  if (existing) return existing.id;

  const created = await prisma.mrpBoothModel.create({
    data: { name },
  });
  return created.id;
}
