import { CLUSTERS, resolveCluster } from "./clusters.js";

// Two-step, same shape as nestegg's analyze_asset/score_signals: build_it hands
// out the plan + relevant clusters + the exact research queries/sources to
// verify the CURRENT stack (tools move fast — don't guess); finalize_build
// turns what research found into an actual architecture + first step + risks.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

// Pure grammatical glue that must not score a cluster match on its own.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "our",
  "what", "how", "who", "when", "where", "will", "would", "should", "could",
  "have", "has", "had", "not", "are", "was", "were", "can", "any", "all",
  "system", "systems", "something", "someone", "team", "boss", "project",
]);
// Short domain tokens that would otherwise be dropped by a length floor.
const SHORT_TOKENS = new Set(["ai", "ml", "bi", "cv", "go", "k8s"]);

// Fold plurals so "dashboard" hits "dashboards" ("ss" guard keeps words like
// "access" intact).
function stem(w: string): string {
  return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}

function tokenize(text: string): Set<string> {
  const raw = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return new Set(
    raw.filter((w) => (w.length > 2 || SHORT_TOKENS.has(w)) && !STOPWORDS.has(w)).map(stem)
  );
}

const MIN_SCORE = 2; // require real signal, not one stray word, before claiming a cluster

// Precompute each cluster's haystacks and every token's cluster-frequency.
// Two tiers: VOCAB words are hand-picked routing signals ("tableau",
// "freezing", "pitch") and score double; GENERAL words come from the label/
// description/tools/titles and score single. Words that show up across half
// the clusters or more ("senior", "analyst", "engineer") prove nothing about
// WHICH cluster a question belongs to, so they score zero.
const VOCAB_HAYSTACKS: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(CLUSTERS).map(([key, c]) => [key, tokenize(c.vocabulary.join(" "))])
);
const GENERAL_HAYSTACKS: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(CLUSTERS).map(([key, c]) => [
    key,
    tokenize(`${c.label} ${c.what} ${c.core_tools.join(" ")} ${c.titles.join(" ")}`),
  ])
);
const CLUSTER_FREQ = new Map<string, number>();
for (const key of Object.keys(CLUSTERS)) {
  const combined = new Set([...VOCAB_HAYSTACKS[key], ...GENERAL_HAYSTACKS[key]]);
  for (const w of combined) CLUSTER_FREQ.set(w, (CLUSTER_FREQ.get(w) ?? 0) + 1);
}
const GENERIC_FREQ = Math.ceil(Object.keys(CLUSTERS).length / 2);

export function matchClusters(idea: string): Array<{ key: string; score: number }> {
  const words = tokenize(idea);
  const scored = Object.keys(CLUSTERS).map((key) => {
    let score = 0;
    for (const w of words) {
      if ((CLUSTER_FREQ.get(w) ?? 0) >= GENERIC_FREQ) continue; // non-discriminative
      // Vocabulary words and strong short domain tokens (ai/ml/bi/...) are
      // deliberate signals worth double; incidental description words single.
      if (VOCAB_HAYSTACKS[key].has(w)) score += 2;
      else if (GENERAL_HAYSTACKS[key].has(w)) score += SHORT_TOKENS.has(w) ? 2 : 1;
    }
    return { key, score };
  });
  const hits = scored.filter((s) => s.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
  // A secondary cluster rides along only if it's genuinely competitive with
  // the top match, not just barely over the floor while the leader dominates.
  return hits.filter((s, i) => i === 0 || s.score * 2 >= hits[0].score);
}

export function buildIt(rawIdea: string, clusterHint?: string): string {
  const idea = clean(rawIdea);
  const hinted = clusterHint ? resolveCluster(clusterHint) : undefined;
  let matched = hinted ? [hinted] : matchClusters(idea).slice(0, 2).map((m) => m.key);
  if (matched.length === 0) {
    return `BUILD PLAN — ${idea}\n\nCouldn't confidently map this to a cluster. Tell me which domain it's closest to (${Object.keys(CLUSTERS).join(", ")}) with cluster_hint, and I'll build the plan.`;
  }

  const blocks = matched.map((key) => {
    const c = CLUSTERS[key];
    return [
      `▶ ${c.label}`,
      `  Likely stack: ${c.core_tools.join(", ")}`,
      `  Starting shape: ${c.project_seed}`,
    ].join("\n");
  });

  const queries = [
    `"${idea}" best practices 2026`,
    ...matched.map((key) => `current recommended stack for ${CLUSTERS[key].label.toLowerCase()} projects 2026`),
  ];

  return [
    `BUILD PLAN — ${idea}`,
    `BOTTOM LINE: this touches ${matched.map((k) => CLUSTERS[k].label).join(" + ")}. Here's the likely stack — verify it's still current before committing (tools move fast).`,
    ``,
    blocks.join("\n\n"),
    ``,
    `VERIFY CURRENT STACK — have research run these, then call finalize_build with what it finds:`,
    ...queries.map((q) => `  • ${q}`),
    ``,
    `Once verified, call finalize_build(idea, findings) for the actual architecture + first step + risks.`,
  ].join("\n");
}

export function finalizeBuild(rawIdea: string, findings: string): string {
  const idea = clean(rawIdea);
  const notes = clean(findings);
  return [
    `BUILD PLAN, FINALIZED — ${idea}`,
    `BOTTOM LINE: use the verified findings below to lock the stack, then start with the smallest end-to-end slice, not the whole system.`,
    ``,
    `Verified findings: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `First step: build the thinnest possible version that goes end-to-end (one input → one output), THEN add the parts that made it "real" (auth, monitoring, scale). Your own MCP work followed exactly this — one server, one tool, working, before the 14-server ecosystem.`,
    ``,
    `Risks to watch: stack drift (re-verify every few months — this space moves fast), scope creep (cut to the smallest real version), and skipping monitoring/logging until something breaks (add it from day one, it's cheap early and expensive late).`,
  ].join("\n");
}
