// check_practice / practice_verdict for AI APIs & Postman. HTTP fundamentals are
// stable, but Postman features (Agent Mode, AI test gen, the CLI) and provider AI
// API specs (endpoints, params, limits, pricing) change fast — so "current
// feature / current API shape" questions are verified via research, not recalled.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "The provider's API reference — OpenAI, Anthropic, Google, etc. The source of truth for the CURRENT request/response shape, params, rate limits, and pricing (these move).",
  "learning.postman.com / Postman docs & blog — current Postman features (collections, environments, AI/Agent Mode, the CLI). The product changes frequently.",
  "The provider's changelog / status page — deprecations, new endpoints, incidents.",
  "The Postman CLI / Newman docs — current commands and flags for CI.",
  "Reputable engineering write-ups WITH real requests/tests shown — not a vague 'AI-native' marketing post.",
];

const RED_FLAGS = [
  "An API example from an old blog — endpoints, model names, and params change; verify against the provider reference.",
  "Pricing / rate-limit numbers quoted from memory or an old post — always verify current pricing on the provider's page.",
  "'Put your key in the URL / front-end' advice — insecure and a red flag for a low-quality source.",
  "Postman feature claims (Agent Mode can X) treated as fixed — the AI features move monthly; confirm.",
  "A tutorial testing an AI endpoint with exact string assertions — outdated approach for non-deterministic output.",
];

export function checkPractice(rawTopic: string): string {
  const topic = clean(rawTopic);
  const year = new Date().getFullYear();
  return [
    `PRACTICE CHECK — "${topic}"`,
    `BOTTOM LINE: HTTP fundamentals are stable, but Postman features and provider AI-API specs (endpoints, params, limits, pricing) change fast — verify this against the sources below, then call practice_verdict.`,
    ``,
    `CHECK THESE SOURCES:`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • "${topic}" official API reference ${year}`,
    `  • "${topic}" site:learning.postman.com OR Postman docs`,
    `  • "${topic}" deprecated OR changed OR pricing ${year}`,
    `  • "${topic}" rate limit OR streaming OR parameters`,
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
    `BOTTOM LINE: grade how CURRENT and official this is — separate the provider/Postman docs from stale blog syntax. Give the corrected request/feature, and never quote pricing/limits from memory.`,
    ``,
    `Findings reported: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `Evidence tiers, strongest to weakest:`,
    `  1. Provider/Postman official + current — the reference/docs confirm the exact endpoint, param, feature, or limit as current. Trust it.`,
    `  2. Official but version-specific — correct for a stated API/app version; confirm it matches what you're on.`,
    `  3. Community, plausible — a write-up consistent with the docs; prefer the doc's exact shape.`,
    `  4. Stale — old endpoints/model names/params or Postman features that have since changed. Update it.`,
    `  5. Wrong/insecure — key-in-URL, exact-match AI tests, invented limits. Don't follow it.`,
    ``,
    `Label VERIFIED (docs confirm current), UPDATED (research found the current shape/limit/feature differs — give the corrected value + source), or UNVERIFIED (couldn't confirm — say so). Pricing and rate limits ALWAYS require a live check.`,
  ].join("\n");
}
