// check_finding / finding_verdict — the two-step research loop.
//
// Psychology needs this more than any other asset here. Its most quotable
// results are disproportionately the ones that failed to replicate, so
// answering "is X true?" from memory is exactly how this asset would end up
// confidently repeating power posing and social priming forever.
//
// finding_verdict GRADES. It does not print the tier list and hand the
// judgement back to the caller who just wrote the findings — that pattern was
// measured across this fleet at 82-88% identical output call-to-call, and it is
// self-grading one layer down (see aiforge-mcp/src/verify.ts).

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "Preregistered MULTI-LAB replications first — Many Labs, the Reproducibility Project, Registered Replication Reports. For psychology this outranks the original paper, however famous.",
  "Meta-analyses that correct for publication bias, and that report how much correction changed the estimate.",
  "The original paper itself — sample size, whether it was preregistered, and the effect size WITH its interval, not just a p-value.",
  "Retraction Watch and post-publication commentary (PubPeer) — several textbook classics have corrections or withdrawals the textbooks never picked up.",
  "The author's own later statements. More than one famous effect has been publicly disowned by the person who found it.",
];

const RED_FLAGS = [
  "A single striking study, no replication named. Surprise is what gets published; surprise is also what fails.",
  "'Studies show' with no sample size, no effect size, and no interval.",
  "A correlational design described in causal language ('causes', 'makes you', 'leads to').",
  "Undergraduate convenience samples generalised to human nature (the WEIRD problem).",
  "A brain scan attached to a behavioural claim — imagery raises believability without raising evidence.",
  "It is selling something: a book, a course, a corporate workshop, a personality instrument.",
  "The finding is over a decade old, extremely famous, and you have never once heard whether it replicated.",
];

