export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  provider: string;
}

export interface Provider {
  name: string;
  /**
   * True for a general WEB INDEX that can independently surface any URL.
   * False for a single-source provider like Wikipedia, which only ever returns
   * its own pages.
   *
   * This distinction is what makes the corroboration score mean anything. Two
   * web indexes returning the same URL is real evidence; Wikipedia and
   * DuckDuckGo "agreeing" is not possible in the first place, because
   * Wikipedia cannot return a non-Wikipedia URL. Measured over 63 real
   * dossiers and 146 sources: corroboration was 1 for every single one, 0.0%
   * above 1 — the ranking was sorting by a constant while every result
   * advertised "(1x corroborated)" as if it were a finding.
   */
  webIndex: boolean;
  /** Why the provider is or isn't usable right now (missing key, etc.). */
  availability(): { available: boolean; note: string };
  search(query: string, maxResults: number): Promise<SearchResult[]>;
}

/**
 * Can corroboration mean anything with this provider set? It needs at least
 * two independent web indexes. With one, every score is 1 by construction and
 * reporting it is noise dressed as evidence.
 */
export function corroborationPossible(providers: Provider[]): boolean {
  return providers.filter((p) => p.webIndex).length >= 2;
}

const USER_AGENT = "research-mcp/0.1 (+local MCP server)";
const REQUEST_TIMEOUT_MS = 10_000;

function decodeEntities(text: string): string {
  // &amp; decoded LAST so "&amp;lt;" stays literal "&lt;" rather than "<".
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

// Cap on how much of any provider response we buffer, so a compromised or
// misbehaving endpoint (or a MITM on a search host) can't OOM the process by
// streaming an unbounded body.
const MAX_RESPONSE_BYTES = 5_000_000;

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

async function getJson(url: string, init?: RequestInit): Promise<any> {
  const host = new URL(url).host;
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${host}`);
  }
  return JSON.parse(await readCapped(res, host));
}

// ---------------------------------------------------------------------------
// DuckDuckGo — no API key. Parses the html.duckduckgo.com results page.
// Result links are indirected through /l/?uddg=<encoded-url>.
// ---------------------------------------------------------------------------
const duckduckgo: Provider = {
  name: "duckduckgo",
  webIndex: true,
  availability: () => ({ available: true, note: "no API key required" }),
  async search(query, maxResults) {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from duckduckgo`);
    const html = await readCapped(res, "duckduckgo");

    // Parse each result as a UNIT so the snippet always belongs to its own
    // anchor. Splitting the page into result blocks and matching within each
    // avoids the index-misalignment bug of two independent global regexes
    // (an ad slot or a snippet-less result would shift every later pairing).
    const results: SearchResult[] = [];
    const blocks = html.split(/<div[^>]*class="[^"]*\bresult\b[^"]*"/i).slice(1);
    const anchorRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
    const snippetRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i;

    for (const block of blocks) {
      if (results.length >= maxResults) break;
      const anchor = block.match(anchorRe);
      if (!anchor) continue;

      let url = decodeEntities(anchor[1]);
      const uddg = url.match(/[?&]uddg=([^&]+)/);
      if (uddg) {
        try {
          url = decodeURIComponent(uddg[1]); // one bad ad link must not kill the whole provider
        } catch {
          continue;
        }
      }
      if (url.startsWith("//")) url = `https:${url}`;
      if (!/^https?:\/\//.test(url) || url.includes("duckduckgo.com/y.js")) continue;

      const snippet = block.match(snippetRe);
      results.push({
        title: stripTags(anchor[2]),
        url,
        snippet: snippet ? stripTags(snippet[1]) : "",
        provider: "duckduckgo",
      });
    }

    // A 200 response with zero parseable results usually means a bot-challenge
    // / anomaly page, not "nothing matched". Surface it as an error so the
    // pipeline reports a degraded provider instead of a silent empty success.
    if (results.length === 0 && !/result__a/.test(html)) {
      throw new Error("duckduckgo returned no results (likely a bot-challenge/anomaly page)");
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Wikipedia — no API key. Good for background/definitions, not current events.
// ---------------------------------------------------------------------------
const wikipedia: Provider = {
  name: "wikipedia",
  // Single-source: it can only ever return wikipedia.org URLs, so it can
  // never corroborate another index and must not count toward corroboration.
  webIndex: false,
  availability: () => ({ available: true, note: "no API key required" }),
  async search(query, maxResults) {
    const data = await getJson(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${maxResults}`
    );
    return (data.pages ?? []).map((p: any) => ({
      title: p.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.key)}`,
      snippet: stripTags(p.excerpt ?? ""),
      provider: "wikipedia",
    }));
  },
};

// ---------------------------------------------------------------------------
// Brave Search — needs BRAVE_API_KEY (free tier available).
// ---------------------------------------------------------------------------
const brave: Provider = {
  name: "brave",
  webIndex: true,
  availability: () =>
    process.env.BRAVE_API_KEY
      ? { available: true, note: "BRAVE_API_KEY set" }
      : { available: false, note: "set BRAVE_API_KEY to enable (free tier at brave.com/search/api)" },
  async search(query, maxResults) {
    const data = await getJson(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
      { headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY!, Accept: "application/json" } }
    );
    return (data.web?.results ?? []).map((r: any) => ({
      title: stripTags(r.title ?? ""),
      url: r.url,
      snippet: stripTags(r.description ?? ""),
      provider: "brave",
    }));
  },
};

