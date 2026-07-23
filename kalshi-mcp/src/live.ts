// The ONE live network call in an otherwise offline asset.
//
// Kalshi's public market-data API is KEYLESS for reads, so a current price needs
// no credential. AGENTS.md's rule is "deterministic and offline; anything live
// routes through research" — this is a deliberate, contained exception for the
// single data source that IS the subject of this asset. It ALWAYS degrades to
// the offline verify-via-research path on ANY failure (no network, timeout,
// 404, unparseable body), so regression.mjs stays network-free and a dropped
// connection can never break the tool. No key, no state, one GET.
const API_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const TIMEOUT_MS = 8000;

function offlineFallback(ticker: string, why: string): string {
  return (
    `Could not fetch a live price for "${ticker}" (${why}).\n` +
    `Use check_kalshi to get the current endpoint + a research query, have the research asset fetch it, then price_check the number.\n` +
    `BOTTOM LINE: no live price available right now — verify via research rather than trusting a stale or guessed number.`
  );
}

// The API returns prices as STRING DOLLARS ("0.6300"); older shapes used integer
// cents (63). Accept either and normalise to cents. A price in cents IS the
// market's implied probability in percent.
function centsOf(market: Record<string, unknown>, base: string): number | undefined {
  const dollars = market[`${base}_dollars`];
  if (typeof dollars === "string" && dollars.trim() !== "") {
    const n = Number.parseFloat(dollars);
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  const cents = market[base];
  if (typeof cents === "number" && Number.isFinite(cents)) return Math.round(cents);
  return undefined;
}

function numOf(market: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = market[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number.parseFloat(v))) return Number.parseFloat(v);
  }
  return undefined;
}

export async function liveMarket(ticker: string): Promise<string> {
  const clean = (ticker ?? "").trim().toUpperCase();
  if (!clean) return offlineFallback(String(ticker), "no ticker given");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/markets/${encodeURIComponent(clean)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    return offlineFallback(clean, err instanceof Error ? err.message : "network error");
  }
  if (!res.ok) return offlineFallback(clean, `API returned HTTP ${res.status}`);

  let market: Record<string, unknown>;
  try {
    const body = (await res.json()) as { market?: Record<string, unknown> };
    market = body.market ?? {};
  } catch {
    return offlineFallback(clean, "unparseable API response");
  }
  if (typeof market.ticker !== "string") return offlineFallback(clean, "no such market");

  const yb = centsOf(market, "yes_bid");
  const ya = centsOf(market, "yes_ask");
  const nb = centsOf(market, "no_bid");
  const na = centsOf(market, "no_ask");
  const last = centsOf(market, "last_price");
  const volume = numOf(market, "volume_fp", "volume", "volume_24h_fp");
  const oi = numOf(market, "open_interest_fp", "open_interest");
  const c = (n?: number) => (typeof n === "number" ? `${n}c` : "—");

  const title = typeof market.title === "string" ? ` — ${market.title}` : "";
  const status = typeof market.status === "string" ? market.status : "?";
  const close = typeof market.close_time === "string" ? `, closes ${market.close_time}` : "";

  const lines = [
    `LIVE Kalshi market ${market.ticker}${title}`,
    `  status: ${status}${close}`,
    `  YES  bid ${c(yb)} / ask ${c(ya)}      NO  bid ${c(nb)} / ask ${c(na)}`,
    `  last ${c(last)}${typeof last === "number" ? ` (implied ~${last}%)` : ""}   volume ${volume ?? "?"}   open interest ${oi ?? "?"}`,
    ``,
    `The price is the market's implied probability AFTER the house cut — not "the true probability". Form your OWN estimate, then price_check the edge after fees.`,
    typeof last === "number"
      ? `BOTTOM LINE: ${market.ticker} last traded at ${last}c (~${last}% implied). A price near 90c is not "nearly free money" — run price_check on your own probability before trusting it.`
      : `BOTTOM LINE: ${market.ticker} is live but has no last trade yet — thin or brand-new market; treat any quote as noisy.`,
  ];
  return lines.join("\n");
}
