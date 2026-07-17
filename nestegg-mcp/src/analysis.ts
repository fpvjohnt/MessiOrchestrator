// Deep-analysis engine for a stock or crypto. Two parts:
//   analyzeAsset(symbol) -> the investigation PLAN + authoritative free sources
//     (SEC EDGAR for filings + insider Form 4) + the scoring rubric. Research
//     then fetches; the model scores.
//   scoreSignals(...) -> deterministic weighted score from the findings, with a
//     plain-language bottom line and the hard education caveat.
// Nothing here says "buy" or "sell" — it organizes public signals so you read
// them like a pro. Markets are not predictable; this is a snapshot, not a promise.

export type AssetType = "stock" | "crypto";

function edgarSources(ticker: string): string {
  const t = encodeURIComponent(ticker.toUpperCase());
  return [
    `AUTHORITATIVE FREE SOURCES (SEC EDGAR — the real filings, free):`,
    `  • All filings ............ https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${t}&type=&dateb=&owner=include&count=40`,
    `  • INSIDER trades (Form 4) https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${t}&type=4&dateb=&owner=include&count=40`,
    `      → execs/employees buying = strong positive tell; routine selling = weak signal (often just taxes/diversifying).`,
    `  • Material events (8-K) .. https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${t}&type=8-K&dateb=&owner=include&count=40`,
    `      → mergers, acquisitions, exec departures, big contracts, lawsuits show up here first.`,
    `  • Annual/quarterly (10-K/10-Q) https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${t}&type=10-K&dateb=&owner=include&count=10`,
    `      → revenue/earnings trend = the real long-term driver.`,
    `  • Full-text search ....... https://efts.sec.gov/LATEST/search-index?q=%22${t}%22 (or the friendly UI at https://www.sec.gov/cgi-bin/browse-edgar)`,
    `  • Price history (CSV, usually fetchable) https://stooq.com/q/d/l/?s=${encodeURIComponent(ticker.toLowerCase())}.us&i=d`,
    `      → Yahoo/Google Finance often block bots; Stooq's CSV usually works for the 5-year trend.`,
  ].join("\n");
}

function cryptoSources(symbol: string): string {
  const s = encodeURIComponent(symbol.toLowerCase());
  return [
    `SOURCES (crypto has NO SEC filings or earnings — value is pure sentiment, so signals are noisier):`,
    `  • Overview/price ......... https://www.coingecko.com/en/coins/${s} (API: https://api.coingecko.com/api/v3/coins/${s})`,
    `  • Is it a security? ...... check SEC actions — https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(symbol)}%22`,
    `  • On-chain / whale wallets needs a key (Etherscan etc.) — note as a gap unless a key is added.`,
    `  • News + sentiment ....... research asset (see search queries below).`,
    `  ⚠️ No insider filings, no fundamentals — treat any crypto score as a weak, sentiment-only read.`,
  ].join("\n");
}

export function analyzeAsset(symbol: string, type: AssetType): string {
  const sym = symbol.toUpperCase();
  const sources = type === "stock" ? edgarSources(symbol) : cryptoSources(symbol);
  const newsQueries =
    type === "stock"
      ? `  • "${sym} stock news" · "${sym} earnings" · "${sym} merger acquisition" · "${sym} SEC investigation" · "${sym} CEO"`
      : `  • "${sym} crypto news" · "${sym} exchange listing" · "${sym} SEC" · "${sym} hack exploit" · "${sym} tokenomics unlock"`;
  return [
    `ANALYSIS PLAN — ${sym} (${type})`,
    ``,
    `BOTTOM LINE: gather the signals below via research, then feed them to 'score_signals' for a rated read. This is analysis, not a buy/sell order.`,
    ``,
    sources,
    ``,
    `NEWS / SENTIMENT — have research run these:`,
    newsQueries,
    ``,
    `THE 6 SIGNALS TO SCORE (what pros actually weigh):`,
    `  1. INSIDER activity — net buying or selling? (buying matters more than selling)`,
    `  2. PRICE trend — 3-month, 1-year, 5-year direction.`,
    type === "stock"
      ? `  3. FUNDAMENTALS — revenue/earnings improving or declining? (the heaviest long-term signal)`
      : `  3. FUNDAMENTALS — N/A for crypto; there are none. That absence IS the risk.`,
    `  4. NEWS tone — mostly positive, mixed, or negative lately?`,
    `  5. MATERIAL events — pending merger, lawsuit, exec departure, big dilution/unlock?`,
    `  6. RISK — how wild are the swings; can you stomach a 50% drop?`,
    ``,
    `Then: 'score_signals' with what you found → one bottom-line rating + the honest caveats.`,
  ].join("\n");
}

