export const TOP_MATERIALS_MAX = 20;

/** Split pasted or typed text into material codes (comma, semicolon, newline, tab). */
export function parseMaterialCodeList(text: string): string[] {
  return normalizeMaterialCodeList(
    text
      .split(/[,;\n\r\t]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

/** Trim, dedupe (first wins), cap at max. */
export function normalizeMaterialCodeList(
  codes: string[],
  max = TOP_MATERIALS_MAX,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of codes) {
    const code = raw.trim();
    if (!code) continue;
    const key = code.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(code);
    if (result.length >= max) break;
  }

  return result;
}
