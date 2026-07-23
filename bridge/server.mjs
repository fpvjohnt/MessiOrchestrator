// HTTP bridge that puts the stdio orchestrator on a local port so cloudflared
// can serve it to the phone. This deliberately does NOT import the orchestrator
// — it spawns dist/index.js as a child and relays JSON-RPC messages between a
// StreamableHTTP server transport and that child's stdio transport. Keeping it
// out-of-process means the Desktop stdio path in src/index.ts stays untouched
// and can't be broken by anything in here.
//
// One child orchestrator per HTTP session, torn down when the session closes.
//
// Auth is Cloudflare Access at the edge, so this binds to 127.0.0.1 ONLY and is
// never reachable from the LAN. cloudflared connects out; nothing dials in.
import express from "express";
import { randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { ipKeyGenerator } from "express-rate-limit";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createProvider } from "./oauth-provider.mjs";
import { loadEnvFile } from "./load-env.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// MUST run before any config is read below. This process is started from
// start-all.cmd at logon with a bare environment, so without it every setting
// here except the token falls back to its default no matter what .env says —
// see load-env.mjs. Values already in the environment win, so a one-off
// override on the command line still beats the file.
await loadEnvFile(ROOT);

const PORT = Number(process.env.MCP_BRIDGE_PORT ?? 8787);
const HOST = "127.0.0.1";

// Public origin this is served on. OAuth metadata and redirect URIs must use
// the external URL, not localhost, or the connector's discovery breaks.
const ISSUER = new URL(process.env.MCP_BRIDGE_ISSUER ?? "https://mcp.johntapia.com");

// The passphrase gating the OAuth approval page. This is the ONLY thing between
// the public hostname and the orchestrator, so refuse to boot rather than start
// unprotected — a bridge that silently ran without auth would expose every
// asset to anyone who guessed the hostname.
const PASSPHRASE = process.env.MCP_BRIDGE_TOKEN;
if (!PASSPHRASE || PASSPHRASE.length < 32) {
  console.error(
    "refusing to start: MCP_BRIDGE_TOKEN must be set to a secret of at least 32 chars"
  );
  process.exit(1);
}

// sessionId -> { http, child, lastSeen }
const sessions = new Map();

// A session is torn down only on an explicit client DELETE or child death.
// Claude's connector does neither — it just stops talking — so every phone
// session used to stay resident for the life of the bridge, holding an
// orchestrator and (once anything fans out across the assets) its 21 child
// servers with it: ~1.5GB per warmed session, and 61 of them accumulated in a
// single bridge lifetime before this was found. Sessions are cheap to
// re-establish and the connector reopens one on demand, so reaping an idle one
// costs the user nothing.
// Overridable so the reaper is testable without a 30-minute test.
const SESSION_IDLE_MS = Number(process.env.MCP_BRIDGE_SESSION_IDLE_MS ?? 30 * 60 * 1000);
// Grace period for a child whose initialize never lands. Until
// onsessioninitialized fires there is no sessionId, so it is absent from the
// map AND both onclose guards below no-op — nothing in the process holds a
// reference and only a PID kill would reap it.
const HANDSHAKE_GRACE_MS = Number(process.env.MCP_BRIDGE_HANDSHAKE_GRACE_MS ?? 60 * 1000);
// Hard ceiling on concurrent sessions. The idle reaper bounds sessions over
// TIME but nothing bounded them at an INSTANT: the log shows three opened in 26
// seconds, and each session is an orchestrator that can warm all 22 assets at
// ~80MB apiece. Eleven concurrent sessions is ~19GB. When the cap is hit the
// OLDEST is reaped, because a single user's newest session is the one they are
// actually looking at.
const MAX_SESSIONS = Math.max(1, Number(process.env.MCP_BRIDGE_MAX_SESSIONS ?? 4));

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

/**
 * Which sessions to reap to get back under MAX_SESSIONS, oldest-first.
 * `keepId` (the session that just handshook) is never a candidate — the user is
 * looking at that one.
 */
