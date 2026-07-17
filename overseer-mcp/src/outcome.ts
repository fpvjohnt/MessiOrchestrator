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

  return [
    ...header,
    ``,
    `Resolution rate (resolved+partial): ${resolutionRate}% of labeled`,
    ...tallyLines,
    ``,
    `BY ASSET (good = resolved+partial):`,
    ...assetLines,
    caveat,
  ].join("\n");
}
