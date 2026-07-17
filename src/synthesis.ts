import type { Case, CaseTaskLog } from "./types.js";

// Cross-asset synthesis — the "correlate, don't just concatenate" step. The
// orchestrator has no LLM (by design: deterministic + offline), so this doesn't
// re-summarize with a model. Instead it does a STRUCTURED merge that exploits a
// convention every asset already follows — a "BOTTOM LINE:" headline — plus the
// sources they cite and any calls that failed, collapsing a long multi-asset
// case log into one digest the caller can turn into a single answer.

function resultText(entry: CaseTaskLog): string {
  if (entry.error) return "";
  const r = entry.result as unknown;
  if (typeof r === "string") return r;
  if (r && typeof r === "object") {
    const o = r as Record<string, unknown>;
    const content = o.content as Array<{ text?: string }> | undefined;
    if (Array.isArray(content) && content[0]?.text) return content[0].text;
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
    if (e.error) {
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
  if (!sources.size && [...byAsset.keys()].some((k) => k !== "research")) flags.push(`No sources cited — nothing here was verified against an external source.`);
  out.push(``, `FLAGS:`, ...(flags.length ? flags.map((f) => `  • ${f}`) : ["  • none — multiple assets contributed and calls succeeded."]));

  out.push(``, `This is a structured digest for writing ONE merged answer — check the headlines for agreement/conflict before combining them.`);
  return out.join("\n");
}
