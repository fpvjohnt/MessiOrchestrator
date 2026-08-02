// OAuth 2.0 refresh-token exchange for the YouTube Analytics API.
//
// The Analytics API is the ONLY source of ageGroup / gender / country /
// deviceType / operatingSystem, and per Google's channel-reports doc: "The user
// authorizing the request must be the owner of the channel." There is no API key
// path and no public equivalent, so OAuth is not an optional nicety here — it is
// the entire mechanism.
//
// Only the refresh token is stored. Access tokens live ~1 hour and are cached in
// memory for the process lifetime, never written to disk.
import { assertAllowedHost, fetchJson, explainGoogleError, HttpError } from "./http.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export function oauthConfig(): OAuthConfig | undefined {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return undefined;
  return { clientId, clientSecret, refreshToken };
}

export function missingOAuthMessage(): string {
  const have = {
    YOUTUBE_OAUTH_CLIENT_ID: Boolean(process.env.YOUTUBE_OAUTH_CLIENT_ID),
    YOUTUBE_OAUTH_CLIENT_SECRET: Boolean(process.env.YOUTUBE_OAUTH_CLIENT_SECRET),
    YOUTUBE_OAUTH_REFRESH_TOKEN: Boolean(process.env.YOUTUBE_OAUTH_REFRESH_TOKEN),
  };
  const missing = Object.entries(have)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return (
    `OAuth is not configured — missing ${missing.join(", ")}.\n\n` +
    `Demographics (age group, gender, country, device, OS) come ONLY from the YouTube Analytics API, ` +
    `which requires OAuth AND ownership of the channel. There is no API-key path and no public ` +
    `equivalent, so nothing can be substituted here and nothing will be invented.\n\n` +
    `SETUP (one time, ~3 minutes):\n` +
    `  1. Google Cloud console -> APIs & Services -> Library -> enable "YouTube Analytics API".\n` +
    `  2. Credentials -> Create credentials -> OAuth client ID -> Application type "Desktop app".\n` +
    `     Put the client id and secret in youtube-mcp/.env as YOUTUBE_OAUTH_CLIENT_ID / _SECRET.\n` +
    `  3. Run:  npm --prefix youtube-mcp run setup:oauth\n` +
    `     Approve in the browser. It prints YOUTUBE_OAUTH_REFRESH_TOKEN — paste that into .env too.\n\n` +
    `Scope requested: ${ANALYTICS_SCOPE} (read-only).`
  );
}

let cached: { token: string; expiresAt: number } | undefined;

export async function accessToken(cfg: OAuthConfig, now = Date.now()): Promise<string> {
  // 60s safety margin so a token cannot expire mid-request.
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;

  // NOT buildUrl. buildUrl exists to put caller input safely into a path/query
  // against a directory-style base, so it appends a trailing slash when the base
  // lacks one — which turns this into POST /token/ and Google answers
  // 404 {"error":"invalid_request"}. That 404 then surfaced on every Analytics
  // call and looked like an Analytics problem, because the token refresh failed
  // before the Analytics request was ever made. setup-oauth.mjs never hit it: it
  // calls fetch() on the literal URL. Nothing is interpolated here, so the
  // allowlist assertion is the only guard needed.
  const url = new URL(TOKEN_URL);
  assertAllowedHost(url);
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: "refresh_token",
  }).toString();

  try {
    const data = await fetchJson<{ access_token?: string; expires_in?: number }>(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!data.access_token) throw new Error("token endpoint returned no access_token");
    cached = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000 };
    return cached.token;
  } catch (err) {
    if (err instanceof HttpError && err.status === 400) {
      throw new Error(
        `${explainGoogleError(err)}\n\nA 400 from the token endpoint almost always means the refresh token ` +
          `was revoked or was minted with a different client id. Re-run: npm --prefix youtube-mcp run setup:oauth`
      );
    }
    throw new Error(explainGoogleError(err));
  }
}
