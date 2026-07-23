#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainTopic, startHere } from "./topics.js";
import { howTo, debug, mythVsReality } from "./toolkit.js";
import { checkPractice, practiceVerdict } from "./verify.js";

const server = new McpServer({ name: "apiforge", version: "0.1.0" });

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
    title: "Explain an AI-API or Postman Topic",
    description:
      "THE FRONT DOOR: name a topic — API fundamentals (HTTP/REST & status codes, authentication with keys/bearer/OAuth, rate limits/" +
      "retries/pagination, JSON payloads & headers), Postman (collections, environments/variables/secrets, tests & pre-request scripts, " +
      "mocks & monitors, the CLI/Newman for CI, the 2026 AI features), or AI/LLM APIs (calling an AI API, streaming & SSE, reliability with " +
      "retries/timeouts/cost, testing NON-deterministic endpoints, webhooks & async jobs) — and get what it is, why it matters, the key " +
      "ideas, how to do it, and the pitfalls. Omit 'topic' for the full map.",
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
  "how_to",
  {
    title: "How To Set Up a Specific API Call or Test",
    description:
      "Name a goal and get concrete Postman/API setup steps: call an LLM API, set up authentication (key/bearer/OAuth), test an endpoint, " +
      "handle rate limits (429), work with a streaming/SSE response, set up environments & variables, chain requests (use one response in " +
      "the next), or run Postman tests in CI. Secrets stay out of the request; AI endpoints are tested by properties, not exact text.",
    inputSchema: { goal: freeText },
  },
  async ({ goal }) => {
    try {
      return textResult(howTo(goal));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "debug",
  {
    title: "Debug an API/Postman Problem",
    description:
      "Describe the symptom and get the likely cause + fix in order: 401 Unauthorized, 403 Forbidden, 429 rate limited, 400/422 bad " +
      "request, CORS error, request timeout/hangs, streaming (SSE) not working, or a {{variable}} not resolving. The status code — or the " +
      "response body — usually names the fix.",
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
    title: "AI-API & Postman Myths vs Reality",
    description:
      "The folklore that causes the most API bugs, debunked honestly: 'a 200 means it worked', 'putting the key in the URL is fine', 'just " +
      "retry any failed request', 'you can test an AI endpoint with exact-match', 'AI-generated tests can be trusted as-is', 'if it works " +
      "in Postman it works everywhere', 'streaming is just a faster response'. Most API bugs are auth, the body, or a wrong assumption.",
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
    title: "Check a Current API/Postman Specific (via Research)",
    description:
      "For the fast-moving surface — a provider's current AI-API request/response shape, params, rate limits or pricing, and current " +
      "Postman features (Agent Mode, AI test generation, the CLI). Returns authoritative sources (provider API references, Postman docs) + " +
      "red flags + research queries; then call practice_verdict. HTTP fundamentals are stable; provider specs and Postman features change " +
      "and are verified, not recalled. Pricing/rate-limits ALWAYS need a live check.",
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
    title: "Grade an API/Postman Finding from Research",
    description:
      "Second half of the verify loop: given what research found about a provider's API or a Postman feature, grade how CURRENT and " +
      "official it is (official+current → stale blog → insecure) and give the corrected request/feature, labeled VERIFIED / UPDATED / " +
      "UNVERIFIED. Pricing and rate limits always require a live check. Pass the topic and the findings.",
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
    description: "New here? What the AI-API & Postman expert covers, the three lenses, and the two rules that prevent the most pain.",
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
  console.error("Fatal error starting apiforge MCP server:", err);
  process.exit(1);
});
