#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as gh from "./github.js";
import { summarizeChecks, renderReport, deploymentStateToState, overallOf } from "./summarize.js";
import type { CheckState } from "./types.js";
import { summarizeFailure, renderFailure } from "./analyze.js";
import { detectChanges, renderChanges } from "./dedup.js";
import { loadState, saveState } from "./statefile.js";

const server = new McpServer(
  { name: "ghmonitor", version: "0.1.0" },
  {
    instructions:
      "GitHub delivery monitoring for a repository (set GITHUB_REPO + GITHUB_TOKEN, authorized read-only). " +
      "check_status: pass/fail/pending for a commit or the latest push. what_broke: the failing checks after a " +
      "push, WITH the failed-log diagnosis. pr_status: a PR's checks + mergeability. summarize_run: diagnose one " +
      "Actions run. deployment_status: latest deployment result. poll_changes: only NEW state-changes since last " +
      "call (deduped) — use for scheduled polling. It never exposes tokens and redacts credentials from logs.",
  }
);

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `BOTTOM LINE: ${message}` }], isError: true };
}

const repoArg = z.string().max(200).optional().describe("owner/name; defaults to GITHUB_REPO.");

async function resolveRef(owner: string, repo: string, ref?: string): Promise<string> {
  return ref && ref.trim() ? ref.trim() : gh.latestPushRef(owner, repo);
}

async function codeScanNote(owner: string, repo: string, ref: string): Promise<string> {
  try {
    const cs = await gh.codeScanning(owner, repo, ref);
    if (!cs.available) return "";
    return cs.open > 0 ? `\n  code-scanning: ${cs.open} open alert(s)` : "\n  code-scanning: clean";
  } catch {
    return "";
  }
}

