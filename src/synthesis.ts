import type { Case, CaseTaskLog } from "./types.js";

// Cross-asset synthesis — the "correlate, don't just concatenate" step. The
// orchestrator has no LLM (by design: deterministic + offline), so this doesn't
// re-summarize with a model. Instead it does a STRUCTURED merge that exploits a
// convention every asset already follows — a "BOTTOM LINE:" headline — plus the
// sources they cite and any calls that failed, collapsing a long multi-asset
// case log into one digest the caller can turn into a single answer.

/**
 * Did this call FAIL? An asset can fail two different ways and only one of them
 * was ever counted.
 *
 * `entry.error` is set when the orchestrator's own call threw. But an MCP tool
 * that rejects its arguments, or is not found, returns a normal result with
 * `isError: true` — and every consumer in this repo keyed off `entry.error`
 * alone. Measured against the real case log: 6 entries carry `error`, and 50
 * carry `result.isError`. Nine failures in ten were invisible to synthesis, to
 * the overseer's error analyzer, and to the audit report.
 *
 * Worse than a wrong count: `resultText` returned the error payload as if it
 * were content, so a hard failure ("Tool calculate_dti not found") rendered as
 * "(no headline extracted — returned data without a BOTTOM LINE, e.g. a
 * dossier)". The digest actively misdescribed a broken call as a verbose one.
 */
export function isFailed(entry: CaseTaskLog): boolean {
  if (entry.error) return true;
  const r = entry.result as unknown;
  return !!(r && typeof r === "object" && (r as { isError?: unknown }).isError === true);
}

function resultText(entry: CaseTaskLog): string {
  if (isFailed(entry)) return "";
  const r = entry.result as unknown;
  if (typeof r === "string") return r;
  if (r && typeof r === "object") {
    const o = r as Record<string, unknown>;
    // Scan EVERY text block, not just the first. An asset that returns a
    // leading non-text block otherwise loses its headline entirely.
    const content = o.content as Array<{ text?: string }> | undefined;
    if (Array.isArray(content)) {
      const joined = content
        .map((b) => (typeof b?.text === "string" ? b.text : ""))
        .filter(Boolean)
        .join("\n");
      if (joined) return joined;
    }
    if (typeof o.preview === "string") return o.preview;
  }
  return "";
}

function bottomLines(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => /^\s*BOTTOM LINE/i.test(l))
    .map((l) => l.replace(/^\s*BOTTOM LINE\s*[:.\-]?\s*/i, "").trim())
    .filter(Boolean);
}

function urls(text: string): string[] {
  const raw = text.match(/https?:\/\/[^\s)\]]+/g) ?? [];
  // Trim tails: a literal "\n" (escaped newline surviving in stored text),
  // quotes/brackets, and trailing punctuation — so a URL butted against the
  // next line ("...studies\nCorroboration:") comes out clean.
  return raw.map((u) => u.split(/\\n|["'<>]/)[0].replace(/[.,;:]+$/, ""));
}

interface AssetContribution {
  calls: number;
  errors: number;
  bottoms: string[];
}

export function synthesizeCase(c: Case): string {
  const byAsset = new Map<string, AssetContribution>();
  const sources = new Set<string>();
  let errorCount = 0;

  for (const e of c.log) {
    const a = byAsset.get(e.asset) ?? { calls: 0, errors: 0, bottoms: [] };
    a.calls += 1;
    if (isFailed(e)) {
      a.errors += 1;
      errorCount += 1;
    } else {
      const text = resultText(e);
      for (const b of bottomLines(text)) if (!a.bottoms.includes(b)) a.bottoms.push(b);
      for (const u of urls(text)) sources.add(u);
    }
    byAsset.set(e.asset, a);
  }

  const header = [`SYNTHESIS — ${c.objective}`, `Assets consulted: ${[...byAsset.keys()].join(", ") || "(none)"}`];

  if (c.log.length === 0) {
    return [...header, ``, `No asset calls were made on this case yet — nothing to synthesize.`].join("\n");
  }

  // What each asset contributed (its bottom-line headlines).
  const contribBlocks = [...byAsset.entries()].map(([asset, a]) => {
    const lines = a.bottoms.length
      ? a.bottoms.map((b) => `    • ${b}`)
      : [`    • (no headline extracted — ${a.errors ? "call errored" : "returned data without a BOTTOM LINE, e.g. a dossier"})`];
    return [`  ▸ ${asset} (${a.calls} call${a.calls === 1 ? "" : "s"}${a.errors ? `, ${a.errors} errored` : ""}):`, ...lines].join("\n");
  });

  // The merged view: every distinct headline across assets, in one place.
  const allBottoms: string[] = [];
  for (const a of byAsset.values()) for (const b of a.bottoms) if (!allBottoms.includes(b)) allBottoms.push(b);

  const out = [
    ...header,
    ``,
    `WHAT EACH CONTRIBUTED:`,
    ...contribBlocks,
    ``,
    `MERGED KEY POINTS:`,
    ...(allBottoms.length ? allBottoms.map((b) => `  • ${b}`) : ["  • (no BOTTOM LINE headlines found — read the full case_report)"]),
  ];

  if (sources.size) {
    out.push(``, `SOURCES CITED (${sources.size}):`, ...[...sources].slice(0, 12).map((u) => `  - ${u}`));
    if (sources.size > 12) out.push(`  … and ${sources.size - 12} more`);
  }

  const flags: string[] = [];
  if (errorCount) flags.push(`${errorCount} call(s) errored — the synthesis may be missing an asset's input.`);
  if (byAsset.size === 1) flags.push(`Only one asset contributed — this is a single-source answer, not a cross-checked one.`);
  // The `some(k => k !== "research")` guard meant a research-ONLY case was the
  // single case that never got this warning — precisely when the one asset that
  // can cite sources found none, which is when the caller most needs telling.
  if (!sources.size) flags.push(`No sources cited — nothing here was verified against an external source.`);
  out.push(``, `FLAGS:`, ...(flags.length ? flags.map((f) => `  • ${f}`) : ["  • none — multiple assets contributed and calls succeeded."]));

  out.push(``, `This is a structured digest for writing ONE merged answer — check the headlines for agreement/conflict before combining them.`);
  return out.join("\n");
}
