// When a caller invents a tool name, the MCP SDK answers "Tool X not found"
// and nothing else — a dead end. The real case log shows this is not rare and
// not random: 13 of 590 calls named a tool that does not exist, and the guesses
// are near-misses that a list would have fixed instantly. `red_flags` when the
// tool is `red_flag`. `research_question` when it is `research`. `consult`
// when it is `ask_the_expert`.
//
// So the orchestrator answers the question the caller actually has — "then
// what IS it called?" — by naming every real tool, and pointing at the closest
// one when there is a plausible match. This lives apart from client-manager.ts
// so it can be tested as a pure function with no process to spawn.

/** Levenshtein distance, iterative single-row. Tool names are short. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[b.length];
}

const tokens = (name: string) => new Set(name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

/**
 * How close two tool names are, 0..1. Three signals, best one wins, because
 * the observed near-misses fail differently: `red_flags`/`red_flag` is a
 * one-character edit, `research_question`/`research` is containment, and
 * `property_lookup`/`property_investigation` shares a token but neither.
 */
export function nameSimilarity(guess: string, real: string): number {
  const a = guess.toLowerCase();
  const b = real.toLowerCase();
  if (a === b) return 1;

  const contains = a.includes(b) || b.includes(a) ? 0.8 : 0;

  const ta = tokens(a);
  const tb = tokens(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const overlap = shared === 0 ? 0 : shared / Math.max(ta.size, tb.size);

  const edit = 1 - editDistance(a, b) / Math.max(a.length, b.length);

  return Math.max(contains, overlap, edit);
}

// Below this, a "did you mean" is noise — the full tool list is the useful
// answer on its own, and a confidently wrong suggestion is worse than none.
const SUGGEST_FLOOR = 0.5;

/** The closest real tool name to a guess, or undefined when nothing is close. */
export function suggestTool(guess: string, available: string[]): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const real of available) {
    const score = nameSimilarity(guess, real);
    // Strictly greater keeps the FIRST of equally-close names, so the result
    // is stable against registry ordering rather than silently flipping.
    if (score > bestScore) {
      bestScore = score;
      best = real;
    }
  }
  return bestScore >= SUGGEST_FLOOR ? best : undefined;
}

/**
 * The replacement for a bare "Tool X not found". Always names every real tool,
 * because that is the fact the caller is missing; adds a suggestion only when
 * one is genuinely close.
 */
export function describeUnknownTool(asset: string, guess: string, available: string[]): string {
  if (available.length === 0) {
    return `${asset} has no tools registered, so "${guess}" cannot be called.`;
  }
  const suggestion = suggestTool(guess, available);
  const didYouMean = suggestion ? ` Did you mean "${suggestion}"?` : "";
  return `${asset} has no tool "${guess}".${didYouMean} Its tools are: ${available.join(", ")}.`;
}
