// Watches the phone's path to the orchestrator and says something when it breaks.
//
// Replaces the old supervise.cmd loop, which called start-all.cmd every 30s and
// relied on that script's own "is it already running?" guards. Those guards
// check for a listening socket and a process name — both of which stay true for
// a component that has stopped working — so the loop happily reported health
// through an outage, and told the user nothing either way.
//
// This does two things that batch could not do well:
//   * probes for a real answer (HTTP /healthz, cloudflared /ready) instead of
//     for the existence of a process, and kills what it restarts so the
//     relaunch isn't skipped by a stale listener;
//   * delivers alerts — desktop toast, an on-disk log, and optionally a
//     webhook, which is the only channel that reaches you away from the machine.
//
// Launching stays in start-all.cmd. This file decides WHEN, never HOW: one
// place still knows the command lines, the env, and the log destinations.
//
// All decision logic lives in supervisor-logic.mjs so it can be tested without
// spawning anything. Everything in here is I/O.
import { spawn, execFile } from "node:child_process";
import { appendFile, mkdir, readFile, stat, rename } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import {
  interpretBridge,
  interpretTunnel,
  createHealthTracker,
  formatAlertLine,
  formatAlertText,
} from "./supervisor-logic.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const LOG_DIR = join(ROOT, "logs");
const LOG_FILE = join(LOG_DIR, "supervisor.log");
const ALERT_FILE = join(LOG_DIR, "alerts.log");
const MAX_LOG_BYTES = 5 * 1024 * 1024;

