// check_practice / practice_verdict: the same two-step research loop as
// curiosity's check_claim and healthguide's check_the_science. Agentic-AI
// tooling moves monthly — framework APIs, "the current best pattern", model
// capabilities — so the ONE place this asset must not answer from memory is a
// "what's the current best way to..." question. Hand out authoritative sources
// + hype red flags; research fetches; practice_verdict grades it honestly.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "Official framework docs & changelogs — LangChain/LangGraph, LlamaIndex, OpenAI Agents SDK, Anthropic docs, AutoGen, CrewAI (APIs change fast; the docs are the source of truth for CURRENT shape)",
  "Provider model & tool-use docs — capabilities, structured outputs, context limits, pricing (verify, never assume)",
  "Peer-reviewed / arXiv papers for a TECHNIQUE's real claims (ReAct, Reflexion, RAG, Toolformer) — read the actual result, not the thread summary",
  "Reputable engineering write-ups with EVALS and numbers (not just a demo) — Anthropic/OpenAI engineering blogs, well-run benchmarks",
  "The library's GitHub issues/releases — what actually breaks and what's deprecated right now",
];

const RED_FLAGS = [
  "HYPE with no eval — 'this agent framework is a game-changer' and not a single number. A demo is not a benchmark.",
  "'Autonomous'/'AGI'/'just works' framing — the tell of marketing over engineering.",
  "Benchmark cherry-picking — one task where it wins, silence on where it loses; or a benchmark the author also built.",
  "A blog post older than a few months treated as current — in this space that's often already deprecated.",
  "'More agents / bigger model solved it' with no measurement of cost, latency, or failure rate.",
  "It's selling something — a course, a paid framework, a 'build an AI agent in 10 minutes' funnel.",
];

export function checkPractice(rawTopic: string): string {
  const topic = clean(rawTopic);
  return [
    `PRACTICE CHECK — "${topic}"`,
    `BOTTOM LINE: don't answer this from memory — agentic-AI tooling and best practices change monthly. Have research check it against the sources this tool lists, then call practice_verdict with what it finds.`,
    ``,
    `CHECK THESE SOURCES:`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • "${topic}" official documentation ${new Date().getFullYear()}`,
    `  • "${topic}" benchmark OR eval OR comparison`,
    `  • "${topic}" deprecated OR breaking changes OR issues`,
    `  • "${topic}" best practice production agent`,
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
    `BOTTOM LINE: grade how well-supported this practice actually is from what research found — separate what's DOCUMENTED and MEASURED from what's just hyped. Recommend the simplest thing that's proven to work.`,
    ``,
    `Findings reported: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `Evidence tiers, strongest to weakest:`,
    `  1. Documented + measured — official docs confirm the current API/shape AND there are real evals/benchmarks (with cost & failure rate, not just a win). Trust it.`,
    `  2. Documented, lightly measured — the API is current and sound in principle, but the evidence it BEATS the simpler option is thin. Fine to use; don't over-claim.`,
    `  3. Promising but unproven — an interesting technique/paper with limited independent replication. Try it behind an eval, don't bet production on it.`,
    `  4. Hype — lots of buzz, no numbers, maybe already deprecated. Treat as unverified until you see docs + evals.`,
    `  5. Outdated/wrong — the docs or releases show it's deprecated or the claim doesn't hold. Don't use it.`,
    ``,
    `Two honest endings that aren't "good" or "bad":`,
    `  • "The simpler thing is still the answer" — often the shiny new framework loses to a plain loop with a good eval; that's a real, valuable finding.`,
    `  • "It depends on your eval" — the right choice is whatever measurably wins on YOUR task, not what's trending. Point back to eval_loop.`,
    ``,
    `This grades the evidence and the recency, not the enthusiasm — being curious about a new agent technique is great; the check is just how you avoid shipping hype.`,
  ].join("\n");
}
