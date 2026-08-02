import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Zero-dependency .env loader, same shape as research-mcp/src/env-file.ts.
// Reads youtube-mcp/.env (if present) and sets KEY=value pairs into process.env
// WITHOUT overwriting vars already set in the real environment.
//
// Vars this asset reads:
//   YOUTUBE_API_KEY            — Data API v3 key (public tools). Required for 8 of 10 tools.
//   YOUTUBE_OAUTH_CLIENT_ID    — OAuth client id     (owner-only demographics tools)
//   YOUTUBE_OAUTH_CLIENT_SECRET— OAuth client secret (owner-only demographics tools)
//   YOUTUBE_OAUTH_REFRESH_TOKEN— minted by `npm run setup:oauth`
//   YOUTUBE_CHANNEL_ID         — optional; defaults to channel==MINE
//
// Runs on import — keep this the FIRST import in index.ts so credentials are set
// before anything reads process.env.
function loadEnvFile(): void {
  try {
    const here = dirname(fileURLToPath(import.meta.url)); // dist/
    const raw = readFileSync(join(here, "..", ".env"), "utf-8"); // youtube-mcp/.env
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // No .env (or unreadable). The tools each report their own missing-credential
    // state with setup instructions rather than throwing at import time — a
    // server that won't start is worse than one that explains what it needs.
  }
}

loadEnvFile();
