import type { BoothMarket } from "@/lib/import/schemas";
import { lineMatchesColour, lineMatchesMarket } from "@/lib/stock/bom-match";
import type {
  PanelMaterialLine,
  PanelRecipe,
  VaryingMaterial,
} from "@/lib/stock/bom-recipe-view";

export type AggregatedMaterial = {
  materialCode: string;
  materialName: string;
  totalQuantity: number;
  panels: string[];
};

export function filterMaterialLine(
  line: PanelMaterialLine,
  boothColour: string | null,
  boothMarket: BoothMarket,
): boolean {
  return (
    lineMatchesColour(line.colour, boothColour) &&
    lineMatchesMarket(line.market, boothMarket)
  );
}

export function aggregateRecipeMaterials(
  panels: PanelRecipe[],
  boothColour: string | null,
  boothMarket: BoothMarket,
): AggregatedMaterial[] {
  const map = new Map<
    string,
    { materialName: string; total: number; panels: Set<string> }
  >();

  for (const panel of panels) {
    for (const line of panel.materials) {
      if (!filterMaterialLine(line, boothColour, boothMarket)) continue;

      const bucket = map.get(line.materialCode) ?? {
        materialName: line.materialName,
        total: 0,
        panels: new Set<string>(),
      };
      bucket.total += Number(line.quantity);
      bucket.panels.add(panel.simpleName);
      map.set(line.materialCode, bucket);
    }
  }

  return [...map.entries()]
    .map(([materialCode, data]) => ({
      materialCode,
      materialName: data.materialName,
      totalQuantity: data.total,
      panels: [...data.panels].sort((a, b) => a.localeCompare(b, "bg")),
    }))
    .sort((a, b) => a.materialCode.localeCompare(b.materialCode, "bg"));
}

export function topMaterialsByQuantity(
  materials: AggregatedMaterial[],
  limit = 20,
): AggregatedMaterial[] {
  return [...materials]
    .sort((a, b) => b.totalQuantity - a.totalQuantity || a.materialCode.localeCompare(b.materialCode, "bg"))
    .slice(0, limit);
}

export function filterVaryingMaterials(
  materials: VaryingMaterial[],
  boothColour: string | null,
  boothMarket: BoothMarket,
): VaryingMaterial[] {
  return materials
    .map((item) => ({
      ...item,
      variants: item.variants.filter(
        (v) =>
          lineMatchesColour(v.colour, boothColour) &&
          lineMatchesMarket(
            v.market === "default" || v.market === "US" ? v.market : null,
            boothMarket,
          ),
      ),
    }))
    .filter((item) => item.variants.length > 0);
}

export function formatRecipeQty(n: number): string {
  return n.toFixed(4).replace(/\.?0+$/, "");
}
