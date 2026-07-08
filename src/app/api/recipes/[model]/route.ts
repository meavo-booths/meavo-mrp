import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { requireApiUser } from "@/lib/api/guard";
import { getBoothModelRecipe } from "@/lib/stock/bom-recipe-view";

export const runtime = "nodejs";

const getCachedBoothModelRecipe = unstable_cache(
  async (modelName: string) => getBoothModelRecipe(modelName),
  ["booth-model-recipe"],
  { revalidate: 300 },
);

export async function GET(
  _request: Request,
  context: { params: Promise<{ model: string }> },
) {
  const { error } = await requireApiUser();
  if (error) return error;

  const { model } = await context.params;
  const modelName = decodeURIComponent(model).trim();
  if (!modelName) {
    return NextResponse.json({ error: "Model name required" }, { status: 400 });
  }

  const recipe = await getCachedBoothModelRecipe(modelName);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json(recipe, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
