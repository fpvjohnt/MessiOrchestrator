#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as registry from "./registry.js";
import * as caseStore from "./case-store.js";
import * as clientManager from "./client-manager.js";
import { selectAssets } from "./router.js";
import { checkAssets, renderHealth } from "./health.js";
import { synthesizeCase } from "./synthesis.js";
import type { AssetConfig } from "./types.js";
import { resolve } from "node:path";
import { stat } from "node:fs/promises";

// Standing operating protocol handed to every client that connects (Desktop,
// Cowork, Claude Code) via the MCP `instructions` channel. This is where the
// self-verifying LOOP lives: the orchestrator has no LLM of its own, so the
// "checker" intelligence is the client driving these tools — and this tells it
// to always close the verify loop on facts, not just route once and stop.
// (Loop-engineering building block #3: durable Skills/project knowledge.)
const ORCHESTRATOR_INSTRUCTIONS = [
  "USE THIS ORCHESTRATOR AS THE FRONT DOOR. For any substantive user question that falls in a domain below, call open_case FIRST — before answering from your own knowledge or a plain web search. Do not skip it just because you could answer directly.",
  "The specialists cover: buying a home & mortgages; California & federal legal info; investing & retirement; health & medical navigation; job hunting & careers; technical & AI-engineering consulting; science & curiosity; education & studying; communication & persuasion; sports; world governments & immigration; world languages; world religions; agentic AI loop engineering — plus a 'research' asset for anything else factual, and an 'overseer' for auditing.",
  "PREFER the orchestrator's 'research' asset over ad-hoc/built-in web search, so facts come back corroborated and the work is logged in a case. Answer directly WITHOUT a case only for casual chat, clarifying questions, or when the user explicitly says not to use tools.",
  "",
  "Normal flow: open_case(objective) routes to the right asset(s) → task_asset calls their tools → synthesize_case merges → close_case records the outcome.",
  "The orchestrator itself is deterministic and has NO language model — YOU are the reasoning/checker in this loop. Do not stop at the first asset answer when it contains facts.",
  "",
  "THE VERIFY LOOP (run it before giving a final answer whenever the answer contains a CURRENT/LIVE fact — a price, rate, law, limit, statistic, date, model/framework specific — or any checkable factual claim):",
  "  1. Prefer the asset's OWN check tool if it has one, and run BOTH halves: check_claim→claim_verdict (curiosity), check_the_science→science_verdict (healthguide), check_practice→practice_verdict (loop), or verify_url (assets with reference data). That two-step IS the loop.",
  "  2. Otherwise task the 'research' asset to corroborate the key claim(s) and sources.",
  "  3. Label the final answer honestly: VERIFIED (research corroborated it), UPDATED (research found a newer/different value — give the corrected value + its source), or UNVERIFIED (couldn't confirm — say so plainly).",
  "",
  "MAKER ≠ CHECKER: the specialist asset is the 'maker'; 'research' (or the asset's own check tool) is the independent 'checker'. Never let the maker's answer be its own verification.",
  "FAIL SAFE: never present an unverified fact as verified. If research errors or can't confirm, return UNVERIFIED — do not round up.",
  "DON'T OVER-VERIFY: skip the loop for evergreen/explanatory content (how a mortgage works, what a Roth IRA is), the user's own preferences, and clearly non-factual asks. Verifying timeless explanations just burns tokens.",
  "CLOSE THE LOOP: call close_case with an outcome (resolved / partial / unresolved / misrouted) so the system can learn from what worked.",
].join("\n");

const server = new McpServer(
  {
    name: "orchestrator",
    version: "0.1.0",
  },
  { instructions: ORCHESTRATOR_INSTRUCTIONS }
);

// When THIS orchestrator process started — the reference point for staleness
// (an asset built after this is running code the process hasn't loaded).
const ORCHESTRATOR_STARTED_AT = new Date();

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// Cap what gets PERSISTED per log entry (the live tool response is not
// truncated). Without this, a verbose or hostile sub-server returning
// megabytes per call makes cases.json grow without bound, and every later
// appendLog/case_report pays to parse and rewrite all of it.
const MAX_LOGGED_CHARS = 8_192;

