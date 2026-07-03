import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import {
  listBomLinesForPicker,
  listPanelsForModels,
} from "@/lib/stock/recipe-exceptions";

export const runtime = "nodejs";

const QuerySchema = z.object({
  boothModelIds: z.string().min(1),
  simpleName: z.string().optional(),
  scopeColour: z.string().optional(),
  scopeMarket: z.enum(["default", "US"]).optional(),
});

export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const url = new URL(request.url);
  const parsed = QuerySchema.parse({
    boothModelIds: url.searchParams.get("boothModelIds") ?? "",
    simpleName: url.searchParams.get("simpleName") ?? undefined,
    scopeColour: url.searchParams.get("scopeColour") || undefined,
    scopeMarket: url.searchParams.get("scopeMarket") || undefined,
  });

  const boothModelIds = parsed.boothModelIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!parsed.simpleName) {
    const panels = await listPanelsForModels(boothModelIds);
    return NextResponse.json({ panels });
  }

  const lines = await listBomLinesForPicker({
    boothModelIds,
    simpleName: parsed.simpleName,
    scopeColour: parsed.scopeColour ?? null,
    scopeMarket: parsed.scopeMarket ?? null,
  });

  return NextResponse.json({ lines });
}
