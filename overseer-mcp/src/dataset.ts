import type { Case, CaseTaskLog } from "./types.js";
import { isFailed, failureMessage } from "./failure.js";

// THE FAILURE CORPUS — the one dataset this system can honestly harvest from
// its own experience.
//
// The outcome labels cannot be mined: the agent that runs a case also closes
// it, so 62/62 came back positive and the signal is dead (see outcome.ts).
// These rows are different in kind. The runtime produced them, not a model:
// a schema either rejected the call or it did not, a tool name either existed
// or it did not. Nothing here is anyone's opinion, so nothing here can flatter
// the system that generated it. That is the whole reason this file exists and
// a "successful answers" exporter does not.
//
// Every row is a (what was called, how it failed, what would have worked) pair,
// which is exactly the shape needed to regression-test the fix.

export type FailureClass =
  | "unknown_tool"
  | "missing_required_arg"
  | "too_long"
  | "wrong_type"
  | "not_assigned"
  | "http_fetch_failed"
  | "timeout"
  | "upstream_auth"
  | "asset_rejected_input"
  | "unclassified";

export interface FailureRow {
  case_id: string;
  asset: string;
  tool: string;
  timestamp?: string;
  failure_class: FailureClass;
  /** The offending parameter, when the schema named one. */
  param?: string;
  /** Declared limit and what was actually sent, for length/type failures. */
  limit?: number;
  actual?: number;
  /** The correct tool name, when the asset told us — a free (wrong → right) pair. */
  suggestion?: string;
  /** Whether this class is fixable in code (schema/naming) vs. environmental. */
  actionable: boolean;
  message: string;
  arguments_keys: string[];
}

function classify(msg: string, entry: CaseTaskLog): Omit<FailureRow, "case_id" | "asset" | "tool" | "timestamp" | "message" | "arguments_keys"> {
  // Unknown tool — the caller invented a plausible name. The asset often
  // replies with its real tool list, which hands us the correct label for free.
  if (/Tool \S+ not found|has no tool ["']/.test(msg)) {
    const didYouMean = /Did you mean ["']([\w-]+)["']/.exec(msg);
    const firstOfList = /Its tools are:\s*([\w-]+)/.exec(msg);
    return {
      failure_class: "unknown_tool",
      suggestion: didYouMean?.[1] ?? firstOfList?.[1],
      actionable: true,
    };
  }

  // Length cap rejected a real call. AGENTS.md forbids unmeasured caps, and
  // these rows ARE the measurement — limit vs. what a caller actually sent.
  const tooBig = /"maximum":\s*(\d+)[\s\S]*?at most (\d+) character[\s\S]*?"path":\s*\[\s*"([^"]+)"/.exec(msg);
  if (/too_big/.test(msg) || /at most \d+ character/.test(msg)) {
    return {
      failure_class: "too_long",
      param: tooBig?.[3],
      limit: tooBig ? Number(tooBig[1]) : undefined,
      actionable: true,
    };
  }

  // Required argument omitted — usually because the tool's PROSE taught a
  // different word than its SCHEMA accepts (AGENTS.md's "do not let a tool's
  // description teach a word its schema rejects").
  if (/"received":\s*"undefined"/.test(msg) || /"message":\s*"Required"/.test(msg)) {
    const p = /"path":\s*\[\s*"([^"]+)"/.exec(msg);
    return { failure_class: "missing_required_arg", param: p?.[1], actionable: true };
  }

  if (/invalid_type/.test(msg)) {
    const p = /"path":\s*\[\s*"([^"]+)"/.exec(msg);
    return { failure_class: "wrong_type", param: p?.[1], actionable: true };
  }

  if (/is not assigned to case/.test(msg)) return { failure_class: "not_assigned", actionable: true };

  // Environmental: real, worth tracking, but NOT a code defect. Kept separate
  // so a corpus of 45 rows can't be read as 45 bugs.
  if (/HTTP \d{3} fetching/.test(msg)) return { failure_class: "http_fetch_failed", actionable: false };
  if (/timed out|-32001/.test(msg)) return { failure_class: "timeout", actionable: false };
  if (/401|unauthorized|missing the permission/i.test(msg)) return { failure_class: "upstream_auth", actionable: false };

  // The asset ran and refused the input in its own words (a BOTTOM LINE
  // complaint rather than a schema throw).
  if (/^BOTTOM LINE/im.test(msg)) return { failure_class: "asset_rejected_input", actionable: true };

  return { failure_class: "unclassified", actionable: false };
}

