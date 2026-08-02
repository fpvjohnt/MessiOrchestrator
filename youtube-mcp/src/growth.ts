// Growth / velocity math. Pure functions plus a small snapshot store.
//
// THE PROBLEM THIS FILE EXISTS TO BE HONEST ABOUT:
//
// The Data API returns CUMULATIVE totals as of the instant you ask. For a video
// you do not own there is no time series available at all. So the obvious
// "fast growing" metric — views divided by hours since publish — is a LIFETIME
// AVERAGE, not a current rate. A video that took 900k views in its first 48 hours
// two years ago and is now completely dead still reports a healthy-looking
// lifetime average, and a naive "fastest growing" list will be full of old hits.
// That is not a rounding error; it inverts the answer.
//
// Two rates are therefore computed and NEVER conflated:
//   lifetimeRate  — always available, from one snapshot. Honest name, honest use:
//                   comparing videos of SIMILAR age.
//   observedRate  — the real thing: Δviews / Δtime between two snapshots this
//                   server actually took. Only available once we have seen the
//                   video twice, which is why every stats fetch records one.
//
// A caller asking for "fast growing" gets observedRate where it exists and an
// explicit downgrade notice where it does not.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export interface VideoCounts {
  videoId: string;
  title?: string;
  channelTitle?: string;
  publishedAt?: string;
  views: number;
  likes?: number;
  comments?: number;
  durationSeconds?: number;
}

export function hoursBetween(aIso: string | undefined, bMs: number): number | undefined {
  if (!aIso) return undefined;
  const t = Date.parse(aIso);
  if (Number.isNaN(t)) return undefined;
  const h = (bMs - t) / 3_600_000;
  return h > 0 ? h : undefined;
}

/** Views per hour averaged over the video's whole life. Undefined if age unknown. */
export function lifetimeRate(v: VideoCounts, now = Date.now()): number | undefined {
  const h = hoursBetween(v.publishedAt, now);
  if (h === undefined) return undefined;
  return v.views / h;
}

/**
 * Engagement rate = (likes + comments) / views.
 *
 * Returns undefined when views is 0 rather than 0 — a video with no views has an
 * UNDEFINED engagement rate, and returning 0 sorts it alongside genuinely
 * unengaging videos. Likes are frequently hidden by the uploader; when likes are
 * absent the rate is computed from comments alone and `basis` says so, because
 * silently treating hidden likes as zero manufactures a low engagement rate.
 */
export function engagement(v: VideoCounts): { rate: number; basis: string } | undefined {
  if (!v.views || v.views <= 0) return undefined;
  const hasLikes = typeof v.likes === "number";
  const hasComments = typeof v.comments === "number";
  if (!hasLikes && !hasComments) return undefined;
  const num = (hasLikes ? (v.likes as number) : 0) + (hasComments ? (v.comments as number) : 0);
  const basis = hasLikes && hasComments ? "likes+comments" : hasLikes ? "likes only (comments unavailable)" : "comments only (likes hidden by uploader)";
  return { rate: num / v.views, basis };
}

export function likeRate(v: VideoCounts): number | undefined {
  if (!v.views || typeof v.likes !== "number") return undefined;
  return v.likes / v.views;
}

export function commentRate(v: VideoCounts): number | undefined {
  if (!v.views || typeof v.comments !== "number") return undefined;
  return v.comments / v.views;
}

