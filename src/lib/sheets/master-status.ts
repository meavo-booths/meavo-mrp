import "server-only";

import type { FactoryCode } from "@/lib/sheets/config";
import {
  BATCH_STATUS_SECTIONS,
  batchCodeForFactory,
  isPlaceholderBatch,
  mapSheetBatchStatus,
  masterSheetRowKey,
  parseSheetQty,
} from "@/lib/sheets/config";
import {
  extractSpreadsheetId,
  type SheetsGridCell,
} from "@/lib/google/sheets-client";

export type ParsedMasterBatch = {
  factory: FactoryCode;
  batchCode: string;
  rowKey: string;
  sheetRowNumber: number;
  sheetStatus: string;
  modelName: string;
  qty: number | null;
  batchSpreadsheetId: string | null;
};

function cell(row: string[] | undefined, index: number): string {
  return row?.[index]?.trim() ?? "";
}

function gridCell(
  row: SheetsGridCell[] | undefined,
  index: number,
): SheetsGridCell | undefined {
  return row?.[index];
}

export function parseMasterBatchStatusTab(
  values: string[][],
  linkGrid: SheetsGridCell[][],
  linkColumn: number,
): ParsedMasterBatch[] {
  const section = BATCH_STATUS_SECTIONS.find((s) => s.batch === linkColumn);
  if (!section) return [];

  const byKey = new Map<string, ParsedMasterBatch>();

  for (let i = section.dataStartRow; i < values.length; i++) {
    const row = values[i];
    const batchCode = cell(row, section.batch).toUpperCase();
    if (!batchCode || !batchCodeForFactory(batchCode, section.factory)) continue;
    if (isPlaceholderBatch(batchCode)) continue;

    const sheetStatus = cell(row, section.status);
    if (!sheetStatus) continue;

    const modelName = cell(row, section.model);
    const qty = parseSheetQty(cell(row, section.number));
    const rowKey = masterSheetRowKey(section.factory, batchCode);

    const linkRowIndex = i - section.dataStartRow;
    const hyperlink = gridCell(linkGrid[linkRowIndex], linkColumn)?.hyperlink;
    const batchSpreadsheetId = extractSpreadsheetId(hyperlink);

    byKey.set(rowKey, {
      factory: section.factory,
      batchCode,
      rowKey,
      sheetRowNumber: i + 1,
      sheetStatus,
      modelName,
      qty,
      batchSpreadsheetId,
    });
  }

  return [...byKey.values()].sort((a, b) =>
    a.batchCode.localeCompare(b.batchCode),
  );
}

export function parseAllMasterBatches(
  values: string[][],
  grids: SheetsGridCell[][][],
): ParsedMasterBatch[] {
  const merged = new Map<string, ParsedMasterBatch>();

  for (let i = 0; i < BATCH_STATUS_SECTIONS.length; i++) {
    const section = BATCH_STATUS_SECTIONS[i]!;
    const parsed = parseMasterBatchStatusTab(
      values,
      grids[i] ?? [],
      section.batch,
    );
    for (const batch of parsed) {
      merged.set(batch.rowKey, batch);
    }
  }

  return [...merged.values()];
}
