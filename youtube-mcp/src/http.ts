// Outbound HTTP for the ONLY networked asset besides research.
//
// research-mcp needs pinnedFetch + ssrf-guard because its `fetch_page` takes an
// arbitrary caller-supplied URL — the host itself is untrusted input, so DNS
// rebinding is a live threat. This asset never does that: every request goes to
// one of four hardcoded Google hosts, and caller input only ever lands in the
// PATH and QUERY of a URL we construct ourselves. So the guard here is an
// allowlist assertion on the constructed URL rather than an IP pin.
//
// The assertion is not decoration. It is what makes "caller input can't move the
// host" a checked property instead of a claim about the code above it — if some
// future edit interpolates a caller string into the origin, this throws instead
// of quietly exfiltrating an API key to whatever host it names.
const ALLOWED_HOSTS = new Set([
  "www.googleapis.com", // Data API v3 + Analytics API
  "youtubeanalytics.googleapis.com", // Analytics API (alternate endpoint)
  "oauth2.googleapis.com", // token refresh
  "www.youtube.com", // unofficial timedtext/watch page (transcripts only)
]);

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function assertAllowedHost(url: URL): void {
  if (url.protocol !== "https:") {
    throw new Error(`refusing non-https request to ${url.protocol}//${url.hostname}`);
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(
      `refusing request to non-allowlisted host "${url.hostname}". ` +
        `This asset may only reach: ${[...ALLOWED_HOSTS].join(", ")}.`
    );
  }
}

/**
 * Build a URL against a fixed DIRECTORY base, putting caller input only in the
 * path segment and query.
 *
 * The base MUST end with "/". An earlier version quietly appended one, which
 * silently rewrote the endpoint URL "https://oauth2.googleapis.com/token" into
 * ".../token/" — Google answers that with 404 {"error":"invalid_request"}, and
 * because it was the TOKEN endpoint the failure surfaced on every Analytics call
 * and looked like an Analytics permissions problem. Refusing the input is better
 * than repairing it into something that resolves but is wrong: a full endpoint
 * URL should be constructed with `new URL()` + assertAllowedHost, not here.
 */
export function buildUrl(base: string, path: string, params: Record<string, string | number | undefined>): URL {
  if (!base.endsWith("/")) {
    throw new Error(
      `buildUrl base must end with "/" (got "${base}"). A base without a trailing slash is an ENDPOINT, ` +
        `not a directory — use new URL() + assertAllowedHost for those.`
    );
  }
  const url = new URL(path.replace(/^\/+/, ""), base);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  assertAllowedHost(url);
  return url;
}

export interface FetchTextOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  method?: "GET" | "POST";
  body?: string;
}

/**
 * One request, size-capped and timed out. Returns the body as text.
 * Throws HttpError on a non-2xx so callers can read Google's own error JSON —
 * a 403 quotaExceeded and a 403 forbidden-because-you-don't-own-this-channel are
 * completely different problems and the body is the only way to tell them apart.
 */
export async function fetchText(url: URL, opts: FetchTextOptions = {}): Promise<string> {
  assertAllowedHost(url);
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 8_000_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // The allowlist was asserted at hop 0 and then ASSUMED, because
    // redirect: "follow" hands the whole redirect chain to undici and a Location
    // pointing anywhere is never re-checked. AGENTS.md cites this very file as
    // the reference implementation of "host allowlist, asserted not assumed" —
    // so the property it is named for held for exactly one request.
    //
    // Following manually re-asserts per hop. That matters more than the odds of
    // Google redirecting somewhere hostile: opts.headers carries the API key on
    // the Data-API paths, and a followed redirect would have sent it to whatever
    // host the Location named.
    let current = url;
    let res: Response;
    for (let hop = 0; ; hop++) {
      if (hop > 5) throw new Error(`Too many redirects starting at ${url.hostname}`);
      res = await fetch(current, {
        method: opts.method ?? "GET",
        headers: {
          // A real UA matters for the unofficial youtube.com paths — the watch page
          // serves a different (caption-track-free) payload to obvious bots.
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) john-mcp-youtube/0.1",
          "Accept-Language": "en-US,en;q=0.9",
          ...(opts.headers ?? {}),
        },
        body: opts.body,
        signal: controller.signal,
        redirect: "manual",
      });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!location) break;
      const next = new URL(location, current);
      assertAllowedHost(next); // the whole point — throws before the next request
      current = next;
    }

    const reader = res.body?.getReader();
    let text = "";
    if (reader) {
      const decoder = new TextDecoder();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          text += decoder.decode(value.subarray(0, Math.max(0, value.byteLength - (total - maxBytes))));
          await reader.cancel();
          break;
        }
        text += decoder.decode(value, { stream: true });
      }
    } else {
      text = await res.text();
    }

    if (!res.ok) {
      throw new HttpError(`HTTP ${res.status} from ${url.hostname}`, res.status, text.slice(0, 2000));
    }
    return text;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`timed out after ${timeoutMs}ms fetching ${url.hostname}${url.pathname}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = unknown>(url: URL, opts: FetchTextOptions = {}): Promise<T> {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`expected JSON from ${url.hostname}${url.pathname} but got ${text.slice(0, 200)}`);
  }
}

/**
 * Pull the human-meaningful part out of a Google API error body.
 * Google's 403 is used for at least four unrelated conditions and the generic
 * "HTTP 403" string sends the caller looking for the wrong fix every time.
 */
export function explainGoogleError(err: unknown): string {
  if (!(err instanceof HttpError)) return err instanceof Error ? err.message : String(err);
  let reason = "";
  let message = "";
  try {
    const parsed = JSON.parse(err.body) as {
      error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
    };
    message = parsed.error?.message ?? "";
    reason = parsed.error?.errors?.[0]?.reason ?? "";
  } catch {
    /* non-JSON body — fall through to the raw text */
  }

  const hints: Record<string, string> = {
    quotaExceeded:
      "Daily quota is gone. search.list has its OWN bucket of 100 calls/day; everything else shares 10,000 units/day. Quota resets at midnight Pacific. Use youtube_quota_status to see the ledger.",
    rateLimitExceeded: "Too many requests too fast. Back off and retry.",
    dailyLimitExceededUnreg: "The API key is missing or not enabled. Set YOUTUBE_API_KEY and enable YouTube Data API v3 in the Google Cloud console.",
    keyInvalid: "YOUTUBE_API_KEY is invalid. Re-copy it from the Google Cloud console.",
    ipRefererBlocked: "The API key has an HTTP-referrer or IP restriction that blocks this machine. Loosen it to 'None' or allow this host.",
    forbidden:
      "Forbidden. For the Analytics API this almost always means the authenticated account does NOT own the requested channel — demographics are owner-only and there is no public equivalent.",
    insufficientPermissions:
      "The OAuth token lacks the yt-analytics.readonly scope. Re-run `npm run setup:oauth` and grant the analytics scope.",
    authError: "The OAuth token is expired or invalid. Re-run `npm run setup:oauth`.",
    commentsDisabled: "Comments are disabled on this video. Not an error — there is nothing to fetch.",
    videoNotFound: "No such video id.",
    channelNotFound: "No such channel id.",
  };

  const hint = reason && hints[reason] ? ` — ${hints[reason]}` : "";
  const detail = message || err.body.slice(0, 300) || "(no error body)";
  return `HTTP ${err.status}${reason ? ` [${reason}]` : ""}: ${detail}${hint}`;
}