function sessionsOverCap(keepId) {
  const candidates = [...sessions.entries()]
    .filter(([id]) => id !== keepId)
    .sort((a, b) => a[1].lastSeen - b[1].lastSeen)
    .map(([id]) => id);
  const excess = sessions.size - MAX_SESSIONS;
  return excess > 0 ? candidates.slice(0, excess) : [];
}

async function closeSession(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  sessions.delete(sessionId);
  // Close the child first so the orchestrator runs its own stdin-EOF shutdown
  // and reaps its connected asset servers, instead of being orphaned.
  await entry.child.close().catch((err) => log("child close failed:", err));
  await entry.http.close().catch((err) => log("http close failed:", err));
  log(`session ${sessionId} closed (${sessions.size} active)`);
}

async function openSession() {
  const child = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(ROOT, "dist/index.js")],
    cwd: ROOT,
    stderr: "inherit",
  });

  const http = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      clearTimeout(handshakeTimer);
      sessions.set(sessionId, { http, child, lastSeen: Date.now() });
      log(`session ${sessionId} opened (${sessions.size} active)`);
      // Evict oldest-first until under the cap. Done AFTER inserting so the new
      // session is never the one reaped, and awaited nowhere — a slow child
      // close must not delay the handshake that just succeeded.
      for (const id of sessionsOverCap(sessionId)) {
        log(`session cap ${MAX_SESSIONS} reached — reaping oldest session ${id}`);
        void closeSession(id); // closeSession removes it from the map itself
      }
    },
  });

  // Closes the child directly rather than via closeSession, which looks the
  // session up by an id that by definition doesn't exist yet.
  const handshakeTimer = setTimeout(() => {
    if (http.sessionId) return;
    log("initialize never completed — closing orphaned child");
    void child.close().catch((err) => log("orphan child close failed:", err));
    void http.close().catch((err) => log("orphan http close failed:", err));
  }, HANDSHAKE_GRACE_MS);
  handshakeTimer.unref();

  // Pure transport-level relay. Neither side needs to understand the protocol,
  // which is why this survives orchestrator changes without edits.
  http.onmessage = (msg) => child.send(msg).catch((err) => log("-> child failed:", err));
  child.onmessage = (msg) => http.send(msg).catch((err) => log("-> http failed:", err));

  http.onclose = () => { if (http.sessionId) void closeSession(http.sessionId); };
  child.onclose = () => { if (http.sessionId) void closeSession(http.sessionId); };
  child.onerror = (err) => log("child error:", err);

  await child.start();
  return http;
}

const app = express();
app.use(express.json({ limit: "8mb" }));
// The OAuth approval page posts a normal HTML form, not JSON.
app.use(express.urlencoded({ extended: false }));
// Behind cloudflared, so req.ip should reflect the real client rather than the
// tunnel's loopback address.
app.set("trust proxy", true);

const provider = createProvider({ passphrase: PASSPHRASE, issuer: ISSUER, log });

// /authorize is the passphrase gate — the only thing between the public
// hostname and the orchestrator (see oauth-provider.mjs's header comment).
// timingSafeEqual there rules out a timing side-channel, but nothing stopped
// unlimited attempts. Fixed-window per-IP cap, in memory: doesn't need to
// survive a restart (an attacker forcing a restart just gets a fresh window —
// an acceptable tradeoff for a single-user personal server), and needs no new
// dependency.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimitHits = new Map(); // client key -> { count, windowStart }

// NOT req.ip. Because "trust proxy" is true above, req.ip is read out of the
// X-Forwarded-For header, which any caller can set freely — a spoofed XFF put
// 40 of 40 attempts past this limiter in testing. Cloudflare's edge sets
// CF-Connecting-IP and overwrites whatever the client sent, and the tunnel is
// the only route to this loopback port, so that header is the one caller
// identifier here that can't be forged. Falling back to the raw socket peer
// keeps a direct local caller bucketed too (they'd already be on the box).
// ipKeyGenerator collapses an IPv6 address to its /56 subnet, so a client with
// an IPv6 allocation can't just walk addresses within it to get a fresh bucket
// per request. It's a no-op for IPv4.
function clientKey(req) {
  const ip = req.get("cf-connecting-ip") ?? req.socket.remoteAddress;
  return ip ? ipKeyGenerator(ip) : "unknown";
}

