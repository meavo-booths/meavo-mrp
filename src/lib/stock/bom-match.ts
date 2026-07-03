import type { BomConflict, BomLineInput, BoothMarket } from "@/lib/import/schemas";

export type ResolvedBomLine = {
  materialCode: string;
  colour: string | null;
  market: BoothMarket | null;
  quantity: string;
};

/** Workshop note on Опаковане col E — e.g. contains Америка. */
export function deriveBoothMarket(workshopNote: string | null | undefined): BoothMarket {
  const note = (workshopNote ?? "").toLowerCase();
  if (note.includes("америка") || note.includes("america")) return "US";
  return "default";
}

export function lineMatchesColour(
  lineColour: string | null,
  boothColour: string | null,
): boolean {
  if (lineColour === null) return true;
  if (!boothColour) return false;
  return lineColour === boothColour;
}

export function lineMatchesMarket(
  lineMarket: BoothMarket | null,
  boothMarket: BoothMarket,
): boolean {
  if (lineMarket === null) return true;
  return lineMarket === boothMarket;
}

/** Detect wildcard + specific overlap on the same material (invalid data). */
export function validateBomConflicts(lines: BomLineInput[]): BomConflict[] {
  const errors: BomConflict[] = [];
  const groups = new Map<string, BomLineInput[]>();

  for (const line of lines) {
    const key = `${line.boothModel}\0${line.element}\0${line.materialCode}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(line);
    groups.set(key, bucket);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const hasWildcardColour = group.some((l) => l.colour === null);
    const hasSpecificColour = group.some((l) => l.colour !== null);
    if (hasWildcardColour && hasSpecificColour) {
      for (const l of group) {
        errors.push({
          kind: "bom_conflict_colour",
          row: l.row,
          message: `Material ${l.materialCode}: mix of blank colour and specific colour on same element`,
        });
      }
    }

    const hasWildcardMarket = group.some((l) => l.market === null);
    const hasSpecificMarket = group.some((l) => l.market !== null);
    if (hasWildcardMarket && hasSpecificMarket) {
      for (const l of group) {
        errors.push({
          kind: "bom_conflict_market",
          row: l.row,
          message: `Material ${l.materialCode}: mix of blank market and default/US on same element`,
        });
      }
    }
  }

  return errors;
}

/**
 * Filter BOM lines for a booth unit; throws if multiple lines match the same material.
 */
export function resolveBomLines(
  lines: ResolvedBomLine[],
  boothColour: string | null,
  boothMarket: BoothMarket,
): ResolvedBomLine[] {
  const matching = lines.filter(
    (l) =>
      lineMatchesColour(l.colour, boothColour) &&
      lineMatchesMarket(l.market, boothMarket),
  );

  const byMaterial = new Map<string, ResolvedBomLine[]>();
  for (const line of matching) {
    const bucket = byMaterial.get(line.materialCode) ?? [];
    bucket.push(line);
    byMaterial.set(line.materialCode, bucket);
  }

  const result: ResolvedBomLine[] = [];
  for (const [materialCode, bucket] of byMaterial) {
    if (bucket.length > 1) {
      throw new Error(
        `BOM conflict: material ${materialCode} matched ${bucket.length} lines for colour=${boothColour ?? "any"} market=${boothMarket}`,
      );
    }
    result.push(bucket[0]!);
  }

  return result;
}

export function sumBomCostEur(
  lines: ResolvedBomLine[],
  unitPrices: Map<string, string | null>,
): number | null {
  let total = 0;
  let hasPrice = false;

  for (const line of lines) {
    const price = unitPrices.get(line.materialCode);
    if (price == null) continue;
    hasPrice = true;
    total += Number(line.quantity) * Number(price);
  }

  return hasPrice ? total : null;
}
