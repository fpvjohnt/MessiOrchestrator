import type { Case, CaseTaskLog } from "./types.js";

const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

// Truncate rather than dump full payloads — a case log can hold multi-KB
// research dossiers, and this is meant to be READ, not re-parsed.
function truncate(value: unknown, max: number): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  const cleaned = clean(text);
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function renderLogEntry(entry: CaseTaskLog, index: number): string {
  const lines = [
    `  [${index + 1}] ${entry.timestamp} — ${entry.asset}.${entry.tool}`,
    `      args: ${truncate(entry.arguments, 200)}`,
  ];
  lines.push(entry.error ? `      ERROR: ${truncate(entry.error, 400)}` : `      result: ${truncate(entry.result, 400)}`);
  return lines.join("\n");
}

export function findCase(cases: Case[], caseId: string): Case | undefined {
  return cases.find((c) => c.id === caseId);
}

/** The "what did the agent system actually do" answer for one case: the
 * objective, routing, and every asset call in order with its outcome. */
export function replayCase(c: Case): string {
  const header = [
    `CASE ${c.id} [${c.status}]`,
    `Objective: ${c.objective}`,
    `Assigned assets: ${c.assignedAssets.join(", ") || "(none)"}`,
    `Opened: ${c.openedAt}${c.closedAt ? `  Closed: ${c.closedAt}` : ""}`,
    c.summary ? `Summary: ${c.summary}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  if (c.log.length === 0) {
    return `${header}\n\n(No asset calls logged for this case.)`;
  }

  return [header, ``, `TIMELINE:`, ...c.log.map(renderLogEntry)].join("\n");
}
