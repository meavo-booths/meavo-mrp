const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return EMAIL_PATTERN.test(email);
}

/** Split pasted text into email addresses. */
export function parseEmailList(text: string): string[] {
  return normalizeEmailList(
    text
      .split(/[,;\n\r\t\s]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

export function normalizeEmailList(
  emails: string[],
  max = 50,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email || !isValidEmail(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    result.push(email);
    if (result.length >= max) break;
  }

  return result;
}
