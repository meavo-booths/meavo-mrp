/** Split pasted or typed text into material codes (comma, semicolon, newline, tab). */
export function parseMaterialCodeList(text: string): string[] {
  return normalizeMaterialCodeList(
    text
      .split(/[,;\n\r\t]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

/** Trim and dedupe (first wins). */
export function normalizeMaterialCodeList(codes: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of codes) {
    const code = raw.trim();
    if (!code) continue;
    const key = code.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(code);
  }

  return result;
}
