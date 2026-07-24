// Persistence: chunks in a JSONL file (one record per line), plus a small
// stats file for observability. Pure-Node, no database. For a personal corpus
// this is loaded into memory; writes are atomic (temp + rename). The embedded
// vector and term-frequencies are stored ON the record, so loading never
// re-embeds or re-tokenizes — O(n) startup.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Chunk } from "./types.js";

function dataDir(): string {
  if (process.env.DOCSEARCH_DATA_DIR) return process.env.DOCSEARCH_DATA_DIR;
  return join(dirname(dirname(fileURLToPath(import.meta.url))), "data");
}
const indexPath = () => join(dataDir(), "index.jsonl");
const statsPath = () => join(dataDir(), "stats.json");

export async function loadChunks(): Promise<Chunk[]> {
  try {
    const raw = await readFile(indexPath(), "utf-8");
    return raw.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Chunk);
  } catch {
    return [];
  }
}

export async function saveChunks(chunks: Chunk[]): Promise<void> {
  const p = indexPath();
  await mkdir(dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, chunks.map((c) => JSON.stringify(c)).join("\n") + (chunks.length ? "\n" : ""), "utf-8");
  await rename(tmp, p);
}

export interface Stats {
  chunks: number;
  sources: number;
  lastIndexedAt: string | null;
  searches: number;
  emptyResults: number;
  ingestFailures: number;
  lastSearchMs: number | null;
  sumSearchMs: number;
}

const ZERO: Stats = { chunks: 0, sources: 0, lastIndexedAt: null, searches: 0, emptyResults: 0, ingestFailures: 0, lastSearchMs: null, sumSearchMs: 0 };

export async function loadStats(): Promise<Stats> {
  try {
    return { ...ZERO, ...(JSON.parse(await readFile(statsPath(), "utf-8")) as Partial<Stats>) };
  } catch {
    return { ...ZERO };
  }
}

export async function saveStats(s: Stats): Promise<void> {
  const p = statsPath();
  await mkdir(dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(s, null, 2), "utf-8");
  await rename(tmp, p);
}
