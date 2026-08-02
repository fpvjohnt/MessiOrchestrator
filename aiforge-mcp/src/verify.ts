// check_practice / practice_verdict: the same two-step research loop as loop's
// check_practice and curiosity's check_claim. The AI/ML tooling stack — Hugging
// Face, LangChain, PyTorch, serving frameworks, model capabilities — moves
// monthly, so the ONE thing this asset must never answer from memory is "what's
// the current API / current best way to..." Hand out authoritative sources +
// hype red flags; research fetches; practice_verdict grades it honestly.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "Official library docs & changelogs — Hugging Face (transformers/PEFT/TRL/datasets), LangChain/LangGraph, PyTorch, vLLM. The API is the source of truth for CURRENT shape; these move fast and tutorials rot.",
  "The library's GitHub releases/issues — what's deprecated RIGHT NOW and what actually breaks (e.g. LangChain's 1.0 migration to create_agent / langchain-classic).",
  "Model cards on the Hub — license, intended use, context length, and limits for a specific open model (verify, never assume).",
  "Peer-reviewed / arXiv for a TECHNIQUE's real claims (LoRA, QLoRA, a new fine-tuning or RAG method) — read the actual result, not a thread summary.",
  "Engineering write-ups with EVALS and numbers (cost, latency, failure rate) — not a demo, not a launch post.",
];

const RED_FLAGS = [
  "A tutorial older than a few months treated as current — in this space the API has often already changed (AgentExecutor, LLMChain, old fine-tuning APIs).",
  "HYPE with no eval — 'this model/framework changes everything' and not a single number. A demo is not a benchmark.",
  "Benchmark cherry-picking — one task where it wins, silence on cost, latency, and where it loses.",
  "'Just fine-tune it' / 'just use a vector DB' / 'you need framework X' offered with no measurement that the simpler thing failed.",
  "It's selling something — a course, a paid framework, a 'build an AI app in 10 minutes' funnel.",
  "A leaderboard cited as proof it fits YOUR task — leaderboard ≠ your data.",
];

