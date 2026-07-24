// Live crypto price via CoinGecko — keyless public tier. The one live call in
// the offline nestegg asset; degrades to research on any failure so regression
// stays network-free. Keeps nestegg's discipline: crypto is risk capital, not
// the retirement base.
const API = "https://api.coingecko.com/api/v3";
const TIMEOUT_MS = 8000;

const ALIAS: Record<string, string> = {
  btc: "bitcoin", bitcoin: "bitcoin", eth: "ethereum", ethereum: "ethereum",
  sol: "solana", solana: "solana", doge: "dogecoin", dogecoin: "dogecoin",
  ada: "cardano", cardano: "cardano", xrp: "ripple", ripple: "ripple",
};

function offline(coin: string, why: string): string {
  return (
    `Could not fetch a live crypto price for "${coin}" (${why}).\n` +
    `Use the research asset for a current price instead.\n` +
    `BOTTOM LINE: no live price right now — verify via research; and remember crypto is a volatile, non-core holding, not a retirement base.`
  );
}

export async function cryptoPrice(coin: string): Promise<string> {
  const raw = (coin ?? "").trim().toLowerCase();
  if (!raw) return offline(String(coin ?? ""), "no coin given");
  const id = ALIAS[raw] ?? raw;
  try {
    const r = await fetch(`${API}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return offline(raw, `API returned HTTP ${r.status}`);
    const j = (await r.json()) as Record<string, { usd?: number; usd_24h_change?: number; usd_market_cap?: number }>;
    const d = j[id];
    if (!d || d.usd == null) return offline(raw, "no such coin (use the full id, e.g. bitcoin)");
    const chg = d.usd_24h_change;
    const cap = d.usd_market_cap;
    return [
      `${id} — live via CoinGecko:`,
      `  price: $${Number(d.usd).toLocaleString()}${chg != null ? `   24h: ${chg > 0 ? "+" : ""}${Number(chg).toFixed(2)}%` : ""}${cap ? `   mkt cap: ~$${Math.round(cap / 1e9)}B` : ""}`,
      ``,
      `BOTTOM LINE: ${id} is $${Number(d.usd).toLocaleString()} right now — a volatile, non-core holding; size it as risk capital, not the retirement base.`,
    ].join("\n");
  } catch (err) {
    return offline(raw, err instanceof Error ? err.message : "network error");
  }
}
