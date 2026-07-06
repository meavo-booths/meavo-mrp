import "server-only";

import { parseCsv, rowsToObjects, serializeCsv } from "@/lib/import/csv";
import { resolveWarehouseId, warehouseCodeFromAlias } from "@/lib/import/resolve";
import {
  OPENING_STOCK_COLUMNS,
  parseCountDate,
  parseOptionalQuantity,
} from "@/lib/import/schemas";
import { emptyImportResult, type ImportResult } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";
import { recordInventoryCount } from "@/lib/stock/inventory";

export function openingStockTemplateCsv(): string {
  return serializeCsv([...OPENING_STOCK_COLUMNS], [
    ["0138", "AKS", "340", "2026-06-08", "Партида 42", ""],
    ["0138", "VAR", "150", "2026-06-08", "Партида 42", ""],
    ["0138", "KAZ", "", "2026-06-08", "", "uncertain — leave blank to skip"],
  ]);
}

export async function exportOpeningStockCsv(): Promise<string> {
  const rows = await prisma.mrpStockBalance.findMany({
    include: {
      material: { select: { code: true } },
      warehouse: { select: { code: true } },
    },
    orderBy: [
      { material: { code: "asc" } },
      { warehouse: { code: "asc" } },
    ],
  });

  const aliasForCode: Record<string, string> = {
    aksakovo: "AKS",
    kazanlak: "KAZ",
    varna: "VAR",
    top: "TOP",
  };

  return serializeCsv(
    [...OPENING_STOCK_COLUMNS],
    rows.map((r) => [
      r.material.code ?? "",
      aliasForCode[r.warehouse.code] ?? r.warehouse.code,
      r.quantity.toString(),
      r.updatedAt.toISOString().slice(0, 10),
      "",
      "",
    ]),
  );
}

export async function importOpeningStockCsv(
  text: string,
  createdBy?: string | null,
): Promise<ImportResult> {
  const result = emptyImportResult();
  const { headers, rows } = parseCsv(text);
  const objects = rowsToObjects(headers, rows);

  for (let i = 0; i < objects.length; i++) {
    const rowNum = i + 2;
    const raw = objects[i]!;
    const materialCode = raw.material_code?.trim();
    const warehouseRaw = raw.warehouse?.trim();

    if (!materialCode && !warehouseRaw) continue;
    if (!materialCode) {
      result.ok = false;
      result.errors.push({ row: rowNum, message: "material_code is required" });
      continue;
    }
    if (!warehouseRaw) {
      result.ok = false;
      result.errors.push({ row: rowNum, message: "warehouse is required" });
      continue;
    }

    const qty = parseOptionalQuantity(raw.quantity ?? "");
    if (qty === null) {
      result.skipped++;
      result.warnings.push({
        row: rowNum,
        message: `Skipped ${materialCode} @ ${warehouseRaw}: quantity blank (uncertain)`,
      });
      continue;
    }

    try {
      const material = await prisma.mrpMaterial.findUnique({
        where: { code: materialCode },
      });
      if (!material) {
        result.ok = false;
        result.errors.push({
          row: rowNum,
          message: `Unknown material_code "${materialCode}"`,
        });
        continue;
      }

      const warehouseId = await resolveWarehouseId(warehouseRaw);
      if (!warehouseId) {
        const hint = warehouseCodeFromAlias(warehouseRaw);
        result.ok = false;
        result.errors.push({
          row: rowNum,
          message: hint
            ? `Warehouse "${warehouseRaw}" not found in DB`
            : `Unknown warehouse "${warehouseRaw}" (use AKS, VAR, KAZ, TOP)`,
        });
        continue;
      }

      const countDate = parseCountDate(raw.count_date ?? "");

      await recordInventoryCount({
        warehouseId,
        materialId: material.id,
        countDate,
        countedQuantity: qty,
        notes: raw.notes?.trim() || null,
        countedThroughBatchLabel: raw.counted_through_batch?.trim() || null,
        createdBy: createdBy ?? null,
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