// ── config ────────────────────────────────────────────────────────────────
// .env is read here rather than inherited, because this process is started by
// supervise.vbs at logon with a bare environment — nothing has sourced .env for
// it. Deliberately does NOT overwrite an existing process.env value, so a var
// set for a one-off run still wins.
async function loadEnv() {
  let text;
  try {
    text = await readFile(join(ROOT, ".env"), "utf-8");
  } catch {
    return; // no .env is fine; every setting below has a default
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue; // comments and blanks
    const [, key, raw] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.trim().replace(/^["'](.*)["']$/, "$1");
  }
}
await loadEnv();

const num = (name, fallback) => Number(process.env[name] ?? fallback);

const BRIDGE_PORT = num("MCP_BRIDGE_PORT", 8787);
// Pinned, and start-all.cmd passes the matching --metrics flag. cloudflared
// picks its own metrics port when not told one, so an unpinned probe is a
// guess that silently starts failing the day the default range shifts.
const TUNNEL_METRICS_PORT = num("MCP_TUNNEL_METRICS_PORT", 20241);
const INTERVAL_MS = num("MCP_SUPERVISOR_INTERVAL_MS", 30_000);
const PROBE_TIMEOUT_MS = num("MCP_SUPERVISOR_PROBE_TIMEOUT_MS", 5_000);
// Two consecutive failures, not one: a single missed probe during a GC pause or
// a momentary network blip is not worth killing live sessions over.
const FAILURES_BEFORE_RESTART = num("MCP_SUPERVISOR_FAILURES_BEFORE_RESTART", 2);
const REPEAT_MS = num("MCP_ALERT_REPEAT_MS", 30 * 60 * 1000);
const SESSION_IDLE_MS = num("MCP_BRIDGE_SESSION_IDLE_MS", 30 * 60 * 1000);

// Optional. Without it, alerts only reach this machine — fine while you're at
// the desk, useless at 3am. See .env.example for the one-line ntfy.sh setup.
const WEBHOOK = process.env.MCP_ALERT_WEBHOOK?.trim();
const WEBHOOK_FORMAT = (process.env.MCP_ALERT_WEBHOOK_FORMAT ?? "ntfy").trim();
const TOAST_ENABLED = (process.env.MCP_ALERT_TOAST ?? "1") !== "0";

const HOST = hostname();

// ── logging ───────────────────────────────────────────────────────────────
async function rotateIfBig(file) {
  try {
    const s = await stat(file);
    if (s.size > MAX_LOG_BYTES) await rename(file, `${file}.1`);
  } catch {
    /* missing file is the normal first-run case */
  }
}

async function writeLine(file, line) {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await rotateIfBig(file);
    await appendFile(file, line + "\n", "utf-8");
  } catch (err) {
    // Never let a full disk or a locked log take down the watchdog itself.
    console.error("log write failed:", err?.message ?? err);
  }
}

function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.join(" ")}`;
  console.log(line);
  void writeLine(LOG_FILE, line);
}

// ── probes ────────────────────────────────────────────────────────────────
// Returns plain data rather than throwing, so interpretBridge/interpretTunnel
// stay pure functions over a value the tests can construct by hand.
async function probeJson(url) {
  const ac = new AbortController();
  // The timeout is the point: a wedged process accepts the connection and then
  // never writes a byte. Without a deadline this await would hang forever and
  // the supervisor would be as stuck as the thing it is watching.
  const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null; // non-JSON answer is itself a failure signal
    }
    return { reachable: true, status: res.status, body, error: null };
  } catch (err) {
    const error = err?.name === "AbortError" ? `no answer within ${PROBE_TIMEOUT_MS}ms` : (err?.cause?.code ?? err?.message ?? "unreachable");
    return { reachable: false, status: null, body: null, error };
  } finally {
    clearTimeout(timer);
  }
}

// ── alert channels ────────────────────────────────────────────────────────
// Every channel is best-effort and independently guarded: an alert failing to
// send must never stop the loop or block the restart it is announcing.

const NTFY_PRIORITY = { recovery: "default", warning: "default", error: "high", critical: "urgent" };
const NTFY_TAGS = { recovery: "white_check_mark", warning: "warning", error: "rotating_light", critical: "rotating_light" };

// A webhook POST is one packet over the open internet and it does drop: during
// testing one of three drills lost both alerts to a transient transport error
// while the toast and the log file were unaffected. For the channel whose whole
// job is to reach you when you are away from the machine, one cheap retry is
// worth more than it costs. Transport failures and 5xx are retried; a 4xx is
// not — a bad topic or a revoked webhook will fail identically forever.
const WEBHOOK_ATTEMPTS = 2;
const WEBHOOK_RETRY_MS = 1_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendWebhook(alert) {
  if (!WEBHOOK) return;
  for (let attempt = 1; attempt <= WEBHOOK_ATTEMPTS; attempt++) {
    const outcome = await attemptWebhook(alert);
    if (outcome.done) return;
    if (attempt < WEBHOOK_ATTEMPTS) {
      log(`alert webhook attempt ${attempt} failed (${outcome.reason}) - retrying`);
      await sleep(WEBHOOK_RETRY_MS);
    } else {
      log(`alert webhook failed after ${WEBHOOK_ATTEMPTS} attempts: ${outcome.reason}`);
    }
  }
}

/** @returns {{done: boolean, reason?: string}} done=true means delivered, or failed in a way retrying cannot fix. */
async function attemptWebhook(alert) {
  try {
    let init;
    if (WEBHOOK_FORMAT === "ntfy") {
      // ntfy.sh needs no account and pushes to a phone, which is why it is the
      // default shape. Title/Priority/Tags are ntfy's own headers.
      init = {
        method: "POST",
        headers: {
          Title: `[${HOST}] ${alert.title}`,
          Priority: NTFY_PRIORITY[alert.level] ?? "default",
          Tags: NTFY_TAGS[alert.level] ?? "bell",
        },
        body: alert.message,
      };
    } else {
      const text = formatAlertText(HOST, alert);
      const payload =
        WEBHOOK_FORMAT === "slack" ? { text } :
        WEBHOOK_FORMAT === "discord" ? { content: text } :
        { level: alert.level, title: alert.title, message: alert.message, host: HOST, time: new Date().toISOString() };
      init = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(WEBHOOK, { ...init, signal: ac.signal });
      if (res.ok) return { done: true };
      if (res.status >= 500) return { done: false, reason: `HTTP ${res.status}` };
      log(`alert webhook rejected the message: HTTP ${res.status} - check MCP_ALERT_WEBHOOK`);
      return { done: true };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    // undici collapses every transport failure into the message "fetch failed"
    // and hides the actual reason on err.cause. Reporting only the message means
    // the one line telling you your alerting is broken says nothing about
    // whether it was DNS, TLS, a timeout, or no route — which is exactly what
    // you need at 3am, and the only record of an alert that never arrived.
    return { done: false, reason: describeFetchError(err) };
  }
}

function describeFetchError(err) {
  if (err?.name === "AbortError") return `no response within ${PROBE_TIMEOUT_MS}ms`;
  const cause = err?.cause;
  const detail = cause?.code ?? cause?.message ?? (cause ? String(cause) : null);
  const base = err?.message ?? String(err);
  return detail ? `${base} (${detail})` : base;
}

// Title and body go through the environment, not the command line: an alert
// message contains a component name and a reason string, and quoting those into
// a PowerShell -Command safely is a bug waiting to happen.
const TOAST_PS = `
$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime] | Out-Null
$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$n = $t.GetElementsByTagName('text')
$n.Item(0).AppendChild($t.CreateTextNode($env:MCP_ALERT_TITLE)) | Out-Null
$n.Item(1).AppendChild($t.CreateTextNode($env:MCP_ALERT_BODY)) | Out-Null
$toast = [Windows.UI.Notifications.ToastNotification]::new($t)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show($toast)
`;

function sendToast(alert) {
  if (!TOAST_ENABLED) return;
  try {
    const child = execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", TOAST_PS],
      {
        env: { ...process.env, MCP_ALERT_TITLE: alert.title, MCP_ALERT_BODY: alert.message },
        timeout: 15_000,
        windowsHide: true,
      },
      (err) => { if (err) log("toast failed:", err.message.split("\n")[0]); }
    );
    child.on("error", (err) => log("toast spawn failed:", err.message));
  } catch (err) {
    log("toast failed:", err?.message ?? String(err));
  }
}

async function deliver(alert) {
  const line = formatAlertLine(new Date().toISOString(), alert);
  console.log(line);
  await writeLine(ALERT_FILE, line);
  await writeLine(LOG_FILE, line);
  sendToast(alert);
  // Deliberately not awaited. The webhook crosses the open internet and may
  // retry; the restart this alert announces must not wait on it. The log file
  // and the toast are already written by the time we get here, so a hung POST
  // costs nothing but its own delivery. Errors are logged inside.
  void sendWebhook(alert);
}

// ── recovery actions ──────────────────────────────────────────────────────
function run(cmd, args) {
  return new Promise((res) => {
    execFile(cmd, args, { windowsHide: true, timeout: 30_000 }, (err, stdout, stderr) => {
      res({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}`.trim() });
    });
  });
}

