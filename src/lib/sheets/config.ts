import type { MrpManufacturingBatchStatus } from "@prisma/client";

export type FactoryCode = "AKS" | "VAR" | "KAZ";

export const BATCH_STATUS_TAB_NAME = "Статус на партиди";
export const BATCH_PACKING_TAB_NAME = "Опаковане";

/** Column indices on the batch Опаковане tab (0-based). */
export const OPAKOVANE_COL = {
  model: 0,
  colour: 1,
  insulationColour: 2,
  boothId: 3,
  workshopNote: 4,
  firstPanel: 5,
} as const;

export const DEFAULT_MASTER_SHEET_ID =
  "1aly6kRe_01ZDH_MnzaTtH6uVrqdsUX_p8AUAvt8EdO4";

export type BatchStatusSection = {
  factory: FactoryCode;
  dataStartRow: number;
  batch: number;
  status: number;
  model: number;
  number: number;
  colour: number | null;
  warehouseCode: string;
};

/** Column layout shared with Meavo Factory planning import. */
export const BATCH_STATUS_SECTIONS: BatchStatusSection[] = [
  {
    factory: "AKS",
    dataStartRow: 2,
    batch: 0,
    status: 1,
    model: 2,
    number: 3,
    colour: null,
    warehouseCode: "aksakovo",
  },
  {
    factory: "VAR",
    dataStartRow: 2,
    batch: 7,
    status: 8,
    model: 9,
    colour: 10,
    number: 11,
    warehouseCode: "varna",
  },
  {
    factory: "KAZ",
    dataStartRow: 2,
    batch: 17,
    status: 18,
    model: 19,
    colour: null,
    number: 20,
    warehouseCode: "kazanlak",
  },
];

const BATCH_CODE_RE: Record<FactoryCode, RegExp> = {
  AKS: /^AB\d+/i,
  VAR: /^VB\d+/i,
  KAZ: /^KB\d+/i,
};

export function batchCodeForFactory(
  code: string,
  factory: FactoryCode,
): boolean {
  return BATCH_CODE_RE[factory].test(code.trim());
}

export function isPlaceholderBatch(code: string): boolean {
  const c = code.trim().toUpperCase();
  return c === "ABXX" || c.includes("ENTER") || c.includes("MANUALLY");
}

export function masterSheetRowKey(
  factory: FactoryCode,
  batchCode: string,
): string {
  return `${factory}:${batchCode.trim().toUpperCase()}`;
}

export function mapSheetBatchStatus(
  raw: string,
): MrpManufacturingBatchStatus {
  const s = raw.trim().toLowerCase();
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  if (s === "in production" || s === "partially ready") return "in_production";
  return "planned";
}

export function parseSheetQty(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}
