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
  // Loose contains-match, LONGEST key first so a specific alias beats a generic
  // one (AGENTS.md: "longest key wins"). This used to be .find(), which returns
  // whichever key happened to be DECLARED first — object insertion order is not
  // a ranking, so a 3-char generic key could silently beat a 20-char specific one.
  const hit = Object.entries(table)
    .filter(([k]) => k.includes(norm) || norm.includes(k))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? { key: hit[0], value: hit[1] } : undefined;
}

// Turn a snake_case canonical key into a clean display heading.
export function displayKey(key: string): string {
  return key.replace(/_/g, " ").toUpperCase();
}
