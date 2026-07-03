import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { parseCsv, rowsToObjects } from "@/lib/import/csv";
import { db, schema } from "@/lib/db/client";

const DEFAULT_MASTER_DATA_SHEET_ID =
  "1YGDc0uuDF9DhSOV19JYceXqPmIL8tFfCmMNwlV0JwGQ";
const ELEMENT_BOM_TAB_GID = "51553840";

export type BomMissingMaterial = {
  code: string;
  bomLineCount: number;
};

async function listMaterialCodesInDb(): Promise<Set<string>> {
  const rows = await db
    .select({ code: schema.materials.code })
    .from(schema.materials)
    .where(eq(schema.materials.isActive, true));
  return new Set(
    rows.map((r) => r.code?.trim()).filter((c): c is string => Boolean(c)),
  );
}

function countBomCodes(
  codes: Iterable<string>,
  knownMaterialCodes: Set<string>,
): BomMissingMaterial[] {
  const counts = new Map<string, number>();
  for (const raw of codes) {
    const code = raw.trim();
    if (!code || knownMaterialCodes.has(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, bomLineCount]) => ({ code, bomLineCount }))
    .sort((a, b) => a.code.localeCompare(b.code, "bg"));
}

async function replaceBomMissingTable(missing: BomMissingMaterial[]) {
  await db.delete(schema.bomMissingMaterialCodes);
  if (missing.length === 0) return;

  await db.insert(schema.bomMissingMaterialCodes).values(
    missing.map((m) => ({
      code: m.code,
      bomLineCount: m.bomLineCount,
      updatedAt: new Date(),
    })),
  );
}

/** Recompute from ElementBOM CSV rows (import) or parsed file content. */
export async function syncBomMissingFromMaterialCodes(
  bomMaterialCodes: string[],
): Promise<BomMissingMaterial[]> {
  const known = await listMaterialCodesInDb();
  const missing = countBomCodes(bomMaterialCodes, known);
  await replaceBomMissingTable(missing);
  return missing;
}

/** Fetch master-data ElementBOM tab and diff against materials (public export). */
export async function syncBomMissingFromMasterSheet(): Promise<BomMissingMaterial[]> {
  const sheetId =
    process.env.GOOGLE_MASTER_DATA_SHEET_ID ?? DEFAULT_MASTER_DATA_SHEET_ID;
  const gid = process.env.GOOGLE_MASTER_DATA_BOM_GID ?? ELEMENT_BOM_TAB_GID;
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ElementBOM tab (${res.status})`);
  }

  const text = await res.text();
  const { headers, rows } = parseCsv(text);
  const objects = rowsToObjects(headers, rows);
  const codes = objects
    .map((r) => r.material_code?.trim())
    .filter((c): c is string => Boolean(c));

  return syncBomMissingFromMaterialCodes(codes);
}

export async function listBomMissingMaterials(): Promise<BomMissingMaterial[]> {
  const known = await listMaterialCodesInDb();
  const rows = await db
    .select()
    .from(schema.bomMissingMaterialCodes)
    .orderBy(asc(schema.bomMissingMaterialCodes.code));

  const staleCodes = rows
    .map((r) => r.code)
    .filter((code) => known.has(code));

  if (staleCodes.length > 0) {
    await db
      .delete(schema.bomMissingMaterialCodes)
      .where(inArray(schema.bomMissingMaterialCodes.code, staleCodes));
  }

  return rows
    .filter((r) => !known.has(r.code))
    .map((r) => ({ code: r.code, bomLineCount: r.bomLineCount }));
}

/** Remove resolved codes after materials are added. */
export async function clearBomMissingMaterialCodes(codes: string[]) {
  const trimmed = codes.map((c) => c.trim()).filter(Boolean);
  if (trimmed.length === 0) return;
  await db
    .delete(schema.bomMissingMaterialCodes)
    .where(inArray(schema.bomMissingMaterialCodes.code, trimmed));
}

/** Materials page: refresh from sheet, fall back to stored table. */
export async function refreshBomMissingMaterialsForUi(): Promise<BomMissingMaterial[]> {
  try {
    return await syncBomMissingFromMasterSheet();
  } catch {
    return listBomMissingMaterials();
  }
}