/**
 * Truncate for persistence WITHOUT destroying the structure synthesis reads.
 *
 * The previous version stored `JSON.stringify(value).slice(0, 8192)`, which
 * defeated the BOTTOM LINE convention entirely: serializing turns real
 * newlines into the two-character escape `\n`, so synthesis.ts's
 * `text.split("\n")` saw ONE line beginning `{"content":[{"type":"text",...`
 * and `/^\s*BOTTOM LINE/` never matched. A 20KB dossier whose FIRST line was a
 * BOTTOM LINE rendered as "(no headline extracted — returned data without a
 * BOTTOM LINE)" — blaming the asset for an omission it had not made. It hit
 * `research` hardest, which is both the fallback asset and the most verbose
 * one: 32 of 226 successful log entries were truncated, all of them research.
 *
 * So truncate the TEXT INSIDE the content blocks and keep the shape. The
 * headline survives because it is at the top of the text, and the newlines
 * survive because nothing is serialized on the way in.
 */
function capForLog(value: unknown): unknown {
  const serialized = JSON.stringify(value) ?? "null";
  if (serialized.length <= MAX_LOGGED_CHARS) return value;

  const content = (value as { content?: unknown })?.content;
  if (Array.isArray(content)) {
    // Share the budget across blocks so a many-block result can't blow past it.
    const perBlock = Math.max(512, Math.floor(MAX_LOGGED_CHARS / content.length));
    return {
      ...(value as object),
      truncated: true,
      originalChars: serialized.length,
      content: content.map((block) => {
        const text = (block as { text?: unknown })?.text;
        if (typeof text !== "string" || text.length <= perBlock) return block;
        return {
          ...(block as object),
          text: `${text.slice(0, perBlock)}\n[... ${text.length - perBlock} more characters truncated for the case log ...]`,
        };
      }),
    };
  }

  // Not a content-block result — fall back to the old behaviour, which is fine
  // for structured data nobody extracts a headline from.
  return {
    truncated: true,
    originalChars: serialized.length,
    preview: serialized.slice(0, MAX_LOGGED_CHARS),
  };
}

// ---------------------------------------------------------------------------
// Asset management — "recruiting" and "retiring" the MCP servers this
// orchestrator can task with work.
// ---------------------------------------------------------------------------

