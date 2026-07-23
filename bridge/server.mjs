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
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createProvider } from "./oauth-provider.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

// sessionId -> { http, child }
const sessions = new Map();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
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
      sessions.set(sessionId, { http, child });
      log(`session ${sessionId} opened (${sessions.size} active)`);
    },
  });

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
function clientKey(req) {
  return req.get("cf-connecting-ip") ?? req.socket.remoteAddress ?? "unknown";
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

// Mounts /authorize, /token, /register, /revoke and the .well-known metadata
// documents the connector uses for discovery. MUST be at the app root.
app.use(
  mcpAuthRouter({
    provider,
    issuerUrl: ISSUER,
    resourceServerUrl: new URL("/mcp", ISSUER),
    resourceName: "John MCP Orchestrator",
    scopesSupported: ["mcp"],
  })
);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, sessions: sessions.size, uptime: Math.round(process.uptime()) });
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
