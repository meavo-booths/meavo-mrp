import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { requireApiUser } from "@/lib/api/guard";
import { db, schema } from "@/lib/db/client";
import { ensureStockReferenceData } from "@/lib/stock";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  await ensureStockReferenceData();

  const rows = await db
    .select()
    .from(schema.warehouses)
    .where(eq(schema.warehouses.isActive, true))
    .orderBy(asc(schema.warehouses.name));

  return NextResponse.json({ warehouses: rows });
}
