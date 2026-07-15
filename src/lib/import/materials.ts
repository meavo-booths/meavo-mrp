import "server-only";

import { parseCsv, rowsToObjects, serializeCsv } from "@/lib/import/csv";
import {
  MATERIALS_COLUMNS,
  parseOptionalPrice,
} from "@/lib/import/schemas";
import { emptyImportResult, type ImportResult } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";
import { clearBomMissingMaterialCodes } from "@/lib/stock/bom-missing";
import {
  INVALID_MATERIAL_UNIT_ERROR,
  resolveMaterialUnit,
} from "@/lib/stock/material-units";

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

  type ParsedRow = {
    rowNum: number;
    code: string;
    name: string | null;
    unit: string | null;
    unitPriceEur: string | null;
    hasPrice: boolean;
  };
  const parsedRows: ParsedRow[] = [];

  for (let i = 0; i < objects.length; i++) {
    const rowNum = i + 2;
    const raw = objects[i]!;
    const code = raw.code?.trim();
    if (!code) continue;

    try {
      const rawUnit = raw.unit?.trim() || null;
      let unit: string | null = null;
      if (rawUnit) {
        const resolved = resolveMaterialUnit(rawUnit, "manual");
        if (!resolved) {
          result.ok = false;
          result.errors.push({
            row: rowNum,
            message: `${INVALID_MATERIAL_UNIT_ERROR} (${rawUnit})`,
          });
          continue;
        }
        unit = resolved.unit;
      }

      parsedRows.push({
        rowNum,
        code,
        name: raw.name?.trim() || null,
        unit,
        unitPriceEur: parseOptionalPrice(raw.unit_price_eur ?? ""),
        hasPrice: Boolean(raw.unit_price_eur?.trim()),
      });
    } catch (err) {
      result.ok = false;
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (parsedRows.length === 0) return result;

  // One lookup for all codes instead of a query per row.
  const existingRows = await prisma.mrpMaterial.findMany({
    where: { code: { in: [...new Set(parsedRows.map((r) => r.code))] } },
    select: { id: true, code: true, name: true, unit: true, unitPriceEur: true },
  });
  const existingByCode = new Map(existingRows.map((m) => [m.code!, m]));

  type CreateData = {
    code: string;
    name: string;
    unit: string;
    unitPriceEur: string | null;
  };
  const createByCode = new Map<string, CreateData>();
  const updates: Array<{
    id: string;
    data: { name: string; unit: string; unitPriceEur: string | null };
  }> = [];
  const importedCodes: string[] = [];

  for (const row of parsedRows) {
    const existing = existingByCode.get(row.code);
    const pendingCreate = createByCode.get(row.code);

    if (existing) {
      const next = {
        name: row.name ?? existing.name,
        unit: row.unit ?? existing.unit,
        unitPriceEur: row.hasPrice
          ? row.unitPriceEur
          : (existing.unitPriceEur?.toString() ?? null),
      };
      const changed =
        next.name !== existing.name ||
        next.unit !== existing.unit ||
        next.unitPriceEur !== (existing.unitPriceEur?.toString() ?? null);
      if (changed) {
        updates.push({ id: existing.id, data: next });
      }
      result.updated++;
    } else if (pendingCreate) {
      // Duplicate code within the CSV — later row overrides provided fields.
      pendingCreate.name = row.name ?? pendingCreate.name;
      pendingCreate.unit = row.unit ?? pendingCreate.unit;
      pendingCreate.unitPriceEur = row.hasPrice
        ? row.unitPriceEur
        : pendingCreate.unitPriceEur;
      result.updated++;
    } else {
      createByCode.set(row.code, {
        code: row.code,
        name: row.name ?? row.code,
        unit: row.unit ?? "бр",
        unitPriceEur: row.unitPriceEur,
      });
      result.created++;
    }
    importedCodes.push(row.code);
  }

  try {
    if (createByCode.size > 0) {
      await prisma.mrpMaterial.createMany({
        data: [...createByCode.values()],
        skipDuplicates: true,
      });
    }
    if (updates.length > 0) {
      const now = new Date();
      await prisma.$transaction(
        updates.map((u) =>
          prisma.mrpMaterial.update({
            where: { id: u.id },
            data: { ...u.data, updatedAt: now },
          }),
        ),
      );
    }
  } catch (err) {
    result.ok = false;
    result.errors.push({
      row: 0,
      message: err instanceof Error ? err.message : String(err),
    });
    return result;
  }

  await clearBomMissingMaterialCodes(importedCodes);

  return result;
}
