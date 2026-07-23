#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as refStore from "./reference-store.js";
import * as profileStore from "./profile-store.js";
import * as calc from "./calculators.js";
import * as explain from "./explainers.js";
import * as perspectives from "./perspectives.js";
import * as property from "./property.js";
import type { BuyerProfile } from "./types.js";

const server = new McpServer({ name: "homebuyer", version: "0.1.0" });

const DEFAULT_RATE_PCT = 6.4; // matches the July 2026 reference; overridable + flagged as an assumption

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

// ---------------------------------------------------------------------------
// Explainers — the stable "how it all works" layer.
// ---------------------------------------------------------------------------

server.registerTool(
  "explain_role",
  {
    title: "Explain a Role",
    description:
      "Explain who a broker/agent/realtor/assessor/inspector/appraiser/escrow officer/loan officer is, " +
      "what they do, who pays them, and whose side they're on. Omit 'role' for the full who's-who. " +
      "Includes the 2024 buyer-agent commission change.",
    inputSchema: { role: z.string().optional() },
  },
  async ({ role }) => textResult(explain.explainRole(role))
);

server.registerTool(
  "buying_timeline",
  {
    title: "Buying Timeline",
    description:
      "The end-to-end California home-buying process, step by step, with contingencies and deposit " +
      "protection front and center.",
    inputSchema: {},
  },
  async () => textResult(explain.buyingTimeline())
);

server.registerTool(
  "explain_term",
  {
    title: "Explain a Term",
    description:
      "Plain-English definition of a home-buying term (earnest money, contingency, escrow, PMI, points, " +
      "title insurance, Mello-Roos, appraisal gap...). Omit 'term' for the full glossary.",
    inputSchema: { term: z.string().optional() },
  },
  async ({ term }) => textResult(explain.explainTerm(term))
);

server.registerTool(
  "house_vs_condo",
  {
    title: "House vs Condo",
    description: "Compare buying a house vs a condo, including the HOA reality and financing differences.",
    inputSchema: {},
  },
  async () => textResult(explain.houseVsCondo())
);

server.registerTool(
  "explain_financing",
  {
    title: "Explain Financing",
    description:
      "Explain loan types (conventional/FHA/VA/USDA/CalHFA), the down-payment reality, and how " +
      "down-payment assistance actually gets repaid. Omit 'loan_type' for all of them.",
    inputSchema: { loan_type: z.string().optional() },
  },
  async ({ loan_type }) => textResult(explain.explainFinancing(loan_type))
);

server.registerTool(
  "how_they_think",
  {
    title: "How They Think",
    description:
      "The insider read on each party in a deal — their real incentive, where it clashes with yours, and " +
      "your counter-move. Roles: buyer_agent, listing_agent, loan_officer, inspector, appraiser, assessor, " +
      "escrow, seller, underwriter. Omit 'role' for the one-line summary of all of them.",
    inputSchema: { role: z.string().optional() },
  },
  async ({ role }) => textResult(perspectives.howTheyThink(role))
);

server.registerTool(
  "red_flag",
  {
    title: "Red-Flag Playbook",
    description:
      "You hit a problem — get the bottom line: what it means, who it scares, rough cost, and your move. " +
      "Issues: unpermitted_addition, old_wiring, foundation, roof, sewer_septic, hoa_trouble, appraisal_low. " +
      "Omit 'issue' for the one-line summary of all of them.",
    inputSchema: { issue: z.string().optional() },
  },
  async ({ issue }) => textResult(perspectives.redFlag(issue))
);

server.registerTool(
  "property_investigation",
  {
    title: "Property Investigation",
    description:
      "Given an address, return the due-diligence checklist AND the authoritative county public-record " +
      "sources to verify the listing (owner/LLC, real tax bill incl. Mello-Roos, permits, sale history, " +
      "flood/fire zone). Riverside/LA/San Diego counties have exact links baked in; others get the general " +
      "path. The research asset then fetches what's public; anything blocked, it points to the exact office.",
    inputSchema: {
      address: z.string().min(1),
      county: z.string().optional(),
      city: z.string().optional().describe("Helps pin exact permit portal + county (e.g. Murrieta)."),
    },
  },
  async ({ address, county, city }) => textResult(property.propertyInvestigation(address, county, city))
);

