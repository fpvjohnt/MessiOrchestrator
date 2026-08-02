import type { Case, CaseOutcome } from "./types.js";

// The quality report — the payoff of outcome labeling. Turns "we did things"
// into "did they work". Honest about coverage: it reports how many closed
// cases are actually LABELED, because a resolution rate over 3 labeled cases
// is noise, and pretending otherwise would be the lie this whole thread exists
// to avoid.

const ORDER: CaseOutcome[] = ["resolved", "partial", "unresolved", "misrouted"];

export function outcomeReport(cases: Case[]): string {
  const closed = cases.filter((c) => c.status === "closed");
  const labeled = closed.filter((c) => c.outcome);
  const coverage = closed.length ? Math.round((labeled.length / closed.length) * 100) : 0;

  const header = [
    `OUTCOME REPORT`,
    `${labeled.length}/${closed.length} closed cases are labeled with an outcome (${coverage}% coverage).`,
  ];

  if (labeled.length === 0) {
    return [
      ...header,
      ``,
      `No outcomes recorded yet — labeling starts now. Pass 'outcome' to close_case (resolved/partial/unresolved/misrouted) and this becomes a real quality signal. Until then there is nothing honest to measure.`,
    ].join("\n");
  }

  // Overall tally.
  const tally = new Map<CaseOutcome, number>();
  for (const c of labeled) tally.set(c.outcome!, (tally.get(c.outcome!) ?? 0) + 1);
  const resolvedish = (tally.get("resolved") ?? 0) + (tally.get("partial") ?? 0);
  const resolutionRate = Math.round((resolvedish / labeled.length) * 100);

  const tallyLines = ORDER.filter((o) => tally.has(o)).map((o) => `  ${o}: ${tally.get(o)}`);

  // Per-asset outcome breakdown — which asset's cases actually work out. A case
  // can have several assets; each assigned asset gets credited the outcome.
  const perAsset = new Map<string, Map<CaseOutcome, number>>();
  for (const c of labeled) {
    for (const asset of c.assignedAssets) {
      const m = perAsset.get(asset) ?? new Map<CaseOutcome, number>();
      m.set(c.outcome!, (m.get(c.outcome!) ?? 0) + 1);
      perAsset.set(asset, m);
    }
  }
  const assetLines = [...perAsset.entries()]
    .map(([asset, m]) => {
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      const good = (m.get("resolved") ?? 0) + (m.get("partial") ?? 0);
      const parts = ORDER.filter((o) => m.has(o)).map((o) => `${o} ${m.get(o)}`);
      return { asset, total, rate: Math.round((good / total) * 100), parts };
    })
    .sort((a, b) => b.total - a.total)
    .map((r) => `  ${r.asset}: ${r.rate}% good over ${r.total} labeled (${r.parts.join(", ")})`);

  const caveat =
    labeled.length < 10
      ? `\nNote: only ${labeled.length} labeled case(s) — treat these as directional, not statistical. The number gets trustworthy as labeling coverage grows.`
      : ``;

  // --- Degenerate-label detection ---
  //
  // 100% coverage and a 100% resolution rate is not a good score; it is a
  // BROKEN INSTRUMENT, and reporting it as a score is the most consequential
  // lie this file could tell. A classifier that has never once emitted the
  // negative class carries zero information: you cannot distinguish "routing
  // works" from "nothing is ever marked wrong", because both produce this
  // exact output. The cause is structural — the same agent that runs a case
  // also closes it, so close_case is self-grading, and graders do not fail
  // themselves. This warning goes ABOVE the numbers, because a reader who
  // sees "100%" first has already drawn the wrong conclusion.
  const negatives = (tally.get("unresolved") ?? 0) + (tally.get("misrouted") ?? 0);
  const degenerate = negatives === 0 && labeled.length >= 10;
  const warning = degenerate
    ? [
        `⚠ DEGENERATE LABELS — READ THIS BEFORE THE NUMBERS`,
        `  ${labeled.length} labeled cases, ZERO marked 'unresolved' or 'misrouted'. Not one, ever.`,
        `  A label that has never once said "no" cannot say "yes" either — the ${resolutionRate}% below`,
        `  measures nothing. Treat routing quality as UNMEASURED, not as good.`,
        `  Root cause: whoever runs the case also closes it, so the metric grades its own work.`,
        `  To get a real signal, do ONE of these:`,
        `    - have a party that did NOT run the case assign the outcome, or`,
        `    - label a random sample blind (read objective + result, hide the old label), or`,
        `    - at minimum, use 'misrouted' + should_have_routed_to the next time routing is wrong;`,
        `      that field is the one piece of ground truth no test set can generate.`,
        ``,
      ]
    : [];

  const rateLine = degenerate
    ? `Resolution rate (resolved+partial): ${resolutionRate}% of labeled — NOT A QUALITY SIGNAL, see warning above`
    : `Resolution rate (resolved+partial): ${resolutionRate}% of labeled`;

  return [
    ...header,
    ``,
    ...warning,
    rateLine,
    ...tallyLines,
    ``,
    degenerate
      ? `BY ASSET (good = resolved+partial) — every asset reads 100% for the reason above; this ranks nothing:`
      : `BY ASSET (good = resolved+partial):`,
    ...assetLines,
    caveat,
  ].join("\n");
}
