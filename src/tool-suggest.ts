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

  // Containment scaled by how much of the longer name is actually shared.
  // A flat 0.8 meant ANY substring cleared the floor, so a one-character guess
  // got a confident answer: "a" -> "affordability", "s" -> "set_profile". That
  // is precisely the confidently-wrong suggestion this file exists to avoid.
  const contains =
    a.includes(b) || b.includes(a)
      ? 0.9 * (Math.min(a.length, b.length) / Math.max(a.length, b.length))
      : 0;

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

// INTENT SYNONYMS — the failure mode spelling alone cannot reach.
//
// The three signals above are all TEXTUAL, so they only catch a guess that
// looks like the answer. Measured against export_failures, the residue is
// guesses that are semantically right and textually unrelated: `consult` for
// `ask_the_expert` shares not one character, and scores 0.0 on all three.
// This file's own header has named that exact case since it was written, and
// it still went unsuggested three times — most recently today.
//
// Each group is a set of interchangeable words. A guess and a real tool that
// land in the SAME group are near-certainly the same intent. Grounded strictly
// in the guesses that actually occurred (overseer's export_failures,
// failure_class="unknown_tool"); do not add speculative pairs, and add a group
// only after a real call has missed because it was absent.
const INTENT_GROUPS: string[][] = [
  ["consult", "ask", "advice", "advise", "expert", "question"],
  ["career", "gap", "level", "ladder", "advance", "progression"],
  ["misinformation", "misleading", "myth", "red", "flag", "flags"],
  ["list", "tools", "index", "start", "help", "here"],
  ["lookup", "look", "find", "search", "investigation", "investigate", "property"],
  // communication.read_body_language -> read_people. Observed 2026-07-26: the
  // guess shares only the generic token "read" (0.33, under the floor), so
  // spelling alone could not reach it.
  ["read", "people", "body", "language", "nonverbal", "bodylanguage"],
  // research.verify -> research. Observed 2026-07-26. Also lets a bare "verify"
  // reach an asset's *_verdict half, which is the step callers skip most.
  ["verify", "verdict", "research", "corroborate", "confirm", "factcheck"],
  // The GENERIC-VERB class, and the last unhandled group in export_failures.
  // Callers reach for a bare verb that no asset actually exposes — psychology
  // .analyze (real: explain_topic), communication.analyze (explain_skill),
  // curiosity.analyze (explore). All three score 0.0 on every textual signal
  // because a one-word guess shares no spelling with a two-word tool name.
  //
  // This is the single most repeated shape in the corpus: four of the eleven
  // unknown_tool rows are one of two verbs, aimed at four different assets. The
  // guess is never wrong about INTENT — it is asking the explainer to explain —
  // only about this registry's naming convention.
  ["analyze", "analyse", "explain", "explore", "topic", "skill", "describe"],
  // polymath.answer -> ask_the_expert. Same shape, the other verb. Folded into
  // the existing consult/ask group rather than a new one, because "answer my
  // question" and "ask the expert" are the same request from the two ends.
  ["answer", "respond", "consult", "ask", "expert", "question"],
];

/** 0.6 when guess and real share an intent group — above the floor, below a real textual match. */
function intentSimilarity(guess: string, real: string): number {
  const g = tokens(guess);
  const r = tokens(real);
  for (const group of INTENT_GROUPS) {
    const gHit = [...g].some((t) => group.includes(t));
    const rHit = [...r].some((t) => group.includes(t));
    if (gHit && rHit) return 0.6;
  }
  return 0;
}

/** The closest real tool name to a guess, or undefined when nothing is close. */
export function suggestTool(guess: string, available: string[]): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const real of available) {
    // Textual match wins outright when present; intent only fills the gap it
    // leaves, so a spelling near-miss is never overridden by a synonym.
    const score = Math.max(nameSimilarity(guess, real), intentSimilarity(guess, real));
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
