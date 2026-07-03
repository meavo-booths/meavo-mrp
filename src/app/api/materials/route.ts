import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import { db, schema } from "@/lib/db/client";
import { parseOptionalPrice } from "@/lib/import/schemas";
import { clearBomMissingMaterialCodes } from "@/lib/stock/bom-missing";
import { ensureStockReferenceData } from "@/lib/stock";

export const runtime = "nodejs";

const CreateSchema = z.object({
  code: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1).default("kg"),
  unitPriceEur: z.string().trim().optional().nullable(),
});

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  await ensureStockReferenceData();

  const rows = await db
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.isActive, true))
    .orderBy(asc(schema.materials.name));

  return NextResponse.json({ materials: rows });
}

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  const body = CreateSchema.parse(await request.json());
  const unitPriceEur =
    body.unitPriceEur && body.unitPriceEur.trim()
      ? parseOptionalPrice(body.unitPriceEur)
      : null;

  const [material] = await db
    .insert(schema.materials)
    .values({
      code: body.code ?? null,
      name: body.name,
      unit: body.unit,
      unitPriceEur,
    })
    .returning();

  if (body.code?.trim()) {
    await clearBomMissingMaterialCodes([body.code.trim()]);
  }

  return NextResponse.json({ material }, { status: 201 });
}