export function checkPractice(rawTopic: string): string {
  const topic = clean(rawTopic);
  const year = new Date().getFullYear();
  return [
    `PRACTICE CHECK — "${topic}"`,
    `BOTTOM LINE: don't answer this from memory — the AI/ML tooling stack (Hugging Face, LangChain, PyTorch, serving) changes monthly. Have research check it against the sources this tool lists, then call practice_verdict with what it finds.`,
    ``,
    `CHECK THESE SOURCES:`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • "${topic}" official documentation ${year}`,
    `  • "${topic}" deprecated OR breaking changes OR migration`,
    `  • "${topic}" benchmark OR eval OR comparison`,
    `  • "${topic}" best practice production ${year}`,
    ``,
    `HYPE RED FLAGS to watch for in what comes back:`,
    ...RED_FLAGS.map((r) => `  - ${r}`),
    ``,
    `Once research reports back, call practice_verdict(topic, findings) for the graded, honest answer.`,
  ].join("\n");
}

// --- The grader ---
//
// This function used to print the full five-tier rubric and hand the judgement
// back to the caller: `findings` was echoed for display and never read. Measured
// over the real case log that made it 85% identical text call-to-call — the
// highest boilerplate ratio of any tool in the fleet, in the one tool whose
// entire job is to COMMIT. A verdict tool that says "here is how you would grade
// this" has not graded anything, and the caller, having just written the
// findings, then grades its own homework. That is the same self-grading defect
// as the outcome labels, one layer down.
//
// It cannot judge meaning — no model here, and AGENTS.md keeps assets
// deterministic — but the properties that actually separate the tiers are
// textual and countable: did research reach primary documentation, did anything
// deprecate, is there a measurement, and did the sources corroborate. So it
// counts those and commits, then prints ONLY the tier it landed on.

interface Signals {
  official: boolean;
  deprecated: boolean;
  measured: boolean;
  uncorroborated: boolean;
  inconclusive: boolean;
}

// Negation guard — a signal regex reads the WORD, not the SENSE, so "no
// official documentation" and "no benchmark exists" would otherwise both count
// as evidence FOR. Positive signals run against non-negated clauses only;
// signals that are themselves about absence read the full text.
const NEGATORS =
  /\b(?:no|not|none|never|without|lacks?|lacking|absent|nothing|cannot|can't|couldn't|could not|didn't|did not|isn't|is not|aren't|are not|failed to|unable to)\b/;

function positiveText(notes: string): string {
  return notes
    .toLowerCase()
    // Sentence-ending punctuation only. Splitting on EVERY "." shredded
    // "platform.openai.com" into three fragments and broke URL and decimal
    // matching, silently downgrading a properly-sourced finding.
    .split(/[;:]|\.(?=\s|$)|\band\b|\bbut\b|,/)
    .filter((clause) => !NEGATORS.test(clause))
    .join(" ");
}

function readSignals(notes: string): Signals {
  const full = notes.toLowerCase();
  const pos = positiveText(notes);
  return {
    official:
      /official (?:doc|documentation)|\bdocs?\.|documentation\b|changelog|release notes|api reference|model card/.test(pos),
    measured: /benchmark|\beval\b|evals\b|measured|latency|throughput|\d+\s*%|cost per|tokens\/s|p95|ablation/.test(pos),
    // Absence/negative findings live in the negated clauses — read full text.
    deprecated: /deprecat|superseded|no longer (?:supported|available)|removed in|breaking change|end of life|sunset/.test(full),
    uncorroborated: /not cross-checked|one web index|single provider|found by 1 provider|uncorroborated/.test(full),
    inconclusive: /could not confirm|couldn't confirm|no sources? found|nothing found|inconclusive|unclear|no official/.test(full),
  };
}

export function practiceVerdict(rawTopic: string, findings: string): string {
  const topic = clean(rawTopic);
  const notes = clean(findings);

  if (!notes) {
    return [
      `PRACTICE VERDICT — "${topic}"`,
      `BOTTOM LINE: UNVERIFIED — no findings were passed, so nothing was graded.`,
      ``,
      `This tool grades what research actually returned. Run check_practice, have research`,
      `run the queries, then call practice_verdict again with the findings.`,
    ].join("\n");
  }

  const s = readSignals(notes);

  // Commit to a label. Order matters: a deprecation finding outranks everything
  // else, because "it works" and "it was removed" cannot both be acted on.
  let label: string;
  let tier: string;
  if (s.deprecated) {
    label = "UPDATED";
    tier = "Outdated/deprecated — the sources show the assumed approach is superseded. Do not build on it; use the replacement the sources name.";
  } else if (s.inconclusive || (!s.official && !s.measured)) {
    label = "UNVERIFIED";
    tier = "Hype or unconfirmed — no primary documentation and no measurement came back. Treat as unproven; do not repeat it as fact.";
  } else if (s.official && s.measured) {
    label = "VERIFIED";
    tier = "Documented + measured — primary docs confirm the current shape AND there are numbers. Trust it, and say what the numbers were.";
  } else if (s.official) {
    label = "VERIFIED";
    tier = "Documented, lightly measured — the API/shape is current and sourced, but nothing shows it BEATS the simpler option. Fine to use; do not over-claim.";
  } else {
    label = "UNVERIFIED";
    tier = "Promising but unproven — there is a measurement but no primary documentation behind it. Try it behind your own eval; do not bet production on it.";
  }

  const caveats: string[] = [];
  if (s.uncorroborated) {
    caveats.push(`Sources were NOT independently corroborated (single index/provider) — carry that caveat into the answer.`);
  }
  if (label === "VERIFIED" && !s.measured) {
    caveats.push(`No measurement came back, so "it works" is documented but "it's better" is not. Say which one you mean.`);
  }

  return [
    `PRACTICE VERDICT — "${topic}"`,
    `BOTTOM LINE: ${label} — ${tier}`,
    ``,
    `Graded on what came back: ${[
      s.official ? "primary docs ✓" : "primary docs ✗",
      s.measured ? "measurement ✓" : "measurement ✗",
      s.deprecated ? "deprecation flagged ⚠" : "no deprecation found",
      s.uncorroborated ? "single-source ⚠" : "corroborated",
    ].join(" · ")}`,
    ...(caveats.length ? [``, `CAVEATS:`, ...caveats.map((c) => `  • ${c}`)] : []),
    ``,
    `Recommend the SIMPLEST thing the evidence supports. "The simpler thing still wins" —`,
    `prompting over fine-tuning, plain vector search over the fancy retriever — is a real`,
    `finding, not a cop-out. State the recommendation; do not hand the judgement back.`,
  ].join("\n");
}