// ---- Deterministic scorer ---------------------------------------------------

const INSIDER: Record<string, number> = { heavy_buying: 25, net_buying: 18, mixed: 8, unknown: 8, net_selling: 5, heavy_selling: 0 };
const TREND: Record<string, number> = { strong_up: 20, up: 15, flat: 10, unknown: 8, down: 5, strong_down: 0 };
const NEWS: Record<string, number> = { positive: 15, mixed: 8, unknown: 6, negative: 0 };
const FUND: Record<string, number> = { improving: 25, stable: 15, unknown: 8, declining: 2, none: 6 };

export interface SignalInput {
  symbol: string;
  type: AssetType;
  insider_activity?: keyof typeof INSIDER;
  price_trend?: keyof typeof TREND;
  news_tone?: keyof typeof NEWS;
  fundamentals?: keyof typeof FUND;
  risk_flags?: number; // count of material red flags (lawsuit, dilution, exec exit, sec action…)
  notes?: string;
}

// Own-property lookup so inherited keys ("toString" etc.) can't slip past the
// `?? fallback` when this function is called directly (outside the zod boundary).
function pick(map: Record<string, number>, key: string, fallback: number): number {
  return Object.hasOwn(map, key) ? map[key] : fallback;
}

export function scoreSignals(input: SignalInput): string {
  // Crypto has no fundamentals — force "none" regardless of what's passed, so a
  // caller can't inflate a crypto score with a signal that doesn't exist.
  const fundKey = input.type === "crypto" ? "none" : input.fundamentals ?? "unknown";
  const insider = pick(INSIDER, input.insider_activity ?? "unknown", 8);
  const trend = pick(TREND, input.price_trend ?? "unknown", 8);
  const news = pick(NEWS, input.news_tone ?? "unknown", 6);
  const fund = pick(FUND, fundKey, 8);
  const flags = Math.min(Math.max(0, Math.floor(input.risk_flags ?? 0)), 10);
  const base = 15;

  let score = base + insider + trend + news + fund - flags * 5;
  score = Math.max(0, Math.min(100, score));

  const band =
    score >= 70
      ? "Signals lean POSITIVE — but that is not a promise."
      : score >= 50
      ? "MIXED — no clear edge here."
      : "Signals lean CAUTION.";

  // null = drop this line entirely; "" = keep as an intentional blank spacer.
  const lines: Array<string | null> = [
    `SIGNAL SCORE — ${input.symbol.toUpperCase()}: ${score}/100`,
    `BOTTOM LINE: ${band}`,
    ``,
    `  Insider activity .. ${input.insider_activity ?? "unknown"}  (+${insider})`,
    `  Price trend ....... ${input.price_trend ?? "unknown"}  (+${trend})`,
    `  Fundamentals ...... ${fundKey}  (+${fund})`,
    `  News tone ......... ${input.news_tone ?? "unknown"}  (+${news})`,
    `  Risk flags ........ ${flags}  (−${flags * 5})`,
    input.notes ? `  Notes ............. ${input.notes}` : null,
    input.type === "crypto"
      ? `⚠️ CRYPTO: no earnings, no filings — this score is a sentiment snapshot only, far noisier than a stock's.`
      : null,
    ``,
    `HARD TRUTH (read this every time):`,
    `  • This scores PUBLIC signals at one moment. It cannot predict the future — nothing can.`,
    `  • Even professionals are right roughly half the time; most fail to beat a plain index fund.`,
    `  • A high score is not "buy" and a low score is not "sell" — it's a starting point for YOUR judgment.`,
    `  • Never put in money you can't afford to lose. For most people, boring index funds beat picking.`,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}
