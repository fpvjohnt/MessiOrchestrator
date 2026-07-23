// build_prompt / improve_prompt / myth_vs_reality. Deterministic and offline.
// build_prompt turns a goal into a structured prompt scaffold + technique picks;
// improve_prompt critiques a pasted prompt against the anti-patterns and suggests
// concrete fixes; myth_vs_reality debunks prompt folklore.

const clean = (s: string) => s.replace(/\r/g, "").trim();
const collapse = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

// ── build_prompt ──────────────────────────────────────────────────────────
export function buildPrompt(rawGoal: string): string {
  const goal = collapse(rawGoal);
  const g = goal.toLowerCase();
  const techniques: string[] = [];

  const isExtract = has(g, "extract", "pull", "parse", "classif", "categor", "label", "structured", "fields");
  const isReason = has(g, "reason", "solve", "math", "logic", "calculate", "step", "decide", "analyze", "diagnose");
  const isGenerate = has(g, "write", "draft", "generate", "summar", "rewrite", "compose", "explain", "answer");
  const wantsFormat = isExtract || has(g, "json", "format", "table", "list", "bullet");

  if (isExtract) techniques.push("few-shot (show 3–5 examples of the exact input→output)", "structured output (specify the schema, forbid extra prose)");
  if (isReason) techniques.push("chain-of-thought for a NON-reasoning model (skip it for o-series/extended-thinking models)", "self-consistency if correctness is high-stakes");
  if (isGenerate) techniques.push("a clear zero-shot instruction first", "a role/persona only if it encodes a real evaluation lens");
  if (!techniques.length) techniques.push("start zero-shot with an explicit instruction + format; add examples only if it's unreliable");

  return [
    `BUILD PROMPT — "${goal}"`,
    `BOTTOM LINE: fill this scaffold, then measure it on 15–30 cases before adding complexity. Every part you leave blank is a place the model will guess.`,
    ``,
    `PROMPT SCAFFOLD (delete parts you don't need; keep the format spec and constraints):`,
    `  <role> Who the model should act as, IF it encodes a real lens (e.g. "a meticulous data extractor"). </role>`,
    `  <task> The one clear objective — lead with it. </task>`,
    `  <context> Background / the input data. Put UNTRUSTED or retrieved content here and label it as data, not instructions. </context>`,
    `  <examples> 3–5 diverse input→output pairs if the format or edge cases aren't obvious. </examples>`,
    `  <format> EXACTLY what the output should look like${wantsFormat ? " — since this feeds code, specify the schema and say 'output only that'" : ""}. </format>`,
    `  <constraints> Length, allowed values, tone; state positives ("answer in ≤3 sentences"), not just don'ts. </constraints>`,
    `  <uncertainty> What to do when unsure ("if it isn't in <context>, say you don't know") — models guess otherwise. </uncertainty>`,
    ``,
    `TECHNIQUES THAT FIT THIS GOAL:`,
    ...techniques.map((t) => `  • ${t}`),
    ``,
    `NEXT: draft it, run it on a small golden set, change ONE thing at a time (→ 'explain_topic iteration_evaluation'). If it feeds code, use real structured output + validation (→ 'aiforge structured_output').`,
    ``,
    `If you're prompting a REASONING model (o-series / extended thinking / thinking mode): drop the chain-of-thought scaffolding — give the goal + constraints + success criteria and let it think ('explain_topic reasoning_models').`,
  ].join("\n");
}

