// YouTube Data API v3 wrappers. Every call goes through the quota ledger and the
// disk cache, in that order: cache first (free), reserve second (before the wire),
// fetch third.
import { buildUrl, fetchJson, explainGoogleError } from "./http.js";
import { reserve } from "./quota.js";
import { readCache, writeCache, cacheKey, freshnessNote, type CacheKind } from "./cache.js";
import { observe, type VideoCounts } from "./growth.js";

const DATA_API = "https://www.googleapis.com/youtube/v3/";

export function apiKey(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Create a key in the Google Cloud console (enable 'YouTube Data API v3'), " +
        "then put YOUTUBE_API_KEY=... in youtube-mcp/.env. This key is public-data only — it cannot read " +
        "demographics, which are owner-only and need OAuth (see youtube_get_owned_channel_demographics)."
    );
  }
  return k;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

/** Cache-then-reserve-then-fetch. `kind` picks the TTL; `meter` picks the bucket. */
async function call<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  kind: CacheKind,
  meter: "search" | "videos.list" | "channels.list" | "commentThreads.list",
  fresh = false
): Promise<{ data: T; freshness: string }> {
  const key = cacheKey(kind, { endpoint, ...params });
  if (!fresh) {
    const hit = readCache<T>(kind, key);
    if (hit) return { data: hit.payload, freshness: freshnessNote(hit) };
  }

  const res = reserve(meter === "search" ? "search" : meter);
  if (!res.ok) throw new Error(res.reason);

  const url = buildUrl(DATA_API, endpoint, { ...params, key: apiKey() });
  try {
    const data = await fetchJson<T>(url);
    writeCache(kind, key, data);
    return { data, freshness: freshnessNote(undefined) };
  } catch (err) {
    throw new Error(explainGoogleError(err));
  }
}

// ---------------------------------------------------------------------------
// search.list — THE SCARCE ONE. 100 calls/day, own bucket.
// ---------------------------------------------------------------------------

export interface SearchItem {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
}

interface RawSearch {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; channelId?: string; channelTitle?: string; publishedAt?: string; description?: string };
  }>;
  pageInfo?: { totalResults?: number };
  nextPageToken?: string;
}

export interface SearchOptions {
  query: string;
  max?: number;
  order?: "relevance" | "date" | "viewCount" | "rating" | "title";
  publishedAfter?: string;
  regionCode?: string;
  relevanceLanguage?: string;
  videoDuration?: "any" | "short" | "medium" | "long";
  channelId?: string;
  fresh?: boolean;
}

export async function searchVideos(opts: SearchOptions): Promise<{ items: SearchItem[]; totalResults?: number; freshness: string }> {
  const { data, freshness } = await call<RawSearch>(
    "search",
    {
      part: "snippet",
      type: "video",
      q: opts.query,
      maxResults: Math.min(50, Math.max(1, opts.max ?? 25)),
      order: opts.order ?? "relevance",
      publishedAfter: opts.publishedAfter,
      regionCode: opts.regionCode,
      relevanceLanguage: opts.relevanceLanguage,
      videoDuration: opts.videoDuration && opts.videoDuration !== "any" ? opts.videoDuration : undefined,
      channelId: opts.channelId,
    },
    "search",
    "search",
    opts.fresh
  );

  const items: SearchItem[] = (data.items ?? [])
    .filter((i) => i.id?.videoId)
    .map((i) => ({
      videoId: i.id!.videoId!,
      title: i.snippet?.title ?? "",
      channelId: i.snippet?.channelId ?? "",
      channelTitle: i.snippet?.channelTitle ?? "",
      publishedAt: i.snippet?.publishedAt ?? "",
      description: i.snippet?.description ?? "",
    }));

  return { items, totalResults: data.pageInfo?.totalResults, freshness };
}

// ---------------------------------------------------------------------------
// videos.list — 1 unit for up to 50 ids. Effectively free; batch aggressively.
// ---------------------------------------------------------------------------

interface RawVideos {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; channelId?: string; channelTitle?: string; publishedAt?: string; tags?: string[]; description?: string; categoryId?: string; defaultAudioLanguage?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    contentDetails?: { duration?: string };
  }>;
}

export interface VideoDetail extends VideoCounts {
  tags: string[];
  description: string;
  categoryId?: string;
  language?: string;
  /** True when the uploader has hidden likes — distinct from "zero likes". */
  likesHidden: boolean;
}

/** ISO-8601 duration (PT1H2M3S) to seconds. */
export function parseDuration(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return undefined;
  const [, d, h, mi, s] = m;
  return (Number(d ?? 0) * 86400) + (Number(h ?? 0) * 3600) + (Number(mi ?? 0) * 60) + Number(s ?? 0);
}