// ---------------------------------------------------------------------------
// Tavily — needs TAVILY_API_KEY (free tier; search API built for AI agents).
// ---------------------------------------------------------------------------
const tavily: Provider = {
  name: "tavily",
  webIndex: true,
  availability: () =>
    process.env.TAVILY_API_KEY
      ? { available: true, note: "TAVILY_API_KEY set" }
      : { available: false, note: "set TAVILY_API_KEY to enable (free tier at tavily.com)" },
  async search(query, maxResults) {
    const data = await getJson("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: maxResults }),
    });
    return (data.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      url: r.url,
      snippet: (r.content ?? "").slice(0, 500),
      provider: "tavily",
    }));
  },
};

// ---------------------------------------------------------------------------
// Google Programmable Search — needs GOOGLE_API_KEY + GOOGLE_CSE_ID
// (100 free queries/day). The classic Bing Web Search API was retired by
// Microsoft in August 2025 and is intentionally not implemented.
// ---------------------------------------------------------------------------
const google: Provider = {
  name: "google",
  webIndex: true,
  availability: () =>
    process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID
      ? { available: true, note: "GOOGLE_API_KEY + GOOGLE_CSE_ID set" }
      : {
          available: false,
          note: "set GOOGLE_API_KEY and GOOGLE_CSE_ID to enable (programmablesearchengine.google.com)",
        },
  async search(query, maxResults) {
    // API key goes in a header, not the query string, so it can't leak into
    // proxy/server access logs.
    const data = await getJson(
      `https://www.googleapis.com/customsearch/v1?cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=${Math.min(maxResults, 10)}`,
      { headers: { "X-goog-api-key": process.env.GOOGLE_API_KEY! } }
    );
    return (data.items ?? []).map((r: any) => ({
      title: r.title ?? "",
      url: r.link,
      snippet: r.snippet ?? "",
      provider: "google",
    }));
  },
};

export const ALL_PROVIDERS: Provider[] = [duckduckgo, wikipedia, brave, tavily, google];

export function activeProviders(requested?: string[]): Provider[] {
  const pool = ALL_PROVIDERS.filter((p) => p.availability().available);
  if (!requested || requested.length === 0) return pool;
  const unknown = requested.filter((name) => !ALL_PROVIDERS.some((p) => p.name === name));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown provider(s): ${unknown.join(", ")}. Known: ${ALL_PROVIDERS.map((p) => p.name).join(", ")}`
    );
  }
  const chosen = pool.filter((p) => requested.includes(p.name));
  if (chosen.length === 0) {
    const notes = ALL_PROVIDERS.filter((p) => requested.includes(p.name))
      .map((p) => `${p.name}: ${p.availability().note}`)
      .join("; ");
    throw new Error(`None of the requested providers are available. ${notes}`);
  }
  return chosen;
}