function rateLimitAuthorize(req, res, next) {
  const ip = clientKey(req);
  const now = Date.now();
  const rec = rateLimitHits.get(ip);
  if (!rec || now - rec.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitHits.set(ip, { count: 1, windowStart: now });
    next();
    return;
  }
  rec.count += 1;
  if (rec.count > RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((rec.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    res.set("Retry-After", String(retryAfterSec));
    log(`rate limit: ${ip} blocked on /authorize (${rec.count} attempts this window)`);
    res.status(429).send("Too many attempts. Try again later.");
    return;
  }
  next();
}

// Sweep stale entries so a stream of one-off IPs can't grow this map forever.
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, rec] of rateLimitHits) {
    if (rec.windowStart < cutoff) rateLimitHits.delete(ip);
  }
}, 60_000).unref();

app.use("/authorize", rateLimitAuthorize);

// The SDK's auth router rate-limits its own endpoints with express-rate-limit,
// but that limiter defaults to keying on req.ip — which, with "trust proxy"
// true, is read straight out of the caller's X-Forwarded-For header. It is
// defeated by the exact spoof that defeated the /authorize limiter above, and
// it says so at startup (ERR_ERL_PERMISSIVE_TRUST_PROXY). Hand every endpoint
// the same unforgeable key. Only keyGenerator is passed, and the SDK spreads
// our config last, so its own windowMs/max/headers/message defaults survive
// untouched (authorize 100/15min, token 50/15min, register 20/hr,
// revoke 50/15min).
const sdkRateLimit = { keyGenerator: clientKey };

// Mounts /authorize, /token, /register, /revoke and the .well-known metadata
// documents the connector uses for discovery. MUST be at the app root.
app.use(
  mcpAuthRouter({
    provider,
    issuerUrl: ISSUER,
    resourceServerUrl: new URL("/mcp", ISSUER),
    resourceName: "John MCP Orchestrator",
    scopesSupported: ["mcp"],
    authorizationOptions: { rateLimit: sdkRateLimit },
    tokenOptions: { rateLimit: sdkRateLimit },
    clientRegistrationOptions: { rateLimit: sdkRateLimit },
    revocationOptions: { rateLimit: sdkRateLimit },
  })
);

// Reap sessions the client walked away from. unref'd so it never holds the
// process open on its own.
setInterval(() => {
  const cutoff = Date.now() - SESSION_IDLE_MS;
  for (const [sessionId, entry] of sessions) {
    if (entry.lastSeen <= cutoff) {
      log(`session ${sessionId} idle ${Math.round((Date.now() - entry.lastSeen) / 1000)}s — reaping`);
      void closeSession(sessionId);
    }
  }
  // Sweep every minute in production; never slower than the TTL itself, so a
  // short test TTL doesn't sit through a full minute waiting for a pass.
}, Math.min(60_000, SESSION_IDLE_MS)).unref();

