#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainSport, startHere } from "./sports.js";
import { scoutTalent, whatToLookFor, pathway } from "./scouting.js";

const server = new McpServer({ name: "sports", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
const lookupKey = z.string().max(120);

server.registerTool(
  "explain_sport",
  {
    title: "How a Sport Works",
    description:
      "How a sport works — rules, objective, positions, and (for soccer) formations and tactics. Soccer is the deep " +
      "coverage; basketball, American football, baseball, tennis, rugby, cricket get solid summaries. Omit 'sport' for the list.",
    inputSchema: { sport: lookupKey.optional() },
  },
  async ({ sport }) => {
    try {
      return textResult(explainSport(sport));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "scout_talent",
  {
    title: "How Talent Is Identified",
    description:
      "How scouts actually judge talent — the four-corners model (technical, tactical, physical, psychological), how the " +
      "corners are weighted, and why raw physicality is over-rated young. The 'how do people know if you've got it' answer.",
    inputSchema: { sport: lookupKey.optional() },
  },
  async ({ sport }) => {
    try {
      return textResult(scoutTalent(sport));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "what_to_look_for",
  {
    title: "What to Look For in a Player",
    description:
      "The concrete signs of real talent an observer (parent, coach, fan) can watch for — scanning, first touch, decision " +
      "speed, off-ball movement, composure — plus the honest caveats (relative age effect, late bloomers, the tiny odds).",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(whatToLookFor());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "pathway",
  {
    title: "Development Pathway",
    description: "How a player actually develops and gets seen — play constantly, club/academy, trials/showcases, standing out on the four corners — with an honest read on the odds and keeping a plan B.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(pathway());
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
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => process.exit(0));
}
main().catch((err) => {
  console.error("Fatal error starting sports MCP server:", err);
  process.exit(1);
});
