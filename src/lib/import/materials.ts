import "server-only";

import { parseCsv, rowsToObjects, serializeCsv } from "@/lib/import/csv";
import {
  MATERIALS_COLUMNS,
  parseOptionalPrice,
} from "@/lib/import/schemas";
import { emptyImportResult, type ImportResult } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";
import { clearBomMissingMaterialCodes } from "@/lib/stock/bom-missing";

export function materialsTemplateCsv(): string {
  return serializeCsv([...MATERIALS_COLUMNS], [
    ["0114", "ПДЧ Бяло 25мм", "квм", "12.50"],
    ["0138", "", "бр", ""],
  ]);
}

export async function exportMaterialsCsv(): Promise<string> {
  const rows = await prisma.mrpMaterial.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  return serializeCsv(
    [...MATERIALS_COLUMNS],
    rows.map((m) => [
      m.code ?? "",
      m.name,
      m.unit,
      m.unitPriceEur?.toString() ?? "",
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

      const existing = await prisma.mrpMaterial.findUnique({
        where: { code },
      });

      if (existing) {
        await prisma.mrpMaterial.update({
          where: { id: existing.id },
          data: {
            name: raw.name?.trim() ? name : existing.name,
            unit: raw.unit?.trim() ? unit : existing.unit,
            unitPriceEur:
              raw.unit_price_eur?.trim() ? unitPriceEur : existing.unitPriceEur,
            updatedAt: new Date(),
          },
        });
        result.updated++;
      } else {
        await prisma.mrpMaterial.create({
          data: {
            code,
            name,
            unit,
            unitPriceEur,
          },
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
