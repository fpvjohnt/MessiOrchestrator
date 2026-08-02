import type { Case } from "./types.js";

// Routing drift: when questions that are essentially THE SAME get routed to
// DIFFERENT assets across cases, the system's behavior changed under you —
// maybe a fix (good), maybe a regression (bad). Either way you want to see it.
//
// "Essentially the same" is decided by token-set overlap of the objectives —
// no embeddings, no model call, fully deterministic. Cheap and honest: it
// won't catch paraphrases with no shared words, and it says so.
//
// It used to use JACCARD (inter / union), which was measurably blind. Jaccard
// punishes a LENGTH difference as if it were a TOPIC difference: the union is
// dominated by whichever objective is longer, so a short objective can never
// score high against a detailed one no matter how identical the subject. On
// the real 107-case log that made the whole report useless — it printed
// "nothing to check yet" while the log held quantum physics asked 3 times.
// Measured on those three: jaccard 0.07 / 0.31 / 0.08, all under the 0.6 bar.
//
// CONTAINMENT (inter / min(|a|,|b|)) asks the right question instead: "is the
// smaller question essentially a subset of the bigger one?" Same three pairs:
// 0.67 / 1.00 / 1.00. The threshold did not move — the metric was wrong.

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "our", "her", "his",
  "what", "how", "who", "when", "where", "why", "which", "would", "should", "could", "can",
  "have", "has", "had", "not", "are", "was", "were", "will", "any", "all", "you", "get",
  "how", "much", "need", "want", "know", "like", "one", "two", "out", "its", "about",
]);

// Framing vocabulary — HOW the answer was requested, not WHAT was asked. These
// words dominate this user's objectives ("explain X in plain language for a
// beginner") and made two unrelated questions look similar while two phrasings
// of the SAME question looked different. Dropping them is what separates the
// quantum trio (0.67-1.00) from merely-same-topic pairs like the six Tesla
// cases (0.07-0.46), which are genuinely different questions and must NOT merge.
const FRAMING = new Set([
  "explain", "explains", "simple", "simply", "plain", "language", "terms", "term",
  "beginner", "beginners", "understand", "learner", "curious", "short", "brief",
  "overview", "give", "given", "need", "needs", "help", "identify", "find",
  "current", "best", "step", "steps", "guide", "using", "use", "real", "actual",
  "actually", "level", "total", "someone", "people", "person", "science",
  "background", "first", "time", "learning", "well", "sourced", "broad", "core",
  "major", "summarize", "summary", "research", "report", "detail", "details",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !FRAMING.has(w))
  );
}

// Containment / overlap coefficient. Length-robust by construction: the
// denominator is the SMALLER set, so "quantum physics, simply" scores against
// a 40-word quantum brief on shared subject matter alone.
function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

// Assets as an order-independent signature so ["a","b"] and ["b","a"] match,
// but ["a"] and ["a","b"] are correctly different.
function assetSig(c: Case): string {
  return [...c.assignedAssets].sort().join("+") || "(none)";
}

interface Group {
  rep: Set<string>;
  label: string;
  cases: Case[];
}

export function detectRoutingDrift(cases: Case[], threshold = 0.6, minGroup = 2): string {
  // Deterministic: cluster in chronological order so the timeline reads
  // oldest-first and grouping doesn't depend on file order.
  const sorted = [...cases].sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const groups: Group[] = [];
  for (const c of sorted) {
    const t = tokens(c.objective);
    if (t.size === 0) continue; // nothing to compare on
    const hit = groups.find((g) => containment(t, g.rep) >= threshold);
    if (hit) hit.cases.push(c);
    else groups.push({ rep: t, label: c.objective, cases: [c] });
  }

  const repeated = groups.filter((g) => g.cases.length >= minGroup);
  const drifted = repeated.filter((g) => new Set(g.cases.map(assetSig)).size > 1);

  const header = [
    `ROUTING DRIFT REPORT (similarity ≥ ${threshold}, group size ≥ ${minGroup})`,
    `Scanned ${cases.length} case(s): ${repeated.length} group(s) of similar questions, ${drifted.length} show routing drift.`,
  ];

  if (drifted.length === 0) {
    return [
      ...header,
      ``,
      repeated.length === 0
        ? `No question was asked more than once similarly enough to compare — nothing to check yet.\n` +
          `Coverage caveat: grouping is subject-word containment, so a genuine repeat worded with NO shared\n` +
          `subject words is invisible here. "Nothing to check" means nothing DETECTED, not nothing happened.`
        : `Every repeated question routed consistently. No drift.`,
    ].join("\n");
  }

  const blocks = drifted.map((g) => {
    const label = g.label.length > 70 ? `${g.label.slice(0, 70)}…` : g.label;
    const lines = g.cases.map((c) => `    ${c.openedAt.slice(0, 10)}  →  ${assetSig(c)}   [${c.id.slice(0, 8)}]`);
    const sigs = [...new Set(g.cases.map(assetSig))];
    return [`▶ "${label}"`, `  routed ${sigs.length} different ways across ${g.cases.length} cases:`, ...lines].join("\n");
  });

  return [
    ...header,
    ``,
    ...blocks,
    ``,
    `Read each block top-to-bottom (oldest first): a change in the arrow's right side is the drift. If the newest routing is the one you want, the drift was a fix — otherwise it's a regression to investigate with replay_case.`,
  ].join("\n");
}