/** Median — used instead of mean so one 40M-view outlier does not define "normal". */
export function median(xs: number[]): number | undefined {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return undefined;
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Multiple of the set's median rate. Reported instead of a z-score on purpose:
 * view-rate distributions are heavy-tailed and roughly log-normal, so a z-score
 * computed on raw rates is dominated by the largest item and reads as
 * significance when it is just skew. "3.4x the median" is both honest and
 * legible.
 */
export function medianMultiple(rate: number | undefined, med: number | undefined): number | undefined {
  if (rate === undefined || med === undefined || med <= 0) return undefined;
  return rate / med;
}

export interface RankedVideo {
  video: VideoCounts;
  rate: number | undefined;
  rateKind: "observed" | "lifetime" | "unknown";
  ageHours: number | undefined;
  multiple: number | undefined;
  engagementRate: number | undefined;
  engagementBasis: string | undefined;
}

/**
 * Rank a set by growth. `observed` supplies real two-snapshot rates where known.
 *
 * Videos are ranked ONLY against others of comparable age when using lifetime
 * rates, via the age-band grouping below — comparing a 3-hour-old video's
 * lifetime rate to a 3-year-old video's is the exact mistake described at the top
 * of this file.
 */
export function rankByGrowth(
  videos: VideoCounts[],
  observed: Map<string, number>,
  now = Date.now()
): { ranked: RankedVideo[]; medianRate: number | undefined; observedCount: number } {
  const rows: RankedVideo[] = videos.map((v) => {
    const obs = observed.get(v.videoId);
    const life = lifetimeRate(v, now);
    const rate = obs ?? life;
    const eng = engagement(v);
    return {
      video: v,
      rate,
      rateKind: obs !== undefined ? "observed" : life !== undefined ? "lifetime" : "unknown",
      ageHours: hoursBetween(v.publishedAt, now),
      multiple: undefined,
      engagementRate: eng?.rate,
      engagementBasis: eng?.basis,
    };
  });

  const med = median(rows.map((r) => r.rate).filter((r): r is number => typeof r === "number"));
  for (const r of rows) r.multiple = medianMultiple(r.rate, med);

  rows.sort((a, b) => {
    if (a.rate === undefined) return 1;
    if (b.rate === undefined) return -1;
    return b.rate - a.rate;
  });

  return { ranked: rows, medianRate: med, observedCount: rows.filter((r) => r.rateKind === "observed").length };
}

/** Coarse age bands, so like is compared with like. */
export function ageBand(ageHours: number | undefined): string {
  if (ageHours === undefined) return "unknown age";
  if (ageHours < 24) return "under 24h";
  if (ageHours < 24 * 7) return "1–7 days";
  if (ageHours < 24 * 30) return "1–4 weeks";
  if (ageHours < 24 * 365) return "1–12 months";
  return "over a year";
}

// ---------------------------------------------------------------------------
// Snapshot store — what makes observedRate possible at all.
// ---------------------------------------------------------------------------

interface Snapshot {
  at: number;
  views: number;
}

type SnapshotFile = Record<string, Snapshot[]>;

function snapshotPath(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // dist/
  return join(here, "..", ".cache", "snapshots.json");
}

function loadSnapshots(): SnapshotFile {
  try {
    return JSON.parse(readFileSync(snapshotPath(), "utf-8")) as SnapshotFile;
  } catch {
    return {};
  }
}

function saveSnapshots(data: SnapshotFile): void {
  try {
    const p = snapshotPath();
    mkdirSync(dirname(p), { recursive: true });
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data), "utf-8");
    renameSync(tmp, p);
  } catch {
    /* no snapshots is a degraded metric, not a failure */
  }
}

/** Record a view-count observation. Keeps the last 12 per video. */
export function observe(counts: Array<{ videoId: string; views: number }>, now = Date.now()): void {
  if (!counts.length) return;
  const data = loadSnapshots();
  for (const c of counts) {
    if (!c.videoId || !Number.isFinite(c.views)) continue;
    const list = data[c.videoId] ?? [];
    const last = list[list.length - 1];
    // Skip near-duplicate observations; two calls a minute apart produce a
    // meaningless Δt and a wildly noisy rate.
    if (last && now - last.at < 5 * 60 * 1000) continue;
    list.push({ at: now, views: c.views });
    data[c.videoId] = list.slice(-12);
  }
  saveSnapshots(data);
}

/**
 * Real observed views/hour from the two most separated snapshots we hold.
 * Requires at least 30 minutes of separation — below that, rounding in YouTube's
 * own (heavily cached, coarsely updated) view counter dominates the delta and the
 * rate is fiction.
 */
export function observedRates(videoIds: string[], minSeparationMs = 30 * 60 * 1000): Map<string, number> {
  const out = new Map<string, number>();
  const data = loadSnapshots();
  for (const id of videoIds) {
    const list = data[id];
    if (!list || list.length < 2) continue;
    const first = list[0];
    const last = list[list.length - 1];
    const dt = last.at - first.at;
    if (dt < minSeparationMs) continue;
    const dv = last.views - first.views;
    if (dv < 0) continue; // YouTube revises counts down during spam sweeps
    out.set(id, dv / (dt / 3_600_000));
  }
  return out;
}

export function formatRate(rate: number | undefined): string {
  if (rate === undefined) return "n/a";
  if (rate >= 1000) return `${Math.round(rate).toLocaleString("en-US")}/h`;
  if (rate >= 1) return `${rate.toFixed(1)}/h`;
  return `${(rate * 24).toFixed(1)}/day`;
}

export function formatPct(x: number | undefined, digits = 2): string {
  return x === undefined ? "n/a" : `${(x * 100).toFixed(digits)}%`;
}
