import type { CaseTaskLog } from "./types.js";

// An asset call can fail two ways, and this repo only ever counted one.
//
//   entry.error            — the orchestrator's own call threw.
//   result.isError === true — the MCP tool itself refused: bad arguments,
//                             unknown tool name, an HTTP failure inside the
//                             asset. This is a NORMAL result payload.
//
// Measured over the real case log: 6 entries carry `error`, 50 carry
// `result.isError`. Every consumer in this package keyed off `error` alone, so
// the audit report, the error analyzer, and answer-drift were all reading 11%
// of the failures and reporting the system as far healthier than it is.
//
// This mirrors `isFailed` in the orchestrator's src/synthesis.ts. The two
// packages cannot import from each other, so if the shape of a failed result
// ever changes, BOTH must change.

export function isFailed(entry: CaseTaskLog): boolean {
  if (entry.error) return true;
  const r = entry.result as unknown;
  return !!(r && typeof r === "object" && (r as { isError?: unknown }).isError === true);
}

/** The failure text, wherever it lives — for grouping and display. */
export function failureMessage(entry: CaseTaskLog): string {
  if (entry.error) return entry.error;
  const r = entry.result as unknown;
  if (r && typeof r === "object") {
    const content = (r as { content?: Array<{ text?: string }> }).content;
    if (Array.isArray(content)) {
      const text = content
        .map((b) => (typeof b?.text === "string" ? b.text : ""))
        .filter(Boolean)
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return "(tool reported isError with no message)";
}
