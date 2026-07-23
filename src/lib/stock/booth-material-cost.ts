import "server-only";

import type { BoothMarket } from "@/lib/import/schemas";
import {
  aggregateRecipeMaterials,
  formatRecipeQty,
} from "@/lib/stock/bom-recipe-filter";
import { getBoothModelRecipe } from "@/lib/stock/bom-recipe-view";
import { loadZeronUnitPricesByCodes } from "@/lib/zeron/delivery-prices";

export type BoothMaterialCostLine = {
  materialCode: string;
  materialName: string;
  totalQuantity: number;
  quantityLabel: string;
  panels: string[];
  averageUnitCost: number | null;
  latestUnitCost: number | null;
  averageLineCost: number | null;
  latestLineCost: number | null;
  deliveryCount: number;
};

export type BoothMaterialCostResult = {
  modelName: string;
  colour: string | null;
  market: BoothMarket;
  availableColours: string[];
  availableMarkets: Array<"default" | "US">;
  materials: BoothMaterialCostLine[];
  totals: {
    averageCost: number | null;
    latestCost: number | null;
    missingPriceCount: number;
  };
};

function sumCosts(values: Array<number | null>): number | null {
  let sum = 0;
  let any = false;
  for (const v of values) {
    if (v == null) continue;
    sum += v;
    any = true;
  }
  return any ? sum : null;
}

export async function computeBoothMaterialCost(input: {
  modelName: string;
  colour: string | null;
  market: BoothMarket;
}): Promise<BoothMaterialCostResult | null> {
  const recipe = await getBoothModelRecipe(input.modelName);
  if (!recipe) return null;

  const aggregated = aggregateRecipeMaterials(
    recipe.panels,
    input.colour,
    input.market,
  );

  const prices = await loadZeronUnitPricesByCodes(
    aggregated.map((m) => m.materialCode),
  );

  const materials: BoothMaterialCostLine[] = aggregated.map((item) => {
    const price = prices.get(item.materialCode);
    const averageUnitCost =
      price && price.averageUnitCost > 0 ? price.averageUnitCost : null;
    const latestUnitCost =
      price && price.latestUnitCost > 0 ? price.latestUnitCost : null;
    const averageLineCost =
      averageUnitCost != null ? item.totalQuantity * averageUnitCost : null;
    const latestLineCost =
      latestUnitCost != null ? item.totalQuantity * latestUnitCost : null;

    return {
      materialCode: item.materialCode,
      materialName: item.materialName,
      totalQuantity: item.totalQuantity,
      quantityLabel: formatRecipeQty(item.totalQuantity),
      panels: item.panels,
      averageUnitCost,
      latestUnitCost,
      averageLineCost,
      latestLineCost,
      deliveryCount: price?.deliveryCount ?? 0,
    };
  });

  materials.sort((a, b) => {
    const aCost = a.latestLineCost;
    const bCost = b.latestLineCost;
    if (aCost == null && bCost == null) {
      return a.materialCode.localeCompare(b.materialCode, "bg");
    }
    if (aCost == null) return 1;
    if (bCost == null) return -1;
    if (bCost !== aCost) return bCost - aCost;
    return a.materialCode.localeCompare(b.materialCode, "bg");
  });

  const missingPriceCount = materials.filter(
    (m) => m.averageUnitCost == null && m.latestUnitCost == null,
  ).length;

  return {
    modelName: recipe.modelName,
    colour: input.colour,
    market: input.market,
    availableColours: recipe.availableColours,
    availableMarkets: recipe.availableMarkets,
    materials,
    totals: {
      averageCost: sumCosts(materials.map((m) => m.averageLineCost)),
      latestCost: sumCosts(materials.map((m) => m.latestLineCost)),
      missingPriceCount,
    },
  };
}
