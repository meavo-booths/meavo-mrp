import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import { db, schema } from "@/lib/db/client";
import { getDefaultWarehouseId, recordInventoryCount } from "@/lib/stock";

export const runtime = "nodejs";

const PostSchema = z.object({
  materialId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  countDate: z.coerce.date(),
  countedQuantity: z.coerce.number().min(0),
  notes: z.string().trim().optional(),
  countedThroughBatchId: z.string().uuid().optional().nullable(),
  countedThroughBatchLabel: z.string().trim().optional().nullable(),
});

export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const materialId = new URL(request.url).searchParams.get("materialId");

  const base = db
    .select({
      id: schema.inventoryCounts.id,
      countDate: schema.inventoryCounts.countDate,
      systemQuantity: schema.inventoryCounts.systemQuantity,
      countedQuantity: schema.inventoryCounts.countedQuantity,
      variance: schema.inventoryCounts.variance,
      notes: schema.inventoryCounts.notes,
      countedThroughBatchLabel: schema.inventoryCounts.countedThroughBatchLabel,
      materialName: schema.materials.name,
      warehouseName: schema.warehouses.name,
    })
    .from(schema.inventoryCounts)
    .innerJoin(
      schema.materials,
      eq(schema.inventoryCounts.materialId, schema.materials.id),
    )
    .innerJoin(
      schema.warehouses,
      eq(schema.inventoryCounts.warehouseId, schema.warehouses.id),
    );

  const rows = await (materialId
    ? base.where(eq(schema.inventoryCounts.materialId, materialId))
    : base
  )
    .orderBy(desc(schema.inventoryCounts.countDate))
    .limit(50);

  return NextResponse.json({ counts: rows });
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
