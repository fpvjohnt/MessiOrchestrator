// Structured data sources — the other half of research. The search providers
// return prose you have to parse; these return FACTS you can compute on, from
// two sources that need no API key at all:
//
//   SEC EDGAR (data.sec.gov)  — company filings. Feeds nestegg, whose
//                               analyze_asset already hands back an EDGAR
//                               source list and expects research to fetch it.
//   Kalshi    (external-api)  — live event-contract prices. Feeds kalshi,
//                               which ships the framework but deliberately
//                               holds no prices.
//
// Both are keyless, which is why they were chosen first: nothing here needs a
// secret, so the "assets hold no credentials" rule is untouched and there is
// no key to leak. Every endpoint and field below was probed live before this
// file was written — see the notes at each one, several of which contradict
// what the published guides say.
//
// SSRF: assertPublicUrl() is not used here, and that is deliberate rather than
// an oversight. It exists for fetch_page/research, which follow URLs that come
// from search results or model output. Every host here is a hardcoded
// constant, and every caller-supplied value is regex-validated and
// URL-encoded before it reaches a path or query, so there is no untrusted URL
// to guard.

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 12_000_000; // company_tickers.json alone is ~220KB; filings JSON runs larger

// The SEC REQUIRES a descriptive User-Agent with a contact address on every
// programmatic request — it is a stated condition of use, not etiquette, and
// they will block traffic without it. This is not a secret, so it lives in an
// env var rather than a key store; the fallback keeps the server working while
// making it obvious in the output that it should be set.
const SEC_CONTACT = process.env.RESEARCH_CONTACT_EMAIL?.trim();
const SEC_USER_AGENT = SEC_CONTACT
  ? `john-mcp-research/0.1 (${SEC_CONTACT})`
  : `john-mcp-research/0.1 (contact not set - see RESEARCH_CONTACT_EMAIL)`;

const GENERIC_USER_AGENT = "research-mcp/0.1 (+local MCP server)";

async function readCapped(res: Response, host: string): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();
  const decoder = new TextDecoder();
  let out = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error(`Response from ${host} exceeded ${MAX_RESPONSE_BYTES} bytes`);
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

async function getJson(url: string, userAgent: string): Promise<any> {
  const host = new URL(url).host;
  const res = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    // Cancel the body. Leaving it undrained holds the connection open in
    // undici until it times out — extract.ts already does this on its redirect
    // path; this one was missed.
    await res.body?.cancel().catch(() => {});
    throw new Error(`HTTP ${res.status} from ${host}`);
  }
  return JSON.parse(await readCapped(res, host));
}

// ---------------------------------------------------------------------------
// SEC EDGAR
// ---------------------------------------------------------------------------

/** Tickers are short and alphanumeric with dots/dashes. Validated rather than
 * escaped, because anything outside this set is a caller bug, not a lookup. */
const TICKER_RE = /^[A-Za-z0-9.\-]{1,12}$/;

// The ticker->CIK map is one 220KB file covering ~10,400 companies and it
// changes rarely, so it is fetched once per process rather than per lookup.
// Without this, every filings call pays for the whole file.
// Caches the PENDING promise, not the resolved map — the same fix
// client-manager.ts already carries. Caching only the result meant N concurrent
// sec_filings calls each pulled the full 220KB file before any of them stored
// it.
let tickerCache: Promise<Map<string, { cik: string; title: string }>> | null = null;

export function loadTickerMap(): Promise<Map<string, { cik: string; title: string }>> {
  if (tickerCache) return tickerCache;
  const pending = (async () => {
    const raw = await getJson("https://www.sec.gov/files/company_tickers.json", SEC_USER_AGENT);
    const map = new Map<string, { cik: string; title: string }>();
    for (const entry of Object.values(raw as Record<string, { cik_str: number; ticker: string; title: string }>)) {
      if (!entry?.ticker) continue;
      // CIK is zero-padded to 10 digits in the submissions path — the raw JSON
      // stores it as an unpadded number, which is the most common way this
      // endpoint gets called wrong.
      map.set(entry.ticker.toUpperCase(), { cik: String(entry.cik_str).padStart(10, "0"), title: entry.title });
    }
    return map;
  })();
  tickerCache = pending;
  // A failed fetch must not be cached forever, or one transient error poisons
  // every later lookup for the life of the process.
  pending.catch(() => {
    if (tickerCache === pending) tickerCache = null;
  });
  return pending;
}

