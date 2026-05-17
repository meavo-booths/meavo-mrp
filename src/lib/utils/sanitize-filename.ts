/**
 * Replace anything that isn't `[A-Za-z0-9._-]` with `_`. Result is safe to use
 * as a Supabase Storage object name segment.
 */
export function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  const safe = trimmed.replace(/[^A-Za-z0-9._-]+/g, "_");
  return safe.replace(/^_+|_+$/g, "") || "file";
}
