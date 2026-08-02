# youtube-mcp

YouTube audience research as an orchestrator asset. **The second networked asset** in this system — see `AGENTS.md` → *Networked assets (exceptions)* for why the offline rule has an exception here and what rules replace it.

11 tools. 7 need an API key, 2 need OAuth, 2 work with no credentials at all.

---

## The three constraints that shape everything here

Read these before using the tools, because they are the difference between an answer and a confident wrong answer.

### 1. Demographics are owner-only. There is no way around it.

Age group, gender, country, device type and operating system come **only** from the YouTube Analytics API. Google's channel-reports documentation:

> `channel==CHANNEL_ID` — Set CHANNEL_ID to the unique channel ID of the channel for which you are retrieving data. **The user authorizing the request must be the owner of the channel.**

The YouTube Data API v3 exposes **no demographic dimensions at all**. So:

- ✅ "What age group watches **my** channel" — answerable, with OAuth.
- ❌ "What age group watches **MrBeast**" — not answerable by anyone, at any price, through any API. Third-party sites that claim this are modelling or guessing.

`youtube_get_owned_channel_demographics` and `youtube_get_age_group_preferences` are the two owner-only tools, and they are named that way so the limit is visible at the call site.

### 2. The age/gender split only sees logged-in viewers.

From Google's dimensions reference — `ageGroup` "identifies the age group of the **logged-in** users associated with the report data", and `gender` likewise.

Signed-out viewers are **absent entirely**. So a report saying "35% age 18-24" means 35% *of your signed-in audience*. Under-18 and over-55 viewers are the most undercounted (shared family accounts, TV profiles, signed-out watching). When the reported percentages sum below ~100%, the missing mass is viewers YouTube declined to bucket **plus** every signed-out viewer — it is unknown, not zero. The tools print this every time; `LOGGED_IN_CAVEAT` in `src/cohorts.ts` is a constant so no tool can emit the numbers without it.

`gender` has exactly three values: `female`, `male`, `user_specified`. It cannot describe viewers outside that scheme.

### 3. Search is capped at 100 calls per day.

From Google's quota documentation:

> Projects that enable the YouTube Data API have a default quota allocation of **100 search.list calls**, 100 videos.insert calls, and 10,000 units per day combined for all other endpoints.

`search.list` has its **own bucket** — 100 calls/day, 1 quota each, and each extra page of results is another call. Meanwhile `videos.list`, `channels.list` and `commentThreads.list` cost ~1 unit against the separate 10,000/day pool, i.e. effectively free.

Consequences baked into the design:

- Search results cache for **6 hours**. Repeating a query costs nothing.
- Prefer `video_ids` over `query` when you already know the videos — zero search cost.
- `src/quota.ts` reserves quota **before** the request, so a timed-out call cannot spend real quota while the ledger reports plenty left.
- Check the ledger with `youtube_quota_status`. It is a **guardrail, not an accountant** — the bridge runs a worker pool, so concurrent workers can undercount. The Google Cloud console Quotas page is authoritative.

---

## Setup

### Public tools (7 of 11)

