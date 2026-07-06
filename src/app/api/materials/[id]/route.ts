import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import { parseOptionalPrice } from "@/lib/import/schemas";
import { clearBomMissingMaterialCodes } from "@/lib/stock/bom-missing";

export const runtime = "nodejs";

const PatchSchema = z.object({
  code: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  unitPriceEur: z.string().trim().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireApiUser();
  if (error) return error;

  const { id } = await params;
  const body = PatchSchema.parse(await request.json());

  const existing = await prisma.mrpMaterial.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let unitPriceEur: Prisma.Decimal | string | null = existing.unitPriceEur;
  if (body.unitPriceEur !== undefined) {
    unitPriceEur =
      body.unitPriceEur === null || body.unitPriceEur === ""
        ? null
        : parseOptionalPrice(body.unitPriceEur);
  }

  const material = await prisma.mrpMaterial.update({
    where: { id },
    data: {
      code: body.code !== undefined ? body.code : existing.code,
      name: body.name ?? existing.name,
      unit: body.unit ?? existing.unit,
      unitPriceEur,
      updatedAt: new Date(),
    },
  });

  if (material.code?.trim()) {
    await clearBomMissingMaterialCodes([material.code.trim()]);
  }

  return NextResponse.json({ material });
}
