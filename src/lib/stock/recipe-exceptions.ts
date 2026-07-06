import "server-only";

import type { BoothMarket } from "@/lib/import/schemas";
import { prisma } from "@/lib/prisma";
import { lineMatchesColour, lineMatchesMarket } from "@/lib/stock/bom-match";

export type RecipeExceptionSummary = {
  id: string;
  name: string;
  notes: string | null;
  status: "active" | "reverted";
  createdAt: Date;
  revertedAt: Date | null;
  modelNames: string[];
  batchLabels: string[];
  changeSummary: string;
};

export type BomLinePickerRow = {
  id: string;
  boothModelId: string;
  boothModelName: string;
  boothElementId: string;
  simpleName: string;
  materialId: string;
  materialCode: string | null;
  materialName: string;
  quantity: string;
  colour: string | null;
  market: BoothMarket | null;
};

export type CreateRecipeExceptionInput = {
  name: string;
  notes?: string | null;
  boothModelIds: string[];
  scopeColour?: string | null;
  scopeMarket?: BoothMarket | null;
  sourceBomLineId: string;
  replacementLines: Array<{
    materialId: string;
    quantity: string | number;
    colour?: string | null;
    market?: BoothMarket | null;
  }>;
  batchLinks: Array<{
    batchLabel: string;
    manufacturingBatchId?: string | null;
    applyToWholeBatch: boolean;
    boothIdTexts?: string[];
  }>;
  createdBy?: string | null;
};

function asBoothMarket(value: string | null): BoothMarket | null {
  if (value === "default" || value === "US") return value;
  return null;
}

function formatChangeSummary(
  remove: { code: string | null; name: string; qty: string },
  adds: Array<{ code: string | null; name: string; qty: string }>,
): string {
  const removeLabel = remove.code ?? remove.name;
  const addPart = adds
    .map((a) => `${a.qty}× ${a.code ?? a.name}`)
    .join(" + ");
  return `−${remove.qty}× ${removeLabel} → +${addPart}`;
}

export async function listRecipeExceptions(
  status: "active" | "reverted" | "all" = "active",
): Promise<RecipeExceptionSummary[]> {
  const rows = await prisma.mrpRecipeException.findMany({
    where: status === "all" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    include: {
      scopes: { include: { boothModel: { select: { name: true } } } },
      batchLinks: { select: { batchLabel: true } },
      lineChanges: {
        include: { material: { select: { code: true, name: true } } },
      },
    },
  });

  return rows.map((row) => {
    const changes = row.lineChanges.map((c) => ({
      changeType: c.changeType,
      quantity: c.quantity.toString(),
      code: c.material.code,
      name: c.material.name,
    }));
    const remove = changes.find((c) => c.changeType === "remove");
    const adds = changes.filter((c) => c.changeType === "add");

    return {
      id: row.id,
      name: row.name,
      notes: row.notes,
      status: row.status,
      createdAt: row.createdAt,
      revertedAt: row.revertedAt,
      modelNames: [...new Set(row.scopes.map((s) => s.boothModel.name))].sort(
        (a, b) => a.localeCompare(b, "bg"),
      ),
      batchLabels: row.batchLinks.map((b) => b.batchLabel),
      changeSummary: remove
        ? formatChangeSummary(
            { code: remove.code, name: remove.name, qty: remove.quantity },
            adds.map((a) => ({
              code: a.code,
              name: a.name,
              qty: a.quantity,
            })),
          )
        : "",
    };
  });
}

export async function listPanelsForModels(
  boothModelIds: string[],
): Promise<string[]> {
  if (boothModelIds.length === 0) return [];

  const rows = await prisma.mrpBoothElement.groupBy({
    by: ["simpleName"],
    where: {
      boothModelId: { in: boothModelIds },
      isActive: true,
    },
    orderBy: { simpleName: "asc" },
  });

  return rows.map((r) => r.simpleName);
}