// The reason a kill is needed at all: start-all.cmd skips the bridge when
// something is listening on 8787, and a wedged bridge is still listening. Left
// alone, the relaunch is a no-op and the outage is permanent.
async function killListenerOnPort(port) {
  const { out } = await run("netstat.exe", ["-ano", "-p", "TCP"]);
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    if (!new RegExp(`:${port}\\b`).test(line)) continue;
    const pid = line.trim().split(/\s+/).pop();
    if (/^\d+$/.test(pid) && pid !== "0") pids.add(pid);
  }
  for (const pid of pids) {
    // /T because the bridge spawns one orchestrator per session and each of
    // those spawns its asset servers. Killing only the parent orphans the tree
    // — which is the leak that put 37 node processes and 2.46GB on this box.
    const r = await run("taskkill.exe", ["/PID", pid, "/T", "/F"]);
    log(`killed pid ${pid} on port ${port}: ${r.ok ? "ok" : r.out}`);
  }
  return pids.size;
}

async function killImage(image) {
  const r = await run("taskkill.exe", ["/IM", image, "/T", "/F"]);
  log(`killed ${image}: ${r.ok ? "ok" : r.out}`);
}

async function relaunch() {
  // Detached: start-all.cmd uses `start /b` for long-lived processes, and this
  // supervisor must not become their parent — if it did, restarting the
  // supervisor would take the bridge down with it.
  const child = spawn("cmd.exe", ["/c", join(HERE, "start-all.cmd")], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    cwd: ROOT,
  });
  child.unref();
}

async function restartBridge() {
  const killed = await killListenerOnPort(BRIDGE_PORT);
  log(`restarting bridge (killed ${killed} listener(s))`);
  await relaunch();
}

async function restartTunnel() {
  await killImage("cloudflared.exe");
  log("restarting cloudflared");
  await relaunch();
}

// ── loop ──────────────────────────────────────────────────────────────────
const tracker = createHealthTracker({
  failuresBeforeRestart: FAILURES_BEFORE_RESTART,
  repeatMs: REPEAT_MS,
});

const COMPONENTS = [
  {
    name: "bridge",
    probe: () => probeJson(`http://127.0.0.1:${BRIDGE_PORT}/healthz`),
    interpret: (p) => interpretBridge(p, { sessionIdleMs: SESSION_IDLE_MS }),
    restart: restartBridge,
  },
  {
    name: "cloudflared tunnel",
    probe: () => probeJson(`http://127.0.0.1:${TUNNEL_METRICS_PORT}/ready`),
    interpret: interpretTunnel,
    restart: restartTunnel,
  },
];

async function tick() {
  for (const c of COMPONENTS) {
    let verdict;
    try {
      verdict = c.interpret(await c.probe());
    } catch (err) {
      // A bug in a probe must not silence the watchdog for the other
      // component, so it is reported as that component being down.
      verdict = { state: "down", reason: `probe threw: ${err?.message ?? err}` };
    }
    const { restart, alerts } = tracker.record(c.name, verdict);
    log(`${c.name}: ${verdict.state} (${verdict.reason})`);
    for (const a of alerts) await deliver(a);
    if (restart) {
      try {
        await c.restart();
      } catch (err) {
        log(`${c.name} restart failed:`, err?.message ?? String(err));
      }
    }
  }
}

log(
  `supervisor started - bridge :${BRIDGE_PORT}, tunnel metrics :${TUNNEL_METRICS_PORT}, ` +
    `every ${INTERVAL_MS / 1000}s, restart after ${FAILURES_BEFORE_RESTART} failures, ` +
    `toast ${TOAST_ENABLED ? "on" : "off"}, webhook ${WEBHOOK ? WEBHOOK_FORMAT : "not configured"}`
);

// A crash here means no watchdog at all, so nothing is allowed to escape the
// loop. supervise.cmd relaunches the process if one does anyway.
process.on("unhandledRejection", (err) => log("unhandled rejection:", err?.message ?? String(err)));

await tick();
setInterval(() => { void tick(); }, INTERVAL_MS);