server.registerTool(
  "check_status",
  {
    title: "Check Delivery Status (commit / latest push)",
    description:
      "Compact pass/fail/pending status for a commit (or the latest push on the default branch): GitHub Actions " +
      "workflows, required checks, commit statuses, and code-scanning results when available, each with a link. " +
      "Answers 'what's the status of my last push?'.",
    inputSchema: { ref: z.string().max(200).optional().describe("commit SHA or branch; default = latest push."), repo: repoArg },
  },
  async ({ ref, repo }) => {
    try {
      const { owner, repo: name } = gh.repoOf(repo);
      const sha = await resolveRef(owner, name, ref);
      const s = await gh.refStatus(owner, name, sha);
      const report = summarizeChecks(`${owner}/${name}`, sha.slice(0, 12), s);
      return textResult(renderReport(report) + (await codeScanNote(owner, name, sha)));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "what_broke",
  {
    title: "What Broke After the Last Push",
    description:
      "For the latest push (or a given ref): the failing checks PLUS a diagnosis of each — pulls the failed job's " +
      "logs, extracts the actionable error (redacted), and reports what failed, likely cause, impacted files, the " +
      "likely owner (commit author), and a suggested next step. Answers 'what broke after my last push?'.",
    inputSchema: { ref: z.string().max(200).optional(), repo: repoArg },
  },
  async ({ ref, repo }) => {
    try {
      const { owner, repo: name } = gh.repoOf(repo);
      const sha = await resolveRef(owner, name, ref);
      const s = await gh.refStatus(owner, name, sha);
      const report = summarizeChecks(`${owner}/${name}`, sha.slice(0, 12), s);
      if (report.overall !== "failing") return textResult(renderReport(report));

      const author = await gh.commitAuthor(owner, name, sha).catch(() => undefined);
      const failingRuns = report.checks.filter((c) => c.state === "failing" && c.runId != null && (c.kind === "workflow" || c.kind === "check"));
      const runIds = [...new Set(failingRuns.map((c) => c.runId!))].slice(0, 3);
      const diagnoses: string[] = [];
      for (const runId of runIds) {
        const jobs = await gh.runJobs(owner, name, runId).catch(() => []);
        for (const job of jobs.filter((j) => j.conclusion === "failure").slice(0, 2)) {
          const log = await gh.jobLog(owner, name, job.id).catch(() => "");
          diagnoses.push(renderFailure(summarizeFailure({ jobName: job.name, log, author, runUrl: job.html_url })));
        }
      }
      const head = renderReport(report);
      return textResult(diagnoses.length ? `${head}\n\n${"=".repeat(40)}\n${diagnoses.join(`\n${"-".repeat(40)}\n`)}` : head);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "pr_status",
  {
    title: "Pull Request Status",
    description: "A pull request's checks (Actions, required checks, statuses) on its head commit, plus mergeability. Answers 'check the status of this PR'.",
    inputSchema: { number: z.number().int().positive().describe("PR number."), repo: repoArg },
  },
  async ({ number, repo }) => {
    try {
      const { owner, repo: name } = gh.repoOf(repo);
      const pr = await gh.pull(owner, name, number);
      const s = await gh.refStatus(owner, name, pr.head.sha);
      const report = summarizeChecks(`${owner}/${name}`, `PR #${number}`, { ...s, url: pr.html_url });
      const merge = pr.mergeable_state ? `\n  mergeable_state: ${pr.mergeable_state}` : "";
      return textResult(renderReport(report) + merge + (await codeScanNote(owner, name, pr.head.sha)));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "summarize_run",
  {
    title: "Summarize a Failing Actions Run",
    description: "Diagnose one GitHub Actions workflow run: its failed jobs, the redacted actionable error from each, likely cause, impacted files, and next step. Answers 'summarize the failing GitHub Actions run'.",
    inputSchema: { run_id: z.number().int().positive(), repo: repoArg },
  },
  async ({ run_id, repo }) => {
    try {
      const { owner, repo: name } = gh.repoOf(repo);
      const jobs = await gh.runJobs(owner, name, run_id);
      const failed = jobs.filter((j) => j.conclusion === "failure");
      if (!failed.length) return textResult(`Run ${run_id} has no failed jobs (${jobs.length} job(s) total).\nBOTTOM LINE: nothing to diagnose — run ${run_id} did not fail.`);
      const parts: string[] = [];
      for (const job of failed.slice(0, 4)) {
        const log = await gh.jobLog(owner, name, job.id).catch(() => "");
        parts.push(renderFailure(summarizeFailure({ jobName: job.name, log, runUrl: job.html_url })));
      }
      return textResult(`Run ${run_id}: ${failed.length} failed job(s).\n\n${parts.join(`\n${"-".repeat(40)}\n`)}`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "deployment_status",
  {
    title: "Latest Deployment Status",
    description: "The most recent deployments and their state (success/failure/pending), with links. Answers 'show failures from the latest deployment'.",
    inputSchema: { repo: repoArg },
  },
  async ({ repo }) => {
    try {
      const { owner, repo: name } = gh.repoOf(repo);
      const deps = await gh.deployments(owner, name);
      if (!deps.length) return textResult(`No deployments found for ${owner}/${name}.\nBOTTOM LINE: this repo has no deployments recorded.`);
      const lines: string[] = [`DEPLOYMENTS for ${owner}/${name}:`];
      const states: CheckState[] = [];
      for (const d of deps) {
        const st = d.statuses[0];
        const state = st ? deploymentStateToState(st.state) : "pending";
        states.push(state);
        lines.push(`  ${state === "failing" ? "✗" : state === "passing" ? "✓" : "•"} ${d.deployment.environment} @ ${d.deployment.sha.slice(0, 12)} — ${state}${st?.target_url ? ` → ${st.target_url}` : ""}${st?.description ? ` (${st.description})` : ""}`);
      }
      const overall = overallOf(states);
      lines.push(overall === "failing" ? `BOTTOM LINE: the latest deployment(s) include FAILURES — see the ✗ lines.` : `BOTTOM LINE: latest deployment is ${overall}.`);
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "poll_changes",
  {
    title: "Poll for New State Changes (deduped)",
    description:
      "Compares current check states against the last poll and returns ONLY what changed or newly failed — never re-announces the same state for the same commit+check. Groups failures from the same workflow run. Use this for scheduled/event-driven monitoring so the conversation isn't flooded.",
    inputSchema: { ref: z.string().max(200).optional(), repo: repoArg },
  },
  async ({ ref, repo }) => {
    try {
      const { owner, repo: name } = gh.repoOf(repo);
      const sha = await resolveRef(owner, name, ref);
      const s = await gh.refStatus(owner, name, sha);
      const report = summarizeChecks(`${owner}/${name}`, sha.slice(0, 12), s);
      const prev = await loadState();
      const { changes, nextState } = detectChanges(report, prev, new Date().toISOString());
      await saveState(nextState);
      return textResult(renderChanges(report, changes));
    } catch (err) {
      return errorResult(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
