// Thin GitHub REST client. All HTTP lives here so the summarize/analyze/dedup
// logic stays pure and offline-testable. Authorized access only: a token from
// the environment (a fine-grained PAT, OAuth token, or GitHub App installation
// token) — never taken from tool arguments, never returned in output.
import type { ApiCheckRun, ApiCombinedStatus, ApiWorkflowRun, ApiDeploymentStatus } from "./types.js";

const API = "https://api.github.com";
const TIMEOUT_MS = Number(process.env.GHMONITOR_TIMEOUT_MS ?? 15_000);
const MAX_LOG_BYTES = Number(process.env.GHMONITOR_MAX_LOG_BYTES ?? 2_000_000);

export class ConfigError extends Error {}
export class PermissionError extends Error {}
export class NotFoundError extends Error {}
export class RateLimitError extends Error {}

export function repoOf(explicit?: string): { owner: string; repo: string } {
  const raw = (explicit ?? process.env.GITHUB_REPO ?? "").trim();
  const m = raw.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (!m) throw new ConfigError("No repository configured. Set GITHUB_REPO=owner/name in the environment, or pass repo=owner/name.");
  return { owner: m[1], repo: m[2] };
}

function token(): string {
  const t = (process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "").trim();
  if (!t) throw new ConfigError("No GitHub token. Set GITHUB_TOKEN (fine-grained PAT / OAuth / App token) with read access to Actions, Checks, Deployments, and Code scanning.");
  return t;
}

// Pure and exported so the "unavailable permissions" behavior is unit-tested.
export function mapStatus(status: number, path: string): Error {
  if (status === 401) return new PermissionError(`GitHub rejected the token (401) for ${path}. Confirm GITHUB_TOKEN is valid and not expired.`);
  if (status === 403) return new PermissionError(`Insufficient permissions (403) for ${path}. The token needs read access to Actions/Checks/Deployments/Code-scanning on this repository.`);
  if (status === 404) return new NotFoundError(`Not found (404): ${path}. Wrong repo/ref/PR, or the token can't see this private resource.`);
  if (status === 429) return new RateLimitError(`Rate limited (429) for ${path}. Wait and retry.`);
  return new Error(`GitHub API error ${status} for ${path}.`);
}

async function ghJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ghmonitor-mcp",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw mapStatus(res.status, path);
  return (await res.json()) as T;
}

// Tolerate features that may be off (code scanning) or empty: 403/404 → null.
async function ghJsonOptional<T>(path: string): Promise<T | null> {
  try {
    return await ghJson<T>(path);
  } catch (err) {
    if (err instanceof PermissionError || err instanceof NotFoundError) return null;
    throw err;
  }
}

export async function refStatus(owner: string, repo: string, ref: string) {
  const [checks, combined, runs] = await Promise.all([
    ghJsonOptional<{ check_runs: ApiCheckRun[] }>(`/repos/${owner}/${repo}/commits/${ref}/check-runs`),
    ghJsonOptional<ApiCombinedStatus>(`/repos/${owner}/${repo}/commits/${ref}/status`),
    ghJsonOptional<{ workflow_runs: ApiWorkflowRun[] }>(`/repos/${owner}/${repo}/actions/runs?head_sha=${encodeURIComponent(ref)}&per_page=20`),
  ]);
  return {
    checkRuns: checks?.check_runs ?? [],
    combined: combined ?? undefined,
    workflowRuns: runs?.workflow_runs ?? [],
  };
}

export async function latestPushRef(owner: string, repo: string, branch?: string): Promise<string> {
  const b = branch ?? (await ghJson<{ default_branch: string }>(`/repos/${owner}/${repo}`)).default_branch;
  const commits = await ghJson<Array<{ sha: string }>>(`/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(b)}&per_page=1`);
  if (!commits.length) throw new NotFoundError(`No commits on ${owner}/${repo}@${b}.`);
  return commits[0].sha;
}

export async function commitAuthor(owner: string, repo: string, ref: string): Promise<string | undefined> {
  const c = await ghJsonOptional<{ author?: { login?: string }; commit?: { author?: { name?: string } } }>(`/repos/${owner}/${repo}/commits/${ref}`);
  return c?.author?.login ?? c?.commit?.author?.name;
}

export async function pull(owner: string, repo: string, number: number) {
  return ghJson<{ number: number; head: { sha: string }; html_url: string; mergeable_state?: string; title: string; user?: { login: string } }>(
    `/repos/${owner}/${repo}/pulls/${number}`
  );
}

export async function runJobs(owner: string, repo: string, runId: number) {
  const r = await ghJson<{ jobs: Array<{ id: number; name: string; conclusion: string | null; html_url?: string }> }>(
    `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`
  );
  return r.jobs;
}

export async function jobLog(owner: string, repo: string, jobId: number): Promise<string> {
  // Redirects to a signed blob; fetch follows it. Cap the body.
  const res = await fetch(`${API}/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", "User-Agent": "ghmonitor-mcp" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) throw mapStatus(res.status, `job ${jobId} logs`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.subarray(0, MAX_LOG_BYTES).toString("utf8");
}

export async function deployments(owner: string, repo: string) {
  const deps = await ghJson<Array<{ id: number; environment: string; sha: string }>>(`/repos/${owner}/${repo}/deployments?per_page=5`);
  const withStatus = await Promise.all(
    deps.map(async (d) => ({
      deployment: d,
      statuses: (await ghJsonOptional<ApiDeploymentStatus[]>(`/repos/${owner}/${repo}/deployments/${d.id}/statuses?per_page=1`)) ?? [],
    }))
  );
  return withStatus;
}

export async function codeScanning(owner: string, repo: string, ref?: string): Promise<{ available: boolean; open: number }> {
  const q = ref ? `?ref=${encodeURIComponent(ref)}&state=open&per_page=100` : `?state=open&per_page=100`;
  const alerts = await ghJsonOptional<unknown[]>(`/repos/${owner}/${repo}/code-scanning/alerts${q}`);
  if (alerts === null) return { available: false, open: 0 };
  return { available: true, open: alerts.length };
}
