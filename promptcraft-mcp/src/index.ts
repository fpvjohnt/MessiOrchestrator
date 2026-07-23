#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainTopic, startHere } from "./topics.js";
import { buildPrompt, improvePrompt, mythVsReality } from "./toolkit.js";
import { checkPractice, practiceVerdict } from "./verify.js";

const server = new McpServer({ name: "promptcraft", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
const freeText = z.string().max(4000);
const lookupKey = z.string().max(200);

server.registerTool(
  "explain_topic",
  {
    title: "Explain a Prompt-Engineering Topic",
    description:
      "THE FRONT DOOR: name a prompt-engineering topic — techniques (zero-shot, few-shot, chain-of-thought, self-consistency, role/persona, " +
      "decomposition, ReAct/tree-of-thought/meta), structure (prompt anatomy, XML/delimiter structuring, output formatting, context & " +
      "example selection), or reliability (iterating & evaluating, anti-patterns, robustness & prompt injection, prompting REASONING " +
      "models) — and get what it is, why it matters, the key ideas, how to do it, and the pitfalls. Provider-neutral technique. Omit " +
      "'topic' for the full map.",
    inputSchema: { topic: lookupKey.optional() },
  },
  async ({ topic }) => {
    try {
      return textResult(explainTopic(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "build_prompt",
  {
    title: "Build a Structured Prompt for a Goal",
    description:
      "Describe what you want the model to do and get a fill-in prompt SCAFFOLD (role, task, context, examples, output format, constraints, " +
      "uncertainty handling) plus which techniques fit the goal — always anchored to 'simplest that works, then measure on a golden set'. " +
      "Flags the reasoning-model caveat (skip chain-of-thought scaffolding on o-series/extended-thinking models). Give the goal in plain words.",
    inputSchema: { goal: freeText },
  },
  async ({ goal }) => {
    try {
      return textResult(buildPrompt(goal));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "improve_prompt",
  {
    title: "Critique & Improve an Existing Prompt",
    description:
      "Paste your prompt and get a structural critique against the common anti-patterns — missing output format, vague terms, negative-only " +
      "phrasing, over-stuffing, conflicting instructions, no example for a non-obvious format, no uncertainty rule, no delimiters — plus " +
      "concrete fixes. Deterministic checks, not a guarantee; the real test is your eval set. Pass the prompt text.",
    inputSchema: { prompt: freeText },
  },
  async ({ prompt }) => {
    try {
      return textResult(improvePrompt(prompt));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "myth_vs_reality",
  {
    title: "Prompt-Engineering Myths vs Reality",
    description:
      "The folklore that wastes time, debunked honestly: 'a good persona makes it smarter', 'longer prompts are better', 'more examples " +
      "always help', 'temperature 0 is deterministic', 'chain-of-thought always improves answers' (it can hurt reasoning models), 'you can " +
      "prompt your way to safety', 'prompt engineering is just wording tricks', 'if it worked once it's good'. Prompting is empirical, not " +
      "incantation.",
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
  "check_practice",
  {
    title: "Check Current Prompt-Engineering Guidance (via Research)",
    description:
      "For model-specific or fast-moving guidance — how to prompt a specific current model (especially reasoning models), whether a " +
      "technique actually beats the simpler option, current provider recommendations. Returns authoritative sources (provider prompting " +
      "guides, papers with evals) + red flags + research queries; then call practice_verdict. Core technique is stable; model-specific " +
      "advice changes each generation and is verified, not recalled.",
    inputSchema: { topic: freeText },
  },
  async ({ topic }) => {
    try {
      return textResult(checkPractice(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "practice_verdict",
  {
    title: "Grade a Prompt-Engineering Finding from Research",
    description:
      "Second half of the verify loop: given what research found about a prompting technique or model-specific guidance, grade how " +
      "well-supported and how CURRENT it is (provider-official → measured technique → folklore → outdated) and recommend the simplest " +
      "thing that measurably helps, labeled VERIFIED / UPDATED / UNVERIFIED. Pass the topic and the findings.",
    inputSchema: { topic: freeText, findings: freeText },
  },
  async ({ topic, findings }) => {
    try {
      return textResult(practiceVerdict(topic, findings));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description: "New here? What the Prompt-Engineering expert covers, the three lenses, and the biggest 2026 caveat (reasoning models).",
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
  console.error("Fatal error starting promptcraft MCP server:", err);
  process.exit(1);
});
