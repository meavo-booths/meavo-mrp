import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import { getDefaultWarehouseId, recordInventoryCount } from "@/lib/stock";

export const runtime = "nodejs";

const PostSchema = z.object({
  materialId: z.string().min(1),
  warehouseId: z.string().min(1).optional(),
  countDate: z.coerce.date(),
  countedQuantity: z.coerce.number().min(0),
  notes: z.string().trim().optional(),
  countedThroughBatchId: z.string().min(1).optional().nullable(),
  countedThroughBatchLabel: z.string().trim().optional().nullable(),
});

export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const materialId = new URL(request.url).searchParams.get("materialId");

  const rows = await prisma.mrpInventoryCount.findMany({
    where: materialId ? { materialId } : undefined,
    select: {
      id: true,
      countDate: true,
      systemQuantity: true,
      countedQuantity: true,
      variance: true,
      notes: true,
      countedThroughBatchLabel: true,
      material: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { countDate: "desc" },
    take: 50,
  });

  const counts = rows.map(({ material, warehouse, ...rest }) => ({
    ...rest,
    materialName: material.name,
    warehouseName: warehouse.name,
  }));

  return NextResponse.json({ counts });
}

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  const body = PostSchema.parse(await request.json());
  const warehouseId = body.warehouseId ?? (await getDefaultWarehouseId());

  const count = await recordInventoryCount({
    warehouseId,
    materialId: body.materialId,
    countDate: body.countDate,
    countedQuantity: body.countedQuantity,
    notes: body.notes ?? null,
    countedThroughBatchId: body.countedThroughBatchId ?? null,
    countedThroughBatchLabel: body.countedThroughBatchLabel ?? null,
    createdBy: user.id,
  });

  return NextResponse.json({ count }, { status: 201 });
}
