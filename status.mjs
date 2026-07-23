// One-shot operational status. Answers "is it OK?" in a single screen instead
// of three curls + a process check + tailing two logs. Read-only.
//
//   Run:  npm run status
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { loadEnvFile } from "./bridge/load-env.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
await loadEnvFile(ROOT);

const BRIDGE_PORT = process.env.MCP_BRIDGE_PORT ?? "8787";
const METRICS_PORT = process.env.MCP_TUNNEL_METRICS_PORT ?? "20241";
const BACKUP_DIR = process.env.MCP_BACKUP_DIR || join(ROOT, "backups");

const ok = (b) => (b ? "OK " : "!! ");

async function getJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM"; // exists but not ours
  }
}

async function newestBackupAgeHours() {
  try {
    const entries = await readdir(BACKUP_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(e.name)).map((e) => e.name).sort();
    if (!dirs.length) return null;
    const s = await stat(join(BACKUP_DIR, dirs[dirs.length - 1]));
    return (Date.now() - s.mtimeMs) / 3_600_000;
  } catch {
    return null;
  }
}

function taskLastResult(name) {
  return new Promise((resolve) => {
    const child = spawn("schtasks", ["/query", "/tn", name, "/v", "/fo", "list"], { windowsHide: true });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", () => resolve(null));
    child.on("close", () => {
      const m = out.match(/Last Result:\s*(\S+)/i);
      resolve(m ? m[1] : null);
    });
  });
}

async function lastAlert() {
  try {
    const txt = await readFile(join(ROOT, "logs", "alerts.log"), "utf-8");
    const lines = txt.trimEnd().split(/\r?\n/);
    return lines[lines.length - 1] || "(empty)";
  } catch {
    return "(no alerts.log)";
  }
}

const [health, tunnel, backupAge, backupRes, archiveRes, alert] = await Promise.all([
  getJson(`http://127.0.0.1:${BRIDGE_PORT}/healthz?deep=1`),
  getJson(`http://127.0.0.1:${METRICS_PORT}/ready`),
  newestBackupAgeHours(),
  taskLastResult("MCP Backup Data"),
  taskLastResult("MCP Archive Cases"),
  lastAlert(),
]);

let lockPid = null;
let lockAlive = false;
try {
  lockPid = Number((await readFile(join(ROOT, "data", ".supervisor.lock"), "utf-8")).trim());
  lockAlive = Number.isFinite(lockPid) && pidAlive(lockPid);
} catch {
  /* no lock */
}

const serving = health?.serving === true || health?.ok === true;
const edge = tunnel?.readyConnections ?? 0;
const backupStale = backupAge === null || backupAge > 26; // daily job + margin

console.log(`\nMCP ORCHESTRATOR STATUS`);
console.log(`  ${ok(serving)}bridge     :${BRIDGE_PORT}  ${health ? `serving=${health.serving ?? health.ok}, sessions=${health.sessions ?? "?"}, uptime=${Math.round((health.uptime ?? 0) / 60)}m` : "NO RESPONSE"}`);
console.log(`  ${ok(edge > 0)}tunnel     metrics :${METRICS_PORT}  readyConnections=${edge}`);
console.log(`  ${ok(lockAlive)}supervisor lock pid=${lockPid ?? "none"} ${lockAlive ? "(alive)" : "(NOT running)"}`);
console.log(`  ${ok(!backupStale)}backup     newest=${backupAge === null ? "NONE" : backupAge.toFixed(1) + "h ago"}  (task LastResult=${backupRes ?? "?"})`);
console.log(`  ${ok(archiveRes === "0")}archive    task LastResult=${archiveRes ?? "?"}`);
console.log(`  --  last alert: ${alert}`);

const allGood = serving && edge > 0 && lockAlive && !backupStale;
console.log(`\n  ${allGood ? "ALL GREEN" : "ATTENTION NEEDED — see !! lines above"}\n`);
process.exit(allGood ? 0 : 1);
