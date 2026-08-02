// check_the_science / science_verdict: the same two-step research-loop shape
// as nestegg's analyze_asset/score_signals and polymath's build_it/finalize_build.
// This tool NEVER answers from static memory — a health/nutrition claim is
// exactly where stale "facts" cause real harm. It hands out the authoritative
// multi-country sources and the noise patterns to watch for; research fetches;
// science_verdict turns findings into a graded, honest answer.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "NIH / National Institute on Aging (US) — https://www.nia.nih.gov",
  "Japan's Ministry of Health, Labour and Welfare / National Institute of Health and Nutrition — https://www.nibiohn.go.jp/eiken/english/",
  "EFSA — European Food Safety Authority — https://www.efsa.europa.eu",
  "Health Canada — https://www.canada.ca/en/health-canada.html",
  "World Health Organization (global) — https://www.who.int",
  "Cochrane Library (systematic reviews/meta-analyses across all published trials) — https://www.cochranelibrary.com",
];

export function checkTheScience(rawClaim: string): string {
  const claim = clean(rawClaim);
  return [
    `EVIDENCE CHECK — "${claim}"`,
    `BOTTOM LINE: don't answer this from memory. Have research check it against the real scientific bodies this tool names, then call science_verdict with what it finds.`,
    ``,
    `CHECK THESE SOURCES (multi-country, so no single country's bias or gap drives the answer):`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • "${claim}" systematic review meta-analysis`,
    `  • "${claim}" NIH OR WHO OR EFSA guidance`,
    `  • "${claim}" Cochrane review`,
    ``,
    `NOISE PATTERNS TO WATCH FOR IN WHAT COMES BACK:`,
    `  - Testimonial/anecdote presented as evidence ("it worked for me" is not a study).`,
    `  - Correlation dressed up as causation (X and Y happen together ≠ X causes Y).`,
    `  - A single small or non-peer-reviewed study generalized as settled science.`,
    `  - A funding source with a financial stake in the answer (a supplement maker funding the one study that favors their product).`,
    ``,
    `Once research reports back, call science_verdict(claim, findings) for the graded, honest answer.`,
  ].join("\n");
}

// Grades from the findings instead of printing the tier list and handing the
// judgement back. See aiforge-mcp/src/verify.ts for the full reasoning: measured
// over the real case log this was 82% identical text call-to-call, because
// `notes` was echoed for display and never read. On a HEALTH claim that matters
// more than anywhere else — "here is how you would grade this" is exactly the
// non-answer someone checking a supplement claim cannot use.
//
// Deliberately asymmetric: it rounds DOWN. Observational evidence described with
// causal language stays observational, because the single most common way health
// claims mislead is an association reported as a cause.
// Negation guard. Without this the grader reads the WORD and misses the SENSE:
// "Observational only; no randomized trials identified" matched /randomi[sz]ed/
// and graded TIER 2, upgrading an association into trial evidence — the precise
// error this tier list exists to prevent, produced by the tool meant to prevent
// it. Evidence-STRENGTH signals therefore run only against clauses that are not
// negated; signals that are themselves about absence read the full text.
const NEGATORS =
  /\b(?:no|not|none|never|without|lacks?|lacking|absent|nothing|cannot|can't|couldn't|could not|didn't|did not|isn't|is not|aren't|are not|failed to|unable to|insufficient|lack of)\b/;

function positiveText(notes: string): string {
  return notes
    .toLowerCase()
    // Sentence-ending punctuation only. Splitting on EVERY "." shredded URLs
    // and decimals ("p=0.03", "nih.gov") into fragments and broke matching.
    .split(/[;:]|\.(?=\s|$)|\band\b|\bbut\b|,/)
    .filter((clause) => !NEGATORS.test(clause))
    .join(" ");
}

function readSignals(notes: string) {
  const full = notes.toLowerCase();
  const pos = positiveText(notes);
  return {
    systematic: /cochrane|systematic review|meta-analys/.test(pos),
    rct: /randomi[sz]ed|\brct\b|controlled trial|double-blind|placebo-controlled/.test(pos),
    guideline: /\bnih\b|\bwho\b|\befsa\b|\bfda\b|\bcdc\b|\bnhs\b|guideline|major-body|consensus statement/.test(pos),
    observational: /observational|cohort|case-control|cross-sectional|epidemiolog|associat|correlat/.test(pos),
    weak: /animal stud|in vitro|mouse|rat stud|small stud|pilot stud|expert opinion|anecdot/.test(pos),
    // Absence claims: these live IN the negated clauses, so they read full text.
    none: /testimonial|influencer|no stud|no evidence|marketing claim|blog post/.test(full),
    disagree: /disagree|conflict|contradict|mixed (?:results|evidence)|inconsistent/.test(full),
  };
}

export function scienceVerdict(rawClaim: string, findings: string): string {
  const claim = clean(rawClaim);
  const notes = clean(findings);

  if (!notes) {
    return [
      `EVIDENCE VERDICT — "${claim}"`,
      `BOTTOM LINE: NOT GRADED — no findings were passed, so no evidence was weighed.`,
      ``,
      `Run check_the_science, have research run the queries, then call science_verdict with what came back.`,
    ].join("\n");
  }

  const s = readSignals(notes);
  let tier: number;
  let label: string;
  if (s.systematic || (s.rct && /multiple|several|many trials/.test(notes.toLowerCase()))) {
    tier = 1;
    label = "STRONG — multiple large randomized trials or a systematic review. This is about as good as health evidence gets.";
  } else if (s.rct || s.guideline) {
    tier = 2;
    label = "SOLID, NOT FINAL — a single well-designed trial, or major-body guidance (NIH/WHO/EFSA). Good enough to act on, not good enough to call settled.";
  } else if (s.observational) {
    tier = 3;
    label = "SUGGESTIVE ONLY — observational evidence. It shows an ASSOCIATION, not that one thing causes the other. Do not restate it as cause.";
  } else if (s.weak) {
    tier = 4;
    label = "WEAK / PRELIMINARY — small, animal-only, lab-only, or expert opinion without trials. Interesting, not actionable.";
  } else if (s.none) {
    tier = 5;
    label = "NOT EVIDENCE — testimonials, influencer claims, or no study at all. Say that plainly.";
  } else {
    tier = 4;
    label = "UNCLEAR — nothing in the findings identifies a study design, so the evidence tier cannot be established. Treat as unproven rather than assuming the best.";
  }

  const notes2: string[] = [];
  if (s.disagree) notes2.push(`Sources DISAGREE — say so plainly rather than picking the side that reads better.`);
  if (s.observational && (s.rct || s.systematic)) {
    notes2.push(`Both trial and observational evidence appeared — be explicit about which part of the claim rests on which.`);
  }

  return [
    `EVIDENCE VERDICT — "${claim}"`,
    `BOTTOM LINE: TIER ${tier} — ${label}`,
    ``,
    `Graded on what came back: ${[
      s.systematic ? "systematic review ✓" : null,
      s.rct ? "randomized trial ✓" : null,
      s.guideline ? "major-body guidance ✓" : null,
      s.observational ? "observational ⚠" : null,
      s.weak ? "small/animal/opinion ⚠" : null,
      s.none ? "no study ⚠" : null,
    ].filter(Boolean).join(" · ") || "no study design identified"}`,
    ...(notes2.length ? [``, ...notes2.map((n) => `  • ${n}`)] : []),
    ``,
    `This grades the SCIENCE, not your situation — a real doctor or dietitian still has to weigh in on how it applies to you.`,
  ].join("\n");
}
