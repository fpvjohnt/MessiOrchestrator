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

// Grades from the findings instead of printing the tier list and handing the
// judgement back. See aiforge-mcp/src/verify.ts for the full reasoning: measured
// over the real case log this function was 88% identical text call-to-call — the
// most boilerplate-heavy tool in the fleet — because `findings` was echoed for
// display and never actually read. A tool that restates how to grade has not
// graded, and the caller who wrote the findings then grades itself.
// Negation guard — see healthguide-mcp/src/science.ts for the full reasoning.
// "No official docs found; could not confirm on openai.com" was reporting
// "official docs ✓" purely because the string openai.com appeared inside the
// sentence saying it was NOT found.
const NEGATORS =
  /\b(?:no|not|none|never|without|lacks?|lacking|absent|nothing|cannot|can't|couldn't|could not|didn't|did not|isn't|is not|aren't|are not|failed to|unable to)\b/;

function positiveText(notes: string): string {
  return notes
    .toLowerCase()
    // Sentence-ending punctuation only. Splitting on EVERY "." shredded
    // "platform.openai.com" into three fragments and broke URL matching,
    // silently downgrading a properly-sourced finding to SINGLE-SOURCE.
    .split(/[;:]|\.(?=\s|$)|\band\b|\bbut\b|,/)
    .filter((clause) => !NEGATORS.test(clause))
    .join(" ");
}

function readSignals(notes: string) {
  const full = notes.toLowerCase();
  const pos = positiveText(notes);
  return {
    official: /developers?\.openai\.com|platform\.openai\.com|openai\.com\/(?:pricing|docs|changelog)|official (?:doc|documentation)|changelog|api reference/.test(pos),
    dated: /\b20\d{2}\b|updated (?:on|this)|last updated|as of \w+ \d/.test(pos),
    corroborated:
      /several (?:independent )?sources|multiple sources|corroborat|agree/.test(pos) &&
      !/not cross-checked|one web index|single provider|found by 1 provider/.test(full),
    // Absence/contradiction claims live in the negated clauses — read full text.
    contradicted: /contradict|docs say otherwise|no longer|deprecat|superseded|outdated|stale/.test(full),
    inconclusive: /could not confirm|couldn't confirm|no sources? found|nothing found|docs don't say|not documented|no official/.test(full),
  };
}

export function openaiVerdict(rawTopic: string, findings: string): string {
  const topic = clean(rawTopic);
  const notes = clean(findings);

  if (!notes) {
    return [
      `OPENAI VERDICT — "${topic}"`,
      `BOTTOM LINE: UNVERIFIED — no findings were passed, so nothing was graded.`,
      ``,
      `Run check_openai, have research run the queries, then call openai_verdict with what came back.`,
    ].join("\n");
  }

  const s = readSignals(notes);
  let label: string;
  let tier: string;
  if (s.contradicted) {
    label = "UPDATED";
    tier = "CONTRADICTED OR STALE — the docs/changelog say otherwise, or it is visibly outdated. Give the corrected value WITH its source, and say what was wrong. This is a success, not an embarrassment.";
  } else if (s.inconclusive) {
    label = "UNVERIFIED";
    tier = "The docs don't say — a real finding. Do not fill the gap with a confident guess; name the doc page that would settle it.";
  } else if (s.official && s.dated) {
    label = "VERIFIED";
    tier = "OFFICIAL + CURRENT — it is in the official docs and it is dated. This is fact. Give the value and the source.";
  } else if (s.official) {
    label = "VERIFIED";
    tier = "OFFICIAL BUT UNDATED — it is in the docs, but the page's recency is unclear. Usable; flag the recency risk before building on it.";
  } else if (s.corroborated) {
    label = "UNVERIFIED";
    tier = "CORROBORATED SECONDARY — independent sources agree but no official confirmation. A reasonable working assumption; label it as such, do NOT state it as documented.";
  } else {
    label = "UNVERIFIED";
    tier = "SINGLE-SOURCE / BLOG-ONLY — one write-up, no official confirmation. Name it as unconfirmed every time. This is where invented feature names live; do not put it in code before checking the docs.";
  }

  return [
    `OPENAI VERDICT — "${topic}"`,
    `BOTTOM LINE: ${label} — ${tier}`,
    ``,
    `Graded on what came back: ${[
      s.official ? "official docs ✓" : "official docs ✗",
      s.dated ? "dated ✓" : "undated ⚠",
      s.corroborated ? "corroborated ✓" : "not corroborated ⚠",
      s.contradicted ? "contradicted/stale ⚠" : "no contradiction found",
    ].join(" · ")}`,
    ``,
    `Never launder a secondary claim into a documented one by restating it cleanly.`,
    `If a stored assumption in this asset's own primitives looked stale during this check, say so —`,
    `this asset is built to be corrected, and a wrong default costs more than an admitted gap.`,
  ].join("\n");
}
