#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as registry from "./registry.js";
import * as caseStore from "./case-store.js";
import * as clientManager from "./client-manager.js";
import { selectAssets, explainRouting } from "./router.js";
import { checkAssets, checkSelf, renderHealth } from "./health.js";
import { contextGaps, expectsDecision, renderGaps } from "./context-gaps.js";
import { synthesizeCase, renderOutcome } from "./synthesis.js";
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
  "DEFAULT TO THIS ORCHESTRATOR FOR EVERY REQUEST. Your FIRST action for any user message that asks for information, analysis, a recommendation, a decision, a how-to, or a task is to call open_case — before answering from your own knowledge, before a plain web search, and before any other MCP server's tools. Do not skip it because you think you already know the answer: the case is how the work gets routed to a specialist, verified, and logged. WHEN IN DOUBT, OPEN A CASE.",
  "The specialists cover: buying a home & mortgages; California & federal legal info; investing & retirement; health & medical navigation; job hunting & careers; technical & AI-engineering consulting; science & curiosity; education & studying; communication & persuasion; sports; world governments & immigration; world languages; world religions; agentic AI loop engineering; live Kalshi prediction-market prices; ElevenLabs voice (text-to-speech / transcription); YouTube audience research — public video/channel/comment statistics, growth velocity and topic clusters, plus age-group/gender/country/device/OS demographics for a channel the user OWNS (owner-only: Google exposes these nowhere else and not at all for other people's channels) — plus a 'research' asset for anything else factual, and an 'overseer' for auditing. If nothing fits, open_case still routes to 'research', so it is ALWAYS the right first call.",
  "PREFER the orchestrator's 'research' asset over ad-hoc/built-in web search, so facts come back corroborated and the work is logged in a case. The ONLY messages that skip open_case are: greetings and pure chit-chat; a clarifying question back to the user; a follow-up you can answer from a case that is already open; or when the user EXPLICITLY says not to use tools. Everything else opens a case.",
  "",
  "FAST PATH (do this to keep cases quick): open_case(objective) → ONE task_assets call that runs the chosen specialists AND the research verifier in PARALLEL → synthesize_case → close_case. Every extra sequential task_asset call is another slow round-trip; batch them. Only fall back to single task_asset for a genuine follow-up that depends on a previous result.",
  "LOOK AHEAD on a COMPLEX or multi-asset request: call plan_case(objective) FIRST to preview which specialists will be assigned (and why), the near-misses, and the batch flow — so the plan is visible and correctable BEFORE you spend calls. If the routing looks wrong, fix the objective wording or pass preferred_assets. Skip plan_case for a simple single-domain question and just run the fast path.",
  "KEEP CASES FAST — minimize round-trips (each tool call is a slow hop, especially over the phone bridge): do the whole case in as FEW tool calls as you can — skip plan_case unless the request is genuinely complex, then ONE task_assets batch -> synthesize_case -> close_case — and never make many sequential task_asset calls.",
  "DO NOT ASK — JUST GO: for a normal information / analysis / how-to / lookup request, ask NO clarifying question and request NO permission — route straight to the orchestrator and answer immediately, making the single most sensible assumption if anything is unspecified (mention it in one short line only if it materially matters). The user wants a straight answer fast, not a question back. The ONLY thing that still pauses for a one-line confirm is an irreversible or outward-facing ACTION about to happen — submitting a form, sending a message, making a purchase. Everything else: proceed without asking.",
  // Added 2026-08-05 at John's direct request: "explain it like a child would and
  // be straight and to the point, don't give so much."
  //
  // A NARROWER version of commit b4e0092, which was reverted the same day it
  // landed. That one failed for two specific reasons, and both are deliberately
  // absent here: it told the model to give ONE paragraph and then pause to ask
  // "want the next part?", which turned every answer into a two-step and fought
  // the DO-NOT-ASK rule directly above; and it offered to build visuals and
  // animations, which he separately asked to stop because generating them makes
  // him wait. Plain and SHORT is the part he actually wanted. Keep it that way.
  "PLAIN AND SHORT — HOW THIS USER WANTS TO BE ANSWERED: use everyday words, the way you would explain something to a smart child. No jargon; if a technical word is truly unavoidable, define it in one short line. Lead with the ANSWER in the first sentence — never with background, a recap of the question, or a preamble about what you are about to do. Then give only what is needed to act on it, and STOP. Do not write section headers, tables, or long lists unless he asked for one. Do not narrate your process or list everything you checked. Depth is available on request: it is fine to end with one short offer like 'want the detail?', but never pause mid-answer to ask permission to continue, and never make an animation or visual. A long answer is not a more helpful answer to him — it is a harder one.",
  "SPEED NEVER COMES FROM SKIPPING VERIFICATION. Keep the full verify loop on any current/checkable fact — a fast WRONG answer is worse than a correct one, and every fact must trace to a REAL source. Make verification cost nothing extra by running the research verifier IN THE SAME task_assets batch as the specialists (they execute in PARALLEL, so the check adds no round-trip), then label VERIFIED / UPDATED / UNVERIFIED and cite the source. The speed-ups above come from batching calls and asking fewer questions — never from trusting an unverified claim.",
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
//
// RAISED 8,192 -> 32,768 on 2026-08-05, measured against the real case log
// rather than guessed (AGENTS.md: "do not set a length cap you have not
// measured"). At 8 KB the cap was cutting 133 of 1,065 successful calls —
// 12.5%, discarding 581,585 characters — and 132 of those 133 were `research`,
// which is both the fallback asset that rides along on ~45% of traffic and the
// one that carries the corroborated facts and the source URLs.
//
// That mattered more than a storage number, because synthesize_case reads the
// LOG, not the live response. One call in eight was being merged into a final
// answer from a truncated body: the sources at the bottom of a research dossier
// were the first thing to go, and "No sources cited" is a FLAG that changes how
// the answer must be written. The cap was manufacturing that flag.
//
// Sizing: of the 133 truncated entries the largest original was 30,986 chars
// (p50 9,571 / p90 20,427 / p99 25,927). 32 KB clears 100% of observed traffic
// with headroom; 16 KB would still have cut 22% of them. Cost is about 0.6 MB
// on a 2.9 MB cases.json, and archive-cases.mjs already bounds long-term growth.
const MAX_LOGGED_CHARS = 32_768;

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
  "plan_case",
  {
    title: "Plan a Case (preview the next actions before executing)",
    description:
      "Look-ahead: preview WHAT WILL HAPPEN for an objective BEFORE opening or executing it. Returns the " +
      "deterministic routing (which specialists would be assigned and why, plus the runner-up near-misses and why " +
      "they lost), whether a research verifier will ride along, and the suggested one-batch execution flow. Call " +
      "this FIRST on a complex or multi-asset request so the plan is visible and correctable — then open_case -> " +
      "task_assets -> synthesize_case -> close_case. If the routing looks wrong, adjust the objective or pass " +
      "preferred_assets to open_case. Read-only; changes nothing.",
    inputSchema: {
      objective: z.string().min(1).describe("What you're trying to accomplish."),
      preferred_assets: z.array(z.string()).optional().describe("If set, the plan uses these instead of the auto-routing (same override open_case accepts)."),
    },
  },
  async ({ objective, preferred_assets }) => {
    try {
      const all = await registry.listAssets();
      const active = new Set(all.filter((a) => a.status === "active").map((a) => a.name));
      const e = explainRouting(objective, all);
      const assigned = preferred_assets?.length ? preferred_assets.filter((a) => active.has(a)) : e.assigned;

      const lines: string[] = [`CASE: ${objective}`, ``];
      lines.push(`ROUTING PLAN${preferred_assets?.length ? " (preferred_assets override)" : " (auto-routed)"}:`);
      if (assigned.length) {
        for (const name of assigned) {
          const row = e.candidates.find((c) => c.name === name);
          lines.push(`  → ${name}${row?.matchedTags.length ? ` (tags: ${row.matchedTags.join(", ")})` : ""}`);
        }
      } else {
        lines.push(`  → (no specialist matched — would fall back to research)`);
      }
      const nearMiss = e.candidates.filter((c) => c.verdict !== "assigned").slice(0, 3);
      if (nearMiss.length) {
        lines.push(``, `NEAR-MISSES (not assigned):`);
        for (const c of nearMiss) lines.push(`  ~ ${c.name} — ${c.verdict}${c.matchedTags.length ? ` (tags: ${c.matchedTags.join(", ")})` : ""}`);
      }
      lines.push(``, `SUGGESTED EXECUTION:`);
      lines.push(`  1. open_case(objective${preferred_assets?.length ? `, preferred_assets: [${assigned.join(", ")}]` : ""})`);
      lines.push(`  2. task_assets — ONE parallel batch across ${assigned.length ? assigned.join(", ") : "research"}${e.verifierAdded && !assigned.includes("research") ? " + research (verifier)" : ""}`);
      lines.push(`  3. synthesize_case -> close_case (label VERIFIED / UPDATED / UNVERIFIED)`);
      lines.push(``, e.verifierAdded ? `VERIFY: this objective looks fact-sensitive — research will ride along as the independent checker.` : `VERIFY: evergreen/explanatory — the verify loop can likely be skipped (don't over-verify).`);
      lines.push(``, `REVIEW THIS PLAN, then execute. If a specialist is wrong or missing, adjust the objective wording or pass preferred_assets.`);
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "open_case",
  {
    title: "Open Case",
    // The mandate is duplicated from ORCHESTRATOR_INSTRUCTIONS on purpose. The
    // `instructions` channel is advisory — a client may drop it — but tool
    // descriptions always reach the model. This is the load-bearing copy.
    description:
      "THE DEFAULT FRONT DOOR — call this FIRST for ANY user request that asks for information, " +
      "analysis, a recommendation, a decision, a how-to, or a task, before answering from your own " +
      "knowledge, before a plain web search, and before any other MCP server's tools. Do not skip it " +
      "because you think you already know the answer. WHEN IN DOUBT, OPEN A CASE. " +
      "Opens a case and routes it to the best-matching specialists: home buying & mortgages, " +
      "California/federal legal info, investing & retirement, health navigation, job hunting, " +
      "technical & AI consulting, science, education, communication, sports, governments & " +
      "immigration, languages, religions, agentic AI loops, live Kalshi prices, ElevenLabs voice, " +
      "YouTube audience research (video/channel stats, growth, topics, and owner-only viewer " +
      "demographics) — " +
      "plus 'research' for anything else factual, so this is ALWAYS a valid first call. Routes by " +
      "tag/description overlap unless preferred_assets is given. Skip ONLY for greetings/chit-chat, a " +
      "clarifying question, a follow-up answerable from an already-open case, or when the user " +
      "explicitly says not to use tools. Then: task_asset → synthesize_case → close_case.",
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

      const caseRecord = await caseStore.createCase(objective, assigned, rationale);
      // Surface the missing context AT OPEN TIME, while the question can still
      // be sharpened — after the answer is written it is too late to be useful.
      const gapText = renderGaps(contextGaps(objective, assigned), expectsDecision(objective));
      return textResult(
        `Case ${caseRecord.id} opened.\nObjective: ${objective}\nAssigned assets: ${
          assigned.length ? assigned.join(", ") : "(none)"
        }\nRouting rationale: ${rationale}${gapText}`
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

// One asset tool call: validate, invoke, log, and return normalized content.
// Shared by task_asset (one) and task_assets (many, in parallel) so the two
// paths can never drift. A per-task failure is logged and returned as an error
// RESULT (not thrown), so one failing call in a batch does not sink the others.
interface TaskOutcome {
  asset: string;
  tool: string;
  // The asset's own content blocks (SDK's loose CallToolResult union); kept as
  // any[] so non-text blocks pass through unchanged, as task_asset always did.
  content: any[];
  isError: boolean;
}
async function runOneTask(
  caseId: string,
  caseRecord: { assignedAssets: string[] },
  asset: string,
  tool: string,
  toolArgs: Record<string, unknown> | undefined
): Promise<TaskOutcome> {
  const timestamp = new Date().toISOString();
  const startedMs = Date.now();
  try {
    if (!caseRecord.assignedAssets.includes(asset)) {
      throw new Error(
        `Asset "${asset}" is not assigned to case ${caseId}. Assigned assets: ${caseRecord.assignedAssets.join(", ") || "(none)"}. Use assign_asset to add it first.`
      );
    }
    const assetConfig = await registry.getAsset(asset);
    if (!assetConfig) throw new Error(`No asset named "${asset}" is registered.`);
    if (assetConfig.status !== "active") throw new Error(`Asset "${asset}" is retired.`);

    const result = await clientManager.callAssetTool(assetConfig, tool, toolArgs);
    // Stamp the duration BEFORE the store write, so ~11ms of load+fsync+rename
    // is not folded into every "asset latency" number the overseer reports.
    const durationMs = Date.now() - startedMs;
    await caseStore.appendLog(caseId, {
      asset,
      tool,
      arguments: capForLog(toolArgs ?? {}),
      result: capForLog(result),
      timestamp,
      durationMs,
    });
    const assetContent = Array.isArray(result.content) ? result.content : [];
    const assetIsError = result.isError === true;
    return { asset, tool, content: assetContent, isError: assetIsError };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await caseStore
      .appendLog(caseId, { asset, tool, arguments: capForLog(toolArgs ?? {}), error: message, timestamp, durationMs: Date.now() - startedMs })
      // If cases.json is locked/unparseable, calls silently stop being recorded
      // and every later report describes less than actually happened. Surface it
      // on stderr rather than masking the original error.
      .catch((logErr) => {
        console.error(
          `[task] FAILED TO LOG ${asset}.${tool} on case ${caseId}: ${logErr instanceof Error ? logErr.message : String(logErr)} — the case record is now incomplete.`
        );
      });
    return { asset, tool, content: [{ type: "text", text: message }], isError: true };
  }
}

server.registerTool(
  "task_asset",
  {
    title: "Task Asset",
    description:
      "Call a tool on an asset assigned to a case and record the result. For 2+ calls, PREFER task_assets — it runs them in parallel in a single turn and is the main way to cut case latency.",
    inputSchema: {
      case_id: z.string().min(1),
      asset: z.string().min(1),
      tool: z.string().min(1),
      arguments: z.record(z.any()).optional().describe("Arguments to pass to the asset's tool."),
    },
  },
  async ({ case_id, asset, tool, arguments: toolArgs }) => {
    const caseRecord = await caseStore.getCase(case_id);
    if (!caseRecord) return errorResult(new Error(`No case with id "${case_id}" found.`));
    if (caseRecord.status === "closed") return errorResult(new Error(`Case ${case_id} is closed.`));
    const r = await runOneTask(case_id, caseRecord, asset, tool, toolArgs);
    return { content: [{ type: "text" as const, text: `Result from ${r.asset}.${r.tool}:` }, ...r.content], isError: r.isError || undefined };
  }
);

server.registerTool(
  "task_assets",
  {
    title: "Task Assets (batch, parallel — the fast path)",
    description:
      "Call SEVERAL asset tools AT ONCE, run in parallel, all results recorded. PREFER THIS over multiple task_asset calls: it collapses N sequential round-trips into one turn and runs the asset calls concurrently, which is the single biggest way to cut how long a case takes. Task the chosen specialists AND the research verifier together here. Give a list of {asset, tool, arguments}; each asset must already be assigned. One slow or failing call does not block the others.",
    inputSchema: {
      case_id: z.string().min(1),
      tasks: z
        .array(
          z.object({
            asset: z.string().min(1),
            tool: z.string().min(1),
            arguments: z.record(z.any()).optional(),
          })
        )
        .min(1)
        .max(8)
        .describe("The asset tool calls to run in parallel (2–8 is the sweet spot)."),
    },
  },
  async ({ case_id, tasks }) => {
    const caseRecord = await caseStore.getCase(case_id);
    if (!caseRecord) return errorResult(new Error(`No case with id "${case_id}" found.`));
    if (caseRecord.status === "closed") return errorResult(new Error(`Case ${case_id} is closed.`));
    const outcomes = await Promise.all(tasks.map((t) => runOneTask(case_id, caseRecord, t.asset, t.tool, t.arguments)));
    const content: any[] = [];
    let anyError = false;
    for (const o of outcomes) {
      content.push({ type: "text", text: `--- ${o.asset}.${o.tool}${o.isError ? " (ERROR)" : ""} ---` });
      content.push(...o.content);
      if (o.isError) anyError = true;
    }
    return { content, isError: anyError || undefined };
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
        // Render the content TEXT, not JSON.stringify(entry.result): the JSON
        // envelope + newline-escaping is ~30-40% more tokens for zero signal and
        // is barely readable. renderOutcome preserves errors and marks non-text.
        const outcome = renderOutcome(entry);
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
      "Close a case, recording a final summary and an OUTCOME — the feedback signal for overseer's quality " +
      "report and the routing answer key. outcome: 'resolved' (objective met), 'partial' (some help), " +
      "'unresolved' (right asset, no useful answer), 'misrouted' (went to the wrong asset). When the outcome " +
      "is 'misrouted', ALSO pass should_have_routed_to with the asset(s) that should have owned it — that is " +
      "the one label no test set can generate, and caselog-eval uses it as ground truth. " +
      "YOU ARE GRADING YOUR OWN WORK HERE, so apply a real bar rather than a generous one. " +
      "'resolved' means the objective as STATED was met and you would stand behind the answer unprompted — " +
      "not 'the tools ran' and not 'the user seemed satisfied'. If an asset errored and you worked around it, " +
      "if a key fact came back UNCORROBORATED or UNVERIFIED, if you answered mostly from your own knowledge " +
      "because the specialist added little, or if you had to change the question to fit the assets — that is " +
      "'partial' at best. If a better-suited asset existed, it is 'misrouted' EVEN IF the answer was good; " +
      "a good answer from the wrong specialist is still a routing miss, and grading it 'resolved' is exactly " +
      "how the routing answer key fills up with false positives and stops being able to detect anything. " +
      "ENFORCED, not merely advised: 'resolved' is REFUSED on a case where no asset call succeeded — that " +
      "label asserts a specialist met the objective, and the runtime can see whether one ever ran. Close such " +
      "a case as 'partial' (you answered it yourself), or task the assigned asset first and then close.",
    inputSchema: {
      case_id: z.string().min(1),
      summary: z.string().optional(),
      outcome: z.enum(["resolved", "partial", "unresolved", "misrouted"]).optional(),
      should_have_routed_to: z
        .array(z.string().min(1))
        .max(5)
        .optional()
        .describe("The asset(s) that SHOULD have been assigned. Set this whenever routing was wrong, especially with outcome 'misrouted'."),
    },
  },
  async ({ case_id, summary, outcome, should_have_routed_to }) => {
    try {
      // THE ZERO-CALL GUARD. Measured 2026-08-05: caselog-eval had to exclude
      // 318 cases that logged no successful asset call at all, and audit_report
      // shows 11 active assets that have NEVER been called — including
      // `education`, assigned to 89 closed cases with zero calls, and reading
      // 100% good. Those cases were answered from the orchestrator's own
      // knowledge and then graded by the thing that answered them.
      //
      // This is the same self-grading failure as the all-'resolved' label
      // distribution, one level up: it moved from "how did the answer turn out"
      // to "did a specialist even participate". No outcome label can detect it,
      // because the grader has no way to know it never called anyone.
      //
      // So the RUNTIME decides this one, not the model. A case with no
      // successful call has no evidence a specialist contributed, and
      // 'resolved' is refused outright — 'partial' remains available and is the
      // honest label for "I answered it myself". Nothing here can be flattered:
      // the log either contains a successful call or it does not.
      if (outcome === "resolved") {
        const existing = await caseStore.getCase(case_id);
        const succeeded = existing?.log.filter((e) => !e.error).length ?? 0;
        if (existing && succeeded === 0) {
          const attempted = existing.log.length;
          return textResult(
            [
              `REFUSED: cannot close ${case_id} as 'resolved' — no asset call in this case succeeded.`,
              ``,
              attempted === 0
                ? `  This case logged ZERO asset calls. Its assets were assigned and never used.`
                : `  This case logged ${attempted} asset call(s), and every one of them errored.`,
              ``,
              `  'resolved' asserts a specialist met the objective. Nothing here shows one ran, so`,
              `  the label would record the orchestrator's own confidence as if it were the`,
              `  system's performance — which is how 'education' came to read 100% good over 89`,
              `  cases without ever executing a single tool.`,
              ``,
              `  Either task the assigned asset(s) and then close, or close as 'partial'`,
              `  (answered without the specialist) / 'unresolved' / 'misrouted'.`,
            ].join("\n")
          );
        }
      }
      const caseRecord = await caseStore.closeCase(case_id, summary, outcome, should_have_routed_to);
      const gt = should_have_routed_to?.length ? ` — recorded should-have-routed: ${should_have_routed_to.join(", ")}` : "";
      const lines = [`Case ${caseRecord.id} closed${outcome ? ` (outcome: ${outcome})` : ""}${gt}.`];

      // Show the running label distribution back at the moment of grading. A
      // self-grader cannot see its own bias from inside one case — every
      // individual "resolved" felt justified — but it can see that it has
      // awarded itself 62 passes and zero failures. Surfacing the base rate
      // here is the cheapest available check on a metric that is otherwise
      // free to drift to 100% and stay there.
      try {
        const all = await caseStore.listCases();
        const labeled = all.filter((c) => c.status === "closed" && c.outcome);
        const neg = labeled.filter((c) => c.outcome === "unresolved" || c.outcome === "misrouted").length;
        if (labeled.length >= 10 && neg === 0) {
          lines.push(
            ``,
            `⚠ Label check: ${labeled.length} cases graded, ZERO ever marked 'unresolved' or 'misrouted'.`,
            `  That distribution carries no information — it is what a broken grader and a perfect`,
            `  system produce identically. You are grading your own work; if nothing has ever gone`,
            `  wrong, the bar is the thing that is wrong. Re-read the criteria before the next close.`
          );
        }
      } catch {
        // Never let the honesty check break the close itself.
      }
      return textResult(lines.join("\n"));
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
      const deps = {
        orchestratorStartedAt: ORCHESTRATOR_STARTED_AT,
        introspect: (a: AssetConfig) => clientManager.introspectAsset(a),
        // This process's own built entry — process.argv[1] is the script node
        // was launched with, which for a built orchestrator is dist/index.js.
        selfMtime: async () => {
          const entry = process.argv[1];
          if (!entry) return undefined;
          const s = await stat(entry);
          return s.mtime;
        },
        entryMtime: async (a: AssetConfig) => {
          // Only stdio assets launched from a local script have a build file to stat.
          const entry = a.args?.[0];
          if (a.transport !== "stdio" || !entry) return undefined;
          const path = resolve(a.cwd ?? process.cwd(), entry);
          const s = await stat(path);
          return s.mtime;
        },
      };
      const [results, self] = await Promise.all([checkAssets(assets, deps), checkSelf(deps)]);
      return textResult(renderHealth(results, ORCHESTRATOR_STARTED_AT, self));
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
