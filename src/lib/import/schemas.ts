import { z } from "zod";

export const MATERIALS_COLUMNS = [
  "code",
  "name",
  "unit",
  "unit_price_eur",
] as const;

export const OPENING_STOCK_COLUMNS = [
  "material_code",
  "warehouse",
  "quantity",
  "count_date",
  "counted_through_batch",
  "notes",
] as const;

export const ELEMENTS_COLUMNS = [
  "booth_model",
  "sheet_header",
  "simple_name",
  "sort_order",
  "active",
] as const;

export const ELEMENT_BOM_COLUMNS = [
  "booth_model",
  "colour",
  "market",
  "element",
  "material_code",
  "quantity",
  "notes",
] as const;

export type BoothMarket = "default" | "US";

export function parseOptionalColour(raw: string): string | null {
  const v = raw.trim();
  if (!v || v === "*") return null;
  return v;
}

/** Blank = both markets; do not normalize to default. */
export function parseMarket(raw: string): BoothMarket | null {
  const v = raw.trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper === "US") return "US";
  if (v.toLowerCase() === "default") return "default";
  throw new Error(`Invalid market "${raw}" — use blank, default, or US`);
}

export function parseBoolean(raw: string, defaultValue = true): boolean {
  const v = raw.trim().toUpperCase();
  if (!v) return defaultValue;
  if (v === "TRUE" || v === "1" || v === "YES") return true;
  if (v === "FALSE" || v === "0" || v === "NO") return false;
  throw new Error(`Invalid boolean "${raw}"`);
}

export function parseQuantity(raw: string): string {
  const v = raw.trim().replace(",", ".");
  if (!v) throw new Error("Quantity is required");
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid quantity "${raw}"`);
  return n.toFixed(4);
}

export function parseOptionalQuantity(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  return parseQuantity(v);
}

export function parseOptionalPrice(raw: string): string | null {
  const v = raw.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid price "${raw}"`);
  return n.toFixed(4);
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** ISO, European numeric, or "8 Jun 2026" style. */
export function parseCountDate(raw: string): Date {
  const v = raw.trim();
  if (!v) return new Date();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T12:00:00.000Z`);
  }

  const numeric = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = Number(numeric[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid date "${raw}"`);
    }
    const d = new Date(Date.UTC(year, month - 1, day, 12));
    if (
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() !== month - 1 ||
      d.getUTCDate() !== day
    ) {
      throw new Error(`Invalid date "${raw}"`);
    }
    return d;
  }

  const m = v.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const monKey = m[2]!.slice(0, 3).toLowerCase();
    const year = Number(m[3]);
    const month = MONTHS[monKey];
    if (!month) throw new Error(`Invalid date "${raw}"`);
    return new Date(Date.UTC(year, month - 1, day, 12));
  }

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date "${raw}"`);
  return d;
}

export const MaterialRowSchema = z.object({
  code: z.string().min(1),
  name: z.string(),
  unit: z.string(),
  unit_price_eur: z.string(),
});

export type BomLineInput = {
  row: number;
  boothModel: string;
  element: string;
  materialCode: string;
  colour: string | null;
  market: BoothMarket | null;
  quantity: string;
};

export type BomConflict = {
  kind: "bom_conflict_colour" | "bom_conflict_market";
  row: number;
  message: string;
};
