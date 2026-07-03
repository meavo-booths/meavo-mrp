import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import {
  createRecipeException,
  listRecipeExceptions,
} from "@/lib/stock/recipe-exceptions";

export const runtime = "nodejs";

const BatchLinkSchema = z.object({
  batchLabel: z.string().trim().min(1),
  manufacturingBatchId: z.string().uuid().optional().nullable(),
  applyToWholeBatch: z.boolean(),
  boothIdTexts: z.array(z.string().trim()).optional(),
});

const PostSchema = z.object({
  name: z.string().trim().min(1),
  notes: z.string().trim().optional().nullable(),
  boothModelIds: z.array(z.string().uuid()).min(1),
  scopeColour: z.string().trim().optional().nullable(),
  scopeMarket: z.enum(["default", "US"]).optional().nullable(),
  sourceBomLineId: z.string().uuid(),
  replacementLines: z
    .array(
      z.object({
        materialId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        colour: z.string().trim().optional().nullable(),
        market: z.enum(["default", "US"]).optional().nullable(),
      }),
    )
    .min(1),
  batchLinks: z.array(BatchLinkSchema).min(1),
});

export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const statusParam = new URL(request.url).searchParams.get("status");
  const status =
    statusParam === "reverted" || statusParam === "all" ? statusParam : "active";

  const exceptions = await listRecipeExceptions(status);
  return NextResponse.json({ exceptions });
}

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const body = PostSchema.parse(await request.json());
    const id = await createRecipeException({
      ...body,
      createdBy: user.id,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
