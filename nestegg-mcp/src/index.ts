#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as refStore from "./reference-store.js";
import * as calc from "./calculators.js";
import * as explain from "./explainers.js";
import * as perspectives from "./perspectives.js";
import * as analysis from "./analysis.js";

const server = new McpServer({ name: "nestegg", version: "0.1.0" });

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

// Bounded-number schemas: .finite() blocks Infinity (which JSON-serializes to
// null — silent corruption) and .max() keeps absurd inputs from NaN math or
// long loops.
const money = z.number().finite().min(0).max(1_000_000_000);
const moneyPositive = z.number().finite().positive().max(1_000_000_000);
const years = z.number().int().min(1).max(80);
const pct = z.number().finite().min(0).max(100);
// Lookup keys are short; cap them so a giant blob can't be echoed back or (via
// update_reference) persisted into the store and replayed forever.
const lookupKey = z.string().max(100);

// ---------------------------------------------------------------------------
// Explainers — kid-simple, chunkable.
// ---------------------------------------------------------------------------

server.registerTool(
  "explain_vehicle",
  {
    title: "Explain an Investment",
    description:
      "Kid-simple explanation of any way people invest — stocks, bonds, index funds, 401k, IRA/Roth, HSA, " +
      "crypto, options (calls/puts), Kalshi/prediction markets, real estate, gold, wine — with how it " +
      "makes money, what can go wrong, and the honest odds. Omit 'vehicle' for the one-line list.",
    inputSchema: { vehicle: lookupKey.optional() },
  },
  async ({ vehicle }) => textResult(explain.explainVehicle(vehicle))
);

server.registerTool(
  "containers_vs_investments",
  {
    title: "Boxes vs Things",
    description:
      "THE key idea that kills most confusion: 401k/IRA/HSA are tax BOXES; stocks/funds are THINGS you " +
      "put inside them. Explains each box's tax deal in plain words.",
    inputSchema: {},
  },
  async () => textResult(explain.containersVsInvestments())
);

server.registerTool(
  "order_of_operations",
  {
    title: "Order of Operations",
    description:
      "The step-by-step ladder pros actually follow: match → kill card debt → emergency fund → " +
      "soon-money parking → Roth → more 401k → the rest. Call with no args for the overview, or " +
      "step: N to get ONE step at a time in plain words.",
    inputSchema: {
      step: z.number().int().min(1).max(7).optional().describe("Get one step at a time (1-7)."),
    },
  },
  async ({ step }) => textResult(explain.orderOfOperations(step))
);

server.registerTool(
  "explain_tax",
  {
    title: "Explain Taxes",
    description:
      "Plain-words tax rules: capital gains (short vs long, California's no-discount twist), what happens " +
      "when you take money OUT of a 401k/IRA/Roth, dividends, crypto tax surprises, why the tax boxes " +
      "matter. Omit 'topic' for the list. Education, not a CPA.",
    inputSchema: { topic: lookupKey.optional() },
  },
  async ({ topic }) => textResult(explain.explainTax(topic))
);

server.registerTool(
  "risk_ladder",
  {
    title: "Risk Ladder",
    description: "Every investment on a 7-rung ladder from can't-lose to casino, with honest odds per rung.",
    inputSchema: {},
  },
  async () => textResult(explain.riskLadder())
);

server.registerTool(
  "explain_term",
  {
    title: "Explain a Term",
    description:
      "Plain-words glossary: compound interest, dividend, ETF, expense ratio, FIDUCIARY (the magic word), " +
      "diversification, bull/bear, dollar-cost averaging, margin, liquidity, brokerage. Omit 'term' for all.",
    inputSchema: { term: lookupKey.optional() },
  },
  async ({ term }) => textResult(explain.explainTerm(term))
);

// ---------------------------------------------------------------------------
// Insider lens + traps.
// ---------------------------------------------------------------------------

server.registerTool(
  "how_they_think",
  {
    title: "How They Think",
    description:
      "The insider read on money-world players — stockbroker, financial advisor (fiduciary vs commission!), " +
      "robo-advisor, fund manager, insurance salesman, crypto influencer, trading guru. Their motive, the " +
      "clash with yours, your move. Omit 'role' for the summary.",
    inputSchema: { role: lookupKey.optional() },
  },
  async ({ role }) => textResult(perspectives.howTheyThink(role))
);

