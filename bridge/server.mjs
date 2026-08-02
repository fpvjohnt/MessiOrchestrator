// HTTP bridge that puts the stdio orchestrator on a local port so cloudflared
// can serve it to the phone. This deliberately does NOT import the orchestrator
// — it spawns dist/index.js as a child and relays JSON-RPC messages between a
// StreamableHTTP server transport and that child's stdio transport. Keeping it
// out-of-process means the Desktop stdio path in src/index.ts stays untouched
// and can't be broken by anything in here.
//
// STATELESS: /mcp accepts a POST carrying one JSON-RPC message and answers it in
// the same response. No session ids, no SSE, nothing retained between requests.
// Requests are load-balanced across a fixed pool of warm orchestrators — see
// worker-pool.mjs for why that is safe and what it replaced.
//
// Auth is Cloudflare Access at the edge, so this binds to 127.0.0.1 ONLY and is
// never reachable from the LAN. cloudflared connects out; nothing dials in.
import express from "express";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WorkerPool } from "./worker-pool.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { ipKeyGenerator } from "express-rate-limit";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { timingSafeEqual } from "node:crypto";
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

// How many orchestrators to keep warm. This is now the ONLY thing that decides
// how much memory the bridge can occupy — roughly 1.5GB per fully warmed worker
// once it has fanned out across the assets. Two is comfortable for one person
// with a phone and a desktop talking at once.
const POOL_SIZE = Math.max(1, Number(process.env.MCP_BRIDGE_WORKERS ?? 2));
// A research case can legitimately run for minutes; this only has to be shorter
// than "forever" so a wedged worker cannot pin a request permanently.
const REQUEST_TIMEOUT_MS = Number(process.env.MCP_BRIDGE_REQUEST_TIMEOUT_MS ?? 10 * 60 * 1000);

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

const pool = new WorkerPool({
  size: POOL_SIZE,
  command: process.execPath,
  args: [resolve(ROOT, "dist/index.js")],
  cwd: ROOT,
  log,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
});

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

// The idle-session reaper, the session cap and the handshake-grace timer all
// lived here. All three existed to bound processes that client behaviour was
// allowed to create. The pool bounds that by construction, so none of them have
// anything left to do.

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
  const pooled = pool.stats();
  const base = {
    stateless: true,
    pool: pooled,
    // Kept so anything already scraping this field does not start reading
    // undefined; a stateless bridge simply never has sessions.
    sessions: 0,
    uptime: Math.round(process.uptime()),
  };
  // A bridge whose workers have all died is not healthy even if the port is up.
  if (pooled.live === 0) {
    res.status(503).json({ ok: false, serving: false, detail: "no warm orchestrator", ...base });
    return;
  }
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

// A STATIC, revocable bearer for a non-OAuth MCP client — e.g. an ElevenLabs
// Conversational AI agent — that can't walk the interactive OAuth passphrase
// flow the phone uses. It is a SEPARATE credential (MCP_BRIDGE_AGENT_TOKEN):
// revoke it by unsetting the env var and restarting, with zero effect on the
// phone's OAuth path. When the header doesn't match, we fall through to the
// normal OAuth check, so that flow is completely unchanged.
const AGENT_TOKEN = process.env.MCP_BRIDGE_AGENT_TOKEN?.trim();
if (AGENT_TOKEN && AGENT_TOKEN.length < 32) {
  console.error("refusing to start: MCP_BRIDGE_AGENT_TOKEN, if set, must be at least 32 chars");
  process.exit(1);
}
function constEq(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function authMcp(req, res, next) {
  if (AGENT_TOKEN) {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "");
    if (m && constEq(m[1], AGENT_TOKEN)) {
      // Minimal auth context; the session machinery below does the real work.
      req.auth = { token: "agent", clientId: "static-agent", scopes: [], extra: {} };
      return next();
    }
  }
  return requireAuth(req, res, next);
}

// ---------------------------------------------------------------- /mcp
// STATELESS. One POST carries one JSON-RPC message (or a batch) and gets its
// answer in the same response body. There is no session id, no SSE stream, and
// nothing on this process that a later request depends on — which is what lets
// the pool route consecutive calls to whichever worker is free, and would let a
// second bridge run behind a real load balancer without sticky sessions.
//
// The handshake is terminated HERE rather than forwarded. Workers are already
// initialized when the pool warms them, and an MCP server accepts initialize
// once per connection, so replaying a client's handshake at a worker would be
// an error. Answering from the pool's stored result is what a stateless proxy
// is supposed to do.
function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handleOne(msg) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return jsonRpcError(msg?.id, -32600, "Invalid Request");
  }
  // Notifications get no reply, by definition.
  if (msg.id === undefined || msg.id === null) {
    if (msg.method !== "notifications/initialized") await pool.notify(msg);
    return null;
  }
  if (msg.method === "initialize") {
    const info = pool.serverInfo;
    if (!info) return jsonRpcError(msg.id, -32603, "No orchestrator is warm yet");
    return { jsonrpc: "2.0", id: msg.id, result: info };
  }
  if (msg.method === "ping") return { jsonrpc: "2.0", id: msg.id, result: {} };
  try {
    return await pool.request(msg);
  } catch (err) {
    log(`dispatch failed (${msg.method}):`, err?.message ?? err);
    return jsonRpcError(msg.id, -32603, err?.message ?? "Bridge error");
  }
}

// Only POST. GET is how the old transport opened an SSE stream and DELETE is
// how it closed a session; with neither concept left, answering them would be a
// lie. 405 with Allow: POST is the honest response and tells a client to fall
// back to plain request/response.
app.get("/mcp", (req, res) => res.set("Allow", "POST").status(405)
  .json(jsonRpcError(null, -32601, "This bridge is stateless: POST only, no SSE stream")));
app.delete("/mcp", (req, res) => res.set("Allow", "POST").status(405)
  .json(jsonRpcError(null, -32601, "This bridge is stateless: there is no session to delete")));

app.post("/mcp", authMcp, async (req, res) => {
  try {
    const body = req.body;
    if (Array.isArray(body)) {
      const replies = (await Promise.all(body.map(handleOne))).filter(Boolean);
      if (!replies.length) return res.status(202).end();
      return res.json(replies);
    }
    const reply = await handleOne(body);
    if (!reply) return res.status(202).end();
    return res.json(reply);
  } catch (err) {
    log("request failed:", err);
    if (!res.headersSent) res.status(500).json(jsonRpcError(null, -32603, "Bridge error"));
  }
});

// Warm the pool BEFORE opening the port. A bridge that accepts connections it
// cannot serve is exactly the "green light, dark phone" failure this system has
// been bitten by before; better to stay down and let the supervisor restart.
try {
  await pool.start();
} catch (err) {
  console.error("refusing to start: no orchestrator would warm —", err?.message ?? err);
  process.exit(1);
}

const server = app.listen(PORT, HOST, () => {
  log(`orchestrator bridge on http://${HOST}:${PORT}/mcp — stateless, ${POOL_SIZE} worker(s)`);
});

async function shutdown() {
  log("shutting down…");
  server.close();
  await pool.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
