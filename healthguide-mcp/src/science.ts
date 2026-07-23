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

export function scienceVerdict(rawClaim: string, findings: string): string {
  const claim = clean(rawClaim);
  const notes = clean(findings);
  return [
    `EVIDENCE VERDICT — "${claim}"`,
    `BOTTOM LINE: grade the evidence tier honestly from what research found — don't round up.`,
    ``,
    `Findings reported: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `Evidence tiers, strongest to weakest:`,
    `  1. Multiple large randomized trials / a Cochrane systematic review — strongest.`,
    `  2. A single well-designed randomized trial, or major-body guidance (NIH/WHO/EFSA) — solid but not final word.`,
    `  3. Observational studies only (show association, not proof of cause) — suggestive, not conclusive.`,
    `  4. Small studies, animal/lab-only studies, or expert opinion without trials — weak, preliminary.`,
    `  5. Testimonials, influencer claims, or no study at all — not evidence.`,
    ``,
    `Where sources from different countries agree, that's a stronger signal than any one source alone. Where they disagree, say so plainly rather than picking a side.`,
    ``,
    `This grades the SCIENCE, not your specific situation — a real doctor or dietitian still needs to weigh in on how it applies to you.`,
  ].join("\n");
}
