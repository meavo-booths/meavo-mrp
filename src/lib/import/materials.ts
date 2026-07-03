import "server-only";

import { asc, eq } from "drizzle-orm";

import { parseCsv, rowsToObjects, serializeCsv } from "@/lib/import/csv";
import {
  MATERIALS_COLUMNS,
  parseOptionalPrice,
} from "@/lib/import/schemas";
import { emptyImportResult, type ImportResult } from "@/lib/import/types";
import { db, schema } from "@/lib/db/client";
import { clearBomMissingMaterialCodes } from "@/lib/stock/bom-missing";

export function materialsTemplateCsv(): string {
  return serializeCsv([...MATERIALS_COLUMNS], [
    ["0114", "ПДЧ Бяло 25мм", "квм", "12.50"],
    ["0138", "", "бр", ""],
  ]);
}

export async function exportMaterialsCsv(): Promise<string> {
  const rows = await db
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.isActive, true))
    .orderBy(asc(schema.materials.code));

  return serializeCsv(
    [...MATERIALS_COLUMNS],
    rows.map((m) => [
      m.code ?? "",
      m.name,
      m.unit,
      m.unitPriceEur ?? "",
    ]),
  );
}

export async function importMaterialsCsv(
  text: string,
): Promise<ImportResult> {
  const result = emptyImportResult();
  const { headers, rows } = parseCsv(text);
  const objects = rowsToObjects(headers, rows);

  const importedCodes: string[] = [];

  for (let i = 0; i < objects.length; i++) {
    const rowNum = i + 2;
    const raw = objects[i]!;
    const code = raw.code?.trim();
    if (!code) continue;

    try {
      const name = raw.name?.trim() || code;
      const unit = raw.unit?.trim() || "бр";
      const unitPriceEur = parseOptionalPrice(raw.unit_price_eur ?? "");

      const existing = await db.query.materials.findFirst({
        where: eq(schema.materials.code, code),
      });

      if (existing) {
        await db
          .update(schema.materials)
          .set({
            name: raw.name?.trim() ? name : existing.name,
            unit: raw.unit?.trim() ? unit : existing.unit,
            unitPriceEur:
              raw.unit_price_eur?.trim() ? unitPriceEur : existing.unitPriceEur,
            updatedAt: new Date(),
          })
          .where(eq(schema.materials.id, existing.id));
        result.updated++;
      } else {
        await db.insert(schema.materials).values({
          code,
          name,
          unit,
          unitPriceEur,
        });
        result.created++;
      }
      importedCodes.push(code);
    } catch (err) {
      result.ok = false;
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await clearBomMissingMaterialCodes(importedCodes);

  return result;
}
