import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import type { BoothMarket } from "@/lib/import/schemas";
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
  const rows = await db
    .select({
      id: schema.recipeExceptions.id,
      name: schema.recipeExceptions.name,
      notes: schema.recipeExceptions.notes,
      status: schema.recipeExceptions.status,
      createdAt: schema.recipeExceptions.createdAt,
      revertedAt: schema.recipeExceptions.revertedAt,
    })
    .from(schema.recipeExceptions)
    .where(
      status === "all"
        ? sql`true`
        : eq(schema.recipeExceptions.status, status),
    )
    .orderBy(desc(schema.recipeExceptions.createdAt));

  const summaries: RecipeExceptionSummary[] = [];
  for (const row of rows) {
    const scopes = await db
      .select({ name: schema.boothModels.name })
      .from(schema.recipeExceptionScopes)
      .innerJoin(
        schema.boothModels,
        eq(schema.recipeExceptionScopes.boothModelId, schema.boothModels.id),
      )
      .where(eq(schema.recipeExceptionScopes.exceptionId, row.id));

    const batches = await db
      .select({ batchLabel: schema.recipeExceptionBatchLinks.batchLabel })
      .from(schema.recipeExceptionBatchLinks)
      .where(eq(schema.recipeExceptionBatchLinks.exceptionId, row.id));

    const changes = await db
      .select({
        changeType: schema.recipeExceptionLineChanges.changeType,
        quantity: schema.recipeExceptionLineChanges.quantity,
        code: schema.materials.code,
        name: schema.materials.name,
      })
      .from(schema.recipeExceptionLineChanges)
      .innerJoin(
        schema.materials,
        eq(schema.recipeExceptionLineChanges.materialId, schema.materials.id),
      )
      .where(eq(schema.recipeExceptionLineChanges.exceptionId, row.id));

    const remove = changes.find((c) => c.changeType === "remove");
    const adds = changes.filter((c) => c.changeType === "add");

    summaries.push({
      id: row.id,
      name: row.name,
      notes: row.notes,
      status: row.status,
      createdAt: row.createdAt,
      revertedAt: row.revertedAt,
      modelNames: [...new Set(scopes.map((s) => s.name))].sort((a, b) =>
        a.localeCompare(b, "bg"),
      ),
      batchLabels: batches.map((b) => b.batchLabel),
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
    });
  }

  return summaries;
}

export async function listPanelsForModels(
  boothModelIds: string[],
): Promise<string[]> {
  if (boothModelIds.length === 0) return [];

  const rows = await db
    .select({ simpleName: schema.boothElements.simpleName })
    .from(schema.boothElements)
    .where(
      and(
        inArray(schema.boothElements.boothModelId, boothModelIds),
        eq(schema.boothElements.isActive, true),
      ),
    )
    .groupBy(schema.boothElements.simpleName)
    .orderBy(asc(schema.boothElements.simpleName));

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

  const rows = await db
    .select({
      id: schema.elementBomLines.id,
      boothModelId: schema.boothModels.id,
      boothModelName: schema.boothModels.name,
      boothElementId: schema.boothElements.id,
      simpleName: schema.boothElements.simpleName,
      materialId: schema.materials.id,
      materialCode: schema.materials.code,
      materialName: schema.materials.name,
      quantity: schema.elementBomLines.quantity,
      colour: schema.elementBomLines.colour,
      market: schema.elementBomLines.market,
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
    .where(
      and(
        inArray(schema.boothModels.id, input.boothModelIds),
        eq(schema.boothElements.simpleName, input.simpleName),
      ),
    )
    .orderBy(
      asc(schema.boothModels.name),
      asc(schema.materials.code),
      asc(schema.elementBomLines.colour),
      asc(schema.elementBomLines.market),
    );

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
      ...row,
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

  const source = await db
    .select({
      id: schema.elementBomLines.id,
      boothElementId: schema.elementBomLines.boothElementId,
      boothModelId: schema.boothElements.boothModelId,
      simpleName: schema.boothElements.simpleName,
      materialId: schema.elementBomLines.materialId,
      quantity: schema.elementBomLines.quantity,
      colour: schema.elementBomLines.colour,
      market: schema.elementBomLines.market,
    })
    .from(schema.elementBomLines)
    .innerJoin(
      schema.boothElements,
      eq(schema.elementBomLines.boothElementId, schema.boothElements.id),
    )
    .where(eq(schema.elementBomLines.id, input.sourceBomLineId))
    .limit(1);

  const sourceLine = source[0];
  if (!sourceLine) {
    throw new Error("Selected recipe line not found");
  }
  if (!input.boothModelIds.includes(sourceLine.boothModelId)) {
    throw new Error("Selected line does not belong to chosen models");
  }

  return db.transaction(async (tx) => {
    const [exception] = await tx
      .insert(schema.recipeExceptions)
      .values({
        name: input.name.trim(),
        notes: input.notes?.trim() || null,
        createdBy: input.createdBy ?? null,
      })
      .returning({ id: schema.recipeExceptions.id });

    const exceptionId = exception!.id;
    const scopeColour = input.scopeColour?.trim() || null;
    const scopeMarket = input.scopeMarket ?? null;

    for (const boothModelId of input.boothModelIds) {
      await tx.insert(schema.recipeExceptionScopes).values({
        exceptionId,
        boothModelId,
        colour: scopeColour,
        market: scopeMarket,
      });

      const element = await tx.query.boothElements.findFirst({
        where: and(
          eq(schema.boothElements.boothModelId, boothModelId),
          eq(schema.boothElements.simpleName, sourceLine.simpleName),
        ),
      });
      if (!element) {
        throw new Error(
          `Panel "${sourceLine.simpleName}" not found for selected model`,
        );
      }

      await tx.insert(schema.recipeExceptionLineChanges).values({
        exceptionId,
        boothElementId: element.id,
        changeType: "remove",
        materialId: sourceLine.materialId,
        quantity: sourceLine.quantity,
        colour: sourceLine.colour,
        market: sourceLine.market,
      });

      for (const line of input.replacementLines) {
        await tx.insert(schema.recipeExceptionLineChanges).values({
          exceptionId,
          boothElementId: element.id,
          changeType: "add",
          materialId: line.materialId,
          quantity: String(line.quantity),
          colour: line.colour ?? sourceLine.colour,
          market: line.market ?? sourceLine.market,
        });
      }
    }

    for (const link of input.batchLinks) {
      const label = link.batchLabel.trim();
      if (!label) continue;

      let manufacturingBatchId = link.manufacturingBatchId ?? null;
      if (!manufacturingBatchId) {
        const batch = await tx.query.manufacturingBatches.findFirst({
          where: eq(schema.manufacturingBatches.name, label),
        });
        manufacturingBatchId = batch?.id ?? null;
      }

      await tx.insert(schema.recipeExceptionBatchLinks).values({
        exceptionId,
        batchLabel: label,
        manufacturingBatchId,
        applyToWholeBatch: link.applyToWholeBatch,
        boothIdTexts: link.boothIdTexts ?? [],
      });
    }

    return exceptionId;
  });
}

export async function revertRecipeException(id: string): Promise<void> {
  await db
    .update(schema.recipeExceptions)
    .set({
      status: "reverted",
      revertedAt: sql`now()`,
    })
    .where(
      and(
        eq(schema.recipeExceptions.id, id),
        eq(schema.recipeExceptions.status, "active"),
      ),
    );
}
