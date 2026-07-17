#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as refStore from "./reference-store.js";
import * as rights from "./rights.js";
import * as perspectives from "./perspectives.js";
import * as lawyer from "./lawyer.js";
import * as resources from "./resources.js";

const server = new McpServer({ name: "lawguide", version: "0.1.0" });

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
const lookupKey = z.string().max(100);

// ---------------------------------------------------------------------------
// Rights & the system.
// ---------------------------------------------------------------------------

server.registerTool(
  "know_your_rights",
  {
    title: "Know Your Rights",
    description:
      "The most important one: your rights with police/searches/stops in plain words. Call with no args " +
      "for the overview, or step: N for ONE at a time. California + federal.",
    inputSchema: { step: z.number().int().min(1).max(rights.RIGHTS_STEP_COUNT).optional() },
  },
  async ({ step }) => textResult(rights.knowYourRights(step))
);

server.registerTool(
  "rights_in",
  {
    title: "Your Rights in Any Situation",
    description:
      "Your rights across EVERY common situation — police_stop, arrested, workplace, housing, driving, debt, " +
      "consumer, immigration (any status), privacy, healthcare. Bottom-line + the specific rights + your " +
      "move. Omit 'context' for the full list. (For police stops step-by-step, use know_your_rights.)",
    inputSchema: { context: lookupKey.optional() },
  },
  async ({ context }) => textResult(rights.rightsIn(context))
);

server.registerTool(
  "which_arena",
  {
    title: "Which Legal Arena",
    description:
      "The spine: criminal / civil / traffic / administrative / immigration — they work totally " +
      "differently (your rights, deadlines, stakes). Omit 'situation' for all.",
    inputSchema: { situation: lookupKey.optional() },
  },
  async ({ situation }) => textResult(rights.whichArena(situation))
);

server.registerTool(
  "explain_process",
  {
    title: "Explain the Process",
    description: "How a case flows step-by-step in each arena (criminal, civil, traffic, small_claims, immigration). Omit for the list.",
    inputSchema: { arena: lookupKey.optional() },
  },
  async ({ arena }) => textResult(rights.explainProcess(arena))
);

server.registerTool(
  "explain_term",
  {
    title: "Explain a Legal Term",
    description: "Plain-English legal glossary (arraignment, plea, discovery, subpoena, misdemeanor, default judgment...). Omit for all.",
    inputSchema: { term: lookupKey.optional() },
  },
  async ({ term }) => textResult(rights.explainTerm(term))
);

server.registerTool(
  "deadlines",
  {
    title: "Legal Deadlines",
    description: "The clocks that ruin you if missed — response deadlines and statutes of limitation (California). Run get_reference for live figures.",
    inputSchema: {},
  },
  async () => textResult(rights.deadlines())
);

// ---------------------------------------------------------------------------
// Insider lens + traps.
// ---------------------------------------------------------------------------

server.registerTool(
  "how_they_think",
  {
    title: "How They Think",
    description:
      "The insider read on every player — prosecutor, defense attorney, public defender, judge, police, " +
      "detective, private investigator, court clerk, paralegal, bail bondsman, immigration officer, IRS " +
      "agent. Their motive, the clash with you, your move. Omit 'role' for the summary.",
    inputSchema: { role: lookupKey.optional() },
  },
  async ({ role }) => textResult(perspectives.howTheyThink(role))
);

server.registerTool(
  "red_flag",
  {
    title: "Legal Traps",
    description:
      "The trap playbook: talking to police, missing court dates, notario fraud, signing under pressure, " +
      "self-representing on serious charges, debt-collector abuse, the other side's insurance adjuster. Omit for summary.",
    inputSchema: { issue: lookupKey.optional() },
  },
  async ({ issue }) => textResult(perspectives.redFlag(issue))
);

// ---------------------------------------------------------------------------
// Think like a lawyer + find help.
// ---------------------------------------------------------------------------

