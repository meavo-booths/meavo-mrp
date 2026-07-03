import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";

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
    const existing = await db.query.warehouses.findFirst({
      where: eq(schema.warehouses.code, wh.code),
    });
    if (!existing) {
      await db.insert(schema.warehouses).values({
        code: wh.code,
        name: wh.name,
      });
    } else if (existing.name !== wh.name) {
      await db
        .update(schema.warehouses)
        .set({ name: wh.name })
        .where(eq(schema.warehouses.id, existing.id));
    }
  }

  for (const name of BOOTH_MODEL_NAMES) {
    const existing = await db.query.boothModels.findFirst({
      where: eq(schema.boothModels.name, name),
    });
    if (!existing) {
      await db.insert(schema.boothModels).values({ name });
    }
  }
}

export async function getDefaultWarehouseId(): Promise<string> {
  await ensureStockReferenceData();
  const wh = await db.query.warehouses.findFirst({
    where: eq(schema.warehouses.code, DEFAULT_WAREHOUSE_CODE),
  });
  if (!wh) {
    throw new Error(`Default warehouse "${DEFAULT_WAREHOUSE_CODE}" not found`);
  }
  return wh.id;
}
