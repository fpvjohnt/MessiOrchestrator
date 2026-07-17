import type { Case } from "./types.js";

// audit_report tells you an asset HAD errors; this tells you WHAT they were.
// Groups identical-shaped failures so 20 of the same error read as one line
// with a count, not 20 lines of noise. Pure read over the case log.

interface ErrEntry {
  asset: string;
  tool: string;
  message: string;
  caseId: string;
  timestamp: string;
}

// Mask the volatile bits (UUIDs, quoted specifics, bare numbers) so the same
// KIND of failure clusters even when the offending value differs.
function normalizeMessage(msg: string): string {
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/"[^"]*"/g, '"…"')
    .replace(/\d+/g, "<n>") // not \b\d+\b — "15000ms" has no boundary before "ms"
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzeErrors(cases: Case[], assetFilter?: string): string {
  const errs: ErrEntry[] = [];
  for (const c of cases) {
    for (const e of c.log) {
      if (!e.error) continue;
      if (assetFilter && e.asset !== assetFilter) continue;
      errs.push({ asset: e.asset, tool: e.tool, message: e.error, caseId: c.id, timestamp: e.timestamp });
    }
  }

  const scope = assetFilter ? ` for asset "${assetFilter}"` : "";
  if (errs.length === 0) return `No errors logged${scope}. Clean.`;

  // Group by asset.tool + the masked message shape.
  const groups = new Map<string, { entries: ErrEntry[]; sample: string }>();
  for (const e of errs) {
    const key = `${e.asset}.${e.tool} :: ${normalizeMessage(e.message)}`;
    const g = groups.get(key) ?? { entries: [], sample: e.message };
    g.entries.push(e);
    groups.set(key, g);
  }

  const sorted = [...groups.values()].sort((a, b) => b.entries.length - a.entries.length);
  const blocks = sorted.map((g) => {
    const first = g.entries[0];
    const latest = g.entries.map((e) => e.timestamp).sort().at(-1)!;
    const sampleMsg = g.sample.length > 300 ? `${g.sample.slice(0, 300)}…` : g.sample;
    return [
      `▶ ${first.asset}.${first.tool} — ${g.entries.length}×  (latest ${latest.slice(0, 10)})`,
      `    ${sampleMsg.replace(/\s+/g, " ").trim()}`,
      `    e.g. case ${first.caseId.slice(0, 8)}`,
    ].join("\n");
  });

  return [
    `ERROR ANALYSIS${scope}`,
    `${errs.length} error(s) across ${groups.size} distinct failure type(s), most frequent first:`,
    ``,
    ...blocks,
  ].join("\n");
}
