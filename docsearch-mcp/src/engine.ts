// The retrieval core, all pure so it is fully offline-testable: BM25 lexical
// scoring + cosine vector scoring, fused by Reciprocal Rank Fusion (robust and
// scale-free), with ACL/metadata filtering applied FIRST (query-time auth) and a
// mild recency boost. Returns top-k with a per-hit relevance explanation.
import type { Chunk, SearchFilters, SearchResult } from "./types.js";
import { lexTokens } from "./tokenize.js";
import { embed, cosine } from "./embed.js";

const K1 = 1.2;
const B = 0.75;
const RRF_K = 60;

export type Mode = "hybrid" | "lexical" | "semantic";

export interface QueryOpts {
  k?: number;
  mode?: Mode;
  filters?: SearchFilters;
  authorizedScopes?: string[]; // enforced; defaults to ["default"]
  recencyWeight?: number; // 0..1, default 0.15
  now?: number; // ms; injectable for deterministic tests
}

interface Index {
  df: Map<string, number>;
  N: number;
  avgLen: number;
}

function buildIndex(chunks: Chunk[]): Index {
  const df = new Map<string, number>();
  let total = 0;
  for (const c of chunks) {
    total += c.len;
    for (const term of Object.keys(c.tf)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  return { df, N: chunks.length, avgLen: chunks.length ? total / chunks.length : 0 };
}

function idf(df: number, N: number): number {
  return Math.log(1 + (N - df + 0.5) / (df + 0.5));
}

function bm25(queryTerms: string[], c: Chunk, idx: Index): number {
  let s = 0;
  for (const t of queryTerms) {
    const f = c.tf[t];
    if (!f) continue;
    const denom = f + K1 * (1 - B + B * (c.len / (idx.avgLen || 1)));
    s += idf(idx.df.get(t) ?? 0, idx.N) * (f * (K1 + 1)) / denom;
  }
  return s;
}

function passes(c: Chunk, f: SearchFilters | undefined, scopes: Set<string>): boolean {
  if (!scopes.has(c.aclScope)) return false; // AUTHORIZATION AT QUERY TIME (req 8)
  if (!f) return true;
  if (f.sourceType && c.sourceType !== f.sourceType) return false;
  if (f.sourceId && c.sourceId !== f.sourceId) return false;
  if (f.author && (c.author ?? "").toLowerCase() !== f.author.toLowerCase()) return false;
  if (f.mime && c.mimeType !== f.mime) return false;
  if (f.since) {
    const t = c.createdAt ?? c.indexedAt;
    if (t < f.since) return false;
  }
  return true;
}

function recencyBoost(c: Chunk, weight: number, now: number): number {
  const t = Date.parse(c.createdAt ?? c.indexedAt);
  if (Number.isNaN(t)) return 1;
  const ageDays = Math.max(0, (now - t) / 86_400_000);
  return 1 + weight * Math.exp(-ageDays / 180); // ~6-month decay
}

export function search(chunks: Chunk[], query: string, opts: QueryOpts = {}): SearchResult[] {
  const k = opts.k ?? 8;
  const mode: Mode = opts.mode ?? "hybrid";
  const now = opts.now ?? Date.now();
  const scopes = new Set(opts.authorizedScopes && opts.authorizedScopes.length ? opts.authorizedScopes : ["default"]);

  const candidates = chunks.filter((c) => passes(c, opts.filters, scopes));
  if (!candidates.length) return [];

  const idx = buildIndex(candidates);
  const qTerms = lexTokens(query);
  const qVec = embed(query);

  const lex = candidates.map((c) => ({ c, s: bm25(qTerms, c, idx) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const lexRank = new Map<string, number>();
  lex.forEach((x, i) => lexRank.set(x.c.id, i + 1));

  const vec = candidates.map((c) => ({ c, s: cosine(qVec, c.vec) })).filter((x) => x.s > 0.03).sort((a, b) => b.s - a.s);
  const vecRank = new Map<string, number>();
  const vecScore = new Map<string, number>();
  vec.forEach((x, i) => {
    vecRank.set(x.c.id, i + 1);
    vecScore.set(x.c.id, x.s);
  });

  const scored = candidates
    .map((c) => {
      const lr = lexRank.get(c.id) ?? null;
      const vr = vecRank.get(c.id) ?? null;
      let score = 0;
      if (mode === "lexical") score = lr ? 1 / (RRF_K + lr) : 0;
      else if (mode === "semantic") score = vr ? 1 / (RRF_K + vr) : 0;
      else score = (lr ? 1 / (RRF_K + lr) : 0) + (vr ? 1 / (RRF_K + vr) : 0);
      score *= recencyBoost(c, opts.recencyWeight ?? 0.15, now);
      return { c, score, lr, vr };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored.map(({ c, score, lr, vr }) => ({
    chunk: c,
    score,
    lexRank: lr,
    vecRank: vr,
    why: explain(qTerms, c, lr, vr, vecScore.get(c.id)),
  }));
}

function explain(qTerms: string[], c: Chunk, lr: number | null, vr: number | null, vecS: number | undefined): string {
  const matched = [...new Set(qTerms.filter((t) => c.tf[t]))];
  const parts: string[] = [];
  if (lr && matched.length) parts.push(`exact match on ${matched.slice(0, 5).join(", ")}`);
  if (vr) parts.push(`semantically similar${vecS != null ? ` (${vecS.toFixed(2)})` : ""}`);
  return parts.join("; ") || "related content";
}

// A short excerpt centered on the first matched query term (req 7 & 9 — no full
// documents; just the relevant window).
export function excerpt(text: string, query: string, maxLen = 240): string {
  const terms = lexTokens(query);
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (at === -1) return oneLine.slice(0, maxLen) + (oneLine.length > maxLen ? " …" : "");
  const start = Math.max(0, at - 60);
  const slice = oneLine.slice(start, start + maxLen);
  return (start > 0 ? "… " : "") + slice.trim() + (start + maxLen < oneLine.length ? " …" : "");
}