server.registerTool(
  "photo_checklist",
  {
    title: "Photo Checklist",
    description:
      "The shot list to take on-site (electrical panel label, under sinks, roof, foundation, HVAC age, " +
      "etc.) so the photos you send can be analyzed for red flags and turned into questions to ask.",
    inputSchema: {},
  },
  async () => textResult(property.photoChecklist())
);

// ---------------------------------------------------------------------------
// Calculators — transparent math; fall back to the saved buyer profile.
// ---------------------------------------------------------------------------

async function profile(): Promise<BuyerProfile> {
  return profileStore.getProfile();
}
function need(value: number | undefined, fromProfile: number | undefined, label: string): number {
  const v = value ?? fromProfile;
  // Reject null/NaN/Infinity too: a corrupted profile value (e.g. Infinity
  // serialized to null in JSON) must produce a clear error, not a confident
  // wrong number.
  if (v === undefined || v === null || !Number.isFinite(v)) {
    throw new Error(`Missing or invalid "${label}". Pass it, or save it with set_profile.`);
  }
  return v;
}

// Shared bounded-number schemas: .finite() blocks Infinity (which zod's
// .positive() alone allows, and which JSON-serializes to null — silent
// corruption), and sane .max() bounds keep absurd inputs from producing
// NaN math or unbounded loops.
const money = z.number().finite().min(0).max(1_000_000_000);
const moneyPositive = z.number().finite().positive().max(1_000_000_000);
const ratePct = z.number().finite().positive().max(25);
const smallPct = z.number().finite().min(0).max(100);
const termYears = z.number().int().min(1).max(50);

