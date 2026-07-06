import "server-only";

import { prisma } from "@/lib/prisma";

/** Canonical warehouses — CSV codes AKS / KAZ / VAR / TOP map via import aliases. */
const DEFAULT_WAREHOUSES = [
  { code: "aksakovo", name: "Аксаково" },
  { code: "kazanlak", name: "Казанлък" },
  { code: "varna", name: "Варна" },
  { code: "top", name: "Тополи" },
] as const;

const BOOTH_MODEL_NAMES = [
  "Soho",
  "Workstation",
  "Camden 2",
  "Camden 4",
  "Haven One",
  "Haven Focus",
  "Haven Two",
  "Haven Four",
] as const;

export const DEFAULT_WAREHOUSE_CODE = "aksakovo";

/** Idempotent seed for warehouses and booth model names from the manufacturing plan. */
export async function ensureStockReferenceData() {
  for (const wh of DEFAULT_WAREHOUSES) {
    const existing = await prisma.mrpWarehouse.findUnique({
      where: { code: wh.code },
    });
    if (!existing) {
      await prisma.mrpWarehouse.create({
        data: {
          code: wh.code,
          name: wh.name,
        },
      });
    } else if (existing.name !== wh.name) {
      await prisma.mrpWarehouse.update({
        where: { id: existing.id },
        data: { name: wh.name },
      });
    }
  }

  for (const name of BOOTH_MODEL_NAMES) {
    const existing = await prisma.mrpBoothModel.findUnique({
      where: { name },
    });
    if (!existing) {
      await prisma.mrpBoothModel.create({ data: { name } });
    }
  }
}

export async function getDefaultWarehouseId(): Promise<string> {
  await ensureStockReferenceData();
  const wh = await prisma.mrpWarehouse.findUnique({
    where: { code: DEFAULT_WAREHOUSE_CODE },
  });
  if (!wh) {
    throw new Error(`Default warehouse "${DEFAULT_WAREHOUSE_CODE}" not found`);
  }
  return wh.id;
}