export async function listBomLinesForPicker(input: {
  boothModelIds: string[];
  simpleName: string;
  scopeColour?: string | null;
  scopeMarket?: BoothMarket | null;
}): Promise<BomLinePickerRow[]> {
  if (input.boothModelIds.length === 0 || !input.simpleName.trim()) {
    return [];
  }

  const rows = await prisma.mrpElementBomLine.findMany({
    where: {
      boothElement: {
        boothModelId: { in: input.boothModelIds },
        simpleName: input.simpleName,
      },
    },
    include: {
      boothElement: { include: { boothModel: true } },
      material: true,
    },
    orderBy: [
      { boothElement: { boothModel: { name: "asc" } } },
      { material: { code: "asc" } },
      { colour: "asc" },
      { market: "asc" },
    ],
  });

  return rows
    .filter((row) => {
      const colourOk = lineMatchesColour(
        row.colour,
        input.scopeColour ?? null,
      );
      const market = asBoothMarket(row.market);
      if (input.scopeMarket != null) {
        return colourOk && lineMatchesMarket(market, input.scopeMarket);
      }
      return colourOk;
    })
    .map((row) => ({
      id: row.id,
      boothModelId: row.boothElement.boothModel.id,
      boothModelName: row.boothElement.boothModel.name,
      boothElementId: row.boothElement.id,
      simpleName: row.boothElement.simpleName,
      materialId: row.material.id,
      materialCode: row.material.code,
      materialName: row.material.name,
      quantity: row.quantity.toString(),
      colour: row.colour,
      market: asBoothMarket(row.market),
    }));
}

export async function createRecipeException(
  input: CreateRecipeExceptionInput,
): Promise<string> {
  if (input.boothModelIds.length === 0) {
    throw new Error("Select at least one booth model");
  }
  if (input.replacementLines.length === 0) {
    throw new Error("Add at least one replacement material");
  }
  if (input.batchLinks.length === 0) {
    throw new Error("Link at least one batch");
  }

  const source = await prisma.mrpElementBomLine.findUnique({
    where: { id: input.sourceBomLineId },
    include: {
      boothElement: { select: { boothModelId: true, simpleName: true } },
    },
  });

  if (!source) {
    throw new Error("Selected recipe line not found");
  }
  const sourceLine = {
    id: source.id,
    boothElementId: source.boothElementId,
    boothModelId: source.boothElement.boothModelId,
    simpleName: source.boothElement.simpleName,
    materialId: source.materialId,
    quantity: source.quantity,
    colour: source.colour,
    market: source.market,
  };
  if (!input.boothModelIds.includes(sourceLine.boothModelId)) {
    throw new Error("Selected line does not belong to chosen models");
  }

  return prisma.$transaction(async (tx) => {
    const exception = await tx.mrpRecipeException.create({
      data: {
        name: input.name.trim(),
        notes: input.notes?.trim() || null,
        createdById: input.createdBy ?? null,
      },
      select: { id: true },
    });

    const exceptionId = exception.id;
    const scopeColour = input.scopeColour?.trim() || null;
    const scopeMarket = input.scopeMarket ?? null;

    for (const boothModelId of input.boothModelIds) {
      await tx.mrpRecipeExceptionScope.create({
        data: {
          exceptionId,
          boothModelId,
          colour: scopeColour,
          market: scopeMarket,
        },
      });

      const element = await tx.mrpBoothElement.findUnique({
        where: {
          boothModelId_simpleName: {
            boothModelId,
            simpleName: sourceLine.simpleName,
          },
        },
      });
      if (!element) {
        throw new Error(
          `Panel "${sourceLine.simpleName}" not found for selected model`,
        );
      }

      await tx.mrpRecipeExceptionLineChange.create({
        data: {
          exceptionId,
          boothElementId: element.id,
          changeType: "remove",
          materialId: sourceLine.materialId,
          quantity: sourceLine.quantity,
          colour: sourceLine.colour,
          market: sourceLine.market,
        },
      });

      for (const line of input.replacementLines) {
        await tx.mrpRecipeExceptionLineChange.create({
          data: {
            exceptionId,
            boothElementId: element.id,
            changeType: "add",
            materialId: line.materialId,
            quantity: String(line.quantity),
            colour: line.colour ?? sourceLine.colour,
            market: line.market ?? sourceLine.market,
          },
        });
      }
    }

    for (const link of input.batchLinks) {
      const label = link.batchLabel.trim();
      if (!label) continue;

      let manufacturingBatchId = link.manufacturingBatchId ?? null;
      if (!manufacturingBatchId) {
        const batch = await tx.mrpManufacturingBatch.findFirst({
          where: { name: label },
        });
        manufacturingBatchId = batch?.id ?? null;
      }

      await tx.mrpRecipeExceptionBatchLink.create({
        data: {
          exceptionId,
          batchLabel: label,
          manufacturingBatchId,
          applyToWholeBatch: link.applyToWholeBatch,
          boothIdTexts: link.boothIdTexts ?? [],
        },
      });
    }

    return exceptionId;
  });
}

export async function revertRecipeException(id: string): Promise<void> {
  await prisma.mrpRecipeException.updateMany({
    where: { id, status: "active" },
    data: {
      status: "reverted",
      revertedAt: new Date(),
    },
  });
}
