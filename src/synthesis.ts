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

/**
 * Readable rendering of a log entry's outcome for case_report — the content
 * TEXT (or the failure reason), instead of JSON.stringify(entry.result). The
 * JSON envelope spends tokens on {"content":[{"type":"text","text":...}]}
 * wrappers and doubles every real newline to "\n" for zero added signal, and it
 * is barely human-readable. A non-text result (image/resource block) is marked
 * rather than dumped.
 */
export function renderOutcome(entry: CaseTaskLog): string {
  if (entry.error) return `ERROR: ${entry.error}`;
  if (isFailed(entry)) {
    const r = entry.result as Record<string, unknown> | undefined;
    const content = r?.content as Array<{ text?: string }> | undefined;
    const text = Array.isArray(content)
      ? content.map((b) => (typeof b?.text === "string" ? b.text : "")).filter(Boolean).join("\n")
      : "";
    return `ERROR: ${text || "asset reported an error"}`;
  }
  return resultText(entry) || "[non-text result]";
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

  // --- Honesty signals the ASSETS already emit, which used to die in the body text ---
  //
  // Every one of these was already being printed by an asset and then dropped on
  // the floor, because FLAGS only ever described the PLUMBING (did calls run, did
  // enough assets answer) and never the CONFIDENCE. The research asset would say
  // "NOT cross-checked: one web index is active" — the single most important
  // reliability caveat this system produces — and the digest right below it would
  // report "FLAGS: none". Promote them.
  const allText = c.log.filter((e) => !isFailed(e)).map((e) => resultText(e)).join("\n");

  if (/NOT cross-checked|one web index|found by 1 provider|single provider/i.test(allText)) {
    flags.push(
      `UNCORROBORATED — an asset reported its findings came from a single index/provider. ` +
        `Agreement between those sources is not independent confirmation. Say so in the answer.`
    );
  }
  if (/\bUNVERIFIED\b|could not confirm|couldn't confirm/i.test(allText)) {
    flags.push(`An asset graded part of this UNVERIFIED — carry that label through; do not launder it into a confident claim.`);
  }

  // A verify loop that was OPENED but never CLOSED. check_* tools exist precisely
  // to refuse answering from stale memory; if the matching *_verdict never ran,
  // the caller took the raw sources and graded them itself — which is the exact
  // self-grading the verdict step was built to prevent.
  const called = new Set(c.log.map((e) => e.tool));
  const openLoops = [...called].filter(
    (t) => /^check_/.test(t) && ![...called].some((v) => /_verdict$/.test(v) || v === "practice_verdict")
  );
  if (openLoops.length) {
    flags.push(
      `VERIFY LOOP LEFT OPEN — ${openLoops.join(", ")} ran but no matching *_verdict did. ` +
        `The grading step was skipped, so nothing here is actually graded.`
    );
  }

  out.push(``, `FLAGS:`);
  if (flags.length) {
    out.push(...flags.map((f) => `  • ${f}`));
  } else {
    // NOT "none — everything succeeded". These checks only ever inspected the
    // plumbing. Reporting a clean bill of health the system never examined is
    // how a digest flatters itself; an absence of detected problems is not
    // evidence of correctness, and it must not read like it is.
    out.push(
      `  • No STRUCTURAL flags raised.`,
      `    Scope of that check: call errors, asset count, source count, self-declared`,
      `    corroboration caveats, and unclosed verify loops. It does NOT check whether`,
      `    the answer is correct, current, or complete. Absence of flags is not a verdict.`
    );
  }

  out.push(
    ``,
    `This is a structured digest for writing ONE merged answer.`,
    `Before combining: where two headlines DISAGREE, report the disagreement — do not average it`,
    `away or silently pick the more confident one. Where a flag above applies, it belongs in the`,
    `answer, not just in this digest. Answer the question that was asked; do not pad the response`,
    `with caveats the evidence does not support, and do not withhold a conclusion the evidence does.`
  );
  return out.join("\n");
}