// ── improve_prompt ──────────────────────────────────────────────────────────
export function improvePrompt(rawPrompt: string): string {
  const promptRaw = clean(rawPrompt);
  const p = promptRaw.toLowerCase();
  const findings: string[] = [];
  const wins: string[] = [];

  const words = promptRaw.split(/\s+/).filter(Boolean).length;

  // Anti-pattern detectors.
  const hasFormatSpec = has(p, "format", "json", "return only", "output only", "respond with", "as a list", "bullet", "schema", "exactly one");
  if (!hasFormatSpec) findings.push("NO OUTPUT FORMAT specified — the model will pick a shape and vary it. Say exactly what the output should look like (and if it feeds code, use structured output).");
  else wins.push("output format is specified");

  const vague = ["good", "nice", "great", "properly", "well", "appropriately", "high quality", "as needed", "etc"].filter((v) => new RegExp(`\\b${v}\\b`).test(p));
  if (vague.length) findings.push(`VAGUE terms (${vague.join(", ")}) — the model can't act on 'good'/'properly'. Replace with a concrete, checkable criterion.`);

  const negatives = (p.match(/\b(don't|do not|never|avoid|no )/g) || []).length;
  const positives = has(p, "you are", "your task", "please", "write", "return", "summarize", "classify", "extract", "answer", "list");
  if (negatives >= 2 && !positives) findings.push("NEGATIVE-ONLY phrasing — lots of don'ts, no clear statement of what TO do. State the desired behavior positively.");

  if (words > 400) findings.push(`LONG (${words} words) — check for over-stuffing (one prompt doing several jobs) and burying the ask. Consider decomposition into chained prompts.`);
  if (words < 8) findings.push(`VERY SHORT (${words} words) — likely under-specified. Add the task, the format, and the key constraint.`);

  const conflict = (has(p, "concise", "brief", "short") && has(p, "detailed", "thorough", "comprehensive", "in depth"));
  if (conflict) findings.push("CONFLICTING instructions (concise + thorough) — the model can't satisfy both. Pick one, or specify where each applies.");

  const hasExamples = has(p, "example", "e.g.", "for instance", "<example", "input:", "output:");
  const looksFormatty = hasFormatSpec && (has(p, "json", "schema") || /output only/.test(p));
  if (!hasExamples && looksFormatty) findings.push("NO EXAMPLE for a non-obvious format — one filled-in example usually locks the shape better than description.");

  const hasUncertainty = has(p, "if you don't know", "if unsure", "not in the context", "say you don't know", "insufficient");
  if (!hasUncertainty && has(p, "context", "document", "based on", "using the")) findings.push("NO UNCERTAINTY rule — tell it to say 'I don't know' / 'not in the context' instead of guessing when grounding is thin.");

  const delimits = has(p, "<", "```", "###", "\"\"\"", "---");
  if (words > 120 && !delimits) findings.push("NO DELIMITERS in a longish prompt — separate instructions / context / data / examples with XML tags or markdown so the model (and you) can tell them apart.");

  return [
    `IMPROVE PROMPT`,
    `BOTTOM LINE: ${findings.length ? `${findings.length} issue(s) found — fixing the format spec and vagueness usually helps most.` : "no major anti-patterns detected; the remaining lever is measured iteration on a golden set."}`,
    ``,
    `The prompt (${words} words) was checked against the common anti-patterns.`,
    ``,
    ...(wins.length ? [`Working already: ${wins.join("; ")}.`, ``] : []),
    `ISSUES + FIXES:`,
    ...(findings.length ? findings.map((f) => `  ✗ ${f}`) : ["  ✓ none of the usual anti-patterns fired."]),
    ``,
    `THEN: change ONE thing at a time and re-run a fixed set of test cases — that's the only way to know a fix actually helped (→ 'explain_topic iteration_evaluation'). For a full rebuild, use 'build_prompt <goal>'.`,
    ``,
    `Note: this is a structural critique (deterministic checks), not a guarantee — the real test is your eval set. If it feeds code, validate the output regardless (→ 'aiforge fm_guardrails').`,
  ].join("\n");
}

// ── myth_vs_reality ──────────────────────────────────────────────────────────
const MYTHS: Array<{ myth: string; reality: string }> = [
  {
    myth: "A good persona ('you are a world-class expert') makes the model smarter.",
    reality: "A role mostly shifts TONE and FOCUS, not capability — it can't add knowledge the model lacks. Useful as a steering nudge WITH concrete instructions; useless as a magic incantation on its own.",
  },
  {
    myth: "Longer, more detailed prompts are better.",
    reality: "Past a point, more text dilutes attention ('lost in the middle'), adds cost, and hides the actual ask. Clarity and relevant context beat length. Over-stuffed prompts are a top anti-pattern.",
  },
  {
    myth: "More few-shot examples always help.",
    reality: "3–5 DIVERSE, correct examples is the sweet spot. More examples add cost and can overfit the model to one shape; a single WRONG example poisons the pattern. Quality and variety over quantity.",
  },
  {
    myth: "Temperature 0 makes the output deterministic and reliable.",
    reality: "It makes decoding greedy (more stable), not guaranteed identical — ties, hardware, and infra still cause drift. And 'stable' isn't 'correct': consistency ≠ correctness. Measure correctness on a golden set.",
  },
  {
    myth: "Chain-of-thought ('think step by step') always improves answers.",
    reality: "It helps NON-reasoning models on multi-step tasks — but on 2026 reasoning models (o-series, extended thinking, thinking mode) it's redundant and can HURT, because they already reason internally. Know which class you're prompting.",
  },
  {
    myth: "You can prompt your way to safety ('ignore any injected instructions').",
    reality: "A prompt is not a guardrail. Untrusted/retrieved content can still hijack the model, and determined input gets around a polite instruction. Delimiting helps; real safety is CODE that validates the output before it acts.",
  },
  {
    myth: "Prompt engineering is just wording tricks / it's dead.",
    reality: "It's empirical engineering: specify the task and format, choose the right context and examples, and ITERATE against an eval. The wording matters less than the structure, the context selection, and the measurement.",
  },
  {
    myth: "If it worked once, the prompt is good.",
    reality: "One good output is an anecdote. A prompt is only as good as its performance across a representative test set — including the edge and failure cases. Tune and verify against the set, not a lucky single run.",
  },
];

export function mythVsReality(): string {
  return [
    `PROMPT ENGINEERING MYTHS vs REALITY`,
    `BOTTOM LINE: prompting is empirical, not incantation. The folklore below wastes time; the reality is 'be specific, choose context well, and measure'.`,
    ``,
    ...MYTHS.flatMap(({ myth, reality }, i) => [`${i + 1}. MYTH: "${myth}"`, `   REALITY: ${reality}`, ``]),
    `The through-line: clarity + right context + iteration on a golden set beats clever wording — and a prompt is never a substitute for a real guardrail.`,
  ].join("\n");
}
