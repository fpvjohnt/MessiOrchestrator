#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadJsonArray } from "./json-store.js";
import { DEFAULT_CASES_PATH, DEFAULT_REGISTRY_PATH, resolvePath } from "./paths.js";
import { findCase, replayCase } from "./replay.js";
import { auditReport } from "./audit.js";
import { detectRoutingDrift } from "./drift.js";
import { analyzeErrors } from "./errors.js";
import { detectAnswerDrift } from "./answer-drift.js";
import { outcomeReport } from "./outcome.js";
import { latencyReport } from "./latency.js";
import type { AssetConfig, Case } from "./types.js";

const server = new McpServer({ name: "overseer", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

// Shared override params on every tool — same trust model as fetch_page/etc.
// elsewhere in this system: local stdio server, caller-supplied path, no
// network exposure. Bad paths/JSON surface as a normal tool error, not a crash.
const pathParams = {
  cases_path: z.string().min(1).max(500).optional().describe("Path to an orchestrator's cases.json. Defaults to the orchestrator this MCP ships beside."),
  registry_path: z.string().min(1).max(500).optional().describe("Path to an orchestrator's registry.json. Defaults to the orchestrator this MCP ships beside."),
};

server.registerTool(
  "replay_case",
  {
    title: "Replay a Case",
    description:
      "Render one case's full timeline: objective, routing, and every asset call in order with its arguments and " +
      "result/error. The 'what did the agent system actually do' answer — pass a case_id from list_cases_brief.",
    inputSchema: { case_id: z.string().min(1).max(100), ...pathParams },
  },
  async ({ case_id, cases_path }) => {
    try {
      const path = resolvePath(cases_path, DEFAULT_CASES_PATH);
      const cases = await loadJsonArray<Case>(path);
      const found = findCase(cases, case_id);
      if (!found) return errorResult(`No case "${case_id}" found in ${path}.`);
      return textResult(replayCase(found));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "list_cases_brief",
  {
    title: "List Cases (Brief)",
    description: "One line per case: id, status, objective. Use to find a case_id for replay_case.",
    inputSchema: { status: z.enum(["open", "closed"]).optional(), ...pathParams },
  },
  async ({ status, cases_path }) => {
    try {
      const path = resolvePath(cases_path, DEFAULT_CASES_PATH);
      const cases = await loadJsonArray<Case>(path);
      const filtered = status ? cases.filter((c) => c.status === status) : cases;
      if (filtered.length === 0) return textResult("No cases found.");
      return textResult(filtered.map((c) => `${c.id} [${c.status}] ${c.objective}`).join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "audit_report",
  {
    title: "Audit Report",
    description:
      "Summarize an orchestrator's case-store: open/closed counts, calls and errors per asset, and any asset " +
      "that was called but never (or no longer) registered. The system-health snapshot.",
    inputSchema: { status: z.enum(["open", "closed"]).optional(), ...pathParams },
  },
  async ({ status, cases_path, registry_path }) => {
    try {
      const casesFile = resolvePath(cases_path, DEFAULT_CASES_PATH);
      const registryFile = resolvePath(registry_path, DEFAULT_REGISTRY_PATH);
      const cases = await loadJsonArray<Case>(casesFile);
      const assets = await loadJsonArray<AssetConfig>(registryFile);
      return textResult(auditReport(cases, assets, status));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "detect_drift",
  {
    title: "Detect Routing Drift",
    description:
      "Find questions that were asked more than once but got routed to DIFFERENT assets over time — the " +
      "system's behavior changing under you (a fix, or a regression). Groups cases by objective similarity " +
      "and flags any group whose assigned assets weren't consistent. Deterministic, no model call.",
    inputSchema: {
      similarity: z.number().min(0.1).max(1).optional().describe("Token-overlap threshold to call two questions 'the same' (default 0.6). Lower = looser grouping."),
      min_group: z.number().int().min(2).max(50).optional().describe("Minimum repeats before a question is checked for drift (default 2)."),
      ...pathParams,
    },
  },
  async ({ similarity, min_group, cases_path }) => {
    try {
      const path = resolvePath(cases_path, DEFAULT_CASES_PATH);
      const cases = await loadJsonArray<Case>(path);
      return textResult(detectRoutingDrift(cases, similarity ?? 0.6, min_group ?? 2));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "analyze_errors",
  {
    title: "Analyze Errors",
    description:
      "Surface WHAT actually failed (audit_report only counts). Pulls every logged error, groups identical " +
      "failures with a count and a sample message, most frequent first. Optional asset filter.",
    inputSchema: { asset: z.string().min(1).max(100).optional().describe("Only this asset's errors."), ...pathParams },
  },
  async ({ asset, cases_path }) => {
    try {
      const path = resolvePath(cases_path, DEFAULT_CASES_PATH);
      const cases = await loadJsonArray<Case>(path);
      return textResult(analyzeErrors(cases, asset));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "detect_answer_drift",
  {
    title: "Detect Answer Drift",
    description:
      "Find deterministic tools whose answer CHANGED for an identical call (same asset, tool, and arguments, " +
      "different result over time) — meaning the code behind it changed. Skips non-deterministic assets " +
      "(research hits the live web) by default. Complements detect_drift, which watches routing not answers.",
    inputSchema: {
      skip_assets: z.array(z.string().max(100)).max(20).optional().describe('Whole assets whose output is expected to vary (default ["research"]).'),
      skip_tools: z.array(z.string().max(120)).max(40).optional().describe('Specific "asset.tool" entries known to read external state (clock/context/config), e.g. "homebuyer.get_reference".'),
      ...pathParams,
    },
  },
  async ({ skip_assets, skip_tools, cases_path }) => {
    try {
      const path = resolvePath(cases_path, DEFAULT_CASES_PATH);
      const cases = await loadJsonArray<Case>(path);
      return textResult(detectAnswerDrift(cases, skip_assets ?? ["research"], skip_tools ?? []));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "outcome_report",
  {
    title: "Outcome Report",
    description:
      "The quality signal: how closed cases actually turned out (resolved/partial/unresolved/misrouted), the " +
      "resolution rate, and a per-asset breakdown of which assets' cases work out. Honest about coverage — " +
      "reports how many closed cases are actually labeled, since a rate over a handful of cases is noise.",
    inputSchema: { ...pathParams },
  },
  async ({ cases_path }) => {
    try {
      const path = resolvePath(cases_path, DEFAULT_CASES_PATH);
      const cases = await loadJsonArray<Case>(path);
      return textResult(outcomeReport(cases));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "latency_report",
  {
    title: "Latency Report",
    description:
      "How slow each asset is (avg/p50/p95/max) and the slowest individual calls, from the per-call duration " +
      "the orchestrator records. Coverage-honest: only counts timed calls. Optional asset filter.",
    inputSchema: { asset: z.string().min(1).max(100).optional().describe("Only this asset's calls."), ...pathParams },
  },
  async ({ asset, cases_path }) => {
    try {
      const path = resolvePath(cases_path, DEFAULT_CASES_PATH);
      const cases = await loadJsonArray<Case>(path);
      return textResult(latencyReport(cases, asset));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description: "What this MCP does and how to use it.",
    inputSchema: {},
  },
  async () =>
    textResult(
      [
        `BOTTOM LINE: this watches an orchestrator's case-store so you can answer "what did the agent system actually do?"`,
        ``,
        `  • See recent activity -> 'list_cases_brief' (optionally status: "open" or "closed").`,
        `  • See exactly what happened in one case -> 'replay_case <case_id>'.`,
        `  • Get the health snapshot -> 'audit_report' (calls/errors per asset, unregistered-asset warnings).`,
        `  • See if routing changed over time -> 'detect_drift' (same question, different assets = a fix or a regression).`,
        `  • See what actually failed -> 'analyze_errors' (the real error messages, grouped).`,
        `  • See if a deterministic answer changed -> 'detect_answer_drift' (same exact call, different result).`,
        `  • See if cases actually WORKED -> 'outcome_report' (resolution rate + per-asset, from close_case outcomes).`,
        `  • See what's SLOW -> 'latency_report' (avg/p95/max per asset, slowest calls).`,
        ``,
        `Defaults to the orchestrator this MCP ships beside. Pass cases_path/registry_path to point at a different orchestrator's data files entirely.`,
      ].join("\n")
    )
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("close", () => process.exit(0));
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => process.exit(0));
}
main().catch((err) => {
  console.error("Fatal error starting overseer MCP server:", err);
  process.exit(1);
});
