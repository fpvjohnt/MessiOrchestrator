// Turn an IndexInput (normalized ingested content) into indexed Chunks: tokenize
// for BM25, embed for vector, carry all source metadata for citation + auth. The
// title is folded into each chunk's indexed text so a title-level query
// ("purchase agreement from Amber") matches the body chunks too.
import type { IndexInput, Chunk } from "./types.js";
import { lexTokens, termFreq } from "./tokenize.js";
import { embed } from "./embed.js";

export function toChunks(input: IndexInput, now: number): Chunk[] {
  const indexedAt = new Date(now).toISOString();
  const out: Chunk[] = [];
  input.chunks.forEach((ch, n) => {
    if (!ch.text || !ch.text.trim()) return;
    const indexedText = `${input.title}\n${ch.text}`;
    const toks = lexTokens(indexedText);
    out.push({
      id: `${input.sourceId}#${n}`,
      sourceId: input.sourceId,
      title: input.title,
      url: input.url,
      sourceType: input.sourceType,
      mimeType: input.mimeType,
      citation: ch.citation,
      text: ch.text,
      author: input.author,
      createdAt: input.createdAt,
      indexedAt,
      aclScope: input.aclScope ?? "default",
      tf: termFreq(toks),
      len: toks.length,
      vec: embed(indexedText),
    });
  });
  return out;
}

// Upsert: drop any existing chunks for this sourceId, then add the new ones —
// this is how a content UPDATE / re-index happens without leaving stale chunks.
export function upsert(existing: Chunk[], fresh: Chunk[], sourceId: string): Chunk[] {
  return existing.filter((c) => c.sourceId !== sourceId).concat(fresh);
}

export function removeSource(existing: Chunk[], sourceId: string): Chunk[] {
  return existing.filter((c) => c.sourceId !== sourceId);
}

export function sourceCount(chunks: Chunk[]): number {
  return new Set(chunks.map((c) => c.sourceId)).size;
}
