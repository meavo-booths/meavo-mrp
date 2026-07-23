import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/guard";
import type { BoothMarket } from "@/lib/import/schemas";
import { computeBoothMaterialCost } from "@/lib/stock/booth-material-cost";

export const runtime = "nodejs";

function parseMarket(value: string | null): BoothMarket {
  return value === "US" ? "US" : "default";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ model: string }> },
) {
  const { error } = await requireApiUser();
  if (error) return error;

  const { model } = await context.params;
  const modelName = decodeURIComponent(model).trim();
  if (!modelName) {
    return NextResponse.json({ error: "Model name required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const colourParam = url.searchParams.get("colour");
  const colour =
    colourParam == null || colourParam === "" || colourParam === "__none__"
      ? null
      : colourParam;
  const market = parseMarket(url.searchParams.get("market"));

  const result = await computeBoothMaterialCost({
    modelName,
    colour,
    market,
  });

  if (!result) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
