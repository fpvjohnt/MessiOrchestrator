#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainFaith, compareFaiths, startHere } from "./faiths.js";

const server = new McpServer({ name: "faiths", version: "0.1.0" });

function textResult(text: string) { return { content: [{ type: "text" as const, text }] }; }
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
const lookupKey = z.string().max(120);

server.registerTool(
  "explain_faith",
  {
    title: "Explain a Faith",
    description: "What a religion or tradition actually believes and practices — origin, core belief, practices, texts, branches. Covers Christianity, Islam, Judaism (incl. Kabbalah), Buddhism, Hinduism, Sikhism, and others (Taoism, Confucianism, Shinto, Jainism, Bahá'í, secular views). Name any faith, or omit for the map. Described neutrally, never preachy.",
    inputSchema: { faith: lookupKey.optional() },
  },
  async ({ faith }) => {
    try { return textResult(explainFaith(faith)); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "compare_faiths",
  {
    title: "How Faiths Relate",
    description: "The shared roots and real differences between the major traditions — the Abrahamic family (Judaism/Christianity/Islam), the Dharmic family (Hinduism/Buddhism/Jainism/Sikhism), East Asian traditions, and the common threads (the Golden Rule) vs the big divides (nature of God, afterlife, authority).",
    inputSchema: {},
  },
  async () => {
    try { return textResult(compareFaiths()); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "start_here",
  { title: "Start Here", description: "New here? What this covers and the honest ground rules.", inputSchema: {} },
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
  console.error("Fatal error starting faiths MCP server:", err);
  process.exit(1);
});