// oldestIdleMin is the number to alert on: it climbing past SESSION_IDLE_MS
// means the reaper has stopped working.
// Whether the ORCHESTRATOR the bridge serves can actually answer, not just
// whether this Express process is up. The old /healthz was a static ok:true —
// so a bridge whose dist/index.js was broken (a bad build, a syntax error, a
// crash-on-start) reported healthy forever, and the supervisor's whole point,
// separating "process alive" from "actually serving", was unmet on the bridge
// side even though it was met for cloudflared.
//
// The probe spawns a throwaway orchestrator over stdio and calls tools/list.
// That exercises the real dist/index.js WITHOUT the 22-asset fleet, because the
// orchestrator connects to assets lazily — listing its own tools spawns none of
// them. Result is cached so repeated /healthz polls don't each pay for a spawn.
//
// The TTL MUST exceed the supervisor's deep-poll interval or the cache never
// helps its only caller: at 20s < the supervisor's 30s poll, every tick found
// the cache already expired and spawned a fresh orchestrator — ~2,880 spawns/day
// purely for health. 45s serves the supervisor's every-other-poll from a warm
// answer while still catching a broken build within one extra tick; with
// FAILURES_BEFORE_RESTART=2 (~60s to act) that costs no real detection latency.
const DEEP_PROBE_TTL_MS = 45_000;
const DEEP_PROBE_TIMEOUT_MS = 12_000;
let deepProbeCache = { at: 0, ok: null, detail: "not yet probed" };

async function runDeepProbe() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(ROOT, "dist/index.js")],
    cwd: ROOT,
    stderr: "ignore",
  });
  const client = new Client({ name: "bridge-healthz-probe", version: "0.1.0" });
  const timer = setTimeout(() => client.close().catch(() => {}), DEEP_PROBE_TIMEOUT_MS);
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    // A serving orchestrator exposes its own case tools. Zero tools means it
    // started but is not wired up — still a failure worth surfacing.
    if (!tools?.length) return { ok: false, detail: "orchestrator returned no tools" };
    return { ok: true, detail: `orchestrator responded with ${tools.length} tools` };
  } catch (err) {
    return { ok: false, detail: `orchestrator probe failed: ${err?.message ?? err}` };
  } finally {
    clearTimeout(timer);
    await client.close().catch(() => {});
  }
}

async function deepProbe() {
  if (Date.now() - deepProbeCache.at < DEEP_PROBE_TTL_MS && deepProbeCache.ok !== null) {
    return deepProbeCache;
  }
  const result = await runDeepProbe();
  deepProbeCache = { at: Date.now(), ...result };
  return deepProbeCache;
}

app.get("/healthz", async (req, res) => {
  const now = Date.now();
  const idleMins = [...sessions.values()].map((s) => Math.round((now - s.lastSeen) / 60000));
  const base = {
    sessions: sessions.size,
    oldestIdleMin: idleMins.length ? Math.max(...idleMins) : 0,
    uptime: Math.round(process.uptime()),
  };
  // Shallow by default (fast, for casual checks); ?deep=1 runs the real probe.
  // The supervisor uses deep — it is the one caller that must know the
  // orchestrator can serve, not just that the port is open.
  if (req.query.deep === "1" || req.query.deep === "true") {
    const probe = await deepProbe();
    res.status(probe.ok ? 200 : 503).json({ ok: probe.ok, serving: probe.ok, detail: probe.detail, ...base });
    return;
  }
  res.json({ ok: true, ...base });
});

// requireBearerAuth returns 401 with a WWW-Authenticate header pointing at the
// resource metadata, which is the signal that kicks the connector into starting
// the OAuth flow rather than just failing.
const requireAuth = requireBearerAuth({
  verifier: provider,
  resourceMetadataUrl: new URL("/.well-known/oauth-protected-resource/mcp", ISSUER).href,
});

app.all("/mcp", requireAuth, async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];
    const existing = sessionId ? sessions.get(sessionId) : undefined;

    if (existing) {
      existing.lastSeen = Date.now();
      await existing.http.handleRequest(req, res, req.body);
      return;
    }
    if (sessionId) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unknown or expired session" },
        id: null,
      });
      return;
    }
    // No session header: must be an initialize request, which opens one.
    const http = await openSession();
    await http.handleRequest(req, res, req.body);
  } catch (err) {
    log("request failed:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Bridge error" },
        id: null,
      });
    }
  }
});

const server = app.listen(PORT, HOST, () => {
  log(`orchestrator bridge on http://${HOST}:${PORT}/mcp`);
});

async function shutdown() {
  log("shutting down…");
  server.close();
  await Promise.all([...sessions.keys()].map(closeSession));
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
