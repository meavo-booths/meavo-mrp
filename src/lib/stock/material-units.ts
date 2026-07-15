/** Zeron-aligned material units of measure. */
export const MRP_MATERIAL_UNITS = ["бр", "квм", "м", "л", "кг"] as const;

export type MrpMaterialUnit = (typeof MRP_MATERIAL_UNITS)[number];

export const MRP_MATERIAL_UNIT_SET = new Set<string>(MRP_MATERIAL_UNITS);

const UNIT_ALIASES: Record<string, MrpMaterialUnit> = {
  br: "бр",
  "бр.": "бр",
  pcs: "бр",
  pc: "бр",
  piece: "бр",
  pieces: "бр",
  ea: "бр",
  each: "бр",
  unit: "бр",
  units: "бр",
  броя: "бр",
  kg: "кг",
  "кг.": "кг",
  kilogram: "кг",
  kilograms: "кг",
  kilo: "кг",
  kvm: "квм",
  sqm: "квм",
  m2: "квм",
  "m²": "квм",
  "m^2": "квм",
  "кв.м": "квм",
  "кв. м": "квм",
  "sq m": "квм",
  "square meter": "квм",
  "square meters": "квм",
  m: "м",
  "м.": "м",
  meter: "м",
  meters: "м",
  metre: "м",
  metres: "м",
  l: "л",
  lt: "л",
  "л.": "л",
  liter: "л",
  liters: "л",
  litre: "л",
  litres: "л",
};

export const INVALID_MATERIAL_UNIT_ERROR =
  "Invalid unit. Allowed: бр, квм, м, л, кг";

export const DEFAULT_MATERIAL_UNIT: MrpMaterialUnit = "бр";

export type MaterialUnitSource = "manual" | "zeron";

export type ResolvedMaterialUnit = {
  unit: string;
  /** True when the stored unit is not one of the canonical Zeron units. */
  flagged: boolean;
};

export function isCanonicalMaterialUnit(unit: string): unit is MrpMaterialUnit {
  return MRP_MATERIAL_UNIT_SET.has(unit);
}

function aliasKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map free-text or alias to a canonical Zeron unit, or null if unknown. */
export function normalizeMaterialUnit(raw: string): MrpMaterialUnit | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isCanonicalMaterialUnit(trimmed)) return trimmed;

  const compact = aliasKey(trimmed).replace(/\s+/g, "");
  const spaced = aliasKey(trimmed);
  return UNIT_ALIASES[compact] ?? UNIT_ALIASES[spaced] ?? null;
}

/**
 * Resolve a unit for persistence.
 * Manual sources reject unknown units; Zeron accepts them and sets `flagged`.
 */
export function resolveMaterialUnit(
  raw: string,
  source: MaterialUnitSource,
): ResolvedMaterialUnit | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (source === "zeron") {
      return { unit: DEFAULT_MATERIAL_UNIT, flagged: false };
    }
    return null;
  }

  const normalized = normalizeMaterialUnit(trimmed);
  if (normalized) {
    return { unit: normalized, flagged: false };
  }

  if (source === "zeron") {
    return { unit: trimmed, flagged: true };
  }

  return null;
}

export function parseMaterialUnit(raw: string): MrpMaterialUnit {
  const resolved = resolveMaterialUnit(raw, "manual");
  if (!resolved) {
    throw new Error(INVALID_MATERIAL_UNIT_ERROR);
  }
  return resolved.unit as MrpMaterialUnit;
}
