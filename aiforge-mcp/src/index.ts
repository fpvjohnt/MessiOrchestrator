#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainTopic, startHere } from "./topics.js";
import { buildIt, debug, mythVsReality } from "./toolkit.js";
import { checkPractice, practiceVerdict } from "./verify.js";

const server = new McpServer({ name: "aiforge", version: "0.1.0" });

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
  "explain_topic",
  {
    title: "Explain an AI/ML Engineering Topic",
    description:
      "THE FRONT DOOR: name a topic across the four craft lenses — Python for AI (numpy/pandas/pytorch, environments, the traps), " +
      "foundation-model integration (inference options, structured output, cost/latency, evals, guardrails), Hugging Face & LangChain " +
      "(Transformers, PEFT/LoRA/QLoRA fine-tuning, serving/quantization, LCEL/create_agent, RAG plumbing), and LLMs & NLP (tokenization, " +
      "embeddings, transformers, fine-tune-vs-RAG-vs-prompt, decoding, classic NLP) — and get what it is, why it matters, the key ideas, " +
      "how you actually do it, and the pitfalls. Omit 'topic' for the full map.",
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
  "build_it",
  {
    title: "How to Build a Given AI/ML Task",
    description:
      "Describe what you want to build (classify text, answer from our docs, semantic search, a chatbot, an agent, extract fields...) and " +
      "get the recommended APPROACH, a suggested STACK, and the first step — always anchored to 'simplest thing that works first, with an " +
      "eval around it'. Steers you away from the expensive default (a giant LLM / fine-tuning / a framework) when a smaller path wins, and " +
      "hands the agent-ARCHITECTURE half to 'loop'. Give the task in plain words.",
    inputSchema: { task: freeText },
  },
  async ({ task }) => {
    try {
      return textResult(buildIt(task));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "debug",
  {
    title: "Debug an AI/ML Problem",
    description:
      "Describe the symptom and get the likely cause + the fix in order: CUDA out of memory, garbage output from an open model, " +
      "device/dtype mismatch, dependency/install/import hell, a deprecated LangChain import (AgentExecutor/LLMChain), RAG giving wrong or " +
      "made-up answers, slow inference, or fine-tuning that isn't working. In AI/ML the bug is usually the plumbing — inputs, environment, " +
      "retrieval, serving — not 'the model is dumb'.",
    inputSchema: { symptom: freeText },
  },
  async ({ symptom }) => {
    try {
      return textResult(debug(symptom));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "myth_vs_reality",
  {
    title: "AI/ML Build Myths vs Reality",
    description:
      "The folklore that wastes the most time and money, debunked honestly: 'fine-tune it so it knows our facts', 'a bigger model will " +
      "fix quality', 'you need a vector database', 'RAG doesn't work', 'you need LangChain', 'temperature 0 is deterministic', 'just use " +
      "an LLM for everything', 'prompt it not to do the dangerous thing', 'more context is always better'. Knowing the craft means " +
      "knowing its edges.",
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
    title: "Check a Current AI/ML Best-Practice (via Research)",
    description:
      "For fast-moving specifics — a current Hugging Face / LangChain / PyTorch / vLLM API, a model's limits or license, whether a " +
      "technique (a fine-tuning method, a retriever) actually beats the simpler option. Returns authoritative sources + hype red flags + " +
      "research queries so research can verify it; then call practice_verdict. Never answers a 'what's the current best way' question from " +
      "stale memory — tutorials in this space rot in months.",
    // A real call arrived as {practice: "..."} — the tool is named
    // check_practice, so that is the word its own name teaches. Accept it.
    inputSchema: { topic: freeText.optional(), practice: freeText.optional() },
  },
  async ({ topic: rawTopic, practice }) => {
    try {
      const topic = rawTopic ?? practice;
      if (!topic) return { ...textResult(`BOTTOM LINE: nothing to check — pass "topic" with the practice or API you want verified.`), isError: true };
      return textResult(checkPractice(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "practice_verdict",
  {
    title: "Grade an AI/ML Best-Practice from Research Findings",
    description:
      "Second half of the verify loop: given what research found about a library API, model, or technique, grade how well-supported and " +
      "how CURRENT it is (documented+measured → hype → deprecated) and recommend the simplest thing that's proven to work, labeled " +
      "VERIFIED / UPDATED / UNVERIFIED. Pass the topic and the findings.",
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
    description: "New here? What the AI/ML Engineering Craft asset covers, the four lenses, and how it differs from loop and openai.",
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
  console.error("Fatal error starting aiforge MCP server:", err);
  process.exit(1);
});
