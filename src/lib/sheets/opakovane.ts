import "server-only";

export function normalizeSheetHeader(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export function parseCheckboxValue(raw: string | undefined): boolean {
  if (!raw) return false;
  const s = raw.trim().toUpperCase();
  return s === "TRUE" || s === "YES" || s === "1";
}

export type OpakovaneColumn = {
  colIndex: number;
  sheetHeader: string;
};

export type ParsedOpakovaneUnit = {
  sheetRowIndex: number;
  modelName: string;
  colour: string | null;
  boothIdText: string;
  progressPct: string | null;
  elements: Array<{
    sheetHeader: string;
    isComplete: boolean;
  }>;
};

function cell(row: string[] | undefined, index: number): string {
  return row?.[index]?.trim() ?? "";
}

/** Find the packing header row and map element columns to sheet_header labels. */
export function findOpakovaneHeaderRow(
  rows: string[][],
  knownHeaders: Set<string>,
): { headerRowIndex: number; columns: OpakovaneColumn[] } | null {
  let best: { headerRowIndex: number; columns: OpakovaneColumn[] } | null = null;

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] ?? [];
    const columns: OpakovaneColumn[] = [];

    for (let col = 3; col < row.length; col++) {
      const header = normalizeSheetHeader(cell(row, col));
      if (!header) continue;
      if (knownHeaders.has(header)) {
        columns.push({ colIndex: col, sheetHeader: header });
      }
    }

    if (columns.length > (best?.columns.length ?? 0)) {
      best = { headerRowIndex: i, columns };
    }
  }

  return best?.columns.length ? best : null;
}

export function parseOpakovaneTab(
  rows: string[][],
  knownHeaders: Set<string>,
): ParsedOpakovaneUnit[] {
  const header = findOpakovaneHeaderRow(rows, knownHeaders);
  if (!header) return [];

  const units: ParsedOpakovaneUnit[] = [];
  const dataStart = header.headerRowIndex + 2;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const boothIdText = cell(row, 2);
    if (!boothIdText) continue;

    const modelName = cell(row, 0);
    const colour = cell(row, 1) || null;

    const elements = header.columns.map(({ colIndex, sheetHeader }) => ({
      sheetHeader,
      isComplete: parseCheckboxValue(cell(row, colIndex)),
    }));

    const completeCount = elements.filter((e) => e.isComplete).length;
    const progressPct =
      elements.length > 0
        ? ((completeCount / elements.length) * 100).toFixed(2)
        : null;

    units.push({
      sheetRowIndex: i + 1,
      modelName,
      colour,
      boothIdText,
      progressPct,
      elements,
    });
  }

  return units;
}
