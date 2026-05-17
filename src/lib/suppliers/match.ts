import "server-only";

import { eq, or } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import {
  inferCountryFromVatNumber,
  inferDeliveryZoneFromCountryCode,
} from "@/lib/extractor/zone";

export type SupplierLookupInput = {
  name: string | null;
  vatNumber: string | null;
  eik: string | null;
  countryCode: string | null;
  address: string | null;
  defaultCurrency: string | null;
};

/**
 * Match an existing supplier by VAT or EIK; otherwise create a new one.
 * Always returns a supplier row.
 *
 * Matching priority:
 *  1. Exact VAT number match
 *  2. Exact EIK match
 *  3. Normalized name match (lowercased + trimmed) — last resort, may collide
 */
export async function findOrCreateSupplier(input: SupplierLookupInput) {
  const normalized = normalizeName(input.name);

  let existing = null as
    | typeof schema.suppliers.$inferSelect
    | null;

  if (input.vatNumber) {
    existing = (await db.query.suppliers.findFirst({
      where: eq(schema.suppliers.vatNumber, input.vatNumber),
    })) ?? null;
  }
  if (!existing && input.eik) {
    existing = (await db.query.suppliers.findFirst({
      where: eq(schema.suppliers.eik, input.eik),
    })) ?? null;
  }
  if (!existing && normalized) {
    existing = (await db.query.suppliers.findFirst({
      where: eq(schema.suppliers.normalizedName, normalized),
    })) ?? null;
  }

  if (existing) {
    // Backfill missing fields without overwriting good data.
    const patch: Partial<typeof schema.suppliers.$inferInsert> = {};
    if (!existing.vatNumber && input.vatNumber) patch.vatNumber = input.vatNumber;
    if (!existing.eik && input.eik) patch.eik = input.eik;
    if (!existing.countryCode && input.countryCode)
      patch.countryCode = input.countryCode;
    if (!existing.address && input.address) patch.address = input.address;
    if (!existing.defaultCurrency && input.defaultCurrency)
      patch.defaultCurrency = input.defaultCurrency;
    if (!existing.deliveryZone) {
      const zone =
        inferDeliveryZoneFromCountryCode(
          existing.countryCode ?? input.countryCode,
        ) ??
        inferDeliveryZoneFromCountryCode(
          inferCountryFromVatNumber(existing.vatNumber ?? input.vatNumber),
        );
      if (zone) patch.deliveryZone = zone;
    }
    if (Object.keys(patch).length > 0) {
      await db
        .update(schema.suppliers)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(schema.suppliers.id, existing.id));
      existing = { ...existing, ...patch } as typeof existing;
    }
    return existing;
  }

  const country =
    input.countryCode ?? inferCountryFromVatNumber(input.vatNumber);
  const zone = inferDeliveryZoneFromCountryCode(country);

  const [created] = await db
    .insert(schema.suppliers)
    .values({
      name: input.name ?? "(unknown supplier)",
      normalizedName: normalized || "(unknown supplier)",
      vatNumber: input.vatNumber,
      eik: input.eik,
      countryCode: country,
      address: input.address,
      defaultCurrency: input.defaultCurrency,
      deliveryZone: zone,
    })
    .returning();

  return created;
}

function normalizeName(name: string | null): string {
  if (!name) return "";
  return name
    .toLocaleLowerCase("bg-BG")
    .replace(/[\u00A0\s]+/g, " ")
    .replace(/[^\p{L}\p{N} .&-]+/gu, "")
    .trim();
}

/** For tests / scripts: search suppliers by VAT or normalized name. */
export async function searchSuppliersByVatOrName(query: string, limit = 10) {
  const q = query.trim();
  if (!q) return [];
  const norm = normalizeName(q);
  return db
    .select()
    .from(schema.suppliers)
    .where(
      or(
        eq(schema.suppliers.vatNumber, q),
        eq(schema.suppliers.eik, q),
        eq(schema.suppliers.normalizedName, norm),
      ),
    )
    .limit(limit);
}
