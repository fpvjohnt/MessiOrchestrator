#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainTopic, startHere } from "./topics.js";
import { readMarket, mythVsReality } from "./toolkit.js";
import { priceCheck } from "./math.js";
import { checkKalshi, kalshiVerdict } from "./verify.js";

const server = new McpServer({ name: "kalshi", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
// Sized from what the case log showed real callers actually send, not from a
// guess — see AGENTS.md on caps. A market question is free text describing a
// real-world condition, and those run long.
const freeText = z.string().max(2000);
const lookupKey = z.string().max(200);

server.registerTool(
  "explain_topic",
  {
    title: "Explain an Event-Contract Topic",
    description:
      "THE FRONT DOOR: name a topic — how the instrument works (what an event contract is, the series/event/market hierarchy, the order " +
      "book and maker vs taker, settlement and expiry), the math (price as implied probability, fees against edge, position sizing, where " +
      "an edge could actually come from), or the context (CFTC regulation and the unsettled state-law fight, how it compares to a " +
      "sportsbook or Polymarket, taxes, and the free public market-data API) — and get what it is, why it matters, the key ideas, how to " +
      "do it, and the pitfalls. Omit 'topic' for the full map.",
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
  "read_market",
  {
    title: "How to Analyse One Market Properly",
    description:
      "The checklist for analysing a single event contract, in the order that matters: read the SETTLEMENT RULE before the price, work out " +
      "what actually decides it, form your own probability BEFORE looking at the market, then compare, check liquidity, run the fee math, " +
      "and size for being wrong. Returns the research queries to have the 'research' asset run. Holds no live prices.",
    inputSchema: { question: freeText.optional().describe("The market or question you're looking at.") },
  },
  async ({ question }) => {
    try {
      return textResult(readMarket(question));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "price_check",
  {
    title: "Breakeven and Expected Value After Fees",
    description:
      "The arithmetic almost nobody does. Give your estimated probability and the contract's price, and get the BREAKEVEN probability " +
      "after fees (which is the price plus the fee, not the price), the edge before and after fees, expected value, max loss/gain, and — " +
      "if you supply days_to_expiry — the annualised return on capital. Says plainly when the fee eats the edge, which for a small edge " +
      "near 50c is the common case. Uses an assumed fee schedule and SAYS SO; pass fee_coefficient once you've verified the current one.",
    inputSchema: {
      your_probability: z
        .number()
        .positive()
        .max(100)
        .describe("Your estimate that the contract you're buying settles at $1. Accepts 0-1 or 0-100."),
      market_price: z
        .number()
        .positive()
        .max(100)
        .describe("Price of the side you're buying, in cents (e.g. 63). For NO at 40c, pass 40 and your probability that NO wins."),
      contracts: z.number().int().positive().max(100000).optional(),
      order: z.enum(["maker", "taker"]).optional().describe("maker = resting limit order (charged less); taker = crosses the spread. Default taker."),
      exit: z.enum(["settlement", "early"]).optional().describe("settlement = fee once; early = fee both ways. Default settlement."),
      fee_coefficient: z.number().positive().max(1).optional().describe("Current published taker fee coefficient, if verified."),
      days_to_expiry: z.number().positive().max(3650).optional().describe("Supply to see the annualised return."),
    },
  },
  async (args) => {
    try {
      return textResult(priceCheck(args));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "myth_vs_reality",
  {
    title: "Prediction-Market Myths vs Reality",
    description:
      "The folklore that costs money: 'the market price is the true probability', 'buying at 90c is nearly free money', 'prediction " +
      "markets beat the polls', 'it's just gambling' / 'it's investing', 'I follow this closely so I have an edge', 'fees are small', " +
      "'it's federally regulated so it's legal for me', and 'I won several in a row so my method works'.",
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
  "check_kalshi",
  {
    title: "Check a Current Kalshi Specific (via Research)",
    description:
      "STEP 1 of the verify loop, for anything that moves: the fee schedule, whether a contract type is tradeable where you live, which " +
      "markets exist, API base URL/endpoints/rate limits, or tax treatment. Returns authoritative sources + red flags + research queries " +
      "so the 'research' asset can verify it; then call kalshi_verdict. Never answers legality or fees from memory — the legal question " +
      "in particular has moved repeatedly and most rulings so far are preliminary, not settled law.",
    inputSchema: { topic: freeText },
  },
  async ({ topic }) => {
    try {
      return textResult(checkKalshi(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "kalshi_verdict",
  {
    title: "Grade What Research Found",
    description:
      "STEP 2 of the verify loop: pass what research found and get it graded by evidence tier — the exchange's own documents and court " +
      "opinions above commentary, commentary above affiliate content. Labels VERIFIED / UPDATED / UNVERIFIED, requires a date on any fee, " +
      "and requires saying explicitly whether a legal position is settled law or a preliminary injunction.",
    inputSchema: {
      topic: freeText,
      findings: freeText.describe("What research reported back."),
    },
  },
  async ({ topic, findings }) => {
    try {
      return textResult(kalshiVerdict(topic, findings));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "start_here",
  {
    title: "Start Here — What This Asset Does",
    description:
      "Orientation: the three lenses (how the instrument works, the math that decides if it's worth it, and regulation/alternatives/data), " +
      "the tools, and the three rules that prevent the most pain.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(startHere());
    } catch (err) {
      return errorResult(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
