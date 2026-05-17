/**
 * Utilities for flattening an {@link ExtractedDocument} into field paths
 * and diffing two extractions to record corrections.
 *
 * Path syntax:
 *   - Object access: `a.b.c`
 *   - Array access:  `a[0].b`
 */

export type FlatField = {
  path: string;
  value: unknown;
};

export function flatten(
  value: unknown,
  prefix = "",
  out: FlatField[] = [],
): FlatField[] {
  if (value === null || value === undefined) {
    out.push({ path: prefix, value });
    return out;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push({ path: prefix, value: [] });
      return out;
    }
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return out;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      out.push({ path: prefix, value: {} });
      return out;
    }
    for (const k of keys) {
      const next = prefix ? `${prefix}.${k}` : k;
      flatten(obj[k], next, out);
    }
    return out;
  }
  out.push({ path: prefix, value });
  return out;
}

export type Diff = {
  path: string;
  ai: unknown;
  user: unknown;
};

/** Compute differences between an AI extraction and the user-edited extraction. */
export function diffExtractions(
  ai: unknown,
  user: unknown,
): Diff[] {
  const aiFields = new Map(flatten(ai).map((f) => [f.path, f.value]));
  const userFields = new Map(flatten(user).map((f) => [f.path, f.value]));
  const allPaths = new Set([...aiFields.keys(), ...userFields.keys()]);
  const diffs: Diff[] = [];
  for (const p of allPaths) {
    const a = aiFields.get(p);
    const u = userFields.get(p);
    if (!equalShallow(a, u)) {
      diffs.push({ path: p, ai: a ?? null, user: u ?? null });
    }
  }
  return diffs;
}

function equalShallow(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  // Numbers from form inputs may arrive as strings; compare loosely.
  return String(a).trim() === String(b).trim();
}
