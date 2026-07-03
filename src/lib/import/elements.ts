import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { BOOTH_ELEMENTS_TEMPLATE } from "@/lib/import/booth-elements-config";
import { parseCsv, rowsToObjects, serializeCsv } from "@/lib/import/csv";
import { ensureBoothModelId } from "@/lib/import/resolve";
import { ELEMENTS_COLUMNS, parseBoolean } from "@/lib/import/schemas";
import { emptyImportResult, type ImportResult } from "@/lib/import/types";
import { db, schema } from "@/lib/db/client";

export function elementsTemplateCsv(): string {
  const rows = BOOTH_ELEMENTS_TEMPLATE.map((e) => [
    e.boothModel,
    e.sheetHeader,
    e.simpleName,
    String(e.sortOrder),
    e.active ? "TRUE" : "FALSE",
  ]);
  return serializeCsv([...ELEMENTS_COLUMNS], rows);
}

export async function exportElementsCsv(): Promise<string> {
  const rows = await db
    .select({
      boothModel: schema.boothModels.name,
      sheetHeader: schema.boothElements.sheetHeader,
      simpleName: schema.boothElements.simpleName,
      sortOrder: schema.boothElements.sortOrder,
      isActive: schema.boothElements.isActive,
    })
    .from(schema.boothElements)
    .innerJoin(
      schema.boothModels,
      eq(schema.boothElements.boothModelId, schema.boothModels.id),
    )
    .orderBy(asc(schema.boothModels.name), asc(schema.boothElements.sortOrder));

  return serializeCsv(
    [...ELEMENTS_COLUMNS],
    rows.map((r) => [
      r.boothModel,
      r.sheetHeader,
      r.simpleName,
      String(r.sortOrder),
      r.isActive ? "TRUE" : "FALSE",
    ]),
  );
}

export async function importElementsCsv(text: string): Promise<ImportResult> {
  const result = emptyImportResult();
  const { headers, rows } = parseCsv(text);
  const objects = rowsToObjects(headers, rows);

  for (let i = 0; i < objects.length; i++) {
    const rowNum = i + 2;
    const raw = objects[i]!;
    const boothModel = raw.booth_model?.trim();
    const sheetHeader = raw.sheet_header ?? "";
    const simpleName = raw.simple_name?.trim();

    if (!boothModel && !sheetHeader.trim() && !simpleName) continue;

    if (!boothModel || !sheetHeader.trim() || !simpleName) {
      result.ok = false;
      result.errors.push({
        row: rowNum,
        message: "booth_model, sheet_header, and simple_name are required",
      });
      continue;
    }

    try {
      const sortOrder = raw.sort_order?.trim()
        ? Number.parseInt(raw.sort_order, 10)
        : 0;
      const isActive = parseBoolean(raw.active ?? "", true);
      const boothModelId = await ensureBoothModelId(boothModel);

      const byHeader = await db.query.boothElements.findFirst({
        where: and(
          eq(schema.boothElements.boothModelId, boothModelId),
          eq(schema.boothElements.sheetHeader, sheetHeader),
        ),
      });

      if (byHeader) {
        await db
          .update(schema.boothElements)
          .set({ simpleName, sortOrder, isActive })
          .where(eq(schema.boothElements.id, byHeader.id));
        result.updated++;
        continue;
      }

      const bySimple = await db.query.boothElements.findFirst({
        where: and(
          eq(schema.boothElements.boothModelId, boothModelId),
          eq(schema.boothElements.simpleName, simpleName),
        ),
      });

      if (bySimple) {
        await db
          .update(schema.boothElements)
          .set({ sheetHeader, sortOrder, isActive })
          .where(eq(schema.boothElements.id, bySimple.id));
        result.updated++;
        continue;
      }

      await db.insert(schema.boothElements).values({
        boothModelId,
        sheetHeader,
        simpleName,
        sortOrder,
        isActive,
      });
      result.created++;
    } catch (err) {
      result.ok = false;
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