export function collectFailures(cases: Case[], assetFilter?: string): FailureRow[] {
  const rows: FailureRow[] = [];
  for (const c of cases) {
    for (const e of c.log ?? []) {
      if (!isFailed(e)) continue;
      if (assetFilter && e.asset !== assetFilter) continue;
      const message = failureMessage(e);
      const args = (e.arguments ?? {}) as Record<string, unknown>;
      const cls = classify(message, e);
      // For a length failure, what was actually sent is the number that tells
      // you where to set the new cap.
      let actual = cls.actual;
      if (cls.failure_class === "too_long" && cls.param && typeof args[cls.param] === "string") {
        actual = (args[cls.param] as string).length;
      }
      rows.push({
        case_id: c.id,
        asset: e.asset,
        tool: e.tool,
        timestamp: e.timestamp,
        ...cls,
        actual,
        message: message.replace(/\s+/g, " ").slice(0, 400),
        arguments_keys: Object.keys(args),
      });
    }
  }
  return rows;
}

export function exportFailures(cases: Case[], opts: { asset?: string; format?: "jsonl" | "summary" } = {}): string {
  const rows = collectFailures(cases, opts.asset);
  if (rows.length === 0) {
    return `FAILURE CORPUS\nNo failed calls found${opts.asset ? ` for asset "${opts.asset}"` : ""} — nothing to export.`;
  }

  if (opts.format === "jsonl") {
    return rows.map((r) => JSON.stringify(r)).join("\n");
  }

  const byClass = new Map<FailureClass, FailureRow[]>();
  for (const r of rows) byClass.set(r.failure_class, [...(byClass.get(r.failure_class) ?? []), r]);
  const actionable = rows.filter((r) => r.actionable).length;

  const out = [
    `FAILURE CORPUS — ${rows.length} labeled row(s) across ${byClass.size} class(es)`,
    `${actionable} actionable (a schema or naming defect you can fix) / ${rows.length - actionable} environmental.`,
    ``,
    `Labeled by the RUNTIME, not by a model — a schema either rejected the call or it did not.`,
    `This is the one corpus here that cannot flatter the system that produced it.`,
    ``,
  ];

  for (const [cls, list] of [...byClass.entries()].sort((a, b) => b[1].length - a[1].length)) {
    out.push(`▶ ${cls} — ${list.length}${list[0].actionable ? "" : "  (environmental)"}`);
    // Length failures carry the measurement that sets the correct cap.
    if (cls === "too_long") {
      const worst = new Map<string, { limit?: number; max: number }>();
      for (const r of list) {
        const k = `${r.asset}.${r.tool}(${r.param ?? "?"})`;
        const cur = worst.get(k);
        worst.set(k, { limit: r.limit, max: Math.max(cur?.max ?? 0, r.actual ?? 0) });
      }
      for (const [k, v] of worst) out.push(`    ${k}: cap ${v.limit ?? "?"}, longest real call ${v.max}`);
    } else if (cls === "unknown_tool") {
      const pairs = new Set(list.map((r) => `    ${r.asset}.${r.tool} → ${r.suggestion ?? "(no suggestion returned)"}`));
      out.push(...pairs);
    } else {
      const seen = new Set(list.map((r) => `    ${r.asset}.${r.tool}${r.param ? `(${r.param})` : ""}`));
      out.push(...[...seen].slice(0, 8));
    }
    out.push(``);
  }

  out.push(`Pass format:"jsonl" for the machine-readable rows (one JSON object per line).`);
  return out.join("\n");
}