export async function videoDetails(ids: string[], fresh = false): Promise<{ items: VideoDetail[]; freshness: string }> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return { items: [], freshness: "no ids requested" };

  const out: VideoDetail[] = [];
  let freshness = "";
  // 50 ids per call, 1 unit each.
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const { data, freshness: f } = await call<RawVideos>(
      "videos",
      { part: "snippet,statistics,contentDetails", id: batch.join(",") },
      "stats",
      "videos.list",
      fresh
    );
    if (!freshness) freshness = f;
    for (const it of data.items ?? []) {
      if (!it.id) continue;
      const likeRaw = it.statistics?.likeCount;
      out.push({
        videoId: it.id,
        title: it.snippet?.title ?? "",
        channelTitle: it.snippet?.channelTitle ?? "",
        publishedAt: it.snippet?.publishedAt ?? "",
        views: Number(it.statistics?.viewCount ?? 0),
        likes: likeRaw === undefined ? undefined : Number(likeRaw),
        comments: it.statistics?.commentCount === undefined ? undefined : Number(it.statistics.commentCount),
        durationSeconds: parseDuration(it.contentDetails?.duration),
        tags: it.snippet?.tags ?? [],
        description: it.snippet?.description ?? "",
        categoryId: it.snippet?.categoryId,
        language: it.snippet?.defaultAudioLanguage,
        likesHidden: likeRaw === undefined,
      });
    }
  }

  // Record a snapshot so a LATER call can compute a real observed growth rate.
  // This is the only mechanism by which youtube_find_fast_growing_videos can ever
  // report actual velocity rather than a lifetime average.
  observe(out.map((v) => ({ videoId: v.videoId, views: v.views })));

  return { items: out, freshness };
}

// ---------------------------------------------------------------------------
// channels.list — 1 unit.
// ---------------------------------------------------------------------------

interface RawChannels {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; description?: string; publishedAt?: string; country?: string; customUrl?: string };
    statistics?: { viewCount?: string; subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
  }>;
}

export interface ChannelDetail {
  channelId: string;
  title: string;
  description: string;
  createdAt?: string;
  country?: string;
  handle?: string;
  views: number;
  subscribers?: number;
  subscribersHidden: boolean;
  videoCount?: number;
}

export async function channelDetails(
  refs: string[],
  fresh = false
): Promise<{ items: ChannelDetail[]; freshness: string }> {
  const ids = refs.filter((r) => /^UC[\w-]{20,}$/.test(r));
  const handles = refs.filter((r) => !/^UC[\w-]{20,}$/.test(r));
  const out: ChannelDetail[] = [];
  let freshness = "";

  // Dedupe by RESOLVED channelId, not by input string. Passing both "@YouTube"
  // and "UCBR8-60-B28hp2BmDPdntcQ" is one channel named two ways, and without
  // this the caller gets it twice — which let compare_channels "compare" a
  // channel against itself and pass its own >=2 guard. Caught by live testing,
  // not by the type checker.
  const seen = new Set<string>();
  const absorb = (data: RawChannels) => {
    for (const it of data.items ?? []) {
      if (!it.id || seen.has(it.id)) continue;
      seen.add(it.id);
      const subRaw = it.statistics?.subscriberCount;
      out.push({
        channelId: it.id,
        title: it.snippet?.title ?? "",
        description: it.snippet?.description ?? "",
        createdAt: it.snippet?.publishedAt,
        country: it.snippet?.country,
        handle: it.snippet?.customUrl,
        views: Number(it.statistics?.viewCount ?? 0),
        subscribers: subRaw === undefined ? undefined : Number(subRaw),
        subscribersHidden: Boolean(it.statistics?.hiddenSubscriberCount) || subRaw === undefined,
        videoCount: it.statistics?.videoCount === undefined ? undefined : Number(it.statistics.videoCount),
      });
    }
  };

  for (let i = 0; i < ids.length; i += 50) {
    const { data, freshness: f } = await call<RawChannels>(
      "channels",
      { part: "snippet,statistics", id: ids.slice(i, i + 50).join(",") },
      "stats",
      "channels.list",
      fresh
    );
    if (!freshness) freshness = f;
    absorb(data);
  }

  // forHandle takes exactly one handle per call, so N handles cost N units.
  for (const h of handles) {
    const { data, freshness: f } = await call<RawChannels>(
      "channels",
      { part: "snippet,statistics", forHandle: h.startsWith("@") ? h : `@${h}` },
      "stats",
      "channels.list",
      fresh
    );
    if (!freshness) freshness = f;
    absorb(data);
  }

  return { items: out, freshness };
}

// ---------------------------------------------------------------------------
// commentThreads.list — 1 unit.
// ---------------------------------------------------------------------------

interface RawComments {
  items?: Array<{
    snippet?: {
      topLevelComment?: {
        snippet?: { textOriginal?: string; authorDisplayName?: string; likeCount?: number; publishedAt?: string };
      };
      totalReplyCount?: number;
    };
  }>;
}

export interface CommentItem {
  text: string;
  author: string;
  likes: number;
  publishedAt: string;
  replies: number;
}

export async function comments(
  videoId: string,
  max = 50,
  order: "time" | "relevance" = "relevance",
  fresh = false
): Promise<{ items: CommentItem[]; freshness: string }> {
  const { data, freshness } = await call<RawComments>(
    "commentThreads",
    { part: "snippet", videoId, maxResults: Math.min(100, Math.max(1, max)), order, textFormat: "plainText" },
    "comments",
    "commentThreads.list",
    fresh
  );
  const items: CommentItem[] = (data.items ?? []).map((i) => {
    const s = i.snippet?.topLevelComment?.snippet;
    return {
      text: s?.textOriginal ?? "",
      author: s?.authorDisplayName ?? "",
      likes: Number(s?.likeCount ?? 0),
      publishedAt: s?.publishedAt ?? "",
      replies: Number(i.snippet?.totalReplyCount ?? 0),
    };
  });
  return { items, freshness };
}
