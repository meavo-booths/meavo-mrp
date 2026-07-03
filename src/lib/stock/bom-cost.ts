import "server-only";

import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import {
  deriveBoothMarket,
  resolveBomLines,
  sumBomCostEur,
  type ResolvedBomLine,
} from "@/lib/stock/bom-match";

export type BomLineWithCost = ResolvedBomLine & {
  materialId: string;
  materialName: string;
  unitPriceEur: string | null;
  lineCostEur: number | null;
};

/** Load all BOM lines for a booth element and compute EUR cost for a unit context. */
export async function computeElementBomCost(input: {
  boothElementId: string;
  boothColour: string | null;
  workshopNote?: string | null;
}): Promise<{ lines: BomLineWithCost[]; totalCostEur: number | null }> {
  const boothMarket = deriveBoothMarket(input.workshopNote);
  return computeElementBomCostForMarket({
    boothElementId: input.boothElementId,
    boothColour: input.boothColour,
    boothMarket,
  });
}

export async function computeElementBomCostForMarket(input: {
  boothElementId: string;
  boothColour: string | null;
  boothMarket: "default" | "US";
}): Promise<{ lines: BomLineWithCost[]; totalCostEur: number | null }> {
  const rows = await db
    .select({
      colour: schema.elementBomLines.colour,
      market: schema.elementBomLines.market,
      quantity: schema.elementBomLines.quantity,
      materialId: schema.materials.id,
      materialCode: schema.materials.code,
      materialName: schema.materials.name,
      unitPriceEur: schema.materials.unitPriceEur,
    })
    .from(schema.elementBomLines)
    .innerJoin(
      schema.materials,
      eq(schema.elementBomLines.materialId, schema.materials.id),
    )
    .where(eq(schema.elementBomLines.boothElementId, input.boothElementId))
    .orderBy(asc(schema.materials.code));

  const resolvedInput: ResolvedBomLine[] = rows.map((r) => ({
    materialCode: r.materialCode ?? r.materialId,
    colour: r.colour,
    market: r.market as "default" | "US" | null,
    quantity: r.quantity,
  }));

  const resolved = resolveBomLines(
    resolvedInput,
    input.boothColour,
    input.boothMarket,
  );

  const priceMap = new Map<string, string | null>();
  for (const r of rows) {
    if (r.materialCode) {
      priceMap.set(r.materialCode, r.unitPriceEur);
    }
  }

  const lines: BomLineWithCost[] = resolved.map((line) => {
    const row = rows.find(
      (r) => (r.materialCode ?? r.materialId) === line.materialCode,
    )!;
    const unitPrice = row.unitPriceEur;
    const lineCostEur =
      unitPrice != null
        ? Number(line.quantity) * Number(unitPrice)
        : null;
    return {
      ...line,
      materialId: row.materialId,
      materialName: row.materialName,
      unitPriceEur: unitPrice,
      lineCostEur,
    };
  });

  const totalCostEur = sumBomCostEur(
    resolved,
    priceMap,
  );

  return { lines, totalCostEur };
}

export async function listAllBomLinesForExport() {
  return db
    .select({
      boothModel: schema.boothModels.name,
      simpleName: schema.boothElements.simpleName,
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
    .orderBy(
      asc(schema.boothModels.name),
      asc(schema.boothElements.sortOrder),
      asc(schema.elementBomLines.colour),
      asc(schema.elementBomLines.market),
      asc(schema.materials.code),
    );
}
