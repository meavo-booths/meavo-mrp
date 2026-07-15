import "server-only";

import { get, put } from "@vercel/blob";

import {
  normalizeMaterialCodeList,
  TOP_MATERIALS_MAX,
} from "@/lib/settings/parse-code-list";
import { prisma } from "@/lib/prisma";

const TOP_MATERIALS_PATH = "mrp/settings/top-materials.json";

type TopMaterialsConfig = {
  codes: string[];
  updatedAt: string;
  updatedBy?: string;
};

export type TopMaterialEntry = {
  code: string;
  name: string | null;
  materialId: string | null;
  found: boolean;
};

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function getTopMaterialCodes(): Promise<string[]> {
  if (!blobConfigured()) return [];

  try {
    const result = await get(TOP_MATERIALS_PATH, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return [];

    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as TopMaterialsConfig;
    return normalizeMaterialCodeList(parsed.codes ?? []);
  } catch {
    return [];
  }
}

export async function setTopMaterialCodes(
  codes: string[],
  updatedBy: string,
): Promise<string[]> {
  if (!blobConfigured()) {
    throw new Error("Top materials storage is not configured");
  }

  const normalized = normalizeMaterialCodeList(codes);
  const payload: TopMaterialsConfig = {
    codes: normalized,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await put(TOP_MATERIALS_PATH, JSON.stringify(payload, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return normalized;
}

function codeLookupKeys(code: string): string[] {
  const trimmed = code.trim();
  const keys = new Set<string>([trimmed.toLowerCase()]);
  if (/^\d+$/.test(trimmed)) {
    keys.add(trimmed.padStart(4, "0").toLowerCase());
    keys.add((trimmed.replace(/^0+/, "") || "0").toLowerCase());
  }
  return [...keys];
}

type MaterialRow = {
  id: string;
  code: string;
  name: string;
};

function buildMaterialLookup(materials: MaterialRow[]): Map<string, MaterialRow> {
  const lookup = new Map<string, MaterialRow>();
  for (const material of materials) {
    for (const key of codeLookupKeys(material.code)) {
      if (!lookup.has(key)) lookup.set(key, material);
    }
  }
  return lookup;
}

function resolveMaterial(
  code: string,
  lookup: Map<string, MaterialRow>,
): MaterialRow | null {
  for (const key of codeLookupKeys(code)) {
    const match = lookup.get(key);
    if (match) return match;
  }
  return null;
}

export async function getTopMaterialsDetail(): Promise<{
  entries: TopMaterialEntry[];
  max: number;
  storageConfigured: boolean;
}> {
  const codes = await getTopMaterialCodes();
  const materials = await prisma.mrpMaterial.findMany({
    where: { isActive: true, code: { not: null } },
    select: { id: true, code: true, name: true },
  });

  const lookup = buildMaterialLookup(
    materials.filter((m): m is MaterialRow => Boolean(m.code)),
  );

  const entries = codes.map((code) => {
    const material = resolveMaterial(code, lookup);
    return {
      code,
      name: material?.name ?? null,
      materialId: material?.id ?? null,
      found: Boolean(material),
    };
  });

  return {
    entries,
    max: TOP_MATERIALS_MAX,
    storageConfigured: blobConfigured(),
  };
}

export async function resolveTopMaterialIds(codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];

  const materials = await prisma.mrpMaterial.findMany({
    where: { isActive: true, code: { not: null } },
    select: { id: true, code: true },
  });

  const lookup = buildMaterialLookup(
    materials.filter((m): m is MaterialRow => Boolean(m.code)),
  );

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const code of codes) {
    const material = resolveMaterial(code, lookup);
    if (!material || seen.has(material.id)) continue;
    seen.add(material.id);
    ids.push(material.id);
  }
  return ids;
}
