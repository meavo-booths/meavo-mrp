import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/guard";
import { revertRecipeException } from "@/lib/stock/recipe-exceptions";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireApiUser();
  if (error) return error;

  const { id } = await params;
  await revertRecipeException(id);
  return NextResponse.json({ ok: true });
}
