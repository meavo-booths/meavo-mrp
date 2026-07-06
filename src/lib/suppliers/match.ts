import "server-only";

import type { MrpSupplier } from "@prisma/client";

import { prisma } from "@/lib/prisma";
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

  let existing = null as MrpSupplier | null;

  if (input.vatNumber) {
    existing = await prisma.mrpSupplier.findFirst({
      where: { vatNumber: input.vatNumber },
    });
  }
  if (!existing && input.eik) {
    existing = await prisma.mrpSupplier.findFirst({
      where: { eik: input.eik },
    });
  }
  if (!existing && normalized) {
    existing = await prisma.mrpSupplier.findFirst({
      where: { normalizedName: normalized },
    });
  }

  if (existing) {
    // Backfill missing fields without overwriting good data.
    const patch: Partial<
      Pick<
        MrpSupplier,
        | "vatNumber"
        | "eik"
        | "countryCode"
        | "address"
        | "defaultCurrency"
        | "deliveryZone"
      >
    > = {};
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
      await prisma.mrpSupplier.update({
        where: { id: existing.id },
        data: { ...patch, updatedAt: new Date() },
      });
      existing = { ...existing, ...patch } as typeof existing;
    }
    return existing;
  }

  const country =
    input.countryCode ?? inferCountryFromVatNumber(input.vatNumber);
  const zone = inferDeliveryZoneFromCountryCode(country);

  const created = await prisma.mrpSupplier.create({
    data: {
      name: input.name ?? "(unknown supplier)",
      normalizedName: normalized || "(unknown supplier)",
      vatNumber: input.vatNumber,
      eik: input.eik,
      countryCode: country,
      address: input.address,
      defaultCurrency: input.defaultCurrency,
      deliveryZone: zone,
    },
  });

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
  return prisma.mrpSupplier.findMany({
    where: {
      OR: [
        { vatNumber: q },
        { eik: q },
        { normalizedName: norm },
      ],
    },
    take: limit,
  });
}