export function checkFinding(rawClaim: string): string {
  const claim = clean(rawClaim);
  return [
    `FINDING CHECK — "${claim}"`,
    `BOTTOM LINE: do not answer this from memory. Psychology's most repeated findings are disproportionately the ones that failed to replicate, so this returns the sources and queries to run, then grades what comes back via finding_verdict.`,
    ``,
    `CHECK THESE SOURCES (in this order):`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • "${claim}" replication OR "failed to replicate" OR "registered replication"`,
    `  • "${claim}" meta-analysis effect size`,
    `  • "${claim}" preregistered study`,
    `  • "${claim}" criticism OR retraction`,
    ``,
    `RED FLAGS to watch for in what comes back:`,
    ...RED_FLAGS.map((r) => `  - ${r}`),
    ``,
    `Then call finding_verdict(claim, findings) for the graded answer.`,
  ].join("\n");
}

// Negation guard. A signal regex reads the WORD, not the SENSE: without this,
// "failed to replicate" counts as replication evidence FOR the claim, and
// "no preregistration" counts as preregistered. Positive signals run only
// against non-negated clauses; signals that are themselves about absence or
// failure read the full text.
const NEGATORS =
  /\b(?:no|not|none|never|without|lacks?|lacking|absent|nothing|cannot|can't|couldn't|could not|didn't|did not|isn't|is not|aren't|are not|failed to|unable to|insufficient|lack of)\b/;

function positiveText(notes: string): string {
  return notes
    .toLowerCase()
    // Sentence-ending punctuation only — splitting on every "." shreds URLs
    // and decimals ("p=0.03", "osf.io") and breaks matching.
    .split(/[;:]|\.(?=\s|$)|\band\b|\bbut\b|,/)
    .filter((clause) => !NEGATORS.test(clause))
    .join(" ");
}

interface Signals {
  replicated: boolean;
  failed: boolean;
  preregistered: boolean;
  metaAnalysis: boolean;
  effectSize: boolean;
  correlationalOnly: boolean;
  retracted: boolean;
  singleStudy: boolean;
}

function readSignals(notes: string): Signals {
  const full = notes.toLowerCase();
  const pos = positiveText(notes);
  return {
    replicated: /replicat|reproduc|many labs|registered replication|multi-?lab/.test(pos),
    preregistered: /preregist|pre-regist|registered report/.test(pos),
    metaAnalysis: /meta-?analy/.test(pos),
    effectSize: /effect size|cohen'?s d|\bd\s*=|\br\s*=|confidence interval|\bci\b/.test(pos),
    // Absence/failure signals live INSIDE negated clauses — read full text.
    failed: /failed to replicat|did not replicat|could not replicat|non-?replicat|replication failure|disput|disowned|withdrew support/.test(full),
    retracted: /retract|fraud|fabricat|data manipulation/.test(full),
    correlationalOnly: /correlational|observational|not causal|no causal|cannot infer caus/.test(full),
    singleStudy: /single study|one study|only one|no replication|has not been replicated/.test(full),
  };
}

export function findingVerdict(rawClaim: string, findings: string): string {
  const claim = clean(rawClaim);
  const notes = clean(findings);

  if (!notes) {
    return [
      `FINDING VERDICT — "${claim}"`,
      `BOTTOM LINE: NOT GRADED — no findings were passed, so nothing was weighed.`,
      ``,
      `Run check_finding, have research run the queries, then call finding_verdict again with what came back.`,
    ].join("\n");
  }

  const s = readSignals(notes);

  // Order matters, and it rounds DOWN. Retraction and replication FAILURE
  // outrank everything, because "it's famous" and "it didn't hold up" cannot
  // both be acted on — and in this field the famous ones are exactly the risk.
  let tier: string;
  let label: string;
  if (s.retracted) {
    tier = "RETRACTED / FABRICATED";
    label = "The underlying work was retracted or the data were fabricated. Do not repeat the claim at all, and say so if someone else does.";
  } else if (s.failed) {
    tier = "FAILED REPLICATION";
    label = "Direct replication attempts did not reproduce this. Treat the original as historical, not as evidence. This is the single most common outcome for famous psychology findings.";
  } else if (s.replicated && (s.preregistered || s.metaAnalysis)) {
    tier = "WELL SUPPORTED";
    label = "Independently replicated AND backed by preregistration or meta-analysis. About as good as psychological evidence gets. Give the effect size, not just the direction.";
  } else if (s.replicated) {
    tier = "REPLICATED, LIGHTLY";
    label = "It has been reproduced, but nothing here shows preregistration or a bias-corrected meta-analysis. Usable; do not present it as settled.";
  } else if (s.correlationalOnly) {
    tier = "ASSOCIATION ONLY";
    label = "The design supports association, not cause. State it as a link and do not slip into causal language — that slip is the most common way this branch misleads.";
  } else if (s.singleStudy) {
    tier = "SINGLE STUDY — UNCONFIRMED";
    label = "One result, no replication found. A lead, not a conclusion. Surprising single findings are precisely the ones that most often fail later.";
  } else {
    tier = "UNVERIFIED";
    label = "Nothing in the findings establishes replication, design, or effect size. Treat as unproven rather than assuming the best — do not fill the gap with a confident summary.";
  }

  const caveats: string[] = [];
  if (!s.effectSize && !s.retracted && !s.failed) {
    caveats.push(`No effect size reported — "real" and "big enough to matter" are different claims. Say which one you mean.`);
  }
  if (s.replicated && s.failed) {
    caveats.push(`Findings contain BOTH replication and replication-failure language — report the conflict rather than picking the tidier side.`);
  }
  if (/weird|undergraduate|college student|convenience sample/i.test(notes)) {
    caveats.push(`Sample looks WEIRD/undergraduate — generalise to "people in general" only with that stated.`);
  }

  return [
    `FINDING VERDICT — "${claim}"`,
    `BOTTOM LINE: ${tier} — ${label}`,
    ``,
    `Graded on what came back: ${[
      s.replicated ? "replication ✓" : "replication ✗",
      s.preregistered ? "preregistered ✓" : "preregistered ✗",
      s.metaAnalysis ? "meta-analysis ✓" : "meta-analysis ✗",
      s.effectSize ? "effect size ✓" : "effect size ✗",
      s.failed ? "replication FAILED ⚠" : "no failure found",
      s.retracted ? "retracted ⚠" : "no retraction found",
    ].join(" · ")}`,
    ...(caveats.length ? [``, `CAVEATS:`, ...caveats.map((c) => `  • ${c}`)] : []),
    ``,
    `"It did not replicate" is a real, useful answer — not a failure of the search. Report it plainly.`,
  ].join("\n");
}

export function howWeKnow(): string {
  return [
    `HOW PSYCHOLOGY KNOWS ANYTHING`,
    `BOTTOM LINE: the design decides what a study can claim. Randomised experiment → cause. Everything else → association, no matter how large the sample or how confident the write-up.`,
    ``,
    `THE DESIGNS, STRONGEST CLAIM FIRST:`,
    `  1. Preregistered multi-lab randomised experiment — cause, and it survived independent hands. The gold standard.`,
    `  2. Single randomised experiment — cause, in this sample, once. Awaits replication.`,
    `  3. Longitudinal / cohort — direction in time, but confounds remain. Suggestive.`,
    `  4. Cross-sectional correlation — association only. Cannot order cause and effect.`,
    `  5. Case study — generates hypotheses. Cannot test them.`,
    ``,
    `THE FIVE QUESTIONS THAT DO MOST OF THE WORK:`,
    `  • Was it randomised? If not, no causal language.`,
    `  • Has it replicated INDEPENDENTLY? A single study is a lead.`,
    `  • How big is the effect, with an interval? Significant ≠ meaningful.`,
    `  • Who was in the sample? Undergraduates are not humanity (the WEIRD problem).`,
    `  • Was the analysis preregistered? Without it, analytic flexibility can manufacture a result honestly.`,
    ``,
    `WHAT THE REPLICATION CRISIS ACTUALLY WAS:`,
    `  Coordinated attempts to repeat published psychology reproduced well under half, with effects around`,
    `  half the original size. The cause was structural, not fraud: journals rejected null results, samples`,
    `  were small, and flexible analysis let honest researchers find something. The fixes — preregistration,`,
    `  multi-lab replication, bigger samples, reporting effect sizes — work, and are now standard.`,
    ``,
    `This is why this asset ships check_finding: on a factual claim it refuses to answer from memory.`,
  ].join("\n");
}
