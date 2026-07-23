#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainFamily, startHere } from "./families.js";
import { howLanguageWorks, learnLanguage, linguisticsMyths } from "./language.js";

const server = new McpServer({ name: "linguistics", version: "0.1.0" });

function textResult(text: string) { return { content: [{ type: "text" as const, text }] }; }
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
const lookupKey = z.string().max(120);

server.registerTool(
  "explain_family",
  {
    title: "Language Families",
    description: "Where a language comes from — the world's major language families (Indo-European, Sino-Tibetan, Afro-Asiatic, Niger-Congo, Austronesian, Dravidian, Japonic/Koreanic/isolates), where they're spoken, and a distinctive trait. Name any language ('Mandarin', 'Swahili') to place it, or omit for the map.",
    inputSchema: { language: lookupKey.optional() },
  },
  async ({ language }) => {
    try { return textResult(explainFamily(language)); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "how_language_works",
  {
    title: "How Language Works",
    description: "The machinery under every language — sounds (phonetics), word-building (morphology), word order (syntax), meaning, writing systems (alphabet/abjad/syllabary/logography), and how languages change over time.",
    inputSchema: {},
  },
  async () => {
    try { return textResult(howLanguageWorks()); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "learn_language",
  {
    title: "How to Learn a Language",
    description: "The evidence-based way to actually learn a language — comprehensible input, high-frequency words, spaced repetition, speaking early, little-and-often — plus the honest hours-to-fluency by difficulty.",
    inputSchema: {},
  },
  async () => {
    try { return textResult(learnLanguage()); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "language_myths",
  {
    title: "Language Myths vs Reality",
    description: "The honest truth about common language myths — 'primitive languages', '100 Eskimo words for snow', 'adults can't learn', 'bilingualism confuses kids', 'one correct version'.",
    inputSchema: {},
  },
  async () => {
    try { return textResult(linguisticsMyths()); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "start_here",
  { title: "Start Here", description: "New here? What this covers and the first move.", inputSchema: {} },
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
  console.error("Fatal error starting linguistics MCP server:", err);
  process.exit(1);
});
