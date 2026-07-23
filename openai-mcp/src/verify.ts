// check_openai / openai_verdict: the same two-step research loop as curiosity's
// check_claim, healthguide's check_the_science, and loop's check_practice.
//
// This asset needs the loop MORE than its siblings do, not less. Its whole
// value is vendor-specific detail — model IDs, parameter names, pricing, rate
// limits, what's deprecated — and that is precisely the detail that rots
// fastest. An "OpenAI expert" answering those from memory is the single most
// likely way this asset lies to John with total confidence. So the rule is
// blunt: stable ENGINEERING JUDGMENT lives in primitives.ts/toolkit.ts;
// anything with a version, a number, or a date in it goes through here.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "developers.openai.com — the official API docs. THE source of truth for current shape: the migration guide, the Agents SDK guide, function calling, structured outputs. If the docs and a blog disagree, the docs win.",
  "OpenAI's official pricing and models pages — the ONLY acceptable source for prices, context limits, and model IDs. Never a summary of them.",
  "OpenAI's deprecations page + changelog — what's actually retiring and when, versus what the internet says is 'dead'.",
  "The Agents SDK GitHub repos (TypeScript and Python) — releases, issues, and breaking changes. What actually breaks in practice shows up here first.",
  "The OpenAI Cookbook — working reference implementations, but check the commit date; a stale cookbook entry looks exactly like a current one.",
  "Independent benchmarks WITH methodology published — for any 'X is better than Y' claim. A vendor's own benchmark is a marketing artifact until someone reproduces it.",
];

const RED_FLAGS = [
  "'Chat Completions is deprecated' — the most repeated false claim about this platform. The official docs say it remains supported. If a source says this, distrust the rest of it too.",
  "A blog post as the source for a PRICE, a rate limit, or a context window. These change; the summary doesn't. Go to the pricing page.",
  "No date on the post, or a date more than a few months old treated as current. In this ecosystem that's often already wrong.",
  "Feature names that appear in exactly one write-up and nowhere in the official docs — that's either a rename, a preview, or an invention. Corroborate before you build on it.",
  "'Game-changer' / '10x' / 'you're doing it wrong' framing with no eval, no numbers, and a course link at the bottom.",
  "Benchmark cherry-picking — one task where it wins, silence on the rest. Especially when the author built the benchmark.",
  "An LLM-generated listicle recycling a year-old blog post. The tell: confident specifics with no source and no date.",
  "Migration urgency with no stated benefit. 'Migrate now' is not a reason. 'Migrate to get X' is.",
];

export function checkOpenai(rawTopic: string): string {
  const topic = clean(rawTopic);
  const year = new Date().getFullYear();
  return [
    `OPENAI CHECK — "${topic}"`,
    `BOTTOM LINE: do NOT answer this from memory. Model IDs, parameter names, pricing, rate limits, and deprecations on this platform change on a scale of weeks — and being confidently wrong about an API shape costs real debugging hours. Have research check the sources this tool lists, then call openai_verdict with what it finds.`,
    ``,
    `CHECK THESE SOURCES (in this order — the official docs outrank everything else):`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • site:developers.openai.com "${topic}"`,
    `  • "${topic}" OpenAI official documentation ${year}`,
    `  • "${topic}" OpenAI deprecated OR "breaking change" OR changelog`,
    `  • "${topic}" OpenAI pricing OR rate limit OR context window`,
    `  • "${topic}" OpenAI Agents SDK github issues`,
    ``,
    `RED FLAGS to watch for in what comes back:`,
    ...RED_FLAGS.map((r) => `  - ${r}`),
    ``,
    `THE TEST FOR EVERY CLAIM THAT COMES BACK: is it in OpenAI's own docs, or is it someone's summary of OpenAI's docs? Only the first one is a fact. The second is a lead.`,
    ``,
    `Once research reports back, call openai_verdict(topic, findings) for the graded, honest answer.`,
  ].join("\n");
}

export function openaiVerdict(rawTopic: string, findings: string): string {
  const topic = clean(rawTopic);
  const notes = clean(findings);
  return [
    `OPENAI VERDICT — "${topic}"`,
    `BOTTOM LINE: grade what research found by SOURCE, not by confidence. Official docs are fact; blogs are leads. Say plainly which tier each claim landed in, and never launder a tier-3 claim into a tier-1 answer by restating it cleanly.`,
    ``,
    `Findings reported: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `Evidence tiers, strongest to weakest:`,
    `  1. OFFICIAL + CURRENT — it's in developers.openai.com / the pricing page / the changelog, and it's dated now. This is fact. Build on it.`,
    `  2. OFFICIAL BUT UNDATED — it's in the docs, but you can't tell how current the page is. Usable; flag the recency risk if you're about to build on it.`,
    `  3. CORROBORATED SECONDARY — several independent sources agree and none contradict the docs. Reasonable working assumption; label it as such, don't state it as documented.`,
    `  4. SINGLE-SOURCE / BLOG-ONLY — one write-up, no official confirmation. NAME it as unconfirmed, explicitly, every time. Do not put it in code without checking the docs first. This is where invented feature names live.`,
    `  5. CONTRADICTED OR STALE — the docs or changelog say otherwise, or it's visibly outdated. Say so and give the correct value with its source.`,
    ``,
    `MANDATORY LABEL on the final answer back to John:`,
    `  • VERIFIED — official docs confirm it. Give the value and the source.`,
    `  • UPDATED — research found something DIFFERENT from what was assumed. Give the corrected value, its source, and say what was wrong. This is a success, not an embarrassment.`,
    `  • UNVERIFIED — couldn't confirm it against official sources. Say that out loud and name the doc page that would settle it. Do NOT fill the gap with a confident guess.`,
    ``,
    `Two honest endings that aren't "yes" or "no":`,
    `  • "The docs don't say" — a real finding. It means don't build on it yet, or test it empirically and treat the result as YOUR data point, not a documented guarantee.`,
    `  • "It changed and nobody announced it loudly" — happens. If the shape moved, the fix is your code, not your memory of the API.`,
    ``,
    `If a stored assumption in this asset's own primitives looked stale during this check, say so plainly — this asset is built to be corrected, and a wrong default here quietly costs more than an admitted gap.`,
  ].join("\n");
}
