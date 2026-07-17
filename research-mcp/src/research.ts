import { activeProviders, type SearchResult } from "./providers.js";
import { fetchPage, type PageExtract } from "./extract.js";

export interface RankedResult extends SearchResult {
  /** How many distinct providers returned this URL — cross-provider agreement. */
  corroboration: number;
  providers: string[];
}

function normalizeUrl(url: string): string {
  if (typeof url !== "string" || url === "") return "";
  try {
    const u = new URL(url);
    u.hash = "";
    // Common tracking params that make identical pages look distinct.
    for (const p of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"]) {
      u.searchParams.delete(p);
    }
    // Lowercase only scheme+host (case-insensitive); the PATH is
    // case-sensitive — /wiki/AIDS and /wiki/Aids are different pages and must
    // not dedupe into one with inflated corroboration.
    const origin = `${u.protocol}//${u.host.toLowerCase()}`;
    let rest = u.pathname + u.search;
    if (rest.endsWith("/")) rest = rest.slice(0, -1);
    return origin + rest;
  } catch {
    return url;
  }
}

/**
 * Fans a query out to every requested (or every available) provider in
 * parallel, dedupes by normalized URL, and ranks by corroboration first —
 * a URL surfaced independently by several engines is a stronger lead than
 * one engine's top hit.
 */
export async function multiSearch(
  query: string,
  requestedProviders?: string[],
  maxPerProvider = 8
): Promise<{ results: RankedResult[]; providerErrors: string[] }> {
  const providers = activeProviders(requestedProviders);
  const settled = await Promise.allSettled(providers.map((p) => p.search(query, maxPerProvider)));

  const providerErrors: string[] = [];
  const byUrl = new Map<string, RankedResult>();

  settled.forEach((outcome, i) => {
    if (outcome.status === "rejected") {
      const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      providerErrors.push(`${providers[i].name}: ${reason}`);
      return;
    }
    for (const result of outcome.value) {
      const key = normalizeUrl(result.url);
      if (!key) continue; // skip malformed provider items with no usable URL
      const existing = byUrl.get(key);
      if (existing) {
        if (!existing.providers.includes(result.provider)) {
          existing.providers.push(result.provider);
          existing.corroboration += 1;
        }
        if (!existing.snippet && result.snippet) existing.snippet = result.snippet;
      } else {
        byUrl.set(key, { ...result, corroboration: 1, providers: [result.provider] });
      }
    }
  });

  const results = [...byUrl.values()].sort((a, b) => b.corroboration - a.corroboration);
  return { results, providerErrors };
}

export interface Dossier {
  question: string;
  providersUsed: string[];
  providerErrors: string[];
  sources: Array<{
    title: string;
    url: string;
    corroboration: number;
    providers: string[];
    excerpt: string;
    fetchError?: string;
  }>;
  unfetchedLeads: RankedResult[];
}

/**
 * The full pipeline: multi-provider search, then fetch and extract the top
 * sources so the caller gets primary text, not just snippets.
 */
export async function buildDossier(
  question: string,
  requestedProviders?: string[],
  fetchTop = 3,
  excerptChars = 6_000
): Promise<Dossier> {
  const providers = activeProviders(requestedProviders);
  const { results, providerErrors } = await multiSearch(question, requestedProviders);

  const toFetch = results.slice(0, Math.min(fetchTop, 5));
  const fetched = await Promise.allSettled(toFetch.map((r) => fetchPage(r.url, excerptChars)));

  const sources = toFetch.map((r, i) => {
    const outcome = fetched[i];
    if (outcome.status === "fulfilled") {
      const page: PageExtract = outcome.value;
      return {
        title: page.title || r.title,
        url: r.url,
        corroboration: r.corroboration,
        providers: r.providers,
        excerpt: page.text,
      };
    }
    const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
    return {
      title: r.title,
      url: r.url,
      corroboration: r.corroboration,
      providers: r.providers,
      excerpt: r.snippet,
      fetchError: reason,
    };
  });

  return {
    question,
    providersUsed: providers.map((p) => p.name),
    providerErrors,
    sources,
    unfetchedLeads: results.slice(toFetch.length, toFetch.length + 7),
  };
}
