import "server-only";

import { prisma } from "@/lib/prisma";
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

export type ElementBomRow = {
  colour: string | null;
  market: string | null;
  quantity: string;
  materialId: string;
  materialCode: string | null;
  materialName: string;
  unitPriceEur: string | null;
};

/** Preload BOM rows for many booth elements in one query (keyed by element id). */
export async function loadBomRowsForElements(
  boothElementIds: string[],
): Promise<Map<string, ElementBomRow[]>> {
  const result = new Map<string, ElementBomRow[]>();
  if (boothElementIds.length === 0) return result;

  const bomLines = await prisma.mrpElementBomLine.findMany({
    where: { boothElementId: { in: [...new Set(boothElementIds)] } },
    select: {
      boothElementId: true,
      colour: true,
      market: true,
      quantity: true,
      material: {
        select: { id: true, code: true, name: true, unitPriceEur: true },
      },
    },
    orderBy: { material: { code: "asc" } },
  });

  for (const l of bomLines) {
    let rows = result.get(l.boothElementId);
    if (!rows) {
      rows = [];
      result.set(l.boothElementId, rows);
    }
    rows.push({
      colour: l.colour,
      market: l.market,
      quantity: l.quantity.toString(),
      materialId: l.material.id,
      materialCode: l.material.code,
      materialName: l.material.name,
      unitPriceEur: l.material.unitPriceEur?.toString() ?? null,
    });
  }

  return result;
}

/** Pure cost computation from preloaded BOM rows (no queries). */
export function computeBomCostFromRows(
  rows: ElementBomRow[],
  boothColour: string | null,
  boothMarket: "default" | "US",
): { lines: BomLineWithCost[]; totalCostEur: number | null } {
  const resolvedInput: ResolvedBomLine[] = rows.map((r) => ({
    materialCode: r.materialCode ?? r.materialId,
    colour: r.colour,
    market: r.market as "default" | "US" | null,
    quantity: r.quantity,
  }));

  const resolved = resolveBomLines(resolvedInput, boothColour, boothMarket);

  const rowByCode = new Map<string, ElementBomRow>();
  const priceMap = new Map<string, string | null>();
  for (const r of rows) {
    rowByCode.set(r.materialCode ?? r.materialId, r);
    if (r.materialCode) {
      priceMap.set(r.materialCode, r.unitPriceEur);
    }
  }

  const lines: BomLineWithCost[] = resolved.map((line) => {
    const row = rowByCode.get(line.materialCode)!;
    const unitPrice = row.unitPriceEur;
    const lineCostEur =
      unitPrice != null ? Number(line.quantity) * Number(unitPrice) : null;
    return {
      ...line,
      materialId: row.materialId,
      materialName: row.materialName,
      unitPriceEur: unitPrice,
      lineCostEur,
    };
  });

  const totalCostEur = sumBomCostEur(resolved, priceMap);

  return { lines, totalCostEur };
}

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
  const rowsByElement = await loadBomRowsForElements([input.boothElementId]);
  const rows = rowsByElement.get(input.boothElementId) ?? [];
  return computeBomCostFromRows(rows, input.boothColour, input.boothMarket);
}

export async function listAllBomLinesForExport() {
  const rows = await prisma.mrpElementBomLine.findMany({
    include: {
      material: true,
      boothElement: { include: { boothModel: true } },
    },
    orderBy: [
      { boothElement: { boothModel: { name: "asc" } } },
      { boothElement: { sortOrder: "asc" } },
      { colour: "asc" },
      { market: "asc" },
      { material: { code: "asc" } },
    ],
  });

  return rows.map((r) => ({
    boothModel: r.boothElement.boothModel.name,
    simpleName: r.boothElement.simpleName,
    colour: r.colour,
    market: r.market,
    materialCode: r.material.code,
    materialName: r.material.name,
    quantity: r.quantity.toString(),
    unitPriceEur: r.material.unitPriceEur?.toString() ?? null,
  }));
}
