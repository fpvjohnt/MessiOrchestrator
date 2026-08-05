// YouTube Analytics API — the owner-only demographics source.
//
// Verified against https://developers.google.com/youtube/analytics/dimensions and
// .../channel_reports (last updated 2026-06-01):
//
//   ageGroup        core dimension. age13-17 age18-24 age25-34 age35-44
//                   age45-54 age55-64 age65-. "identifies the age group of the
//                   LOGGED-IN users associated with the report data."
//   gender          core dimension. Exactly three values: female, male,
//                   user_specified. Also logged-in users only.
//   country         core dimension, ISO-3166-1 alpha-2.
//   deviceType      DESKTOP GAME_CONSOLE MOBILE TABLET TV AUTOMOTIVE WEARABLE
//                   UNKNOWN_PLATFORM
//   operatingSystem ANDROID BADA BLACKBERRY ... (long list)
//
// The binding constraint the docs state and callers always trip over: the
// demographics report pairs ageGroup/gender with the SINGLE metric
// viewerPercentage. Asking for views alongside ageGroup is a 400. That is why
// REPORTS below is a fixed table of known-valid (dimensions, metrics) pairs rather
// than free-form parameters — a caller cannot construct an invalid combination.
import { buildUrl, fetchJson, explainGoogleError } from "./http.js";
import { accessToken, oauthConfig, type OAuthConfig } from "./oauth.js";
import { readCache, writeCache, cacheKey, freshnessNote } from "./cache.js";

const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/";

export interface ReportSpec {
  label: string;
  dimensions: string;
  metrics: string;
  sort?: string;
  /** Why this pairing and not another — surfaced in output so it is auditable. */
  note: string;
  /**
   * Some reports are "top-N" queries and the API REJECTS them without an
   * explicit maxResults. Found the hard way: the first live run of the weekly
   * routine got HTTP 400 badRequest "The query is not supported" on top_videos,
   * twice, while youtube_get_age_group_preferences ran the same report fine —
   * because that tool passes max (its top_n) and the demographics tool did not.
   * Reproduced deliberately: identical call with maxResults=10 succeeds.
   * Defaulting here rather than at each call site so a future report with the
   * same constraint cannot reintroduce it.
   */
  requiresMaxResults?: boolean;
}

/** Applied when a requiresMaxResults report is called without one. */
export const DEFAULT_MAX_RESULTS = 10;

export const REPORTS: Record<string, ReportSpec> = {
  age_gender: {
    label: "Age group x gender",
    dimensions: "ageGroup,gender",
    metrics: "viewerPercentage",
    note: "viewerPercentage is the ONLY metric valid with ageGroup/gender. Percentages are of LOGGED-IN viewers and sum to ~100 across the whole grid, not per row.",
  },
  age: {
    label: "Age group",
    dimensions: "ageGroup",
    metrics: "viewerPercentage",
    sort: "ageGroup",
    note: "Logged-in viewers only.",
  },
  gender: {
    label: "Gender",
    dimensions: "gender",
    metrics: "viewerPercentage",
    note: "Logged-in viewers only. Exactly three buckets exist: female, male, user_specified.",
  },
  country: {
    label: "Country",
    dimensions: "country",
    metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage",
    sort: "-estimatedMinutesWatched",
    note: "Sorted by watch time, not views — watch time is what the recommender optimises and what pays.",
  },
  device: {
    label: "Device type",
    dimensions: "deviceType",
    metrics: "views,estimatedMinutesWatched,averageViewDuration",
    sort: "-estimatedMinutesWatched",
    note: "Sorted by watch time deliberately: TV almost always ranks far higher by watch time than by views, and ranking by views hides it.",
  },
  os: {
    label: "Operating system",
    dimensions: "operatingSystem",
    metrics: "views,estimatedMinutesWatched,averageViewDuration",
    sort: "-estimatedMinutesWatched",
    note: "Sorted by watch time.",
  },
  top_videos: {
    label: "Top videos",
    dimensions: "video",
    metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained",
    sort: "-estimatedMinutesWatched",
    note: "Ranked by watch time. subscribersGained included because it is the clearest signal of which videos recruit rather than merely entertain.",
    requiresMaxResults: true,
  },
};

export interface QueryResult {
  columns: string[];
  rows: Array<Array<string | number>>;
  freshness: string;
  spec: ReportSpec;
}

interface RawReport {
  columnHeaders?: Array<{ name?: string }>;
  rows?: Array<Array<string | number>>;
}

