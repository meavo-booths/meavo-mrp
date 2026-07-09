import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import { applyMovement, getDefaultWarehouseId } from "@/lib/stock";

export const runtime = "nodejs";

const BodySchema = z.object({
  materialId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive(),
  effectiveAt: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  invoiceNumber: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  const body = BodySchema.parse(await request.json());
  const warehouseId = body.warehouseId ?? (await getDefaultWarehouseId());

  const movement = await applyMovement({
    warehouseId,
    materialId: body.materialId,
    movementType: "manual_receipt",
    quantityDelta: body.quantity,
    effectiveAt: body.effectiveAt ?? new Date(),
    notes: body.notes ?? null,
    metadata: body.invoiceNumber
      ? { invoiceNumber: body.invoiceNumber }
      : undefined,
    createdBy: user.id,
  });

  return NextResponse.json({ movement }, { status: 201 });
}
