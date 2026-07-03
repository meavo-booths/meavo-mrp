import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import type { BoothMarket } from "@/lib/import/schemas";

export type BoothModelSummary = {
  name: string;
  panelCount: number;
  bomLineCount: number;
};

export type RecipeVariantLine = {
  colour: string | null;
  market: string | null;
  totalQuantity: number;
  panels: string[];
};

export type VaryingMaterial = {
  materialCode: string;
  materialName: string;
  variants: RecipeVariantLine[];
};

export type PanelMaterialLine = {
  materialCode: string;
  materialName: string;
  quantity: string;
  colour: string | null;
  market: BoothMarket | null;
  unitPriceEur: string | null;
};

export type PanelRecipe = {
  simpleName: string;
  sortOrder: number;
  materials: PanelMaterialLine[];
};

export type BoothModelRecipe = {
  modelName: string;
  availableColours: string[];
  availableMarkets: Array<"default" | "US">;
  varyingMaterials: VaryingMaterial[];
  panels: PanelRecipe[];
};

type RawBomRow = {
  simpleName: string;
  sortOrder: number;
  colour: string | null;
  market: string | null;
  materialCode: string | null;
  materialName: string;
  quantity: string;
  unitPriceEur: string | null;
};

function asBoothMarket(value: string | null): BoothMarket | null {
  if (value === "default" || value === "US") return value;
  return null;
}

function variantKey(colour: string | null, market: string | null): string {
  return `${colour ?? ""}\0${market ?? ""}`;
}

function formatQty(n: number): string {
  return n.toFixed(4).replace(/\.?0+$/, "");
}

async function loadBomRowsForModel(modelName: string): Promise<RawBomRow[]> {
  return db
    .select({
      simpleName: schema.boothElements.simpleName,
      sortOrder: schema.boothElements.sortOrder,
      colour: schema.elementBomLines.colour,
      market: schema.elementBomLines.market,
      materialCode: schema.materials.code,
      materialName: schema.materials.name,
      quantity: schema.elementBomLines.quantity,
      unitPriceEur: schema.materials.unitPriceEur,
    })
    .from(schema.elementBomLines)
    .innerJoin(
      schema.boothElements,
      eq(schema.elementBomLines.boothElementId, schema.boothElements.id),
    )
    .innerJoin(
      schema.boothModels,
      eq(schema.boothElements.boothModelId, schema.boothModels.id),
    )
    .innerJoin(
      schema.materials,
      eq(schema.elementBomLines.materialId, schema.materials.id),
    )
    .where(eq(schema.boothModels.name, modelName))
    .orderBy(
      asc(schema.boothElements.sortOrder),
      asc(schema.materials.code),
      asc(schema.elementBomLines.colour),
      asc(schema.elementBomLines.market),
    );
}

export async function listBoothModelsWithRecipes(): Promise<BoothModelSummary[]> {
  const rows = await db
    .select({
      name: schema.boothModels.name,
      panelCount: sql<number>`count(distinct ${schema.boothElements.id})::int`,
      bomLineCount: sql<number>`count(${schema.elementBomLines.id})::int`,
    })
    .from(schema.boothModels)
    .leftJoin(
      schema.boothElements,
      eq(schema.boothElements.boothModelId, schema.boothModels.id),
    )
    .leftJoin(
      schema.elementBomLines,
      eq(schema.elementBomLines.boothElementId, schema.boothElements.id),
    )
    .where(eq(schema.boothModels.isActive, true))
    .groupBy(schema.boothModels.name)
    .orderBy(asc(schema.boothModels.name));

  return rows.filter((r) => r.bomLineCount > 0);
}

export async function getBoothModelRecipe(
  modelName: string,
): Promise<BoothModelRecipe | null> {
  const rows = await loadBomRowsForModel(modelName);
  if (rows.length === 0) return null;

  const panelsMap = new Map<string, PanelRecipe>();
  const materialVariants = new Map<
    string,
    {
      materialName: string;
      byVariant: Map<
        string,
        { colour: string | null; market: string | null; total: number; panels: Set<string> }
      >;
    }
  >();

  for (const row of rows) {
    const code = row.materialCode ?? row.materialName;
    if (!panelsMap.has(row.simpleName)) {
      panelsMap.set(row.simpleName, {
        simpleName: row.simpleName,
        sortOrder: row.sortOrder,
        materials: [],
      });
    }
    panelsMap.get(row.simpleName)!.materials.push({
      materialCode: code,
      materialName: row.materialName,
      quantity: row.quantity,
      colour: row.colour,
      market: asBoothMarket(row.market),
      unitPriceEur: row.unitPriceEur,
    });

    if (!materialVariants.has(code)) {
      materialVariants.set(code, {
        materialName: row.materialName,
        byVariant: new Map(),
      });
    }
    const mv = materialVariants.get(code)!;
    const vk = variantKey(row.colour, row.market);
    const bucket = mv.byVariant.get(vk) ?? {
      colour: row.colour,
      market: row.market,
      total: 0,
      panels: new Set<string>(),
    };
    bucket.total += Number(row.quantity);
    bucket.panels.add(row.simpleName);
    mv.byVariant.set(vk, bucket);
  }

  const varyingMaterials: VaryingMaterial[] = [];
  for (const [materialCode, data] of materialVariants) {
    const variants = [...data.byVariant.values()].map((v) => ({
      colour: v.colour,
      market: v.market,
      totalQuantity: v.total,
      panels: [...v.panels].sort((a, b) => a.localeCompare(b, "bg")),
    }));

    const hasMultipleVariants = variants.length > 1;
    const hasSpecificVariant = variants.some(
      (v) => v.colour !== null || v.market !== null,
    );

    if (hasMultipleVariants || hasSpecificVariant) {
      varyingMaterials.push({
        materialCode,
        materialName: data.materialName,
        variants: variants.sort((a, b) =>
          variantKey(a.colour, a.market).localeCompare(
            variantKey(b.colour, b.market),
          ),
        ),
      });
    }
  }

  varyingMaterials.sort((a, b) =>
    a.materialCode.localeCompare(b.materialCode, "bg"),
  );

  const panels = [...panelsMap.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.simpleName.localeCompare(b.simpleName, "bg"),
  );

  const colourSet = new Set<string>();
  const marketSet = new Set<"default" | "US">();
  for (const row of rows) {
    if (row.colour) colourSet.add(row.colour);
    if (row.market === "default" || row.market === "US") {
      marketSet.add(row.market);
    }
  }

  const availableColours = [...colourSet].sort((a, b) => a.localeCompare(b, "bg"));
  const availableMarkets = [...marketSet].sort();
  if (availableMarkets.length === 0) {
    availableMarkets.push("default");
  }

  return {
    modelName,
    availableColours,
    availableMarkets,
    varyingMaterials,
    panels,
  };
}