server.registerTool(
  "recruit_asset",
  {
    title: "Recruit Asset",
    description:
      "Register another MCP server as an asset this orchestrator can task with work. " +
      "Provide tags describing its capabilities so open_case can route objectives to it.",
    inputSchema: {
      name: z.string().min(1).describe('Unique short id, e.g. "filesystem" or "web-search".'),
      description: z.string().min(1).describe("What this asset does."),
      tags: z
        .array(z.string())
        .default([])
        .describe('Capability keywords used for routing, e.g. ["files", "search", "code"].'),
      transport: z.enum(["stdio", "http"]).describe("How to connect to this asset's MCP server."),
      command: z.string().optional().describe('stdio only: executable to launch, e.g. "npx".'),
      args: z.array(z.string()).optional().describe("stdio only: arguments for the command."),
      cwd: z.string().optional().describe("stdio only: working directory for the command."),
      env: z.record(z.string()).optional().describe("stdio only: extra environment variables."),
      url: z.string().url().optional().describe("http only: the server's endpoint URL."),
      fallback: z
        .boolean()
        .default(false)
        .describe(
          "Mark as a first-line responder: assigned to any objective that no other asset matches by " +
            "keyword (e.g. a research asset that should field every plain-language question)."
        ),
    },
  },
  async ({ name, description, tags, transport, command, args, cwd, env, url, fallback }) => {
    try {
      if (transport === "stdio" && !command) {
        throw new Error('transport "stdio" requires a command.');
      }
      if (transport === "http" && !url) {
        throw new Error('transport "http" requires a url.');
      }
      const cleanTags = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
      const asset: AssetConfig = {
        name: name.trim(),
        description,
        tags: cleanTags,
        transport,
        command,
        args,
        cwd,
        env,
        url,
        fallback,
        status: "active",
        registeredAt: new Date().toISOString(),
      };
      const outcome = await registry.addAsset(asset);
      const note = outcome === "reactivated" ? " (replacing a previously retired asset of the same name)" : "";
      return textResult(
        `Asset "${name}" recruited${note}. Tags: ${cleanTags.length ? cleanTags.join(", ") : "(none)"}.`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "update_asset",
  {
    title: "Update Asset",
    description:
      "Edit a registered asset's description/tags/connection config, and optionally reactivate it if " +
      "retired. Drops any live connection so the next call reconnects with the new configuration.",
    inputSchema: {
      name: z.string().min(1),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      transport: z.enum(["stdio", "http"]).optional(),
      command: z.string().optional(),
      args: z.array(z.string()).optional(),
      cwd: z.string().optional(),
      env: z.record(z.string()).optional(),
      url: z.string().url().optional(),
      fallback: z.boolean().optional().describe("Set the first-line-responder flag on/off."),
      reactivate: z.boolean().optional().describe("Set true to move a retired asset back to active."),
    },
  },
  async ({ name, tags, reactivate, ...patch }) => {
    try {
      const cleanTags = tags ? [...new Set(tags.map((t) => t.trim()).filter(Boolean))] : undefined;
      const asset = await registry.updateAsset(name, { ...patch, tags: cleanTags, reactivate });
      await clientManager.disconnect(name);
      return textResult(`Asset "${name}" updated. Status: ${asset.status}.`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "list_assets",
  {
    title: "List Assets",
    description:
      "List registered assets — one condensed line each by default (name, status, a short blurb, tag count). " +
      "Defaults to active assets only. Pass verbose:true for full descriptions and complete tag lists, or use " +
      "debrief_asset for one asset's actual tools.",
    inputSchema: {
      status: z
        .enum(["active", "retired", "all"])
        .default("active")
        .describe('Which assets to include (default "active" — pass "all" to include retired ones too).'),
      query: z.string().optional().describe("Case-insensitive substring match against name, description, or tags."),
      verbose: z
        .boolean()
        .default(false)
        .describe("Show full descriptions and complete tag lists instead of a condensed line."),
    },
  },
  async ({ status, query, verbose }) => {
    const all = await registry.listAssets();
    let matching = status === "all" ? all : all.filter((a) => a.status === status);
    if (query) {
      const q = query.toLowerCase();
      matching = matching.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (matching.length === 0) {
      return textResult(
        all.length === 0
          ? "No assets recruited yet. Use recruit_asset to register an MCP server."
          : "No assets match that filter."
      );
    }
    const lines = matching.map((a) => {
      const flags = `${a.status}${a.fallback ? ", fallback" : ""}`;
      if (verbose) {
        return `- ${a.name} [${flags}] (${a.transport}) — ${a.description} — tags: ${
          a.tags.length ? a.tags.join(", ") : "(none)"
        }`;
      }
      const blurb = a.description.length > 90 ? `${a.description.slice(0, 90)}…` : a.description;
      const tagCount = a.tags.length ? ` — ${a.tags.length} tags` : "";
      return `- ${a.name} [${flags}] (${a.transport}) — ${blurb}${tagCount}`;
    });
    const footer =
      status !== "all" || query
        ? `\n\n${matching.length} of ${all.length} total asset(s) shown. status:"all" clears the status filter.` +
          (verbose ? "" : " verbose:true for full descriptions.")
        : verbose
          ? ""
          : `\n\nverbose:true for full descriptions and complete tag lists.`;
    return textResult(lines.join("\n") + footer);
  }
);

server.registerTool(
  "retire_asset",
  {
    title: "Retire Asset",
    description: "Mark an asset as retired so it is no longer considered for routing, and disconnect it.",
    inputSchema: {
      name: z.string().min(1),
    },
  },
  async ({ name }) => {
    try {
      await registry.retireAsset(name);
      await clientManager.disconnect(name);
      return textResult(`Asset "${name}" retired.`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "debrief_asset",
  {
    title: "Debrief Asset",
    description: "Connect to a recruited asset and list the tools it exposes.",
    inputSchema: {
      name: z.string().min(1),
    },
  },
  async ({ name }) => {
    try {
      const asset = await registry.getAsset(name);
      if (!asset) throw new Error(`No asset named "${name}" is registered.`);
      const tools = await clientManager.listAssetTools(asset);
      if (tools.length === 0) return textResult(`Asset "${name}" exposes no tools.`);
      const lines = tools.map((t) => `- ${t.name}: ${t.description ?? "(no description)"}`);
      return textResult(`Asset "${name}" exposes:\n${lines.join("\n")}`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Case management — an objective, the assets assigned to it, and the trail
// of tasked calls and results ("the dossier").
// ---------------------------------------------------------------------------

server.registerTool(
  "open_case",
  {
    title: "Open Case",
    // The mandate is duplicated from ORCHESTRATOR_INSTRUCTIONS on purpose. The
    // `instructions` channel is advisory — a client may drop it — but tool
    // descriptions always reach the model. This is the load-bearing copy.
    description:
      "THE FRONT DOOR — call this FIRST for any substantive question, before answering from your " +
      "own knowledge or a plain web search, and do not skip it just because you could answer directly. " +
      "Opens a case and routes it to the best-matching specialists: home buying & mortgages, " +
      "California/federal legal info, investing & retirement, health navigation, job hunting, " +
      "technical & AI consulting, science, education, communication, sports, governments & " +
      "immigration, languages, religions, agentic AI loops — plus 'research' for anything else " +
      "factual. Routes by tag/description overlap unless preferred_assets is given. Skip only for " +
      "casual chat, clarifying questions, or when the user says not to use tools. " +
      "Then: task_asset → synthesize_case → close_case.",
    inputSchema: {
      objective: z.string().min(1).describe("What you're trying to accomplish."),
      preferred_assets: z
        .array(z.string())
        .optional()
        .describe("Explicit asset names to assign instead of auto-routing."),
    },
  },
  async ({ objective, preferred_assets }) => {
    try {
      const allAssets = await registry.listAssets();
      let assigned: string[];
      let rationale: string;

      if (preferred_assets && preferred_assets.length > 0) {
        const unknown = preferred_assets.filter((n) => !allAssets.some((a) => a.name === n));
        if (unknown.length > 0) {
          throw new Error(`Unknown asset(s): ${unknown.join(", ")}`);
        }
        const inactive = preferred_assets.filter(
          (n) => allAssets.find((a) => a.name === n)?.status !== "active"
        );
        if (inactive.length > 0) {
          throw new Error(`Asset(s) not active: ${inactive.join(", ")}. Reactivate with update_asset first.`);
        }
        assigned = preferred_assets;
        rationale = "explicitly requested";
      } else {
        const selection = selectAssets(objective, allAssets);
        assigned = selection.assigned;
        rationale = selection.rationale;
      }

      const caseRecord = await caseStore.createCase(objective, assigned);
      return textResult(
        `Case ${caseRecord.id} opened.\nObjective: ${objective}\nAssigned assets: ${
          assigned.length ? assigned.join(", ") : "(none)"
        }\nRouting rationale: ${rationale}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "assign_asset",
  {
    title: "Assign Asset to Case",
    description:
      "Add an additional active asset to an already-open case — e.g. when auto-routing at open_case " +
      "found no match, or the objective grew a new angle.",
    inputSchema: {
      case_id: z.string().min(1),
      asset: z.string().min(1),
    },
  },
  async ({ case_id, asset }) => {
    try {
      const caseRecord = await caseStore.getCase(case_id);
      if (!caseRecord) throw new Error(`No case with id "${case_id}" found.`);
      if (caseRecord.status === "closed") throw new Error(`Case ${case_id} is closed.`);
      const assetConfig = await registry.getAsset(asset);
      if (!assetConfig) throw new Error(`No asset named "${asset}" is registered.`);
      if (assetConfig.status !== "active") throw new Error(`Asset "${asset}" is retired.`);
      await caseStore.assignAsset(case_id, asset);
      return textResult(`Asset "${asset}" assigned to case ${case_id}.`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "task_asset",
  {
    title: "Task Asset",
    description: "Call a tool on an asset assigned to a case and record the result in the case log.",
    inputSchema: {
      case_id: z.string().min(1),
      asset: z.string().min(1),
      tool: z.string().min(1),
      arguments: z.record(z.any()).optional().describe("Arguments to pass to the asset's tool."),
    },
  },
  async ({ case_id, asset, tool, arguments: toolArgs }) => {
    const timestamp = new Date().toISOString();
    const startedMs = Date.now();
    try {
      const caseRecord = await caseStore.getCase(case_id);
      if (!caseRecord) throw new Error(`No case with id "${case_id}" found.`);
      if (caseRecord.status === "closed") throw new Error(`Case ${case_id} is closed.`);
      if (!caseRecord.assignedAssets.includes(asset)) {
        throw new Error(
          `Asset "${asset}" is not assigned to case ${case_id}. Assigned assets: ${
            caseRecord.assignedAssets.join(", ") || "(none)"
          }. Use assign_asset to add it first.`
        );
      }
      const assetConfig = await registry.getAsset(asset);
      if (!assetConfig) throw new Error(`No asset named "${asset}" is registered.`);
      if (assetConfig.status !== "active") throw new Error(`Asset "${asset}" is retired.`);

      const result = await clientManager.callAssetTool(assetConfig, tool, toolArgs);
      // Stamp the duration BEFORE the store write. It used to be evaluated
      // inside the object literal — i.e. after appendLog had already begun —
      // which folded ~11ms of load+fsync+rename into every "asset latency"
      // number the overseer reports. Measure the asset, not the bookkeeping.
      const durationMs = Date.now() - startedMs;
      await caseStore.appendLog(case_id, {
        asset,
        tool,
        arguments: capForLog(toolArgs ?? {}),
        result: capForLog(result),
        timestamp,
        durationMs,
      });
      // Forward the asset's own content blocks directly instead of
      // JSON-stringifying the whole CallToolResult, so non-text content
      // (images, embedded resources) survives intact and isError propagates.
      // callTool()'s return type is a loose union when no resultSchema is
      // passed, so narrow both fields defensively before reusing them.
      const assetContent = Array.isArray(result.content) ? result.content : [];
      const assetIsError = typeof result.isError === "boolean" ? result.isError : undefined;
      return {
        content: [{ type: "text" as const, text: `Result from ${asset}.${tool}:` }, ...assetContent],
        isError: assetIsError,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await caseStore
        .appendLog(case_id, { asset, tool, arguments: capForLog(toolArgs ?? {}), error: message, timestamp, durationMs: Date.now() - startedMs })
        // An empty catch here hid a real failure mode: if cases.json is locked
        // or unparseable, calls silently stop being recorded and every later
        // report — case_report, synthesize_case, the whole overseer — quietly
        // describes less than actually happened. It still must not mask the
        // original error, so it is reported on stderr rather than thrown.
        .catch((logErr) => {
          console.error(
            `[task_asset] FAILED TO LOG ${asset}.${tool} on case ${case_id}: ${
              logErr instanceof Error ? logErr.message : String(logErr)
            } — the case record is now incomplete.`
          );
        });
      return errorResult(err);
    }
  }
);

server.registerTool(
  "case_report",
  {
    title: "Case Report",
    description: "Compile the full dossier for a case: objective, assigned assets, and the tasking log.",
    inputSchema: {
      case_id: z.string().min(1),
    },
  },
  async ({ case_id }) => {
    try {
      const caseRecord = await caseStore.getCase(case_id);
      if (!caseRecord) throw new Error(`No case with id "${case_id}" found.`);

      const logLines = caseRecord.log.map((entry) => {
        const outcome = entry.error ? `ERROR: ${entry.error}` : JSON.stringify(entry.result);
        return `  [${entry.timestamp}] ${entry.asset}.${entry.tool}(${JSON.stringify(entry.arguments)}) -> ${outcome}`;
      });

      const report = [
        `Case ${caseRecord.id} [${caseRecord.status}]`,
        `Objective: ${caseRecord.objective}`,
        `Assigned assets: ${caseRecord.assignedAssets.join(", ") || "(none)"}`,
        `Opened: ${caseRecord.openedAt}`,
        caseRecord.closedAt ? `Closed: ${caseRecord.closedAt}` : null,
        caseRecord.summary ? `Summary: ${caseRecord.summary}` : null,
        "Tasking log:",
        logLines.length ? logLines.join("\n") : "  (no tasks run yet)",
      ]
        .filter(Boolean)
        .join("\n");

      return textResult(report);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "synthesize_case",
  {
    title: "Synthesize Case",
    description:
      "Merge a case's multiple asset results into ONE synthesis-ready digest instead of side-by-side outputs: " +
      "each asset's BOTTOM LINE headline, the merged key points, all sources cited, and flags (errors, " +
      "single-source, unverified). The 'correlate, don't concatenate' step — deterministic, no model call.",
    inputSchema: { case_id: z.string().min(1) },
  },
  async ({ case_id }) => {
    try {
      const caseRecord = await caseStore.getCase(case_id);
      if (!caseRecord) throw new Error(`No case with id "${case_id}" found.`);
      return textResult(synthesizeCase(caseRecord));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "list_cases",
  {
    title: "List Cases",
    description:
      "List cases with their status and objective, most recent first. Defaults to the 20 most recent " +
      "across all statuses — pass status/query to narrow, or a higher limit to look further back.",
    inputSchema: {
      status: z.enum(["open", "closed"]).optional().describe("Only cases in this status."),
      query: z.string().optional().describe("Case-insensitive substring match against the objective."),
      limit: z.number().int().positive().max(200).default(20).describe("Max cases to return (default 20, max 200)."),
    },
  },
  async ({ status, query, limit }) => {
    const all = await caseStore.listCases();
    let matching = status ? all.filter((c) => c.status === status) : all;
    if (query) {
      const q = query.toLowerCase();
      matching = matching.filter((c) => c.objective.toLowerCase().includes(q));
    }
    if (matching.length === 0) {
      return textResult(all.length === 0 ? "No cases opened yet." : "No cases match that filter.");
    }
    // Cases are stored oldest-first; reverse so a limited view surfaces recent
    // activity instead of silently returning the oldest cases in the store.
    const newestFirst = [...matching].reverse();
    const shown = newestFirst.slice(0, limit);
    const lines = shown.map((c) => `- ${c.id} [${c.status}] ${c.objective}`);
    const footer =
      matching.length > shown.length
        ? `\n\nShowing ${shown.length} of ${matching.length} matching case(s) (${all.length} total). Increase limit, or narrow with status/query.`
        : matching.length !== all.length
          ? `\n\n${matching.length} matching case(s) of ${all.length} total.`
          : "";
    return textResult(lines.join("\n") + footer);
  }
);

server.registerTool(
  "close_case",
  {
    title: "Close Case",
    description:
      "Close a case, optionally recording a final summary and an OUTCOME — the feedback signal for " +
      "overseer's quality report. outcome: 'resolved' (objective met), 'partial' (some help), 'unresolved' " +
      "(right asset, no useful answer), 'misrouted' (went to the wrong asset). Record it honestly; it's how " +
      "the system learns whether routing and answers actually worked.",
    inputSchema: {
      case_id: z.string().min(1),
      summary: z.string().optional(),
      outcome: z.enum(["resolved", "partial", "unresolved", "misrouted"]).optional(),
    },
  },
  async ({ case_id, summary, outcome }) => {
    try {
      const caseRecord = await caseStore.closeCase(case_id, summary, outcome);
      return textResult(`Case ${caseRecord.id} closed${outcome ? ` (outcome: ${outcome})` : ""}.`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "health_check",
  {
    title: "Health Check",
    description:
      "Platform liveness + staleness probe: connects to every active asset and reports whether it's reachable, " +
      "how many tools it exposes, its reported version, and whether its built code is STALE (rebuilt after this " +
      "orchestrator started — meaning a restart is needed to load it). The answer to 'are all assets up and current?'",
    inputSchema: {},
  },
  async () => {
    try {
      const assets = await registry.listAssets();
      const results = await checkAssets(assets, {
        orchestratorStartedAt: ORCHESTRATOR_STARTED_AT,
        introspect: (a) => clientManager.introspectAsset(a),
        entryMtime: async (a) => {
          // Only stdio assets launched from a local script have a build file to stat.
          const entry = a.args?.[0];
          if (a.transport !== "stdio" || !entry) return undefined;
          const path = resolve(a.cwd ?? process.cwd(), entry);
          const s = await stat(path);
          return s.mtime;
        },
      });
      return textResult(renderHealth(results, ORCHESTRATOR_STARTED_AT));
    } catch (err) {
      return errorResult(err);
    }
  }
);

let shuttingDown = false;
async function shutdownAndExit(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await clientManager.disconnectAll();
  process.exit(0);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stdin EOF is the normal MCP shutdown handshake when the client exits.
  // Without this, live child-process handles for connected assets keep the
  // event loop alive and the orchestrator (plus every sub-server) lingers
  // as an orphaned process tree — signals alone don't cover this path,
  // especially on Windows where SIGTERM delivery isn't supported.
  process.stdin.on("end", () => void shutdownAndExit());
  process.stdin.on("close", () => void shutdownAndExit());

  // Parent-death watchdog: if Claude (our parent) dies WITHOUT cleanly closing
  // our stdin — a hard kill, crash, or abrupt reboot — the stdin-EOF handlers
  // above may never fire, and we would linger holding a whole tree of asset
  // child processes as orphans. Poll the parent's liveness and, when it's gone,
  // shut down gracefully (disconnectAll kills the children) so residual process
  // trees can't pile up across reboots. unref() so this timer never keeps us alive.
  const parentPid = process.ppid;
  setInterval(() => {
    try {
      process.kill(parentPid, 0); // signal 0 = liveness probe; throws if gone
    } catch {
      void shutdownAndExit();
    }
  }, 5000).unref();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void shutdownAndExit());
}

main().catch((err) => {
  console.error("Fatal error starting orchestrator MCP server:", err);
  process.exit(1);
});
