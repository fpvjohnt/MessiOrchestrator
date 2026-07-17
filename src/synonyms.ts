// Deterministic "semantic-lite" layer: a curated concept map that lets natural
// phrasing reach the canonical tag an asset actually carries. "cops"/"custody"
// → police, "stressed"/"overwhelmed" → anxiety, "leasing" → rent. This is a
// hand-built thesaurus, NOT a model — it stays offline, deterministic, and
// testable (the whole system's design principle), unlike embedding matching
// which would add a model dependency and break routing determinism.
//
// Each canonical MUST be a real tag on the asset that should win, or the
// mapping matches nothing. Surface forms are stored in already-stemmed form
// where the plural stemmer would produce it (cops→cop), plus raw where it
// won't (freezing).

const CONCEPTS: Record<string, string[]> = {
  // lawguide 'police'
  police: ["cop", "officer", "detained", "custody", "arrested"],
  // lawguide 'sued'
  sued: ["sue", "suing"],
  // homebuyer 'rent'
  rent: ["renting", "leasing", "lease", "leased"],
  // polymath 'crash'
  crash: ["freeze", "freezing", "frozen", "hang", "hanging", "lockup", "unresponsive"],
  // healthguide 'anxiety'
  anxiety: ["anxious", "stressed", "overwhelmed", "panic"],
  // nestegg 'crypto'
  crypto: ["coin", "bitcoin"],
  // polymath 'sql' — "turn my database into a report". Unambiguously technical,
  // no cross-domain collision (unlike "screening", which health also uses).
  sql: ["database"],
};

const SURFACE_TO_CANON = new Map<string, string>();
for (const [canon, surfaces] of Object.entries(CONCEPTS)) {
  for (const s of surfaces) SURFACE_TO_CANON.set(s, canon);
}

/** Expand a query's tokens with the canonical concept for any colloquial
 * surface form present. Query-side only: asset tags are already canonical. */
export function expandConcepts(tokens: Iterable<string>): Set<string> {
  const out = new Set(tokens);
  for (const t of tokens) {
    const canon = SURFACE_TO_CANON.get(t);
    if (canon) out.add(canon);
  }
  return out;
}
