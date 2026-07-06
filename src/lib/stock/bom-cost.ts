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
  const bomLines = await prisma.mrpElementBomLine.findMany({
    where: { boothElementId: input.boothElementId },
    include: { material: true },
    orderBy: { material: { code: "asc" } },
  });

  const rows = bomLines.map((l) => ({
    colour: l.colour,
    market: l.market,
    quantity: l.quantity.toString(),
    materialId: l.material.id,
    materialCode: l.material.code,
    materialName: l.material.name,
    unitPriceEur: l.material.unitPriceEur?.toString() ?? null,
  }));

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
