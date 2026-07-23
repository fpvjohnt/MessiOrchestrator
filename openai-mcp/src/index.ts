#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainPrimitive, startHere } from "./primitives.js";
import { pickPrimitive, debugOpenai, migrationCheck, mythVsReality } from "./toolkit.js";
import { howTheyUseIt } from "./roles.js";
import { howTheyBuild } from "./builders.js";
import { checkOpenai, openaiVerdict } from "./verify.js";

const server = new McpServer({ name: "openai", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
const freeText = z.string().max(2000);
const lookupKey = z.string().max(200);

server.registerTool(
  "pick_primitive",
  {
    title: "Pick the Right OpenAI Primitive for What You're Building",
    description:
      "THE FRONT DOOR: describe what you want to build and get the layer to build it on, justified — Responses API (you own the loop) vs " +
      "Agents SDK (the SDK runs it) vs Chat Completions vs hosted tools/MCP vs realtime vs retrieval vs fine-tuning. Always anchored to " +
      "'smallest thing that works first'. Says out loud when the honest answer is NOT OpenAI (data can't leave, multi-provider routing, " +
      "cost floor) or not an LLM at all. Give the task in plain words.",
    inputSchema: { task: freeText },
  },
  async ({ task }) => {
    try {
      return textResult(pickPrimitive(task));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "explain_primitive",
  {
    title: "Explain an OpenAI Platform Primitive",
    description:
      "Name a primitive — responses_api, agents_sdk, chat_completions, platform_tools (incl. remote MCP), realtime_voice, " +
      "embeddings_retrieval, finetune_or_not, batch_and_cost — and get what it is, when to reach for it, its anatomy (the parts you " +
      "actually build), how it fails, and how to build it right. Omit 'primitive' for the full map.",
    inputSchema: { primitive: lookupKey.optional() },
  },
  async ({ primitive }) => {
    try {
      return textResult(explainPrimitive(primitive));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "how_they_use_it",
  {
    title: "How a Given Role Actually Uses ChatGPT & Codex",
    description:
      "The profession lens: name a role — software engineer, data/systems analyst, researcher, IT/sysadmin, lawyer/legal, real estate, " +
      "healthcare, finance/accounting, teacher, marketing/sales, manager/exec, student, writer, mechanical/civil/electrical engineer, " +
      "product/design — and get what they ACTUALLY use it for, which surface fits (Chat vs Work vs Codex vs API), their highest-leverage " +
      "move, the trap that burns THAT role specifically (fabricated citations for lawyers, Fair Housing language for realtors, PHI for " +
      "clinicians, wrong-question SQL for analysts), and how they verify. Covers how the ROLE USES THE TOOL — not that role's domain " +
      "advice; each entry hands the real question to the asset that owns it. Omit 'role' for the full list.",
    inputSchema: { role: lookupKey.optional() },
  },
  async ({ role }) => {
    try {
      return textResult(howTheyUseIt(role));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "how_they_build",
  {
    title: "What the People Who Build & Run OpenAI Actually Do",
    description:
      "The builder lens: name an OpenAI engineering/research/safety/data/ops role — Software Engineer, Data Engineer, Data Scientist " +
      "(Business or Infrastructure), Platform Engineering, Site Reliability Engineer, Software Engineer (Agent Infrastructure), ChatGPT " +
      "Performance Engineer, AI Deployment Engineer, Forward Deployed Engineer (FDE), AI Support Engineer, Technical Threat Investigator, " +
      "Technical Intelligence Analyst, Quantitative (Intelligence) Analyst, Agent Post-Training, Agent Post-Training Research, Artifact " +
      "Research, Workday Engineer, Strategy and Operations — and get their charter, what they actually do day to day, the real stack, what " +
      "separates a great one, and the trap (what outsiders get wrong about the role). Grounded in OpenAI's public role families as of 2026; " +
      "anything live (a specific opening, comp, a reorg) routes check_openai → openai_verdict. Omit 'role' for the full map. This is the " +
      "mirror of how_they_use_it: how OpenAI is BUILT, not how it's used.",
    inputSchema: { role: lookupKey.optional() },
  },
  async ({ role }) => {
    try {
      return textResult(howTheyBuild(role));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "debug_openai",
  {
    title: "Debug an OpenAI Integration",
    description:
      "Describe the symptom and get the likely cause + the fix in order: broke after migrating to Responses, the loop never stops, " +
      "blows the context window, 429s/rate limits, cost blowout, unreliable or invented tool calls, prompt injection through retrieved " +
      "content. The diagnosis is usually request shape, loop engineering, or context — not 'the model is dumb'.",
    inputSchema: { symptom: freeText },
  },
  async ({ symptom }) => {
    try {
      return textResult(debugOpenai(symptom));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "migration_check",
  {
    title: "Should You Migrate Off Chat Completions? (Honest Audit)",
    description:
      "An honest audit, not a sales pitch. Chat Completions is NOT deprecated — there's no clock on you. Returns the real reasons to " +
      "migrate (you're building an agent, you want built-in tools/remote MCP, server-side state, reasoning models with tools, cache " +
      "economics), the real reasons not to, the concrete breaking differences (Messages→Items, response_format→text.format, no 'n', " +
      "stored-by-default), and how to do it safely behind an eval. Optionally pass context about your current setup.",
    inputSchema: { context: freeText.optional() },
  },
  async ({ context }) => {
    try {
      return textResult(migrationCheck(context));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "myth_vs_reality",
  {
    title: "OpenAI Platform Myths vs Reality",
    description:
      "The folklore that burns people, debunked honestly: 'Chat Completions is deprecated', 'fine-tune it on our docs so it knows our " +
      "stuff', 'the Agents SDK means I don't need to understand loops', 'guardrails stop prompt injection', 'tracing means we have " +
      "evals', 'multi-agent will make it smarter', 'the newest model will fix quality', 'use OpenAI for everything', 'Responses is " +
      "stateless'. Knowing a platform deeply means knowing its edges, not denying them.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(mythVsReality());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "check_openai",
  {
    title: "Check a Current OpenAI Specific (via Research)",
    description:
      "For anything version-sensitive — model IDs, parameter names, pricing, rate limits, context windows, what's deprecated, whether a " +
      "feature exists. Returns authoritative sources (developers.openai.com first), the research queries to run, and the red flags " +
      "(starting with the false 'Chat Completions is deprecated' claim). Then call openai_verdict. This asset NEVER answers a " +
      "current-specifics question from memory — that's how an expert lies with confidence.",
    // A real call arrived as {claim: "..."} — the tool verifies claims, so
    // that is the word a caller reaches for. Accept it.
    inputSchema: { topic: freeText.optional(), claim: freeText.optional() },
  },
  async ({ topic: rawTopic, claim }) => {
    try {
      const topic = rawTopic ?? claim;
      if (!topic) return { ...textResult(`BOTTOM LINE: nothing to check — pass "topic" with the OpenAI specific you want verified.`), isError: true };
      return textResult(checkOpenai(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "openai_verdict",
  {
    title: "Grade an OpenAI Finding from Research",
    description:
      "Second half of the verify loop: given what research found, grade it by SOURCE not confidence (official+current → official-undated " +
      "→ corroborated secondary → single-source/blog-only → contradicted/stale) and return the answer labeled VERIFIED / UPDATED / " +
      "UNVERIFIED. Blog-only claims get named as unconfirmed every time. Pass the topic and the findings.",
    inputSchema: { topic: freeText, findings: freeText },
  },
  async ({ topic, findings }) => {
    try {
      return textResult(openaiVerdict(topic, findings));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description: "New here? What the OpenAI Platform Engineer covers and the first move.",
    inputSchema: {},
  },
  async () => textResult(startHere())
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("close", () => process.exit(0));

  // Parent-death watchdog: if our parent (the orchestrator) dies WITHOUT cleanly
  // closing our stdin — a hard kill, crash, or abrupt reboot — the stdin-EOF
  // handlers above may never fire and we would linger as an orphan. Poll the
  // parent's liveness and self-terminate when it is gone, so residual process
  // trees can't pile up across reboots. unref() so this timer never keeps us alive.
  const __parentPid = process.ppid;
  setInterval(() => {
    try {
      process.kill(__parentPid, 0); // signal 0 = liveness probe; throws if gone
    } catch {
      process.exit(0);
    }
  }, 5000).unref();
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => process.exit(0));
}
main().catch((err) => {
  console.error("Fatal error starting openai MCP server:", err);
  process.exit(1);
});
