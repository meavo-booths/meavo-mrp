/**
 * Helpers to determine the Bulgarian VAT delivery zone for a supplier.
 *
 * - "local"  : Bulgarian supplier (BG) — standard input VAT.
 * - "eu"     : Other EU/EEA member state — reverse-charge VAT.
 * - "non_eu" : Anything else — import (customs duty + import VAT at clearance).
 */

export type DeliveryZone = "local" | "eu" | "non_eu";

/** ISO-3166-1 alpha-2 codes for the EU 27 member states (as of 2024). */
const EU_COUNTRIES: ReadonlySet<string> = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

/**
 * Infer the delivery zone from a supplier country code.
 * Returns null when the country is unknown so the user can resolve it manually.
 */
export function inferDeliveryZoneFromCountryCode(
  countryCode: string | null | undefined,
): DeliveryZone | null {
  if (!countryCode) return null;
  const cc = countryCode.trim().toUpperCase();
  if (cc.length !== 2) return null;
  if (cc === "BG") return "local";
  if (EU_COUNTRIES.has(cc)) return "eu";
  return "non_eu";
}

/**
 * Best-effort country inference from a VAT number prefix, e.g. "BG123456789" → "BG".
 * Falls through to null when the prefix is not 2 letters.
 */
export function inferCountryFromVatNumber(
  vatNumber: string | null | undefined,
): string | null {
  if (!vatNumber) return null;
  const stripped = vatNumber.replace(/\s+/g, "");
  const m = /^([A-Za-z]{2})/u.exec(stripped);
  return m ? m[1].toUpperCase() : null;
}

export function isEuCountry(cc: string | null | undefined): boolean {
  return !!cc && EU_COUNTRIES.has(cc.toUpperCase());
}
