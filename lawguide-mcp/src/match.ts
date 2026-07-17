// Shared lookup: exact match first, then substring — but only for inputs of 3+
// chars, so "s"/"k" can't silently match the wrong entry. Returns the CANONICAL
// key alongside the value so callers render headings from the matched key, not
// the raw (possibly attacker-crafted) input.
export function fuzzyFind<T>(
  table: Record<string, T>,
  rawInput: string
): { key: string; value: T } | undefined {
  const norm = rawInput.toLowerCase().trim().replace(/[\s-]+/g, "_");
  // Object.hasOwn so inherited keys ("constructor", "__proto__", "toString")
  // can't resolve to a Object.prototype member and leak garbage/throw.
  if (Object.hasOwn(table, norm)) return { key: norm, value: table[norm] };
  if (norm.length < 3) return undefined; // too short to fuzzy-match safely
  const hit = Object.entries(table).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit ? { key: hit[0], value: hit[1] } : undefined;
}

// Turn a snake_case canonical key into a clean display heading.
export function displayKey(key: string): string {
  return key.replace(/_/g, " ").toUpperCase();
}
