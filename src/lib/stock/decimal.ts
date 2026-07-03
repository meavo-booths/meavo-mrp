/** Parse user/API numeric input into a fixed-scale decimal string for numeric columns. */
export function toDecimalString(value: string | number, scale = 4): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) {
    throw new Error("Invalid number");
  }
  return n.toFixed(scale);
}

export function addDecimal(a: string, b: string, scale = 4): string {
  return (Number(a) + Number(b)).toFixed(scale);
}