server.registerTool(
  "red_flag",
  {
    title: "Money Traps",
    description:
      "The trap playbook: guaranteed returns, FOMO picks, beginner options, margin, gold dealers, wine " +
      "platforms, free seminars, pump groups. What it looks like, the math against you, your move. Omit " +
      "'issue' for the summary.",
    inputSchema: { issue: lookupKey.optional() },
  },
  async ({ issue }) => textResult(perspectives.redFlag(issue))
);

// ---------------------------------------------------------------------------
// Deep analysis: stock / crypto signal engine (free sources, education-only).
// ---------------------------------------------------------------------------

server.registerTool(
  "analyze_asset",
  {
    title: "Analyze a Stock or Crypto",
    description:
      "Given a ticker (AAPL) or coin (BTC), returns the investigation plan + authoritative FREE sources " +
      "(SEC EDGAR filings, insider Form 4 buys/sells, 8-K mergers, 10-K financials, Stooq price history) " +
      "+ news queries + the 6 signals to score. Research then fetches; feed findings to score_signals. " +
      "Education, not a buy/sell call.",
    // The description says "Given a ticker (AAPL)" while the parameter is
    // called `symbol` — so the tool taught the caller a word it then rejected,
    // and a real call arrived as {ticker: "ALK"} and failed validation.
    // Accepting both is the honest fix: the prose and the schema now agree on
    // every word either of them uses.
    inputSchema: {
      symbol: z
        .string()
        .regex(/^[A-Za-z0-9.\-]{1,20}$/, "Symbol must be 1-20 chars: letters, digits, dot, dash only.")
        .optional()
        .describe("Ticker like AAPL, or coin like BTC/ethereum."),
      ticker: z
        .string()
        .regex(/^[A-Za-z0-9.\-]{1,20}$/, "Ticker must be 1-20 chars: letters, digits, dot, dash only.")
        .optional(),
      type: z.enum(["stock", "crypto"]).default("stock"),
    },
  },
  async ({ symbol: rawSymbol, ticker, type }) => {
    try {
      const symbol = rawSymbol ?? ticker;
      if (!symbol) {
        return { ...textResult(`BOTTOM LINE: no ticker given — pass "symbol" (e.g. AAPL, or BTC with type "crypto").`), isError: true };
      }
      return textResult(analysis.analyzeAsset(symbol, type));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "score_signals",
  {
    title: "Score the Signals",
    description:
      "Turn what research found into one bottom-line signal score (0-100) with the hard caveats. Insider " +
      "BUYING weighs more than selling (selling is often routine); fundamentals weigh heaviest for stocks. " +
      "Every field optional — unknowns score neutral.",
    inputSchema: {
      symbol: z.string().regex(/^[A-Za-z0-9.\-]{1,20}$/, "Symbol must be 1-20 chars: letters, digits, dot, dash only."),
      type: z.enum(["stock", "crypto"]).default("stock"),
      insider_activity: z.enum(["heavy_buying", "net_buying", "mixed", "net_selling", "heavy_selling", "unknown"]).optional(),
      price_trend: z.enum(["strong_up", "up", "flat", "down", "strong_down", "unknown"]).optional(),
      news_tone: z.enum(["positive", "mixed", "negative", "unknown"]).optional(),
      fundamentals: z.enum(["improving", "stable", "declining", "none", "unknown"]).optional(),
      risk_flags: z.number().int().min(0).max(10).optional().describe("Count of material red flags (lawsuit, dilution, exec exit, SEC action)."),
      notes: z.string().max(500).optional(),
    },
  },
  async ({ symbol, type, ...signals }) => {
    try {
      return textResult(analysis.scoreSignals({ symbol, type, ...signals }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Calculators.
// ---------------------------------------------------------------------------

server.registerTool(
  "compound_growth",
  {
    title: "Compound Growth",
    description: "What monthly investing becomes over time — and how much is growth doing the work.",
    inputSchema: {
      monthly: moneyPositive.max(1_000_000),
      years,
      annual_return_pct: z.number().finite().min(0).max(20).optional().describe("Default 7 (long-run index average)."),
    },
  },
  async ({ monthly, years: y, annual_return_pct }) => {
    try {
      return textResult(calc.compoundGrowth(monthly, y, annual_return_pct ?? 7));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "fee_drag",
  {
    title: "Fee Drag",
    description: "What a yearly fee (advisor 1%, expensive fund) really costs you over decades. Shocking on purpose.",
    inputSchema: {
      monthly: moneyPositive.max(1_000_000),
      years,
      fee_pct: z.number().finite().min(0).max(5),
      annual_return_pct: z.number().finite().min(0).max(20).optional(),
    },
  },
  async ({ monthly, years: y, fee_pct, annual_return_pct }) => {
    try {
      return textResult(calc.feeDrag(monthly, y, fee_pct, annual_return_pct ?? 7));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "match_value",
  {
    title: "Employer Match Value",
    description: "What your 401k match is worth in free money — per year and compounded over 20 years.",
    inputSchema: {
      salary: moneyPositive,
      match_pct: pct.describe("How much the employer matches, e.g. 50 = 50 cents per dollar."),
      match_limit_pct: z.number().finite().min(0).max(25).describe("Up to what % of salary, e.g. 6."),
    },
  },
  async ({ salary, match_pct, match_limit_pct }) => {
    try {
      return textResult(calc.matchValue(salary, match_pct, match_limit_pct));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "goal_timeline",
  {
    title: "Goal Timeline",
    description:
      "When you'll hit a savings goal (like a house down payment) at your monthly pace — and WHERE that " +
      "money should sit (the <5-year rule: goal money doesn't gamble).",
    inputSchema: {
      goal: moneyPositive,
      current_saved: money.optional(),
      monthly: moneyPositive.max(1_000_000),
      safe_rate_pct: z.number().finite().min(0).max(10).optional().describe("Default 4 (HYSA/T-bill territory)."),
    },
  },
  async ({ goal, current_saved, monthly, safe_rate_pct }) => {
    try {
      return textResult(calc.goalTimeline(goal, current_saved ?? 0, monthly, safe_rate_pct ?? 4));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Reference data + verification loop (same two-for-one as homebuyer).
// ---------------------------------------------------------------------------

server.registerTool(
  "get_reference",
  {
    title: "Get Reference Data",
    description:
      "Stored live-sensitive numbers (2026 contribution limits, HYSA rate levels, capital-gains rates) with " +
      "source, as-of date, staleness flag, and the authoritative verify_url research should fetch to " +
      "re-check. Omit 'key' for all.",
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
    description: "Which stored numbers are past their freshness window and should be re-verified via research.",
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
      "Propose a new value after research verified it at the source. FLAG-ONLY: without confirm=true this " +
      "previews and writes nothing. Only confirm after a human approves.",
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
      if (parsed.getTime() > now().getTime() + 86_400_000) {
        throw new Error(`as_of "${asOf}" is in the future — that would suppress staleness checks.`);
      }
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
    description: "Lost in the noise? The 3-sentence orientation and your first moves, in plain words.",
    inputSchema: {},
  },
  async () =>
    textResult(
      [
        `BOTTOM LINE: almost everyone who wins does it the boring way — index funds inside tax boxes, on autopilot, for decades. The exciting stuff is mostly how people lose.`,
        ``,
        `Three sentences that replace 100 videos:`,
        `  1. A 401k/IRA is a tax BOX; an index fund is the THING that goes inside ('containers_vs_investments').`,
        `  2. There's a correct ORDER to fill your buckets — free match money first ('order_of_operations', one step at a time).`,
        `  3. Anyone promising fast guaranteed money is paid to say it ('how_they_think', 'red_flag').`,
        ``,
        `Your first 3 moves:`,
        `  1. Ask: 'order_of_operations step 1'.`,
        `  2. Run 'match_value' with your salary and your job's match.`,
        `  3. Run 'goal_timeline' for your house down payment — that money has its own safe lane.`,
        ``,
        `I'm education, not a licensed advisor — I teach the machine and run your numbers; big moves get confirmed with a fee-only fiduciary.`,
      ].join("\n")
    )
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
  console.error("Fatal error starting nestegg MCP server:", err);
  process.exit(1);
});
