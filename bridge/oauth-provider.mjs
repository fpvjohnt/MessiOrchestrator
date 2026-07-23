// OAuth 2.1 authorization server for the bridge.
//
// Claude's Custom Connectors cannot send a static Authorization header, so the
// bearer-token scheme the bridge started with could never work from the phone —
// connectors speak OAuth (dynamic client registration + authorization code +
// PKCE). This implements the provider interface the MCP SDK's auth router
// expects.
//
// The human gate is a single passphrase (MCP_BRIDGE_TOKEN, the same secret in
// .env) entered on an approval page. There is exactly one user — John — so
// there is no user database, just "does the passphrase match".
//
// State is persisted to bridge/oauth-state.json (gitignored) so restarting the
// bridge does not silently de-authorize the phone and force a re-login.
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STATE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "oauth-state.json");

const ACCESS_TTL_MS = 60 * 60 * 1000; // 1h — refresh tokens cover the long tail.
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d — re-authorize monthly, not never.
const CODE_TTL_MS = 5 * 60 * 1000; // authorization codes are single-use and short.

function token() {
  return randomBytes(32).toString("base64url");
}

// Tokens are stored hashed. If oauth-state.json ever leaks, the hashes are not
// usable as credentials.
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function loadState() {
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    return {
      clients: new Map(Object.entries(raw.clients ?? {})),
      accessTokens: new Map(Object.entries(raw.accessTokens ?? {})),
      refreshTokens: new Map(Object.entries(raw.refreshTokens ?? {})),
    };
  } catch {
    return { clients: new Map(), accessTokens: new Map(), refreshTokens: new Map() };
  }
}

