/** Convenience wrappers around Intl for the two project locales. */

const dateOptionsShort: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

export function formatDate(
  value: Date | string | null | undefined,
  locale: string,
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, dateOptionsShort).format(d);
}

export function formatMoney(
  value: string | number | null | undefined,
  currency: string | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  if (!currency) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function formatQuantity(
  value: string | number | null | undefined,
  locale: string,
  unit?: string | null,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
  }).format(n);
  return unit ? `${formatted} ${unit}` : formatted;
}
