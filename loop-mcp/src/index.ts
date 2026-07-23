#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainPattern, startHere } from "./patterns.js";
import { designLoop, debugLoop, evalLoop, mythVsReality } from "./toolkit.js";
import { buildingBlocks, modelRequirements } from "./blocks.js";
import { checkPractice, practiceVerdict } from "./verify.js";

const server = new McpServer({ name: "loop", version: "0.1.0" });

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
  "explain_pattern",
  {
    title: "Explain an Agentic Loop Pattern",
    description:
      "The front door: name an agentic loop pattern — basic agent loop, ReAct, plan-and-execute, reflexion/self-correction, " +
      "the tool-use loop, RAG loop, multi-agent orchestration, evaluator-optimizer, human-in-the-loop, memory/state — and get " +
      "what it is, when to reach for it, its anatomy (the parts you build), how it fails, and how to build it right. Omit 'pattern' for the full map.",
    inputSchema: { pattern: lookupKey.optional() },
  },
  async ({ pattern }) => {
    try {
      return textResult(explainPattern(pattern));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "design_loop",
  {
    title: "Design a Loop for a Task",
    description:
      "Describe what you want the agent to do and get a recommended architecture: which pattern(s) fit and why, the parts every " +
      "loop needs (stop condition, state, tools, eval, guardrails), the first step, and the risks — always anchored to 'start with " +
      "the simplest loop that works'. Give the task in plain words.",
    inputSchema: { task: freeText },
  },
  async ({ task }) => {
    try {
      return textResult(designLoop(task));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "debug_loop",
  {
    title: "Debug a Misbehaving Loop",
    description:
      "Describe the symptom and get the likely cause + the fix in order: never stops/runs forever, thrashes tools/picks the wrong " +
      "tool, invents tool calls, runs out of context, drifts off task, too slow/expensive, or inconsistent/flaky. The diagnosis is " +
      "almost always a loop-engineering problem, not 'the model is dumb'.",
    inputSchema: { symptom: freeText },
  },
  async ({ symptom }) => {
    try {
      return textResult(debugLoop(symptom));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "eval_loop",
  {
    title: "How to Evaluate a Loop (Honestly)",
    description:
      "How to actually KNOW an agent loop works — the levels of eval (ran → consistent → correct on a golden set → robust to " +
      "paraphrase → real-world outcome), what to measure (trajectory not just the answer, cost, failure modes), and the honest " +
      "limits of LLM-as-judge. The core lesson: consistency ≠ correctness.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(evalLoop());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "myth_vs_reality",
  {
    title: "Agentic Loop Myths vs Reality",
    description:
      "The folklore that burns people, debunked honestly: 'more agents = better', 'just add reflection', 'the model will figure out " +
      "the loop', 'temperature 0 = deterministic', 'it's consistent so it works', 'RAG doesn't work', 'prompt it not to do the " +
      "dangerous thing'. The engineering is in the loop, not the model.",
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
  "building_blocks",
  {
    title: "The 6 Building Blocks of an Autonomous Loop",
    description:
      "The operational framework for turning manual prompting into a self-running loop — the six blocks you need in place: Connectors " +
      "(your MCP collection), Automations (the heartbeat/trigger), Skills (durable project knowledge + constraints), Subagents " +
      "(maker ≠ checker), Memory (continuity across runs), and Worktrees (clean workspace per parallel agent). Each with why the loop " +
      "needs it, how to build it, and its readiness check. Omit 'block' for the full checklist. An MCP collection already gives you block #1.",
    inputSchema: { block: lookupKey.optional() },
  },
  async ({ block }) => {
    try {
      return textResult(buildingBlocks(block));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "model_requirements",
  {
    title: "Model Requirements for a Practical Loop",
    description:
      "The model capabilities that make a loop practical instead of an expensive experiment: cheap tokens + a large context window " +
      "(loops burn tokens on every retry/verify), robust tool-calling + structured JSON output (the #1 requirement — the loop lives " +
      "on reliable calls to your connectors), and high concurrency (to run maker/checker subagents in parallel). In a loop, " +
      "reliability and cost beat raw intelligence.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(modelRequirements());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "check_practice",
  {
    title: "Check a Current Best-Practice (via Research)",
    description:
      "For fast-moving specifics — a framework's current API (LangGraph, OpenAI Agents SDK, CrewAI...), whether a technique actually " +
      "beats the simpler option, current model limits/pricing. Returns authoritative sources + hype red flags + research queries so " +
      "research can verify it; then call practice_verdict. Never answers a 'what's the current best way' question from stale memory.",
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
    title: "Grade a Best-Practice from Research Findings",
    description:
      "Second half of the verify loop: given what research found about a practice/framework/technique, grade how well-supported and " +
      "how CURRENT it is (documented+measured → hype → deprecated) and recommend the simplest thing that's proven to work. Pass the topic and the findings.",
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
    description: "New here? What Loop Engineering covers and the first move.",
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
  console.error("Fatal error starting loop MCP server:", err);
  process.exit(1);
});