server.registerTool(
  "affordability",
  {
    title: "Affordability",
    description:
      "Estimate the max home price you can afford from income + debts + down payment, using the 28/36 " +
      "debt-to-income rule. Falls back to your saved profile for income/debts/down payment.",
    inputSchema: {
      annual_income: moneyPositive.optional(),
      monthly_debts: money.optional(),
      down_payment: money.optional(),
      rate_pct: ratePct.optional().describe(`Defaults to ${DEFAULT_RATE_PCT}% — verify current rate.`),
      term_years: termYears.optional(),
      front_end_pct: smallPct.optional(),
      back_end_pct: smallPct.optional(),
      hoa_monthly: money.optional(),
      mello_roos_monthly: money.optional(),
    },
  },
  async (args) => {
    try {
      const p = await profile();
      const rate = args.rate_pct ?? DEFAULT_RATE_PCT;
      const out = calc.affordability({
        annual_income: need(args.annual_income, p.annual_income, "annual_income"),
        monthly_debts: args.monthly_debts ?? p.monthly_debts ?? 0,
        down_payment: need(args.down_payment, p.down_payment, "down_payment"),
        rate_pct: rate,
        term_years: args.term_years,
        front_end_pct: args.front_end_pct,
        back_end_pct: args.back_end_pct,
        hoa_monthly: args.hoa_monthly,
        mello_roos_monthly: args.mello_roos_monthly,
      });
      const note = args.rate_pct === undefined ? `\n\n(Rate assumed ${DEFAULT_RATE_PCT}% — check the live rate reference.)` : "";
      return textResult(out + note);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "monthly_cost",
  {
    title: "Monthly Cost",
    description:
      "The TRUE monthly cost of a home: principal + interest + property tax + insurance + HOA + " +
      "Mello-Roos + PMI. Falls back to your saved profile for price/down payment.",
    inputSchema: {
      price: moneyPositive.optional(),
      down_payment: money.optional(),
      rate_pct: ratePct.optional().describe(`Defaults to ${DEFAULT_RATE_PCT}% — verify current rate.`),
      term_years: termYears.optional(),
      property_tax_rate_pct: z.number().finite().min(0).max(10).optional(),
      home_insurance_monthly: money.optional(),
      hoa_monthly: money.optional(),
      mello_roos_monthly: money.optional(),
      pmi_rate_pct: z.number().finite().min(0).max(10).optional(),
    },
  },
  async (args) => {
    try {
      const p = await profile();
      const out = calc.monthlyCost({
        price: need(args.price, p.target_price, "price"),
        down_payment: need(args.down_payment, p.down_payment, "down_payment"),
        rate_pct: args.rate_pct ?? DEFAULT_RATE_PCT,
        term_years: args.term_years,
        property_tax_rate_pct: args.property_tax_rate_pct,
        home_insurance_monthly: args.home_insurance_monthly,
        hoa_monthly: args.hoa_monthly,
        mello_roos_monthly: args.mello_roos_monthly,
        pmi_rate_pct: args.pmi_rate_pct,
      });
      return textResult(out);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "closing_costs",
  {
    title: "Closing Costs",
    description: "Itemized estimate of buyer closing costs for a California purchase.",
    inputSchema: {
      price: moneyPositive.optional(),
      down_payment: money.optional(),
    },
  },
  async (args) => {
    try {
      const p = await profile();
      return textResult(
        calc.closingCosts({
          price: need(args.price, p.target_price, "price"),
          down_payment: need(args.down_payment, p.down_payment, "down_payment"),
        })
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "cash_to_close",
  {
    title: "Cash to Close",
    description: "Total up-front cash needed: down payment + closing costs + reserves, minus earnest money already paid.",
    inputSchema: {
      down_payment: money.optional(),
      closing_costs: money,
      reserves: money.optional(),
      earnest_money_paid: money.optional(),
    },
  },
  async (args) => {
    try {
      const p = await profile();
      return textResult(
        calc.cashToClose({
          down_payment: need(args.down_payment, p.down_payment, "down_payment"),
          closing_costs: args.closing_costs,
          reserves: args.reserves,
          earnest_money_paid: args.earnest_money_paid,
        })
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "rent_vs_buy",
  {
    title: "Rent vs Buy",
    description:
      "Break-even analysis of renting vs buying over N years, including maintenance, appreciation, and " +
      "selling costs. Shows roughly when buying pulls ahead.",
    inputSchema: {
      monthly_rent: moneyPositive,
      price: moneyPositive.optional(),
      down_payment: money.optional(),
      rate_pct: ratePct.optional(),
      years: z.number().int().min(1).max(50).default(7),
      rent_growth_pct: z.number().finite().min(0).max(25).optional(),
      appreciation_pct: z.number().finite().min(-25).max(25).optional(),
      hoa_monthly: money.optional(),
      mello_roos_monthly: money.optional(),
      maintenance_rate_pct: z.number().finite().min(0).max(10).optional(),
    },
  },
  async (args) => {
    try {
      const p = await profile();
      return textResult(
        calc.rentVsBuy({
          monthly_rent: args.monthly_rent,
          price: need(args.price, p.target_price, "price"),
          down_payment: need(args.down_payment, p.down_payment, "down_payment"),
          rate_pct: args.rate_pct ?? DEFAULT_RATE_PCT,
          years: args.years,
          rent_growth_pct: args.rent_growth_pct,
          appreciation_pct: args.appreciation_pct,
          hoa_monthly: args.hoa_monthly,
          mello_roos_monthly: args.mello_roos_monthly,
          maintenance_rate_pct: args.maintenance_rate_pct,
        })
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Reference data + the research-verification loop.
// ---------------------------------------------------------------------------

server.registerTool(
  "get_reference",
  {
    title: "Get Reference Data",
    description:
      "Return stored live-sensitive reference values (rates, loan limits, program terms, prices) with " +
      "their source, as-of date, staleness flag, and the authoritative verify_url research should fetch " +
      "to re-check. Omit 'key' for all of them.",
    inputSchema: { key: z.string().optional() },
  },
  async ({ key }) => {
    try {
      const views = await refStore.withStaleness(now());
      const chosen = key ? views.filter((v) => v.key === key) : views;
      if (chosen.length === 0) {
        return textResult(`No reference "${key}". Known keys: ${views.map((v) => v.key).join(", ")}`);
      }
      const blocks = chosen.map((v) =>
        [
          `${v.key} — ${v.label}`,
          `  value: ${v.value}`,
          `  as of: ${v.as_of} (${v.age_days === Infinity ? "?" : v.age_days}d old${v.is_stale ? " — STALE, re-verify" : ""})`,
          `  confidence: ${v.confidence}`,
          `  source: ${v.source}`,
          `  verify_url: ${v.verify_url}`,
          v.notes ? `  notes: ${v.notes}` : null,
        ]
          .filter(Boolean)
          .join("\n")
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
    description:
      "List reference values older than their staleness window — i.e. what the orchestrator should have " +
      "research re-verify against each verify_url.",
    inputSchema: {},
  },
  async () => {
    try {
      const stale = (await refStore.withStaleness(now())).filter((v) => v.is_stale);
      if (stale.length === 0) return textResult("All reference values are within their freshness window.");
      const lines = stale.map(
        (v) => `- ${v.key} (${v.age_days === Infinity ? "unknown age" : `${v.age_days}d old`}, limit ${v.staleness_days}d) → verify at ${v.verify_url}`
      );
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
    description:
      "Propose a new value for a reference after research verified it against the source. FLAG-ONLY by " +
      "default: without confirm=true this only PREVIEWS the change and writes nothing. Only call with " +
      "confirm=true after a human approves — the source of truth never silently rewrites itself.",
    inputSchema: {
      key: z.string(),
      value: z.string(),
      source: z.string().describe("Where the new value was verified (e.g. the verify_url)."),
      as_of: z.string().optional().describe("ISO date verified; defaults to today."),
      confirm: z.boolean().default(false),
    },
  },
  async ({ key, value, source, as_of, confirm }) => {
    try {
      const asOf = as_of ?? now().toISOString().slice(0, 10);
      // A future as_of would make the record read as "fresh" forever and never
      // get flagged stale for re-verification — reject it (small clock-skew
      // allowance of one day).
      const parsed = new Date(asOf);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`as_of "${asOf}" is not a parseable date. Use YYYY-MM-DD.`);
      }
      if (parsed.getTime() > now().getTime() + 86_400_000) {
        throw new Error(`as_of "${asOf}" is in the future — a future date would suppress staleness checks.`);
      }
      const result = await refStore.updateReference(key, value, source, asOf, confirm, now());
      return textResult(result.message);
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Buyer profile + orientation.
// ---------------------------------------------------------------------------

server.registerTool(
  "set_profile",
  {
    title: "Set Buyer Profile",
    description:
      "Save your details once so the calculators reuse them (income, debts, down payment, target price, " +
      "city, household size, veteran status). Only provided fields change.",
    inputSchema: {
      city: z.string().optional(),
      household_size: z.number().int().min(1).max(20).optional(),
      annual_income: moneyPositive.optional(),
      monthly_debts: money.optional(),
      down_payment: money.optional(),
      target_price: moneyPositive.optional(),
      credit_band: z.enum(["excellent", "good", "fair", "poor"]).optional(),
      is_veteran: z.boolean().optional(),
      first_time_buyer: z.boolean().optional(),
    },
  },
  async (args) => {
    try {
      const updated = await profileStore.updateProfile(args, now());
      return textResult(`Profile saved:\n${JSON.stringify(updated, null, 2)}`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_profile",
  { title: "Get Buyer Profile", description: "Show the saved buyer profile.", inputSchema: {} },
  async () => {
    const p = await profileStore.getProfile();
    return textResult(Object.keys(p).length ? JSON.stringify(p, null, 2) : "No profile saved yet — use set_profile.");
  }
);

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description:
      "Orientation for an overwhelmed first-time buyer: reads your profile, tells you where you are and " +
      "the next few concrete moves. The best first call if you don't know where to begin.",
    inputSchema: {},
  },
  async () => {
    try {
      const p = await profileStore.getProfile();
      const have = Object.keys(p).length > 0;
      const veteranLine = p.is_veteran
        ? `You marked veteran status — ask a VA-savvy lender about a 0%-down VA loan first; it's usually the best deal.`
        : `If you or your spouse ever served, ask about a VA loan (0% down).`;
      return textResult(
        [
          `START HERE — first-time buyer roadmap`,
          ``,
          have ? `Your saved profile: ${JSON.stringify(p)}` : `No profile yet — run set_profile so the calculators remember your numbers.`,
          ``,
          `Your next 3 moves:`,
          `  1. GET PRE-APPROVED with a lender — it fixes your real budget and makes offers credible. Run 'affordability' first for a ballpark.`,
          `  2. LEARN THE TRUE MONTHLY COST — run 'monthly_cost' for a target price. In SW Riverside, always factor Mello-Roos + insurance (call 'get_reference insurance_market_ca').`,
          `  3. LINE UP YOUR PEOPLE — read 'explain_role' so you know who's on your side, and 'buying_timeline' so you know what protects your deposit (contingencies).`,
          ``,
          veteranLine,
          ``,
          `Ask me anything as a plain question — the orchestrator will pull the right explainer or calculator, and cross-check any live number (rates, limits, programs) against the source via research.`,
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
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
  console.error("Fatal error starting homebuyer MCP server:", err);
  process.exit(1);
});