1. [Google Cloud console](https://console.cloud.google.com/) → **APIs & Services → Library** → enable **YouTube Data API v3**.
2. **Credentials → Create credentials → API key.**
3. Create `youtube-mcp/.env`:

```
YOUTUBE_API_KEY=AIza...
```

If the key has an HTTP-referrer or IP restriction it will 403 from this machine — set restrictions to *None*, or allow this host.

### Demographics tools (2 of 11) — one-time OAuth

1. Same console → enable **YouTube Analytics API** (a *different* API from the Data API).
2. **Credentials → Create credentials → OAuth client ID → Application type: Desktop app.**
3. Add the client id/secret to `youtube-mcp/.env`.
4. If your consent screen is in *Testing* mode, add your Google account under **Test users**, or consent fails with `access_denied`.
5. Run:

```
npm --prefix youtube-mcp run setup:oauth
```

It starts a loopback listener, prints the redirect URI to paste into the OAuth client, opens consent, and writes `YOUTUBE_OAUTH_REFRESH_TOKEN` into `.env`.

> The old out-of-band flow (`urn:ietf:wg:oauth:2.0:oob`) that older tutorials use was shut off by Google and will fail. This script uses the loopback flow with PKCE.

Only the refresh token is stored. Access tokens live in memory for the process lifetime and are never written to disk.

---

## Tools

| tool | needs | cost |
|---|---|---|
| `youtube_search_videos` | API key | **1 search call** + 1 unit |
| `youtube_get_video_stats` | API key | 1 unit / 50 videos |
| `youtube_get_channel_stats` | API key | ~1 unit / channel |
| `youtube_get_comments` | API key | 1 unit |
| `youtube_get_transcript` | OAuth for owned videos | 250 units official / 0 unofficial (⚠️ blocked) |
| `youtube_find_fast_growing_videos` | API key | **1 search call** + 1 unit |
| `youtube_compare_channels` | API key | ~1 unit / channel |
| `youtube_analyze_topics` | API key¹ | 1 unit, or **1 search call** with `query` |
| `youtube_get_owned_channel_demographics` | OAuth | Analytics quota (separate) |
| `youtube_get_age_group_preferences` | OAuth² | 1 + N Analytics queries |
| `youtube_quota_status` | — | 0 |

¹ `youtube_analyze_topics(topic="gaming")` is a pure offline lookup — no key, no network.
² `youtube_get_age_group_preferences(age_group="18-24")` is likewise a pure offline lookup.

### Two rates, never conflated

`youtube_find_fast_growing_videos` reports growth two ways and labels which is which:

- **`lifetime`** — total views ÷ age. Always available from one snapshot, and **it is an average over the whole life of the video**. A video that took 900k views in its first 48 hours two years ago and is dead now still scores well. Ranking by this inverts the answer, so results are additionally grouped into age bands so a 3-hour-old upload is never ranked against a 3-year-old one.
- **`observed`** — real Δviews ÷ Δtime between two snapshots *this server took*. This is the honest number.

Every `videos.list` call records a snapshot (`.cache/snapshots.json`), so **calling a stats tool, waiting 30+ minutes, then calling `find_fast_growing_videos` turns the estimate into a measurement.** Snapshots closer than 30 minutes apart are ignored — YouTube's view counter is coarsely updated and the delta would be noise.

### Transcripts: official for your videos, currently blocked for everyone else's

`youtube_get_transcript` tries two paths in order.

**1. Official — `captions.list` + `captions.download` (needs OAuth).** Google's reference: the download method *"requires the user to have permission to edit the video."* So this works for **channels you own**, and for those it is compliant, stable, and carries none of the caveats below. Costs 250 quota units (50 list + 200 download). Returns SRT, stripped to plain text.

**2. Unofficial — the undocumented `timedtext` endpoint. ⚠️ BLOCKED as of 2026-07-29, measured.**

YouTube returns **HTTP 200 with a zero-byte body**, on every format (`json3`, `srv3`, none) — while the watch page still lists all six caption tracks and the signed URL is intact. So this is not a missing-captions case and not a parser bug. The `/youtubei/v1/player` endpoint answers `UNPLAYABLE` / *"The page needs to be reloaded"* for the same video, which is the bot-check wall.

Getting past it requires forging a proof-of-origin token — defeating an access control. **This server will not do that**, so third-party transcripts are unavailable and the tool says so precisely instead of guessing at a format change.

**What to do instead for videos you don't own:** `youtube_get_comments` + `youtube_analyze_topics` infer subject matter without a transcript. Weaker, and labelled as inference rather than measurement.

Auto-generated captions, on either path, are speech-to-text and misrender names, jargon and accented speech.

### Comments are not a survey

`youtube_get_comments` is the best available audience proxy for videos you don't own, and it is **evidence about commenters**. Far under 1% of viewers comment, skewed toward strong opinions. The tool says so in every response. Nothing from it supports a claim about "the audience".

### Topic clustering measures vocabulary

`youtube_analyze_topics` is keyword matching over titles + uploader tags, one topic per video (longest matching key wins), so shares sum to 100% of **matched** videos. Unmatched videos are reported as a residue rather than folded into a category, and the keys that fired are printed so any assignment can be audited. An ironic or metaphorical title will land wrong and nothing here can detect that.

### Cohort scaffolds assert nothing

`src/cohorts.ts` deliberately contains **no claims about what an age group watches**. The obvious version of that file is a stereotype generator that emits the same confident sentence for a woodworking channel and a K-pop channel. Instead each cohort holds the *signals worth checking in your own numbers* and *the specific way that cohort gets misread*. The scaffold asks; only your data answers.

---

## Layout

```
src/env-file.ts     .env loader — imported FIRST in index.ts
src/http.ts         allowlisted fetch; throws on any non-Google host
src/quota.ts        the 100-search-calls/day ledger (pure fns + persistence)
src/cache.ts        disk cache with per-kind TTLs
src/api.ts          Data API v3 wrappers (cache → reserve → fetch)
src/oauth.ts        refresh-token exchange
src/analytics.ts    Analytics API; fixed table of valid dimension/metric pairs
src/transcript.ts   unofficial timedtext
src/topics.ts       topic taxonomy + distribution()
src/growth.ts       velocity math + snapshot store
src/cohorts.ts      cohort signal checklists + LOGGED_IN_CAVEAT
src/index.ts        the 11 tools
setup-oauth.mjs     one-time consent flow
.cache/             quota ledger, snapshots, HTTP cache (gitignored)
```

`analytics.ts` exposes a **fixed table** of known-valid `(dimensions, metrics)` pairs rather than free-form parameters, because the demographics report pairs `ageGroup`/`gender` with the single metric `viewerPercentage` — asking for `views` alongside `ageGroup` is a 400. A caller cannot construct an invalid combination.

## Why `youtube_get_age_group_preferences` works at all

`ageGroup` cannot be crossed with the `video` **dimension** (only `viewerPercentage` is valid there), but it *can* be **filtered** to one video: `filters=video==ID`. So the tool ranks your top videos by watch time, runs the age/gender report once per video, and joins each video to its topic cluster. Percentages are per-video shares, so they are **averaged** within a topic, never summed — and the sample count is printed, because a topic backed by one video is one video's audience, not a cohort finding.
