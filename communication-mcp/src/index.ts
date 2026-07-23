#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainSkill, startHere } from "./areas.js";
import { prepare, readPeople, steelman, spotFallacies, mythVsReality } from "./toolkit.js";

const server = new McpServer({ name: "communication", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
const lookupKey = z.string().max(200);

server.registerTool(
  "explain_skill",
  {
    title: "Explain a Communication Skill",
    description:
      "The front door: name a communication area — public speaking, business/work, home/relationships, debate/persuasion, " +
      "listening/understanding, reading people, body language — and get the real techniques, the common mistake, and how " +
      "to practice. Omit 'area' for the full map.",
    inputSchema: { area: lookupKey.optional() },
  },
  async ({ area }) => {
    try {
      return textResult(explainSkill(area));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "prepare",
  {
    title: "Prepare for a Moment",
    description: "A prep playbook for a specific high-stakes moment: speech, difficult_conversation, negotiation, interview, debate, feedback, apology. Give the situation, get the steps.",
    inputSchema: { situation: lookupKey },
  },
  async ({ situation }) => {
    try {
      return textResult(prepare(situation));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "read_people",
  {
    title: "Read People (Honestly)",
    description:
      "The honest interrogator/detective toolkit for picking up what someone isn't saying — baseline-and-deviation, " +
      "clusters, mismatches, funnel questions, silence, and following the 'breadcrumbs' — WITH the firm caveat that body " +
      "language is not a lie detector and no gesture reliably reveals a lie. Sharper questions, not mind-reading.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(readPeople());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "steelman",
  {
    title: "Steelman the Other Side",
    description: "How to understand and fairly state the STRONGEST version of a view you disagree with — the skill under empathy, real diligence, and persuasion. Pass a topic to tailor it.",
    inputSchema: { topic: lookupKey.optional() },
  },
  async ({ topic }) => {
    try {
      return textResult(steelman(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "spot_fallacies",
  {
    title: "Spot Faulty Arguments",
    description: "Recognize and counter the common argument tricks and logical fallacies (ad hominem, strawman, false dilemma, whataboutism, gish gallop, appeal to emotion/authority, slippery slope, bandwagon, circular). Being hard to fool. Omit for the list, or name one for how to counter it.",
    inputSchema: { fallacy: lookupKey.optional() },
  },
  async ({ fallacy }) => {
    try {
      return textResult(spotFallacies(fallacy));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "myth_vs_reality",
  {
    title: "Reading-People Myths vs Reality",
    description: "The honest truth about body language and lie detection — the '93% body language' myth, the lie-detector myth, the eye-direction myth, and more. What pop psychology gets wrong, so you're actually harder to fool.",
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
  "start_here",
  {
    title: "Start Here",
    description: "New here? What this covers and the first move.",
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
  console.error("Fatal error starting communication MCP server:", err);
  process.exit(1);
});