/** YYYY-MM-DD, N days back from today (UTC). */
export function dateRange(days: number, now = new Date()): { startDate: string; endDate: string } {
  // YouTube Analytics lags roughly 2 days; ending "today" reliably returns a
  // short or empty tail that reads as a collapse in views. End 2 days back.
  const end = new Date(now.getTime() - 2 * 86_400_000);
  const start = new Date(end.getTime() - Math.max(1, days) * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export const LAG_NOTE =
  "DATE RANGE NOTE: the window ends 2 days before today on purpose. YouTube Analytics data lags ~48h; " +
  "a range ending today returns a partial tail that looks like a sudden drop in views.";

export async function runReport(
  reportKey: keyof typeof REPORTS,
  opts: { days?: number; channelId?: string; country?: string; video?: string; max?: number; fresh?: boolean } = {}
): Promise<QueryResult> {
  const cfg: OAuthConfig | undefined = oauthConfig();
  if (!cfg) throw new Error("OAUTH_NOT_CONFIGURED");

  const spec = REPORTS[reportKey];
  if (!spec) throw new Error(`unknown report "${String(reportKey)}". Known: ${Object.keys(REPORTS).join(", ")}`);

  const { startDate, endDate } = dateRange(opts.days ?? 28);
  const channel = opts.channelId ?? process.env.YOUTUBE_CHANNEL_ID;
  // channel==MINE is the authenticated user's own channel. An explicit id still
  // requires ownership by that same account — the API rejects anything else.
  const ids = channel ? `channel==${channel}` : "channel==MINE";

  // Filters combine with ";". The video filter is what makes per-video
  // demographics possible, and therefore what makes "which age group watches
  // which TOPIC" answerable at all: ageGroup cannot be crossed with the video
  // DIMENSION (viewerPercentage is the only valid metric there), but it can be
  // FILTERED to one video at a time. Run it per video, join on topic afterwards.
  const filterParts: string[] = [];
  if (opts.country) filterParts.push(`country==${opts.country}`);
  if (opts.video) filterParts.push(`video==${opts.video}`);

  const params: Record<string, string | number | undefined> = {
    ids,
    startDate,
    endDate,
    metrics: spec.metrics,
    dimensions: spec.dimensions,
    sort: spec.sort,
    // A top-N report without maxResults is a hard 400, not a degraded result.
    maxResults: opts.max ?? (spec.requiresMaxResults ? DEFAULT_MAX_RESULTS : undefined),
    filters: filterParts.length ? filterParts.join(";") : undefined,
  };

  const key = cacheKey("analytics", { reportKey, ...params });
  if (!opts.fresh) {
    const hit = readCache<{ columns: string[]; rows: Array<Array<string | number>> }>("analytics", key);
    if (hit) return { ...hit.payload, freshness: freshnessNote(hit), spec };
  }

  const url = buildUrl(ANALYTICS_API, "reports", params);
  const token = await accessToken(cfg);
  try {
    const data = await fetchJson<RawReport>(url, { headers: { Authorization: `Bearer ${token}` } });
    const payload = {
      columns: (data.columnHeaders ?? []).map((c) => c.name ?? ""),
      rows: data.rows ?? [],
    };
    writeCache("analytics", key, payload);
    return { ...payload, freshness: freshnessNote(undefined), spec };
  } catch (err) {
    throw new Error(explainGoogleError(err));
  }
}

/** Render a report as an aligned text table. */
export function renderTable(r: QueryResult, limit = 40): string {
  if (!r.rows.length) return "(no rows — the channel may have too little data in this window for YouTube to report it)";
  const rows = r.rows.slice(0, limit);
  const widths = r.columns.map((c, i) =>
    Math.max(c.length, ...rows.map((row) => String(row[i] ?? "").length))
  );
  const line = (cells: Array<string | number>) =>
    cells.map((c, i) => String(c ?? "").padEnd(widths[i])).join("  ").trimEnd();
  const out = [line(r.columns), widths.map((w) => "-".repeat(w)).join("  ")];
  for (const row of rows) out.push(line(row));
  if (r.rows.length > limit) out.push(`… ${r.rows.length - limit} more rows`);
  return out.join("\n");
}

/**
 * YouTube suppresses demographic rows for small audiences, so a sparse grid is
 * expected rather than broken. Saying which is the difference between a caller
 * concluding "no under-18s watch me" and "YouTube won't tell me about under-18s".
 */
export function sparsityNote(r: QueryResult): string {
  const total = r.rows.reduce((sum, row) => {
    const v = row[row.length - 1];
    return sum + (typeof v === "number" ? v : Number(v) || 0);
  }, 0);
  if (!r.rows.length) return "No rows returned. Below YouTube's reporting threshold for this window, or the channel had no views in it.";
  if (r.spec.metrics === "viewerPercentage" && total > 0 && total < 95) {
    return `Reported percentages sum to ${total.toFixed(1)}%, not ~100%. The remainder is viewers YouTube declined to bucket (too few to report without deanonymising them) plus all signed-out viewers. The missing mass is not zero — it is unknown.`;
  }
  return "";
}
