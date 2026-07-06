import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
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

  const rows = await prisma.mrpMaterial.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ materials: rows });
}

export async function POST(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const body = CreateSchema.parse(await request.json());
  const unitPriceEur =
    body.unitPriceEur && body.unitPriceEur.trim()
      ? parseOptionalPrice(body.unitPriceEur)
      : null;

  const material = await prisma.mrpMaterial.create({
    data: {
      code: body.code ?? null,
      name: body.name,
      unit: body.unit,
      unitPriceEur,
    },
  });

  if (body.code?.trim()) {
    await clearBomMissingMaterialCodes([body.code.trim()]);
  }

  return NextResponse.json({ material }, { status: 201 });
}
