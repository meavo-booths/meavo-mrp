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

// Reference data is fixed; seed at most once per process instead of on every request.
let seeded = false;

/** Idempotent seed for warehouses and booth model names from the manufacturing plan. */
export async function ensureStockReferenceData() {
  if (seeded) return;

  const [warehouses, boothModels] = await Promise.all([
    prisma.mrpWarehouse.findMany({
      where: { code: { in: DEFAULT_WAREHOUSES.map((w) => w.code) } },
      select: { id: true, code: true, name: true },
    }),
    prisma.mrpBoothModel.findMany({
      where: { name: { in: [...BOOTH_MODEL_NAMES] } },
      select: { name: true },
    }),
  ]);

  const warehouseByCode = new Map(warehouses.map((w) => [w.code, w]));
  for (const wh of DEFAULT_WAREHOUSES) {
    const existing = warehouseByCode.get(wh.code);
    if (!existing) {
      await prisma.mrpWarehouse.create({
        data: { code: wh.code, name: wh.name },
      });
    } else if (existing.name !== wh.name) {
      await prisma.mrpWarehouse.update({
        where: { id: existing.id },
        data: { name: wh.name },
      });
    }
  }

  const knownModelNames = new Set(boothModels.map((m) => m.name));
  const missingModels = BOOTH_MODEL_NAMES.filter(
    (name) => !knownModelNames.has(name),
  );
  if (missingModels.length > 0) {
    await prisma.mrpBoothModel.createMany({
      data: missingModels.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }

  seeded = true;
}

let defaultWarehouseId: string | null = null;

export async function getDefaultWarehouseId(): Promise<string> {
  if (defaultWarehouseId) return defaultWarehouseId;
  await ensureStockReferenceData();
  const wh = await prisma.mrpWarehouse.findUnique({
    where: { code: DEFAULT_WAREHOUSE_CODE },
    select: { id: true },
  });
  if (!wh) {
    throw new Error(`Default warehouse "${DEFAULT_WAREHOUSE_CODE}" not found`);
  }
  defaultWarehouseId = wh.id;
  return wh.id;
}
