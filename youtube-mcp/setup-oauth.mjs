#!/usr/bin/env node
// One-time OAuth consent to mint a refresh token for the YouTube Analytics API.
//
// Why this script has to exist: age group, gender, country, device type and
// operating system come ONLY from the YouTube Analytics API, and Google's docs are
// explicit that "the user authorizing the request must be the owner of the
// channel." There is no API-key path. So a browser consent is unavoidable, once.
//
// Uses the loopback redirect flow (http://127.0.0.1:PORT), which is what Google
// documents for "Desktop app" clients. The out-of-band (urn:ietf:wg:oauth:2.0:oob)
// flow that older tutorials use was shut off by Google and will fail.
import http from "node:http";
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes, createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(HERE, ".env");
const SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly";

function readEnv() {
  const out = {};
  if (!existsSync(ENV_PATH)) return out;
  for (const line of readFileSync(ENV_PATH, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));
}

function upsertEnv(key, value) {
  let lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf-8").split(/\r?\n/) : [];
  let found = false;
  lines = lines.map((l) => {
    if (l.trim().startsWith(`${key}=`)) { found = true; return `${key}=${value}`; }
    return l;
  });
  if (!found) lines.push(`${key}=${value}`);
  writeFileSync(ENV_PATH, lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n").replace(/\n*$/, "\n"), "utf-8");
}

async function main() {
  console.log("\n=== youtube-mcp OAuth setup ===\n");
  console.log("Prerequisites in the Google Cloud console:");
  console.log("  1. Enable the *YouTube Analytics API* (not just the Data API).");
  console.log("  2. Credentials -> Create credentials -> OAuth client ID -> Application type: Desktop app.");
  console.log("  3. If the consent screen is in Testing mode, add your Google account under 'Test users',");
  console.log("     otherwise consent fails with access_denied.\n");
  console.log(`Scope requested (read-only): ${SCOPE}\n`);

  const env = readEnv();
  let clientId = env.YOUTUBE_OAUTH_CLIENT_ID || process.env.YOUTUBE_OAUTH_CLIENT_ID;
  let clientSecret = env.YOUTUBE_OAUTH_CLIENT_SECRET || process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  let clientType = "";

  // Accept the client_secret_*.json the Cloud console downloads, so nobody has
  // to hand-copy a 72-character id out of a browser. `node setup-oauth.mjs <path>`.
  const jsonArg = process.argv[2];
  if (jsonArg) {
    if (!existsSync(jsonArg)) {
      console.error(`\nNo such file: ${jsonArg}`);
      process.exit(1);
    }
    const parsed = JSON.parse(readFileSync(jsonArg, "utf-8"));
    // "installed" = Desktop app (what this flow needs); "web" = Web application.
    const block = parsed.installed ?? parsed.web;
    if (!block?.client_id || !block?.client_secret) {
      console.error(`\n${jsonArg} does not look like an OAuth client file (no installed/web block).`);
      process.exit(1);
    }
    clientType = parsed.installed ? "installed" : "web";
    clientId = block.client_id;
    clientSecret = block.client_secret;
    console.log(`Read ${clientType} client from ${jsonArg}`);
    if (clientType === "web") {
      console.log(
        `\nWARNING: this is a "Web application" client, not a Desktop app. Web clients must have the\n` +
          `exact loopback redirect URI pre-registered, and this script binds a RANDOM port. Either create\n` +
          `a Desktop-app client instead (recommended), or expect to register the URI printed below.`
      );
    }
  }

  if (!clientId) clientId = await ask("OAuth client ID: ");
  if (!clientSecret) clientSecret = await ask("OAuth client secret: ");
  // An id ending in .apps.googleusercontent.com from a Desktop client is the
  // normal case; assume installed unless the JSON said otherwise.
  if (!clientType) clientType = "installed";
  if (!clientId || !clientSecret) {
    console.error("\nBoth a client id and secret are required. Aborting without writing anything.");
    process.exit(1);
  }

  // PKCE — required for some client configurations and harmless for the rest.
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("hex");

  const server = http.createServer();
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  // access_type=offline + prompt=consent is what actually returns a refresh_token.
  // Without prompt=consent, a re-authorisation returns an access token only and the
  // script appears to succeed while producing nothing reusable.
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  // Desktop ("installed") clients may use a loopback redirect on ANY port
  // without pre-registering it — that is why binding port 0 above is safe. An
  // earlier version of this script told the user to go register the exact URI,
  // which is unnecessary busywork for a Desktop client and confusing when the
  // console offers nowhere obvious to put it.
  if (clientType === "web") {
    console.log(`\nThis is a WEB client, so add this EXACT redirect URI to its "Authorized redirect URIs":\n  ${redirectUri}\n`);
  } else {
    console.log(`\nRedirect: ${redirectUri}  (Desktop clients accept any loopback port — nothing to register.)\n`);
  }
  console.log("Open this URL in a browser and approve:\n");
  console.log(authUrl.toString());
  console.log("\nWaiting for the redirect… (Ctrl+C to abort)\n");

  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timed out after 5 minutes waiting for consent")), 5 * 60 * 1000);
    server.on("request", (req, res) => {
      const u = new URL(req.url, redirectUri);
      const gotCode = u.searchParams.get("code");
      const err = u.searchParams.get("error");
      const gotState = u.searchParams.get("state");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (err) {
        res.end(`<h1>Consent failed</h1><p>${err}</p><p>You can close this tab.</p>`);
        clearTimeout(timeout);
        reject(new Error(`consent returned error=${err}`));
        return;
      }
      if (gotState !== state) {
        res.end("<h1>State mismatch</h1><p>Aborted. You can close this tab.</p>");
        clearTimeout(timeout);
        reject(new Error("state mismatch — possible CSRF, aborted"));
        return;
      }
      res.end("<h1>Done</h1><p>Refresh token minted. Return to the terminal — you can close this tab.</p>");
      clearTimeout(timeout);
      resolve(gotCode);
    });
  }).finally(() => server.close());

  if (!code) throw new Error("no authorization code returned");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(`\nToken exchange failed (HTTP ${resp.status}):\n${text}\n`);
    console.error("Most common cause: the redirect URI above is not listed on the OAuth client. Add it and re-run.");
    process.exit(1);
  }
  const json = JSON.parse(text);
  if (!json.refresh_token) {
    console.error("\nGoogle returned an access token but NO refresh token.");
    console.error("This happens when the app was already authorised. Revoke it at");
    console.error("https://myaccount.google.com/permissions and re-run, or confirm prompt=consent was sent.");
    process.exit(1);
  }

  upsertEnv("YOUTUBE_OAUTH_CLIENT_ID", clientId);
  upsertEnv("YOUTUBE_OAUTH_CLIENT_SECRET", clientSecret);
  upsertEnv("YOUTUBE_OAUTH_REFRESH_TOKEN", json.refresh_token);

  console.log(`\n✓ Wrote YOUTUBE_OAUTH_CLIENT_ID, _SECRET and _REFRESH_TOKEN to ${ENV_PATH}`);
  console.log("\nVerify with:");
  console.log("  youtube_get_owned_channel_demographics(days=28)");
  console.log("\nReminder about what you just enabled: age and gender describe LOGGED-IN viewers only.");
  console.log("Those percentages are shares of your signed-in audience, not of your audience.\n");
}

main().catch((err) => {
  console.error(`\nSetup failed: ${err.message}\n`);
  process.exit(1);
});
