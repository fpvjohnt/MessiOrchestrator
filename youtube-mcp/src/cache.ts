// Disk cache. With only 100 search calls per day, a cache is not an optimisation
// — it is the difference between a usable tool and one that dies at 10am. Two
// callers asking "top AI videos this week" ten minutes apart must cost one call,
// not two.
//
// TTLs are deliberately asymmetric to what each thing actually is:
//   search results   — long TTL. The RANKING of "what's popular this week" does
//                      not meaningfully change in an hour, and this is the
//                      expensive bucket.
//   video/channel    — short TTL. View counts are the thing you asked about;
//                      serving an hour-stale count as current is the Yahoo
//                      previous-close mistake in a different costume.
//   transcripts      — very long TTL. Captions for a published video are
//                      effectively immutable, and the fetch is unofficial and
//                      flaky, so caching a success is worth a lot.
import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const TTL_MS = {
  search: 6 * 60 * 60 * 1000, // 6h — the expensive bucket
  stats: 15 * 60 * 1000, // 15m — counts must feel current
  comments: 60 * 60 * 1000, // 1h
  transcript: 30 * 24 * 60 * 60 * 1000, // 30d — effectively immutable
  analytics: 60 * 60 * 1000, // 1h — YouTube itself lags ~48h anyway
} as const;

export type CacheKind = keyof typeof TTL_MS;

/**
 * Stable cache key. Object key ORDER must not produce two entries for one
 * logical request, so entries are sorted before hashing.
 */
export function cacheKey(kind: CacheKind, params: Record<string, unknown>): string {
  const stable = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join("&");
  const hash = createHash("sha256").update(`${kind}|${stable}`).digest("hex").slice(0, 24);
  return `${kind}-${hash}`;
}

function cacheDir(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // dist/
  return join(here, "..", ".cache", "http");
}

interface Envelope<T> {
  storedAt: number;
  kind: CacheKind;
  payload: T;
}

export interface CacheHit<T> {
  payload: T;
  ageMs: number;
}

export function readCache<T>(kind: CacheKind, key: string, now = Date.now()): CacheHit<T> | undefined {
  try {
    const raw = readFileSync(join(cacheDir(), `${key}.json`), "utf-8");
    const env = JSON.parse(raw) as Envelope<T>;
    const ageMs = now - env.storedAt;
    if (ageMs > TTL_MS[kind]) return undefined;
    return { payload: env.payload, ageMs };
  } catch {
    return undefined;
  }
}

export function writeCache<T>(kind: CacheKind, key: string, payload: T, now = Date.now()): void {
  try {
    const dir = cacheDir();
    mkdirSync(dir, { recursive: true });
    const p = join(dir, `${key}.json`);
    const tmp = `${p}.${process.pid}.tmp`;
    const env: Envelope<T> = { storedAt: now, kind, payload };
    writeFileSync(tmp, JSON.stringify(env), "utf-8");
    renameSync(tmp, p);
  } catch {
    // A cache that cannot write is slow, not broken.
  }
}

/** Human-readable freshness, so a cached answer never passes as a live one. */
export function freshnessNote(hit: CacheHit<unknown> | undefined): string {
  if (!hit) return "LIVE fetch.";
  const mins = Math.round(hit.ageMs / 60000);
  if (mins < 1) return "CACHED (<1 min old).";
  if (mins < 60) return `CACHED (${mins} min old) — no quota spent.`;
  const hours = (hit.ageMs / 3_600_000).toFixed(1);
  return `CACHED (${hours} h old) — no quota spent. Re-run with fresh=true to force a live fetch.`;
}

/** Drop expired entries. Called opportunistically; never throws. */
export function pruneCache(now = Date.now()): number {
  let dropped = 0;
  try {
    const dir = cacheDir();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const p = join(dir, name);
      try {
        const kind = name.split("-")[0] as CacheKind;
        const ttl = TTL_MS[kind] ?? TTL_MS.stats;
        if (now - statSync(p).mtimeMs > ttl) {
          unlinkSync(p);
          dropped++;
        }
      } catch {
        /* skip unreadable entry */
      }
    }
  } catch {
    /* no cache dir yet */
  }
  return dropped;
}
