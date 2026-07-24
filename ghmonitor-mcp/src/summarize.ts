// Pure status compaction: turn the various GitHub result shapes (check runs,
// combined commit status, workflow runs, deployment statuses) into ONE compact
// CheckState vocabulary and an overall verdict. No I/O — trivially testable.
import type {
  CheckState,
  CheckSummary,
  StatusReport,
  ApiCheckRun,
  ApiCombinedStatus,
  ApiWorkflowRun,
  ApiDeploymentStatus,
} from "./types.js";

// GitHub uses two axes (status + conclusion); collapse to one state.
export function conclusionToState(status: string | undefined, conclusion: string | null | undefined): CheckState {
  if (status && status !== "completed") return "pending";
  switch (conclusion) {
    case "success": return "passing";
    case "failure": case "timed_out": case "action_required": case "startup_failure": return "failing";
    case "cancelled": return "cancelled";
    case "skipped": case "neutral": case "stale": return "skipped";
    default: return "pending";
  }
}

export function statusStateToState(state: string): CheckState {
  if (state === "success") return "passing";
  if (state === "failure" || state === "error") return "failing";
  return "pending";
}

export function deploymentStateToState(state: string): CheckState {
  if (state === "success") return "passing";
  if (state === "failure" || state === "error") return "failing";
  if (state === "inactive") return "skipped";
  return "pending";
}

// The precedence that decides an overall verdict from many checks: any failure
// dominates; then pending; then passing; then cancelled/skipped.
export function overallOf(states: CheckState[]): CheckState {
  if (states.some((s) => s === "failing")) return "failing";
  if (states.some((s) => s === "pending")) return "pending";
  if (states.some((s) => s === "passing")) return "passing";
  if (states.some((s) => s === "cancelled")) return "cancelled";
  return "skipped";
}

export function summarizeChecks(
  repo: string,
  ref: string,
  input: {
    checkRuns?: ApiCheckRun[];
    combined?: ApiCombinedStatus;
    workflowRuns?: ApiWorkflowRun[];
    deployments?: ApiDeploymentStatus[];
    url?: string;
  }
): StatusReport {
  const checks: CheckSummary[] = [];

  for (const c of input.checkRuns ?? []) {
    checks.push({ name: c.name, state: conclusionToState(c.status, c.conclusion), kind: "check", url: c.html_url, runId: c.id });
  }
  for (const s of input.combined?.statuses ?? []) {
    checks.push({ name: s.context, state: statusStateToState(s.state), kind: "status", url: s.target_url });
  }
  for (const w of input.workflowRuns ?? []) {
    checks.push({ name: w.name ?? `workflow ${w.id}`, state: conclusionToState(w.status, w.conclusion), kind: "workflow", url: w.html_url, runId: w.id });
  }
  for (const d of input.deployments ?? []) {
    checks.push({ name: `deploy: ${d.environment ?? "?"}`, state: deploymentStateToState(d.state), kind: "deployment", url: d.target_url ?? d.log_url });
  }

  const counts: Record<CheckState, number> = { passing: 0, failing: 0, pending: 0, cancelled: 0, skipped: 0 };
  for (const c of checks) counts[c.state]++;

  return { repo, ref, overall: overallOf(checks.map((c) => c.state)), checks, counts, url: input.url };
}

const ICON: Record<CheckState, string> = { passing: "✓", failing: "✗", pending: "•", cancelled: "⊘", skipped: "–" };

export function renderReport(r: StatusReport): string {
  const lines: string[] = [];
  lines.push(`${ICON[r.overall]} ${r.repo} @ ${r.ref} — ${r.overall.toUpperCase()}`);
  if (r.url) lines.push(`  ${r.url}`);
  const summary = Object.entries(r.counts).filter(([, n]) => n > 0).map(([s, n]) => `${n} ${s}`).join(", ");
  if (summary) lines.push(`  ${summary}`);
  for (const c of r.checks) lines.push(`  ${ICON[c.state]} ${c.name} (${c.state})${c.url ? ` → ${c.url}` : ""}`);
  lines.push(bottomLine(r));
  return lines.join("\n");
}

export function bottomLine(r: StatusReport): string {
  if (r.overall === "failing") {
    const failed = r.checks.filter((c) => c.state === "failing").map((c) => c.name);
    return `BOTTOM LINE: ${r.ref} is FAILING — ${failed.join(", ")}. Use what_broke / summarize_run for the cause.`;
  }
  if (r.overall === "pending") return `BOTTOM LINE: ${r.ref} checks are still running (${r.counts.pending} pending).`;
  if (r.overall === "passing") return `BOTTOM LINE: ${r.ref} is green — all required checks passed.`;
  return `BOTTOM LINE: ${r.ref} has no passing/failing checks (${r.overall}).`;
}
