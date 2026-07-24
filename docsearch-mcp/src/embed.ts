// Dense vector embedding. Default: a DETERMINISTIC hashed bag-of-features vector
// (word unigrams + char 3-grams from tokenize.ts, hashed into a fixed dimension,
// L2-normalized). Cosine over these captures lexical + morphological overlap —
// real "vector search" that upgrades cleanly to neural embeddings by pointing
// DOCSEARCH_EMBED at a model/endpoint later, without changing the index shape.
//
// It is honest about its limits: it finds paraphrases that SHARE terms/word-
// shape ("renewal risk" ~ "renewals at risk"), not pure synonyms ("renewal" ~
// "churn"). That gap is where a neural embedder would help; the API is ready.
import { vecFeatures } from "./tokenize.js";

export const DIM = 384;

// FNV-1a — small, fast, well-distributed; deterministic across runs/machines.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function embed(text: string): number[] {
  const v = new Array(DIM).fill(0);
  for (const f of vecFeatures(text)) {
    const h = hash(f);
    const idx = h % DIM;
    // Signed hashing reduces collision bias (feature hashing trick).
    v[idx] += (h & 1) === 0 ? 1 : -1;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  // Both are L2-normalized, so cosine == dot product.
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}