export interface SecFilingsOptions {
  ticker: string;
  /** Filter to specific forms, e.g. ["10-K", "8-K"]. Empty = all. */
  forms?: string[];
  limit?: number;
}

export async function secFilings(opts: SecFilingsOptions): Promise<string> {
  const ticker = opts.ticker.trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) {
    return `BOTTOM LINE: "${opts.ticker}" is not a valid ticker — expected 1-12 characters, letters/digits/dot/dash only.`;
  }
  const limit = Math.min(Math.max(opts.limit ?? 15, 1), 100);
  const wantForms = (opts.forms ?? []).map((f) => f.trim().toUpperCase()).filter(Boolean);

  const map = await loadTickerMap();
  const hit = map.get(ticker);
  if (!hit) {
    return `BOTTOM LINE: no SEC registrant found for ticker "${ticker}" — it may be a fund, a foreign issuer without a US listing, or delisted. EDGAR covers ${map.size} tickers.`;
  }

  const data = await getJson(`https://data.sec.gov/submissions/CIK${hit.cik}.json`, SEC_USER_AGENT);
  // filings.recent is COLUMNAR — parallel arrays, not an array of objects.
  // Every field is a separate array indexed in lockstep.
  const recent = data?.filings?.recent;
  if (!recent?.form?.length) {
    return `BOTTOM LINE: EDGAR has no recent filings listed for ${hit.title} (CIK ${hit.cik}).`;
  }

  // The columnar arrays are indexed in lockstep, so a short one would render
  // `undefined` into a URL rather than failing. Bound the loop by the SHORTEST
  // array actually used.
  const columns = [recent.form, recent.filingDate, recent.accessionNumber].filter(Array.isArray);
  const rowCount = Math.min(...columns.map((c: unknown[]) => c.length));

  const rows: string[] = [];
  for (let i = 0; i < rowCount && rows.length < limit; i++) {
    const form = recent.form[i];
    if (wantForms.length && !wantForms.includes(String(form).toUpperCase())) continue;
    const accession = String(recent.accessionNumber[i] ?? "").replace(/-/g, "");
    const doc = recent.primaryDocument?.[i];
    const url = doc
      ? `https://www.sec.gov/Archives/edgar/data/${Number(hit.cik)}/${accession}/${doc}`
      : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${hit.cik}`;
    const desc = recent.primaryDocDescription?.[i] ?? "";
    rows.push(
      `  ${String(form).padEnd(10)} ${recent.filingDate[i]}  ${desc ? desc + " — " : ""}${url}`
    );
  }

  if (!rows.length) {
    const available = [...new Set(recent.form.slice(0, 200))].slice(0, 20).join(", ");
    return `BOTTOM LINE: ${hit.title} has recent filings, but none matching form(s) ${wantForms.join(", ")}. Recent forms on file include: ${available}.`;
  }

  const filtered = wantForms.length ? ` (${wantForms.join(", ")} only)` : "";
  return [
    `SEC EDGAR — ${hit.title} (${ticker}, CIK ${hit.cik})`,
    `BOTTOM LINE: ${rows.length} filing(s)${filtered} from EDGAR, newest first — these are the primary source documents, not commentary about them. ${data.sicDescription ? `Industry: ${data.sicDescription}.` : ""}`,
    ``,
    ...rows,
    ``,
    SEC_CONTACT
      ? `Source: data.sec.gov (official, free, no API key). Fetch any URL above with fetch_page for the filing text.`
      : `Source: data.sec.gov (official, free, no API key). ⚠ RESEARCH_CONTACT_EMAIL is not set — the SEC requires a contact address in the User-Agent and may block requests without one. Set it in research-mcp's .env.`,
    ``,
    `Read the filing itself before trusting any summary of it. A 10-K is the company's own audited account; an 8-K is what they had to disclose and when.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Kalshi — live event-contract prices
// ---------------------------------------------------------------------------

const KALSHI_BASE = "https://external-api.kalshi.com/trade-api/v2";
const SERIES_RE = /^[A-Za-z0-9._\-]{1,64}$/;

/** Prices come back as DOLLAR STRINGS ("0.2500"), not integer cents. Published
 * guides and older examples describe integer `yes_bid`/`yes_ask` fields; the
 * live API returns `yes_bid_dollars`/`yes_ask_dollars` as strings. This was
 * caught by probing the endpoint, not by reading about it. */
export function dollarsToCents(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n * 100 : undefined;
}

const cents = (n: number | undefined) => (n === undefined ? "  --" : `${n.toFixed(0).padStart(3)}c`);

export interface KalshiMarketsOptions {
  /** Free-text filter applied to market titles, case-insensitive. */
  query?: string;
  /** Restrict to a series, e.g. "KXHIGHNY". Far cheaper than filtering titles. */
  series?: string;
  limit?: number;
  status?: "open" | "closed" | "settled";
}

export async function kalshiMarkets(opts: KalshiMarketsOptions): Promise<string> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const status = opts.status ?? "open";
  const query = opts.query?.trim().toLowerCase() ?? "";

  const params = new URLSearchParams({ status, limit: String(query ? 200 : limit) });
  if (opts.series) {
    const series = opts.series.trim().toUpperCase();
    if (!SERIES_RE.test(series)) {
      return `BOTTOM LINE: "${opts.series}" is not a valid series ticker — expected up to 64 characters, letters/digits/dot/dash/underscore only.`;
    }
    params.set("series_ticker", series);
  }

  const data = await getJson(`${KALSHI_BASE}/markets?${params.toString()}`, GENERIC_USER_AGENT);
  let markets: any[] = Array.isArray(data?.markets) ? data.markets : [];
  if (query) {
    markets = markets.filter((m) => String(m?.title ?? "").toLowerCase().includes(query));
  }
  markets = markets.slice(0, limit);

  if (!markets.length) {
    return [
      `KALSHI MARKETS${opts.series ? ` — series ${opts.series}` : ""}${query ? ` matching "${opts.query}"` : ""}`,
      `BOTTOM LINE: no ${status} markets matched. Kalshi's titles are specific and heavily abbreviated, so a broad word often matches nothing — try the series ticker instead, or a single distinctive word.`,
    ].join("\n");
  }

  const rows = markets.flatMap((m) => {
    const bid = dollarsToCents(m.yes_bid_dollars);
    const ask = dollarsToCents(m.yes_ask_dollars);
    const last = dollarsToCents(m.last_price_dollars);
    // The MID is the honest read of an implied probability — the last trade can
    // be stale and one side of a wide spread systematically misleads. This is
    // the same point the kalshi asset's price_as_probability topic makes.
    const mid = bid !== undefined && ask !== undefined ? (bid + ask) / 2 : last;
    const spread = bid !== undefined && ask !== undefined ? ask - bid : undefined;
    const title = String(m.title ?? "").replace(/\*\*/g, "");
    return [
      `  ${title}`,
      `    ${m.ticker}   bid ${cents(bid)} / ask ${cents(ask)}  → implied ${mid === undefined ? "--" : mid.toFixed(0) + "%"}` +
        `${spread !== undefined ? `  (spread ${spread.toFixed(0)}c)` : ""}   closes ${m.close_time ?? "?"}`,
    ];
  });

  // The settlement rule is the contract. The kalshi asset's whole checklist
  // starts with "read the rule before the price", so surfacing it here is what
  // makes that advice actionable instead of a lecture.
  const firstRule = markets.find((m) => m.rules_primary)?.rules_primary;

  return [
    `KALSHI MARKETS${opts.series ? ` — series ${opts.series}` : ""}${query ? ` matching "${opts.query}"` : ""}`,
    `BOTTOM LINE: ${markets.length} ${status} market(s), priced as the MID of bid/ask — that mid is the market's implied probability, and it is the honest read. The last trade can be stale and one side of a wide spread misleads.`,
    ``,
    ...rows,
    ``,
    ...(firstRule ? [`SETTLEMENT RULE (first market shown): ${String(firstRule).slice(0, 400)}`, ``] : []),
    `Source: Kalshi public market-data API (free, no API key). A wide spread means the implied probability is a range, not a number — and you pay half that spread on entry and half on exit.`,
    `Next: the 'kalshi' asset's price_check turns your own probability estimate and one of these prices into a breakeven-after-fees answer.`,
  ].join("\n");
}
