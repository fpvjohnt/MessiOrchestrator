import type { Case } from "./types.js";

// Process-level latency read: how slow is each asset, and is anything an
// outlier. Computed from the durationMs the orchestrator now records per call.
// Coverage-honest — entries logged before duration tracking (or that never
// carried it) are simply not counted, and the report says how many did.

interface Sample {
  asset: string;
  tool: string;
  ms: number;
  caseId: string;
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function latencyReport(cases: Case[], assetFilter?: string): string {
  const samples: Sample[] = [];
  let totalCalls = 0;
  for (const c of cases) {
    for (const e of c.log) {
      totalCalls += 1;
      if (typeof e.durationMs !== "number") continue;
      if (assetFilter && e.asset !== assetFilter) continue;
      samples.push({ asset: e.asset, tool: e.tool, ms: e.durationMs, caseId: c.id });
    }
  }

  const scope = assetFilter ? ` for asset "${assetFilter}"` : "";
  if (samples.length === 0) {
    return [
      `LATENCY REPORT${scope}`,
      `No timed calls yet${assetFilter ? ` for "${assetFilter}"` : ""} — ${totalCalls} logged call(s), none carry duration.`,
      ``,
      `Duration is recorded going forward; older calls predate it. Run some tasks, then re-check.`,
    ].join("\n");
  }

  // Per-asset stats.
  const byAsset = new Map<string, number[]>();
  for (const s of samples) {
    const arr = byAsset.get(s.asset) ?? [];
    arr.push(s.ms);
    byAsset.set(s.asset, arr);
  }
  const rows = [...byAsset.entries()]
    .map(([asset, msList]) => {
      const sorted = [...msList].sort((a, b) => a - b);
      const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
      return { asset, n: sorted.length, avg, p50: pct(sorted, 50), p95: pct(sorted, 95), max: sorted.at(-1)! };
    })
    .sort((a, b) => b.avg - a.avg);

  const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);
  const assetLines = rows.map((r) => `  ${r.asset}: avg ${fmt(r.avg)}  (p50 ${fmt(r.p50)}, p95 ${fmt(r.p95)}, max ${fmt(r.max)}, n=${r.n})`);

  // Slowest individual calls — the outliers worth a look.
  const slowest = [...samples].sort((a, b) => b.ms - a.ms).slice(0, 5);
  const slowLines = slowest.map((s) => `  ${fmt(s.ms)}  ${s.asset}.${s.tool}  [${s.caseId.slice(0, 8)}]`);

  const coverage = Math.round((samples.length / Math.max(1, totalCalls)) * 100);
  return [
    `LATENCY REPORT${scope}`,
    `${samples.length}/${totalCalls} logged calls are timed (${coverage}% coverage).`,
    ``,
    `BY ASSET (slowest average first):`,
    ...assetLines,
    ``,
    `SLOWEST INDIVIDUAL CALLS:`,
    ...slowLines,
    ``,
    `Note: this is wall-clock per call, which includes the asset's own work AND (for research) network fetches — a slow 'research' is usually the web, not a bug. Watch for an asset drifting slower over time, or a p95 far above its p50.`,
  ].join("\n");
}
