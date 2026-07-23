// Reads the root .env into process.env.
//
// The bridge is started by start-all.cmd, which is started by supervise.cmd at
// logon — a chain that gives it a bare Windows environment. Nothing in it has
// ever sourced .env. start-all.cmd worked around that by parsing the file for
// MCP_BRIDGE_TOKEN alone and setting that one variable, so every other setting
// server.mjs reads (MCP_BRIDGE_PORT, MCP_BRIDGE_ISSUER,
// MCP_BRIDGE_SESSION_IDLE_MS, MCP_BRIDGE_HANDSHAKE_GRACE_MS) was read from an
// environment that could never contain it. Putting any of them in .env changed
// nothing, and nothing said so.
//
// MCP_BRIDGE_PORT was the sharp one: the supervisor DOES read .env, so setting
// it moved the supervisor's probe while the bridge stayed on 8787 — a
// permanent false outage, with restarts, against a perfectly healthy bridge.
//
// Both processes now load the same file through the same parser.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Parses .env text into a plain object. Pure — no I/O, no process.env — so the
 * quoting and precedence rules are testable directly.
 *
 * Deliberately minimal, matching research-mcp/src/env-file.ts rather than
 * pulling in dotenv: KEY=value, # comments, blank lines, optional surrounding
 * quotes. No variable expansion and no multi-line values, because nothing here
 * needs them and both are quiet ways to mangle a secret.
 */
export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    // Only the FIRST "=" separates key from value. The bridge token is
    // base64url of 32 random bytes and standard base64 ends in "=" padding —
    // splitting on every "=" would silently truncate a secret.
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue; // comments, blanks, and anything malformed
    const [, key, raw] = m;
    const trimmed = raw.trim();
    // Strip one matched pair of surrounding quotes, so a value with trailing
    // spaces can be written deliberately.
    const value =
      (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
        ? trimmed.slice(1, -1)
        : trimmed;
    out[key] = value; // last occurrence wins, as every .env loader does
  }
  return out;
}

/**
 * Applies parsed values to `target`, never overwriting what is already set.
 *
 * A variable exported for a one-off run must beat the file — that is how the
 * regression suite drives these paths, and how you test a change without
 * editing config.
 */
export function applyEnv(parsed, target) {
  const applied = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (target[key] !== undefined) continue;
    target[key] = value;
    applied.push(key);
  }
  return applied;
}

/**
 * Loads <root>/.env into process.env. A missing file is not an error: every
 * setting has a default, and the one that does not (MCP_BRIDGE_TOKEN) is
 * checked by the bridge itself with a message that says what to do.
 */
export async function loadEnvFile(root, target = process.env) {
  let text;
  try {
    text = await readFile(join(root, ".env"), "utf-8");
  } catch {
    return [];
  }
  return applyEnv(parseEnv(text), target);
}
