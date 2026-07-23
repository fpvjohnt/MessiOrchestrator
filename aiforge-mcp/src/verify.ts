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

export function practiceVerdict(rawTopic: string, findings: string): string {
  const topic = clean(rawTopic);
  const notes = clean(findings);
  return [
    `PRACTICE VERDICT — "${topic}"`,
    `BOTTOM LINE: grade how well-supported and how CURRENT this is from what research found — separate what's DOCUMENTED and MEASURED from what's just hyped or already deprecated. Recommend the simplest thing that's proven to work.`,
    ``,
    `Findings reported: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `Evidence tiers, strongest to weakest:`,
    `  1. Documented + measured — official docs confirm the CURRENT API/shape AND there are real evals (cost + failure rate, not just a win). Trust it.`,
    `  2. Documented, lightly measured — the API is current and sound, but the evidence it BEATS the simpler option is thin. Fine to use; don't over-claim.`,
    `  3. Promising but unproven — an interesting technique/paper with limited independent replication. Try it behind an eval; don't bet production on it.`,
    `  4. Hype — buzz, no numbers, maybe already deprecated. Unverified until you see docs + evals.`,
    `  5. Outdated/deprecated — the docs/releases show it's superseded (e.g. a pre-1.0 LangChain API, an old fine-tuning method). Don't build on it.`,
    ``,
    `Two honest endings that aren't "good" or "bad":`,
    `  • "The simpler thing still wins" — often prompting beats fine-tuning, plain vector search beats the fancy retriever, a small encoder beats the LLM. That's a real, valuable finding.`,
    `  • "It depends on your eval" — the right choice is whatever measurably wins on YOUR task and data, not what's trending. Point back to fm_evaluation.`,
    ``,
    `Label the answer VERIFIED (docs confirm current + evidence), UPDATED (research found a newer/different current API than assumed — give the corrected one + source), or UNVERIFIED (couldn't confirm — say so). This grades the evidence and the recency, not the enthusiasm.`,
  ].join("\n");
}
