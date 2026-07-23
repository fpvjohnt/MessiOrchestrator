#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as refStore from "./reference-store.js";
import { explore, mythVsReality, goDeeper, howWeKnow, startHere } from "./domains.js";
import { checkClaim, claimVerdict } from "./claims.js";

const server = new McpServer({ name: "curiosity", version: "0.1.0" });

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
  "explore",
  {
    title: "Explore a Field or Topic",
    description:
      "The front door for curiosity: pass any science/history topic — 'black holes', 'quantum computing', " +
      "'the pyramids', 'Einstein', 'evolution' — and get the field it belongs to, the questions that pull you " +
      "in, the touchstones to know, and rabbit holes to go deeper. Omit 'topic' for the whole map. Fields: " +
      "physics_quantum, space_astronomy, life_biology, earth_geoscience, history_archaeology, minds_science, computing_ai.",
    inputSchema: { topic: lookupKey.optional() },
  },
  async ({ topic }) => {
    try {
      return textResult(explore(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "myth_vs_reality",
  {
    title: "Myth vs Reality",
    description:
      "Common misconceptions and the honest reality, per field (ancient aliens, Tesla 'free energy', 'humans " +
      "came from chimps', 'Big Bang was an explosion', 'diamonds from coal'). Omit 'topic' for one per field.",
    inputSchema: { topic: lookupKey.optional() },
  },
  async ({ topic }) => {
    try {
      return textResult(mythVsReality(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "go_deeper",
  {
    title: "Go Deeper (Rabbit Holes)",
    description: "Given a field or topic, the connected topics to explore next plus the research queries to learn their current state. For following curiosity down the chain.",
    inputSchema: { topic: lookupKey },
  },
  async ({ topic }) => {
    try {
      return textResult(goDeeper(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "how_we_know",
  {
    title: "How We Actually Know",
    description: "The methods science uses to turn 'I heard' into 'we measured' — dating, spectroscopy, seismic imaging, peer review, falsifiability. The antidote to pseudoscience, and the reason the answers can be trusted.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(howWeKnow());
    } catch (err) {
      return errorResult(err);
    }
  }
);

// --- Claim-check loop (two-step with research) ---

server.registerTool(
  "check_claim",
  {
    title: "Check a Claim — Sources",
    description:
      "For ANY 'is this true?' science/history claim (ancient aliens, free energy, a viral science fact): returns " +
      "the authoritative sources, the exact research queries, and the pseudoscience red flags to watch for. NEVER " +
      "answered from memory. Have research run the queries, then call claim_verdict with what it finds.",
    inputSchema: { claim: z.string().min(1).max(500) },
  },
  async ({ claim }) => {
    try {
      return textResult(checkClaim(claim));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "claim_verdict",
  {
    title: "Claim Verdict",
    description: "After research verifies a check_claim, pass what it found for a graded, honest verdict (5 evidence tiers, plus the 'genuinely open' and 'the real story is cooler' endings). Grades the evidence, never the person asking.",
    inputSchema: {
      claim: z.string().min(1).max(500),
      findings: z.string().min(1).max(2000).describe("What research found when it checked the claim."),
    },
  },
  async ({ claim, findings }) => {
    try {
      return textResult(claimVerdict(claim, findings));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// --- Reference data + verify loop (mirrors the other assets) ---

server.registerTool(
  "get_reference",
  {
    title: "Get Reference Data",
    description: "Live-sensitive science figures (age of the universe, confirmed exoplanets, largest quantum processor) with source, as-of date, staleness, and the verify_url research fetches to re-check. Omit 'key' for all.",
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
          `  confidence: ${v.confidence}`,
          `  source: ${v.source}`,
          `  verify_url: ${v.verify_url}`,
          v.notes ? `  notes: ${v.notes}` : null,
        ].filter(Boolean).join("\n")
      );
      return textResult(blocks.join("\n\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "list_stale_references",
  { title: "List Stale References", description: "Which stored science figures are past their freshness window and should be re-verified via research.", inputSchema: {} },
  async () => {
    try {
      const stale = (await refStore.withStaleness(now())).filter((v) => v.is_stale);
      if (stale.length === 0) return textResult("All reference values are within their freshness window.");
      const lines = stale.map((v) => `- ${v.key} (${v.age_days === Infinity ? "unknown age" : `${v.age_days}d old`}, limit ${v.staleness_days}d) → verify at ${v.verify_url}`);
      return textResult(`STALE — re-verify via research:\n${lines.join("\n")}`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "update_reference",
  {
    title: "Update Reference (flag-only)",
    description: "Propose a new value after research verified it at the source. FLAG-ONLY: without confirm=true it previews and writes nothing.",
    inputSchema: {
      key: lookupKey,
      value: z.string().min(1).max(500),
      source: z.string().min(1).max(500),
      as_of: z.string().optional(),
      confirm: z.boolean().default(false),
    },
  },
  async ({ key, value, source, as_of, confirm }) => {
    try {
      const asOf = as_of ?? now().toISOString().slice(0, 10);
      const parsed = new Date(asOf);
      if (Number.isNaN(parsed.getTime())) throw new Error(`as_of "${asOf}" is not a parseable date. Use YYYY-MM-DD.`);
      if (parsed.getTime() > now().getTime() + 86_400_000) throw new Error(`as_of "${asOf}" is in the future.`);
      const result = await refStore.updateReference(key, value, source, asOf, confirm, now());
      return textResult(result.message);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description: "New to poking around? How this works and the first move.",
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
  console.error("Fatal error starting curiosity MCP server:", err);
  process.exit(1);
});
