import "server-only";

import { upsertMaterialFromZeron } from "@/lib/zeron/materials";

export type ZeronInboundProcessResult = {
  materialsUpserted: number;
  materialsCreated: number;
  flaggedUnits: number;
};

function readString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = obj[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function readPrice(obj: Record<string, unknown>): string | null {
  const raw = readString(
    obj,
    "unitPriceEur",
    "unit_price_eur",
    "UnitPriceEur",
    "UnitPrice",
    "unitPrice",
    "price",
    "Price",
  );
  return raw || null;
}

function extractMaterialRows(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];

  const obj = data as Record<string, unknown>;
  const arrayKeys = [
    "materials",
    "Materials",
    "items",
    "Items",
    "nomenclature",
    "Nomenclature",
    "articles",
    "Articles",
  ];

  for (const key of arrayKeys) {
    const value = obj[key];
    if (!Array.isArray(value)) continue;
    return value.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row),
    );
  }

  if (
    readString(
      obj,
      "code",
      "Code",
      "materialCode",
      "MaterialCode",
      "sku",
      "SKU",
    )
  ) {
    return [obj];
  }

  return [];
}

function toMaterialInput(row: Record<string, unknown>) {
  const code = readString(
    row,
    "code",
    "Code",
    "materialCode",
    "MaterialCode",
    "sku",
    "SKU",
  );
  if (!code) return null;

  return {
    code,
    name: readString(row, "name", "Name", "description", "Description") || null,
    unit: readString(row, "unit", "Unit", "measureUnit", "MeasureUnit") || null,
    unitPriceEur: readPrice(row),
  };
}

/**
 * Best-effort JSON parse for Zeron inbound payloads.
 * Unknown units are stored as-is and surfaced via the invalid-units banner.
 */
export async function processZeronInboundPayload(input: {
  body: string;
  contentType: string;
}): Promise<ZeronInboundProcessResult | null> {
  const contentType = input.contentType.toLowerCase();
  if (!contentType.includes("json")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    return null;
  }

  const rows = extractMaterialRows(parsed);
  if (rows.length === 0) return null;

  const result: ZeronInboundProcessResult = {
    materialsUpserted: 0,
    materialsCreated: 0,
    flaggedUnits: 0,
  };

  for (const row of rows) {
    const material = toMaterialInput(row);
    if (!material) continue;

    try {
      const upserted = await upsertMaterialFromZeron(material);
      result.materialsUpserted++;
      if (upserted.created) result.materialsCreated++;
      if (upserted.flaggedUnit) result.flaggedUnits++;
    } catch (err) {
      console.warn("[zeron:inbound] skipped material row:", {
        code: material.code,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result.materialsUpserted > 0 ? result : null;
}
