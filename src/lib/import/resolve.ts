import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";

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

  const wh = await db.query.warehouses.findFirst({
    where: eq(schema.warehouses.code, code),
  });
  return wh?.id ?? null;
}

export function warehouseCodeFromAlias(raw: string): string | null {
  return WAREHOUSE_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export async function ensureBoothModelId(name: string): Promise<string> {
  const existing = await db.query.boothModels.findFirst({
    where: eq(schema.boothModels.name, name),
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(schema.boothModels)
    .values({ name })
    .returning({ id: schema.boothModels.id });
  return created!.id;
}
