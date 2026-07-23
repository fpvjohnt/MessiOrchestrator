// check_practice / practice_verdict for prompt engineering. Core technique is
// fairly stable, but MODEL-SPECIFIC prompting guidance (especially for reasoning
// models) changes every model generation — so a "how should I prompt <model>"
// question is verified via research, not recalled.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "The model provider's own prompting guide — OpenAI, Anthropic, Google docs. Each model generation ships its own guidance (reasoning models especially differ). This is the source of truth for model-specific advice.",
  "Provider model cards / release notes — whether a model is a 'reasoning' model, its context window, and how it wants to be prompted.",
  "Peer-reviewed / arXiv for a TECHNIQUE's real effect (chain-of-thought, self-consistency, tree-of-thought) — read the actual result and its conditions.",
  "Reputable engineering write-ups WITH evals (before/after numbers on a real task), not a single cherry-picked example.",
];

const RED_FLAGS = [
  "A prompting tip from an old post applied to a new reasoning model — the exact behavior CoT scaffolding hurts on modern reasoning models.",
  "HYPE with no eval — 'this one prompt trick 10x'd my results' and not a single before/after number.",
  "'Magic words' framing ('just say you are an expert') sold as capability rather than a modest steering nudge.",
  "A technique claimed as universal when the paper showed it only on one task type.",
  "It's selling a prompt pack / course — a funnel, not evidence.",
];

export function checkPractice(rawTopic: string): string {
  const topic = clean(rawTopic);
  const year = new Date().getFullYear();
  return [
    `PRACTICE CHECK — "${topic}"`,
    `BOTTOM LINE: prompt TECHNIQUE is fairly stable, but MODEL-SPECIFIC guidance (especially reasoning models) changes each generation — verify this against the sources below, then call practice_verdict.`,
    ``,
    `CHECK THESE SOURCES:`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • "${topic}" prompting guide ${year} official`,
    `  • "${topic}" reasoning model OR extended thinking prompting`,
    `  • "${topic}" benchmark OR eval OR ablation`,
    `  • "${topic}" deprecated OR "no longer recommended"`,
    ``,
    `RED FLAGS to watch for in what comes back:`,
    ...RED_FLAGS.map((r) => `  - ${r}`),
    ``,
    `Once research reports back, call practice_verdict(topic, findings) for the graded, honest answer.`,
  ].join("\n");
}

export function practiceVerdict(rawTopic: string, findings: string): string {
  const topic = clean(rawTopic);
  const notes = clean(findings);
  return [
    `PRACTICE VERDICT — "${topic}"`,
    `BOTTOM LINE: grade how well-supported and how CURRENT this prompting guidance is — separate what a provider/paper actually recommends for the CURRENT model from folklore. Prefer the simplest technique that measurably helps.`,
    ``,
    `Findings reported: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `Evidence tiers, strongest to weakest:`,
    `  1. Provider-official + current — the model's own docs recommend it for THIS generation, and there's evidence it helps. Trust it.`,
    `  2. Documented technique, measured — a paper/eval shows the effect and its conditions; apply within those conditions.`,
    `  3. Plausible, unproven on your task — reasonable but not shown to beat the simpler option here. Try it behind your own eval.`,
    `  4. Folklore — 'magic words', 'longer is better', no numbers. Unverified.`,
    `  5. Outdated — advice for older models that hurts current (reasoning) models. Don't apply it.`,
    ``,
    `Two honest endings:`,
    `  • "The simpler prompt still wins" — often a clear zero-shot with a good format beats the elaborate technique. A real, valuable finding.`,
    `  • "It depends on the model" — reasoning vs standard models want different prompts; the right answer is the one that measurably wins on YOUR model + task.`,
    ``,
    `Label VERIFIED / UPDATED (guidance changed for the current model — give the corrected advice + source) / UNVERIFIED. Grade the evidence and recency, not the enthusiasm.`,
  ].join("\n");
}
