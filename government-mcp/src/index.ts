#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as refStore from "./reference-store.js";
import { explainGovernment, immigrationPaths, workPermit, travelEntry, howGovernmentsDiffer, startHere } from "./regions.js";

const server = new McpServer({ name: "government", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
function now(): Date {
  return new Date();
}
const lookupKey = z.string().max(120);

server.registerTool(
  "explain_government",
  {
    title: "How a Government Works",
    description: "How a region/country is governed — the system and structure. Regions: United States, Europe (EU+UK), Middle East, Japan, Russia, South America. Omit 'region' for the map. See also how_governments_differ for the system types.",
    inputSchema: { region: lookupKey.optional() },
  },
  async ({ region }) => {
    try { return textResult(explainGovernment(region)); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "immigration_paths",
  {
    title: "Immigration / Residency Paths",
    description: "How to immigrate to / get residency in a region (family, work, investor, study, and region-specific routes like the EU Blue Card or Mercosur). General info — rules change, verify via research + official sources, use a lawyer for a real case.",
    inputSchema: { region: lookupKey.optional() },
  },
  async ({ region }) => {
    try { return textResult(immigrationPaths(region)); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "work_permit",
  {
    title: "Work Permit / Right to Work",
    description: "How to legally WORK in a region — the main work-visa/permit types and whether employer sponsorship is needed (US H-1B, EU Blue Card, UK Skilled Worker, Gulf kafala sponsorship, Japan work status, etc.).",
    inputSchema: { region: lookupKey.optional() },
  },
  async ({ region }) => {
    try { return textResult(workPermit(region)); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "travel_entry",
  {
    title: "Travel / Entry Visa",
    description: "Tourist/short-stay entry rules for a region — visa-free windows, e-visas, and the catches (e.g. the Schengen 90/180 rule). Tourism only; work needs a work permit.",
    inputSchema: { region: lookupKey.optional() },
  },
  async ({ region }) => {
    try { return textResult(travelEntry(region)); } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "how_governments_differ",
  {
    title: "How Governments Differ",
    description: "The main government systems in plain words — republic, parliamentary democracy, constitutional vs absolute monarchy, semi-presidential, authoritarian — and why the label on paper can differ from practice.",
    inputSchema: {},
  },
  async () => {
    try { return textResult(howGovernmentsDiffer()); } catch (err) { return errorResult(err); }
  }
);

// --- Reference + verify loop ---
server.registerTool(
  "get_reference",
  {
    title: "Get Reference Data",
    description: "Live-sensitive immigration figures (Schengen 90/180, US naturalization years, Japan PR years) with source, as-of date, staleness, and the verify_url research fetches. Omit 'key' for all.",
    inputSchema: { key: lookupKey.optional() },
  },
  async ({ key }) => {
    try {
      const views = await refStore.withStaleness(now());
      const chosen = key ? views.filter((v) => v.key === key) : views;
      if (chosen.length === 0) return textResult(`No reference "${key}". Known: ${views.map((v) => v.key).join(", ")}`);
      const blocks = chosen.map((v) =>
        [
          `${v.key} — ${v.label}`,
          `  value: ${v.value}`,
          `  as of: ${v.as_of} (${v.age_days === Infinity ? "?" : v.age_days}d old${v.is_stale ? " — STALE, re-verify" : ""})`,
          `  source: ${v.source}`,
          `  verify_url: ${v.verify_url}`,
          v.notes ? `  notes: ${v.notes}` : null,
        ].filter(Boolean).join("\n")
      );
      return textResult(blocks.join("\n\n"));
    } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "list_stale_references",
  { title: "List Stale References", description: "Which stored figures are past their freshness window and should be re-verified via research.", inputSchema: {} },
  async () => {
    try {
      const stale = (await refStore.withStaleness(now())).filter((v) => v.is_stale);
      if (stale.length === 0) return textResult("All reference values are within their freshness window.");
      const lines = stale.map((v) => `- ${v.key} (${v.age_days === Infinity ? "unknown age" : `${v.age_days}d old`}, limit ${v.staleness_days}d) → verify at ${v.verify_url}`);
      return textResult(`STALE — re-verify via research:\n${lines.join("\n")}`);
    } catch (err) { return errorResult(err); }
  }
);

server.registerTool(
  "update_reference",
  {
    title: "Update Reference (flag-only)",
    description: "Propose a new value after research verified it. FLAG-ONLY: without confirm=true it previews and writes nothing.",
    inputSchema: { key: lookupKey, value: z.string().min(1).max(500), source: z.string().min(1).max(500), as_of: z.string().optional(), confirm: z.boolean().default(false) },
  },
  async ({ key, value, source, as_of, confirm }) => {
    try {
      const asOf = as_of ?? now().toISOString().slice(0, 10);
      const parsed = new Date(asOf);
      if (Number.isNaN(parsed.getTime())) throw new Error(`as_of "${asOf}" is not a parseable date. Use YYYY-MM-DD.`);
      if (parsed.getTime() > now().getTime() + 86_400_000) throw new Error(`as_of "${asOf}" is in the future.`);
      const result = await refStore.updateReference(key, value, source, asOf, confirm, now());
      return textResult(result.message);
    } catch (err) { return errorResult(err); }
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
  console.error("Fatal error starting government MCP server:", err);
  process.exit(1);
});
