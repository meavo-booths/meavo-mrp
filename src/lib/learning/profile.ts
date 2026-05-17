import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import type { SupplierProfileHints } from "@/lib/extractor/types";

const RECENT_EXAMPLES_CAP = 5;
const HINT_THRESHOLD = 3; // a recurring correction must occur this many times to become a hint

/**
 * Load the supplier-specific extraction context (hints + recent examples)
 * to seed the AI prompt as few-shot context.
 */
export async function loadSupplierProfileHints(
  supplierId: string,
): Promise<SupplierProfileHints | undefined> {
  const supplier = await db.query.suppliers.findFirst({
    where: eq(schema.suppliers.id, supplierId),
  });
  if (!supplier) return undefined;

  const profile = await db.query.supplierExtractionProfiles.findFirst({
    where: eq(schema.supplierExtractionProfiles.supplierId, supplierId),
  });

  return {
    supplierName: supplier.name,
    hints: (profile?.hints as Record<string, unknown> | undefined) ?? {},
    recentExamples:
      (profile?.recentExamples as Array<Record<string, unknown>> | undefined) ??
      [],
  };
}

/**
 * Append an approved extraction to the supplier's recent examples (FIFO,
 * capped at {@link RECENT_EXAMPLES_CAP}). Mines the recent correction logs to
 * promote repeat fixes into prompt hints.
 */
export async function recordApprovedExtraction(opts: {
  supplierId: string;
  finalExtraction: Record<string, unknown>;
}) {
  const { supplierId, finalExtraction } = opts;

  const existing = await db.query.supplierExtractionProfiles.findFirst({
    where: eq(schema.supplierExtractionProfiles.supplierId, supplierId),
  });

  const prevExamples = ((existing?.recentExamples as unknown[]) ?? []) as Record<
    string,
    unknown
  >[];
  const nextExamples = [...prevExamples, finalExtraction].slice(
    -RECENT_EXAMPLES_CAP,
  );

  const correctionRows = await db.query.correctionLogs.findMany({
    where: eq(schema.correctionLogs.supplierId, supplierId),
    limit: 500,
  });

  const hints = mineHintsFromCorrections(
    (existing?.hints as Record<string, unknown> | undefined) ?? {},
    correctionRows,
  );

  if (existing) {
    await db
      .update(schema.supplierExtractionProfiles)
      .set({
        recentExamples: nextExamples,
        hints,
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierExtractionProfiles.supplierId, supplierId));
  } else {
    await db.insert(schema.supplierExtractionProfiles).values({
      supplierId,
      recentExamples: nextExamples,
      hints,
    });
  }
}

/**
 * Build a `hints` object from correction log entries.
 * If the same field has been changed to the same value `HINT_THRESHOLD`+ times
 * by users, surface that as a hint to the model in future extractions.
 */
function mineHintsFromCorrections(
  current: Record<string, unknown>,
  rows: Array<{
    fieldPath: string;
    aiValue: unknown;
    userValue: unknown;
  }>,
): Record<string, unknown> {
  const tally = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const path = row.fieldPath;
    const v = row.userValue;
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue; // only scalars qualify as a hint
    const key = String(v);
    const inner = tally.get(path) ?? new Map<string, number>();
    inner.set(key, (inner.get(key) ?? 0) + 1);
    tally.set(path, inner);
  }

  const hints: Record<string, unknown> = { ...current };
  for (const [path, inner] of tally) {
    let bestVal: string | null = null;
    let bestCount = 0;
    for (const [val, count] of inner) {
      if (count > bestCount) {
        bestCount = count;
        bestVal = val;
      }
    }
    if (bestVal != null && bestCount >= HINT_THRESHOLD) {
      hints[path] = bestVal;
    } else {
      // Stop suggesting outdated values that no longer dominate.
      delete hints[path];
    }
  }
  return hints;
}
