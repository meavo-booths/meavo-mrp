import "server-only";

import { parseCsv, rowsToObjects, serializeCsv } from "@/lib/import/csv";
import { warehouseCodeFromAlias } from "@/lib/import/resolve";
import {
  OPENING_STOCK_COLUMNS,
  parseCountDate,
  parseOptionalQuantity,
} from "@/lib/import/schemas";
import { emptyImportResult, type ImportResult } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";
import { toDecimalString } from "@/lib/stock/decimal";
import {
  applyMovementsInTx,
  resolveWarehouseCodesForMovements,
  type ApplyMovementInput,
} from "@/lib/stock/movements";

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

type PendingCountRow = {
  rowNum: number;
  warehouseId: string;
  materialId: string;
  countDate: Date;
  counted: string;
  systemQuantity: string;
  variance: string;
  notes: string | null;
  countedThroughBatchId: string | null;
  countedThroughBatchLabel: string | null;
};

const IMPORT_CHUNK_SIZE = 25;

export async function importOpeningStockCsv(
  text: string,
  createdBy?: string | null,
): Promise<ImportResult> {
  const result = emptyImportResult();
  const { headers, rows } = parseCsv(text);
  const objects = rowsToObjects(headers, rows);

  // First pass: syntactic validation + collect lookup keys.
  type ValidRow = {
    rowNum: number;
    materialCode: string;
    warehouseCode: string;
    counted: string;
    countDate: Date;
    notes: string | null;
    batchLabel: string | null;
  };
  const validRows: ValidRow[] = [];

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

    const warehouseCode = warehouseCodeFromAlias(warehouseRaw);
    if (!warehouseCode) {
      result.ok = false;
      result.errors.push({
        row: rowNum,
        message: `Unknown warehouse "${warehouseRaw}" (use AKS, VAR, KAZ, TOP)`,
      });
      continue;
    }

    validRows.push({
      rowNum,
      materialCode,
      warehouseCode,
      counted: qty,
      countDate: parseCountDate(raw.count_date ?? ""),
      notes: raw.notes?.trim() || null,
      batchLabel: raw.counted_through_batch?.trim() || null,
    });
  }

  if (validRows.length === 0) return result;

  // Bulk lookups instead of per-row queries.
  const materialCodes = [...new Set(validRows.map((r) => r.materialCode))];
  const warehouseCodes = [...new Set(validRows.map((r) => r.warehouseCode))];
  const batchLabels = [
    ...new Set(
      validRows.map((r) => r.batchLabel).filter((l): l is string => Boolean(l)),
    ),
  ];

  const [materials, warehouses, batches] = await Promise.all([
    prisma.mrpMaterial.findMany({
      where: { code: { in: materialCodes } },
      select: { id: true, code: true },
    }),
    prisma.mrpWarehouse.findMany({
      where: { code: { in: warehouseCodes } },
      select: { id: true, code: true },
    }),
    batchLabels.length > 0
      ? prisma.mrpManufacturingBatch.findMany({
          where: { name: { in: batchLabels } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const materialIdByCode = new Map(materials.map((m) => [m.code, m.id]));
  const warehouseIdByCode = new Map(warehouses.map((w) => [w.code, w.id]));
  const batchByName = new Map(batches.map((b) => [b.name, b]));

  // Second pass: resolve FKs and compute variances against a running balance map.
  const resolvedRows: PendingCountRow[] = [];
  const materialIds = new Set<string>();
  const warehouseIds = new Set<string>();

  for (const row of validRows) {
    const materialId = materialIdByCode.get(row.materialCode);
    if (!materialId) {
      result.ok = false;
      result.errors.push({
        row: row.rowNum,
        message: `Unknown material_code "${row.materialCode}"`,
      });
      continue;
    }
    const warehouseId = warehouseIdByCode.get(row.warehouseCode);
    if (!warehouseId) {
      result.ok = false;
      result.errors.push({
        row: row.rowNum,
        message: `Warehouse "${row.warehouseCode}" not found in DB`,
      });
      continue;
    }

    const batch = row.batchLabel ? batchByName.get(row.batchLabel) : undefined;
    materialIds.add(materialId);
    warehouseIds.add(warehouseId);
    resolvedRows.push({
      rowNum: row.rowNum,
      warehouseId,
      materialId,
      countDate: row.countDate,
      counted: toDecimalString(row.counted),
      systemQuantity: "0", // filled below from the balance map
      variance: "0",
      notes: row.notes,
      countedThroughBatchId: batch?.id ?? null,
      countedThroughBatchLabel: batch?.name ?? row.batchLabel,
    });
  }

  if (resolvedRows.length === 0) return result;

  const balances = await prisma.mrpStockBalance.findMany({
    where: {
      warehouseId: { in: [...warehouseIds] },
      materialId: { in: [...materialIds] },
    },
    select: { warehouseId: true, materialId: true, quantity: true },
  });
  const balanceByPair = new Map(
    balances.map((b) => [
      `${b.warehouseId}\u0000${b.materialId}`,
      b.quantity.toString(),
    ]),
  );

  for (const row of resolvedRows) {
    const key = `${row.warehouseId}\u0000${row.materialId}`;
    const systemQty = balanceByPair.get(key) ?? "0";
    row.systemQuantity = systemQty;
    row.variance = (Number(row.counted) - Number(systemQty)).toFixed(4);
    // Later duplicate rows for the same pair count against the new quantity.
    balanceByPair.set(key, row.counted);
  }

  // Apply in chunks: movements + count rows commit atomically per chunk.
  for (let start = 0; start < resolvedRows.length; start += IMPORT_CHUNK_SIZE) {
    const chunk = resolvedRows.slice(start, start + IMPORT_CHUNK_SIZE);
    const movementInputs: ApplyMovementInput[] = chunk.map((row) => ({
      warehouseId: row.warehouseId,
      materialId: row.materialId,
      movementType: "inventory_count" as const,
      quantityDelta: row.variance,
      effectiveAt: row.countDate,
      notes: row.notes,
      createdBy: createdBy ?? null,
      referenceId: row.countedThroughBatchId,
      metadata: {
        systemQuantity: row.systemQuantity,
        countedQuantity: row.counted,
        countedThroughBatchId: row.countedThroughBatchId,
        countedThroughBatchLabel: row.countedThroughBatchLabel,
        importRow: row.rowNum,
      },
    }));

    try {
      const codes = await resolveWarehouseCodesForMovements(movementInputs);
      await prisma.$transaction(async (tx) => {
        const movements = await applyMovementsInTx(tx, movementInputs, codes);
        // Match movements back to rows via the importRow marker (createManyAndReturn
        // does not guarantee output order).
        const movementIdByRow = new Map<number, string>();
        for (const movement of movements) {
          const importRow = (movement.metadata as { importRow?: number })
            ?.importRow;
          if (typeof importRow === "number") {
            movementIdByRow.set(importRow, movement.id);
          }
        }

        await tx.mrpInventoryCount.createMany({
          data: chunk.map((row) => ({
            warehouseId: row.warehouseId,
            materialId: row.materialId,
            countDate: row.countDate,
            systemQuantity: row.systemQuantity,
            countedQuantity: row.counted,
            variance: row.variance,
            notes: row.notes,
            countedThroughBatchId: row.countedThroughBatchId,
            countedThroughBatchLabel: row.countedThroughBatchLabel,
            movementId: movementIdByRow.get(row.rowNum) ?? null,
            createdById: createdBy ?? null,
          })),
        });
      });
      result.created += chunk.length;
    } catch (err) {
      result.ok = false;
      const message = err instanceof Error ? err.message : String(err);
      for (const row of chunk) {
        result.errors.push({ row: row.rowNum, message });
      }
    }
  }

  return result;
}