export function createProvider({ passphrase, issuer, log = () => {} }) {
  const state = loadState();
  // Authorization codes stay in memory only — they live <5 minutes and
  // persisting them across restarts would be a liability, not a feature.
  const codes = new Map();

  // Every token is stamped with the CURRENT passphrase's hash at issue time.
  // Rotating MCP_BRIDGE_TOKEN and restarting the bridge changes this value,
  // which makes every previously-issued access/refresh token fail verification
  // on its next use — rotation revokes everything automatically, instead of
  // requiring a manual oauth-state.json wipe. Not reversible (it's one-way),
  // so it can't be used to recover the passphrase from the state file.
  const passphraseVersion = hash(passphrase);

  function persist() {
    const payload = {
      clients: Object.fromEntries(state.clients),
      accessTokens: Object.fromEntries(state.accessTokens),
      refreshTokens: Object.fromEntries(state.refreshTokens),
    };
    // Write-then-rename so a crash mid-write can't truncate the file and lose
    // the phone's registration.
    const tmp = `${STATE_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload, null, 2), { mode: 0o600 });
    renameSync(tmp, STATE_FILE);
  }

  function sweep() {
    const now = Date.now();
    let dirty = false;
    for (const [key, rec] of state.accessTokens) {
      if (rec.expiresAt <= now) { state.accessTokens.delete(key); dirty = true; }
    }
    for (const [key, rec] of state.refreshTokens) {
      if (rec.expiresAt <= now) { state.refreshTokens.delete(key); dirty = true; }
    }
    for (const [key, rec] of codes) {
      if (rec.expiresAt <= now) codes.delete(key);
    }
    if (dirty) persist();
  }
  setInterval(sweep, 60_000).unref();

  function issueTokens(clientId, scopes) {
    const access = token();
    const refresh = token();
    const expiresAt = Date.now() + ACCESS_TTL_MS;
    state.accessTokens.set(hash(access), { clientId, scopes, expiresAt, passphraseVersion });
    state.refreshTokens.set(hash(refresh), {
      clientId,
      scopes,
      expiresAt: Date.now() + REFRESH_TTL_MS,
      passphraseVersion,
    });
    persist();
    return {
      access_token: access,
      token_type: "bearer",
      expires_in: Math.floor(ACCESS_TTL_MS / 1000),
      refresh_token: refresh,
      scope: scopes.join(" "),
    };
  }

  const clientsStore = {
    async getClient(clientId) {
      return state.clients.get(clientId);
    },
    // Dynamic client registration — the connector registers itself on first
    // connect, which is how Claude expects to bootstrap.
    async registerClient(client) {
      state.clients.set(client.client_id, client);
      persist();
      log(`registered oauth client ${client.client_id}`);
      return client;
    },
  };

  return {
    clientsStore,

    // Renders the approval page, and handles its submission. The passphrase is
    // what proves it's John and not whoever found the hostname.
    async authorize(client, params, res) {
      const submitted = res.req.body?.passphrase;
      const redirect = new URL(params.redirectUri);

      if (res.req.method === "POST") {
        if (!passphrase || !safeEqual(submitted ?? "", passphrase)) {
          log("authorize: wrong passphrase");
          res.status(401).send(approvalPage(params, client, "Incorrect passphrase."));
          return;
        }
        const code = token();
        codes.set(code, {
          clientId: client.client_id,
          codeChallenge: params.codeChallenge,
          redirectUri: params.redirectUri,
          scopes: params.scopes ?? [],
          resource: params.resource?.href,
          expiresAt: Date.now() + CODE_TTL_MS,
        });
        redirect.searchParams.set("code", code);
        if (params.state) redirect.searchParams.set("state", params.state);
        log(`authorize: approved for ${client.client_id}`);
        res.redirect(redirect.href);
        return;
      }

      res.send(approvalPage(params, client));
    },

    async challengeForAuthorizationCode(client, authorizationCode) {
      const rec = codes.get(authorizationCode);
      if (!rec || rec.clientId !== client.client_id) {
        throw new Error("invalid authorization code");
      }
      return rec.codeChallenge;
    },

    async exchangeAuthorizationCode(client, authorizationCode) {
      const rec = codes.get(authorizationCode);
      if (!rec || rec.clientId !== client.client_id) {
        throw new Error("invalid authorization code");
      }
      if (rec.expiresAt <= Date.now()) {
        codes.delete(authorizationCode);
        throw new Error("authorization code expired");
      }
      // Single use — burn it immediately so a replayed code is worthless.
      codes.delete(authorizationCode);
      return issueTokens(client.client_id, rec.scopes);
    },

    async exchangeRefreshToken(client, refreshToken, scopes) {
      const key = hash(refreshToken);
      const rec = state.refreshTokens.get(key);
      if (!rec || rec.clientId !== client.client_id) {
        throw new Error("invalid refresh token");
      }
      if (rec.expiresAt <= Date.now() || rec.passphraseVersion !== passphraseVersion) {
        state.refreshTokens.delete(key);
        persist();
        // Same message either way — don't tell a caller whether it expired
        // naturally or was revoked by a passphrase rotation.
        throw new Error("refresh token expired");
      }
      return issueTokens(client.client_id, scopes?.length ? scopes : rec.scopes);
    },

    async verifyAccessToken(accessToken) {
      const rec = state.accessTokens.get(hash(accessToken));
      if (!rec) throw new Error("invalid access token");
      if (rec.expiresAt <= Date.now() || rec.passphraseVersion !== passphraseVersion) {
        state.accessTokens.delete(hash(accessToken));
        persist();
        throw new Error("access token expired");
      }
      return {
        token: accessToken,
        clientId: rec.clientId,
        scopes: rec.scopes,
        expiresAt: Math.floor(rec.expiresAt / 1000),
      };
    },

    async revokeToken(client, request) {
      const key = hash(request.token);
      state.accessTokens.delete(key);
      state.refreshTokens.delete(key);
      persist();
    },
  };

  function escape(value) {
    return String(value).replace(/[<>&"']/g, (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function approvalPage(params, client, error) {
    // The authorize handler validated these already; they are echoed back as
    // hidden fields so the POST carries the same request. Escaped regardless —
    // client_name comes from dynamic registration, i.e. from the network.
    const hidden = Object.entries({
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
      response_type: "code",
      state: params.state ?? "",
      scope: (params.scopes ?? []).join(" "),
      resource: params.resource?.href ?? "",
    })
      .filter(([, v]) => v !== "")
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${escape(v)}">`)
      .join("\n      ");

    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Authorize orchestrator access</title>
<style>
  body{font:16px/1.5 system-ui,sans-serif;max-width:26rem;margin:3rem auto;padding:0 1.25rem;color:#111}
  h1{font-size:1.25rem;margin:0 0 .25rem}
  p{color:#555;margin:.5rem 0 1.5rem}
  .who{background:#f4f4f5;border-radius:.5rem;padding:.75rem 1rem;font-size:.9rem;margin-bottom:1.5rem}
  label{display:block;font-weight:600;margin-bottom:.375rem;font-size:.9rem}
  input[type=password]{width:100%;padding:.625rem .75rem;font-size:1rem;border:1px solid #ccc;border-radius:.375rem}
  button{margin-top:1rem;width:100%;padding:.7rem;font-size:1rem;font-weight:600;color:#fff;background:#111;border:0;border-radius:.375rem;cursor:pointer}
  .err{background:#fef2f2;color:#991b1b;padding:.625rem .75rem;border-radius:.375rem;font-size:.9rem;margin-bottom:1rem}
  @media(prefers-color-scheme:dark){
    body{background:#18181b;color:#f4f4f5}p{color:#a1a1aa}.who{background:#27272a}
    input[type=password]{background:#27272a;border-color:#3f3f46;color:#f4f4f5}
    button{background:#f4f4f5;color:#18181b}.err{background:#450a0a;color:#fecaca}
  }
</style></head>
<body>
  <h1>Authorize orchestrator access</h1>
  <p>An MCP client is requesting access to your orchestrator and all of its assets.</p>
  <div class="who"><strong>${escape(client.client_name ?? client.client_id)}</strong><br>
    redirect: ${escape(params.redirectUri)}</div>
  ${error ? `<div class="err">${escape(error)}</div>` : ""}
  <form method="POST">
      ${hidden}
    <label for="p">Passphrase</label>
    <input id="p" type="password" name="passphrase" autocomplete="current-password" autofocus required>
    <button type="submit">Approve</button>
  </form>
</body></html>`;
  }
}
