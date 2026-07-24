// Shared domain types. The GitHub API shapes are narrowed to just the fields
// this monitor reads, so the pure logic can be tested with tiny literals.

export type CheckState = "passing" | "failing" | "pending" | "cancelled" | "skipped";

export interface CheckSummary {
  name: string;
  state: CheckState;
  kind: "check" | "status" | "workflow" | "deployment" | "code-scanning";
  url?: string;
  runId?: number;
  jobId?: number;
}

export interface StatusReport {
  repo: string;
  ref: string; // sha, branch, or "PR #n"
  overall: CheckState;
  checks: CheckSummary[];
  counts: Record<CheckState, number>;
  url?: string; // PR or commit url
}

export interface FailureSummary {
  what: string; // what failed
  likelyCause: string;
  impactedFiles: string[];
  nextStep: string;
  errorExcerpt: string; // redacted, trimmed
  owner?: string; // likely owner (commit author) when determinable
}

// Minimal GitHub API shapes (only the fields used).
export interface ApiCheckRun {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null; // success | failure | cancelled | skipped | neutral | timed_out | action_required
  html_url?: string;
  id?: number;
}
export interface ApiCombinedStatus {
  state: "success" | "failure" | "pending";
  statuses: Array<{ context: string; state: string; target_url?: string; description?: string }>;
}
export interface ApiWorkflowRun {
  id: number;
  name?: string;
  head_sha?: string;
  status: string; // queued | in_progress | completed
  conclusion: string | null;
  html_url?: string;
  event?: string;
}
export interface ApiDeploymentStatus {
  state: string; // success | failure | error | pending | in_progress | queued | inactive
  environment?: string;
  description?: string;
  target_url?: string;
  log_url?: string;
}
