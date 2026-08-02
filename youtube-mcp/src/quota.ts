// Quota ledger. This file exists because of one line in Google's own docs:
//
//   "Projects that enable the YouTube Data API have a default quota allocation of
//    100 search.list calls, 100 videos.insert calls, and 10,000 units per day
//    combined for all other endpoints."
//   "The search.list and videos.insert methods have their own quota buckets. Each
//    of these methods has a default daily limit of 100 per day."
//   — https://developers.google.com/youtube/v3/determine_quota_cost (2026-06-01)
//
// So search is NOT 100 units out of 10,000. It is its own bucket of 100 CALLS,
// and paging counts as another call. Two `youtube_find_fast_growing_videos` runs
// that page three deep across four queries burn a quarter of the day before
// lunch. Everything else we call (videos.list, channels.list,
// commentThreads.list) is 1 unit against the separate 10,000 pool, i.e. free by
// comparison. The whole design consequence: SEARCH IS THE SCARCE RESOURCE, cache
// it hard, and never page unless the caller asked for depth.
//
// Honest limitation, stated because the alternative is a number that lies: the
// bridge runs a warm POOL of worker processes, so two workers can read-modify-
// write this ledger concurrently and undercount. Writes are atomic (temp+rename)
// so the file never corrupts, but the COUNT is a guardrail, not an accountant.
// The authoritative number is the Quotas page in the Google Cloud console; this
// ledger exists to stop a runaway loop, not to bill you.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Documented cost per Data API method, in units against the 10,000/day pool. */
export const UNIT_COST = {
  "videos.list": 1,
  "channels.list": 1,
  "commentThreads.list": 1,
  "playlistItems.list": 1,
  "captions.list": 50,
  "captions.download": 200,
} as const;

export type MeteredMethod = keyof typeof UNIT_COST;

/** search.list and videos.insert each get their own bucket of 100 calls/day. */
export const SEARCH_CALLS_PER_DAY = 100;
export const UNITS_PER_DAY = 10_000;

export interface QuotaState {
  /** Pacific-time day this ledger covers, YYYY-MM-DD. */
  day: string;
  /** search.list calls made today (own bucket, max 100). */
  searchCalls: number;
  /** Units spent today against the shared 10,000 pool. */
  units: number;
  /** Per-method call counts, for the status report. */
  calls: Record<string, number>;
}

/**
 * The Pacific-time calendar day, as YYYY-MM-DD. Quotas reset at midnight PT, and
 * this machine is not on PT — using the local day would reset the ledger at the
 * wrong hour and either strand quota or blow through it.
 *
 * Uses Intl with an IANA zone so DST is handled by the platform's tz database
 * rather than a hand-rolled -7/-8 guess, which is wrong twice a year.
 */
export function pacificDayKey(when: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(when);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function emptyState(day = pacificDayKey()): QuotaState {
  return { day, searchCalls: 0, units: 0, calls: {} };
}

/** Roll the ledger over if it is from a previous Pacific day. Pure. */
export function rollOver(state: QuotaState, now: Date = new Date()): QuotaState {
  const today = pacificDayKey(now);
  return state.day === today ? state : emptyState(today);
}

export function searchCallsRemaining(state: QuotaState): number {
  return Math.max(0, SEARCH_CALLS_PER_DAY - state.searchCalls);
}

export function unitsRemaining(state: QuotaState): number {
  return Math.max(0, UNITS_PER_DAY - state.units);
}

/** Pure spend simulation — returns the next state, or a refusal reason. */
export function trySpend(
  state: QuotaState,
  kind: "search" | MeteredMethod,
  count = 1
): { ok: true; next: QuotaState } | { ok: false; reason: string } {
  const s = rollOver(state);
  if (kind === "search") {
    if (s.searchCalls + count > SEARCH_CALLS_PER_DAY) {
      return {
        ok: false,
        reason:
          `search quota exhausted: ${s.searchCalls}/${SEARCH_CALLS_PER_DAY} calls used today (Pacific). ` +
          `This is search.list's OWN daily bucket, so the 10,000-unit pool being untouched does not help. ` +
          `Resets midnight Pacific. Cached searches still work — retry with the same query to hit the cache.`,
      };
    }
    return {
      ok: true,
      next: { ...s, searchCalls: s.searchCalls + count, calls: bump(s.calls, "search.list", count) },
    };
  }
  const cost = UNIT_COST[kind] * count;
  if (s.units + cost > UNITS_PER_DAY) {
    return {
      ok: false,
      reason: `unit quota exhausted: ${s.units}/${UNITS_PER_DAY} units used today (Pacific). ${kind} costs ${UNIT_COST[kind]}/call. Resets midnight Pacific.`,
    };
  }
  return { ok: true, next: { ...s, units: s.units + cost, calls: bump(s.calls, kind, count) } };
}

function bump(calls: Record<string, number>, key: string, n: number): Record<string, number> {
  return { ...calls, [key]: (calls[key] ?? 0) + n };
}

/** Human-readable ledger. Pure, so regression can assert on it. */
export function describeQuota(state: QuotaState): string {
  const s = rollOver(state);
  const methods = Object.entries(s.calls)
    .sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `${m}=${n}`)
    .join(" ");
  return (
    `search.list ${s.searchCalls}/${SEARCH_CALLS_PER_DAY} calls (own bucket) | ` +
    `other endpoints ${s.units}/${UNITS_PER_DAY} units | ` +
    `Pacific day ${s.day}${methods ? ` | ${methods}` : ""}`
  );
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function ledgerPath(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // dist/
  return join(here, "..", ".cache", "quota.json");
}

export function loadState(): QuotaState {
  try {
    const raw = readFileSync(ledgerPath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<QuotaState>;
    return rollOver({
      day: typeof parsed.day === "string" ? parsed.day : pacificDayKey(),
      searchCalls: Number(parsed.searchCalls) || 0,
      units: Number(parsed.units) || 0,
      calls: parsed.calls && typeof parsed.calls === "object" ? (parsed.calls as Record<string, number>) : {},
    });
  } catch {
    return emptyState();
  }
}

export function saveState(state: QuotaState): void {
  try {
    const p = ledgerPath();
    mkdirSync(dirname(p), { recursive: true });
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
    renameSync(tmp, p); // atomic on the same volume
  } catch {
    // A ledger we cannot persist is a degraded guardrail, not a reason to fail
    // the caller's actual request. The Google console remains authoritative.
  }
}

/**
 * Reserve quota BEFORE the request goes out. Reserving after the fact means a
 * crashed or timed-out call spends nothing in the ledger while having spent real
 * quota at Google — which is exactly how a retry loop drains the bucket while
 * the ledger reports plenty left.
 */
export function reserve(kind: "search" | MeteredMethod, count = 1): { ok: true } | { ok: false; reason: string } {
  const result = trySpend(loadState(), kind, count);
  if (!result.ok) return result;
  saveState(result.next);
  return { ok: true };
}

export function quotaStatusLine(): string {
  return describeQuota(loadState());
}
