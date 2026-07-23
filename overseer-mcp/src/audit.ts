import type { AssetConfig, Case } from "./types.js";
import { isFailed } from "./failure.js";

interface AssetStats {
  calls: number;
  errors: number;
}

/** The system-health snapshot: how many cases, how many calls per asset, how
 * many errored, and — the check that actually catches drift in the setup
 * itself — any asset that got CALLED but was never (or no longer) registered. */
export function auditReport(cases: Case[], assets: AssetConfig[], statusFilter?: "open" | "closed"): string {
  const filtered = statusFilter ? cases.filter((c) => c.status === statusFilter) : cases;

  const byAsset = new Map<string, AssetStats>();
  for (const c of filtered) {
    for (const entry of c.log) {
      const stats = byAsset.get(entry.asset) ?? { calls: 0, errors: 0 };
      stats.calls += 1;
      if (isFailed(entry)) stats.errors += 1;
      byAsset.set(entry.asset, stats);
    }
  }

  const openCount = filtered.filter((c) => c.status === "open").length;
  const closedCount = filtered.filter((c) => c.status === "closed").length;

  const assetLines = [...byAsset.entries()]
    .sort((a, b) => b[1].calls - a[1].calls)
    .map(([name, s]) => `  ${name}: ${s.calls} call(s)${s.errors ? `, ${s.errors} error(s)` : ""}`);

  const registeredNames = new Set(assets.map((a) => a.name));
  const unregisteredCalled = [...byAsset.keys()].filter((n) => !registeredNames.has(n));
  const neverCalled = assets.filter((a) => a.status === "active" && !byAsset.has(a.name)).map((a) => a.name);

  return [
    `AUDIT REPORT${statusFilter ? ` (status=${statusFilter})` : ""}`,
    `Cases: ${filtered.length} total — ${openCount} open, ${closedCount} closed`,
    `Registered assets: ${assets.length} (${assets.filter((a) => a.status === "active").length} active)`,
    ``,
    `CALLS BY ASSET:`,
    ...(assetLines.length ? assetLines : ["  (none logged)"]),
    ...(unregisteredCalled.length
      ? [``, `WARNING — called but not in the registry (renamed or retired mid-history?): ${unregisteredCalled.join(", ")}`]
      : []),
    ...(neverCalled.length ? [``, `Active but never called in this case set: ${neverCalled.join(", ")}`] : []),
  ].join("\n");
}