server.registerTool(
  "think_like_a_lawyer",
  {
    title: "How a Lawyer Would Handle It",
    description:
      "Give a situation (traffic_ticket, arrested, accused_crime, sued_civil, contract_dispute, " +
      "landlord_tenant, car_accident, debt_collection, immigration_stop, irs_notice) and get the lawyer's " +
      "playbook: first moves, the questions a lawyer would ask YOU, what they'd do, the range of " +
      "POSSIBILITIES (not a prediction), and what lawyer you need. Omit 'situation' for the list.",
    inputSchema: { situation: lookupKey.optional() },
  },
  async ({ situation }) => textResult(lawyer.thinkLikeALawyer(situation))
);

server.registerTool(
  "get_a_lawyer",
  {
    title: "Get a Lawyer (incl. free options)",
    description: "How to actually get legal help — public defenders, legal aid, contingency, referrals, self-help — and when each is free.",
    inputSchema: {},
  },
  async () => textResult(lawyer.getALawyer())
);

server.registerTool(
  "find_legal_resources",
  {
    title: "Find Legal Resources",
    description:
      "Real California legal-help resources for a need + area: statewide finders + your county's public " +
      "defender, legal aid, self-help center, and law library (Riverside/LA/San Diego baked in), plus the " +
      "search queries for research to pull current local orgs live.",
    inputSchema: {
      need: z.string().min(1).max(200).describe("What you need help with, e.g. 'eviction', 'DUI', 'immigration'."),
      area: z.string().max(100).optional().describe("Your county or city (Riverside, Murrieta, Los Angeles, San Diego...)."),
    },
  },
  async ({ need, area }) => {
    try {
      return textResult(resources.findLegalResources(need, area));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Reference + verification loop.
// ---------------------------------------------------------------------------

server.registerTool(
  "get_reference",
  {
    title: "Get Reference Data",
    description:
      "Live-sensitive legal figures (CA small-claims limit, statutes of limitation, answer deadline, right " +
      "to counsel) with source, as-of date, staleness, and the authoritative verify_url research fetches. Omit 'key' for all.",
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
  {
    title: "List Stale References",
    description: "Which stored legal figures are past their freshness window and should be re-verified via research.",
    inputSchema: {},
  },
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
    description: "Propose a new value after research verified it. FLAG-ONLY: without confirm=true it previews and writes nothing.",
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

// ---------------------------------------------------------------------------
// Orientation.
// ---------------------------------------------------------------------------

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description: "In a legal jam and don't know where to begin? The first moves and the honest ground rules.",
    inputSchema: {},
  },
  async () =>
    textResult(
      [
        `BOTTOM LINE: stay calm, say little, meet every deadline, and get a real lawyer for anything serious (often free). Most legal harm is self-inflicted by talking too much or missing a date.`,
        ``,
        `Your first moves:`,
        `  1. Figure out your arena — 'which_arena' (criminal vs civil vs traffic vs immigration vs IRS). It sets your rights and deadlines.`,
        `  2. Know your rights for your situation — 'rights_in <context>' (work, housing, driving, debt, immigration...) or 'know_your_rights' for police stops. If accused/arrested/sued — 'think_like_a_lawyer <situation>'.`,
        `  3. Find help — 'get_a_lawyer' and 'find_legal_resources <need> <your county>'. Much of it is free.`,
        ``,
        `Ground rules (honest):`,
        `  • This is legal INFORMATION and possibilities — NOT legal advice, and NOT confidential (a real lawyer IS).`,
        `  • It shows how the system works and what COULD happen — it can't predict YOUR case.`,
        `  • For anything serious (arrest, charges, a lawsuit served, immigration, IRS), a licensed lawyer is the move. You likely qualify for free or low-cost help.`,
      ].join("\n")
    )
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
  console.error("Fatal error starting lawguide MCP server:", err);
  process.exit(1);
});
