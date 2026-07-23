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
import { appendFile, mkdir, stat, rename } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
// For the hourly asset-fleet check: spawn a throwaway orchestrator and call its
// health_check, which connects to every registered asset.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  interpretBridge,
  interpretTunnel,
  createHealthTracker,
  formatAlertLine,
  formatAlertText,
} from "./supervisor-logic.mjs";
import { loadEnvFile } from "./load-env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const LOG_DIR = join(ROOT, "logs");
const LOG_FILE = join(LOG_DIR, "supervisor.log");
const ALERT_FILE = join(LOG_DIR, "alerts.log");
const MAX_LOG_BYTES = 5 * 1024 * 1024;

// ── config ────────────────────────────────────────────────────────────────
// .env is read here rather than inherited, because this process is started by
// supervise.vbs at logon with a bare environment. Shared with the bridge so
// both agree on what a setting means — they disagreeing about MCP_BRIDGE_PORT
// is precisely how a healthy bridge gets probed on the wrong port and
// restarted forever. See load-env.mjs.
await loadEnvFile(ROOT);

const num = (name, fallback) => Number(process.env[name] ?? fallback);

const BRIDGE_PORT = num("MCP_BRIDGE_PORT", 8787);
// Pinned, and start-all.cmd passes the matching --metrics flag. cloudflared
// picks its own metrics port when not told one, so an unpinned probe is a
// guess that silently starts failing the day the default range shifts.
const TUNNEL_METRICS_PORT = num("MCP_TUNNEL_METRICS_PORT", 20241);
const INTERVAL_MS = num("MCP_SUPERVISOR_INTERVAL_MS", 30_000);
// 15s, not 5s: the bridge's deep /healthz probe spawns a throwaway orchestrator
// (~12s cold) to prove it can actually serve. The bridge caches that for 20s so
// most polls are instant, but the first poll after a restart pays full price
// and must not be cut off — a false timeout there would trigger a needless
// restart of a bridge that is actually fine.
const PROBE_TIMEOUT_MS = num("MCP_SUPERVISOR_PROBE_TIMEOUT_MS", 15_000);
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

// How long to give start-all.cmd to finish. It only has to spawn two detached
// processes, so seconds is generous; anything longer means it is wedged.
const RELAUNCH_TIMEOUT_MS = 30_000;
// How long to wait after a relaunch before checking whether it actually worked.
// The bridge binds its port in well under this.
const RELAUNCH_VERIFY_MS = 10_000;

/**
 * Runs start-all.cmd and WAITS for it, rather than firing and forgetting.
 *
 * The fire-and-forget version cost three hours of downtime: start-all.cmd
 * wedged on a `netstat | findstr` pipeline (a detached cmd.exe has no stdin, so
 * findstr never sees EOF), and 15 consecutive restarts each spawned a new hung
 * process while the supervisor logged "restarting" and reported success. The
 * pipeline is gone, but a relaunch that silently does nothing must never again
 * be indistinguishable from one that works.
 *
 * Still detached — start-all.cmd uses `start /b` for the long-lived processes
 * and this supervisor must not become their parent, or restarting the
 * supervisor would take the bridge down with it. Detaching the process group is
 * separate from waiting for the launcher script to exit.
 */
function relaunch(args = []) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const child = spawn("cmd.exe", ["/c", join(HERE, "start-all.cmd"), ...args], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      cwd: ROOT,
    });
    child.unref();

    const timer = setTimeout(() => {
      // The launcher itself is stuck. Say so loudly — this is the failure that
      // hid behind "restarting" 15 times.
      done({ ok: false, reason: `start-all.cmd did not exit within ${RELAUNCH_TIMEOUT_MS}ms (launcher wedged)` });
    }, RELAUNCH_TIMEOUT_MS);

    child.on("error", (err) => done({ ok: false, reason: `could not spawn start-all.cmd: ${err.message}` }));
    child.on("exit", (code) =>
      done(code === 0 ? { ok: true } : { ok: false, reason: `start-all.cmd exited ${code}` })
    );
  });
}

/**
 * Relaunch, then PROVE it worked by re-probing. Without this the supervisor can
 * only report what it attempted, never what it achieved.
 */
async function relaunchAndVerify(component, args, probe) {
  const launch = await relaunch(args);
  if (!launch.ok) {
    log(`RESTART-INEFFECTIVE ${component}: ${launch.reason}`);
    return { ok: false, reason: launch.reason };
  }
  await new Promise((r) => setTimeout(r, RELAUNCH_VERIFY_MS));
  const probed = await probe();
  const ok = probed?.ok === true;
  log(
    ok
      ? `${component}: relaunch verified (responding after restart)`
      : `RESTART-INEFFECTIVE ${component}: still not responding ${RELAUNCH_VERIFY_MS}ms after a clean relaunch`
  );
  return ok ? { ok: true } : { ok: false, reason: "still not responding after a clean relaunch" };
}

async function restartBridge() {
  const killed = await killListenerOnPort(BRIDGE_PORT);
  log(`restarting bridge (killed ${killed} listener(s))`);
  // --force-bridge: the listener was just killed, so the port is free and the
  // script must not re-derive that for itself.
  return relaunchAndVerify("bridge", ["--force-bridge"], () =>
    probeJson(`http://127.0.0.1:${BRIDGE_PORT}/healthz`)
  );
}

async function restartTunnel() {
  await killImage("cloudflared.exe");
  log("restarting cloudflared");
  return relaunchAndVerify("cloudflared tunnel", ["--force-tunnel"], () =>
    probeJson(`http://127.0.0.1:${TUNNEL_METRICS_PORT}/ready`)
  );
}

// ── loop ──────────────────────────────────────────────────────────────────
const tracker = createHealthTracker({
  failuresBeforeRestart: FAILURES_BEFORE_RESTART,
  repeatMs: REPEAT_MS,
});

const COMPONENTS = [
  {
    name: "bridge",
    // deep=1 so the probe verifies the ORCHESTRATOR can serve, not just that
    // the port is open. A broken build answers a shallow /healthz with ok:true
    // forever; the deep probe returns 503, which interpretBridge already reads
    // as DOWN and restarts. The 15s probe timeout in probeJson covers the ~12s
    // orchestrator spawn, and the bridge caches the result for 20s so this
    // 30s-interval poll almost always hits a warm answer.
    probe: () => probeJson(`http://127.0.0.1:${BRIDGE_PORT}/healthz?deep=1`),
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
        const outcome = await c.restart();
        // A restart that changed nothing is a DIFFERENT failure from the
        // service being down, and it needs its own alert — otherwise the
        // repeat-alert schedule just keeps saying "still down, restarting
        // again" while the restart mechanism itself is broken. That is exactly
        // how a three-hour outage produced 15 identical alerts and no clue.
        if (outcome && outcome.ok === false) {
          await deliver({
            level: "CRITICAL",
            title: `${c.name} restart is not working`,
            message:
              `Restarted ${c.name} but it did not come back: ${outcome.reason}. ` +
              `The recovery mechanism itself needs attention - repeated restarts will not fix this.`,
          });
        }
      } catch (err) {
        log(`${c.name} restart failed:`, err?.message ?? String(err));
      }
    }
  }
}

// ── asset-fleet check ──────────────────────────────────────────────────────
// Nothing watched the 22 asset servers. The bridge and tunnel had a watchdog;
// a broken asset build was invisible until a user's question hit it. This runs
// the orchestrator's own health_check — which connects to every registered
// asset — on a slow interval and alerts on any DOWN. Slow (hourly) because it
// spawns the whole fleet; the deep bridge probe already covers the fast path.
const ASSET_CHECK_INTERVAL_MS = num("MCP_SUPERVISOR_ASSET_CHECK_MS", 60 * 60 * 1000);
const ASSET_CHECK_TIMEOUT_MS = 60_000;
let lastAssetVerdict = null;

async function checkAssets() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(ROOT, "dist/index.js")],
    cwd: ROOT,
    stderr: "ignore",
  });
  const client = new Client({ name: "supervisor-asset-check", version: "0.1.0" });
  const timer = setTimeout(() => client.close().catch(() => {}), ASSET_CHECK_TIMEOUT_MS);
  try {
    await client.connect(transport);
    const res = await client.callTool({ name: "health_check", arguments: {} });
    const text = res?.content?.[0]?.text ?? "";
    const m = text.match(/(\d+)\/(\d+) reachable/);
    const downLine = text.split("\n").find((l) => /reachable/.test(l)) ?? "health_check ran";
    if (!m) {
      return { ok: false, reason: `health_check gave no reachable count: ${text.slice(0, 120)}` };
    }
    const [, up, total] = m.map(Number);
    // Name the DOWN assets so the alert is actionable, not just a count.
    const down = text
      .split("\n")
      .filter((l) => /:\s*DOWN/.test(l))
      .map((l) => l.trim().split(/[:\s]/)[0]);
    return up === total
      ? { ok: true, reason: downLine.trim() }
      : { ok: false, reason: `${up}/${total} assets reachable - DOWN: ${down.join(", ") || "unknown"}` };
  } catch (err) {
    return { ok: false, reason: `asset check failed to run: ${err?.message ?? err}` };
  } finally {
    clearTimeout(timer);
    await client.close().catch(() => {});
  }
}

async function assetTick() {
  const verdict = await checkAssets();
  log(`assets: ${verdict.ok ? "ok" : "DEGRADED"} (${verdict.reason})`);
  // Edge-triggered: alert when the fleet BECOMES unhealthy, and once more when
  // it recovers — not every hour it stays down (that is what the log is for).
  const was = lastAssetVerdict;
  lastAssetVerdict = verdict.ok;
  if (!verdict.ok && was !== false) {
    await deliver({ level: "CRITICAL", title: "asset(s) down", message: verdict.reason });
  } else if (verdict.ok && was === false) {
    await deliver({ level: "RECOVERY", title: "assets recovered", message: verdict.reason });
  }
}

// Single-instance guard. Two supervisors both killing-and-restarting the
// bridge fight each other — the logs show this has happened (two "restarting
// bridge" lines 4s apart against a 30s interval). A lock file carrying the
// live PID lets a second launch bow out instead of doubling the watchdog.
// A lock whose PID is no longer alive is stale (a hard-killed supervisor never
// cleans up) and is reclaimed.
const LOCK_FILE = join(HERE, "..", "data", ".supervisor.lock");
function pidAlive(pid) {
  try {
    process.kill(pid, 0); // signal 0 tests existence without killing
    return true;
  } catch (err) {
    return err.code === "EPERM"; // exists but not ours to signal
  }
}
try {
  if (existsSync(LOCK_FILE)) {
    const held = Number(readFileSync(LOCK_FILE, "utf-8").trim());
    if (held && held !== process.pid && pidAlive(held)) {
      log(`another supervisor is already running (pid ${held}) - exiting so two watchdogs do not fight`);
      process.exit(0);
    }
    log(`reclaiming stale supervisor lock (pid ${held} not alive)`);
  }
  writeFileSync(LOCK_FILE, String(process.pid));
  const releaseLock = () => {
    try {
      if (Number(readFileSync(LOCK_FILE, "utf-8").trim()) === process.pid) unlinkSync(LOCK_FILE);
    } catch {}
  };
  process.on("exit", releaseLock);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
} catch (err) {
  // A lock we cannot manage must not stop the watchdog from running — better a
  // possible double than no supervision at all.
  log(`supervisor lock unavailable (${err?.message ?? err}) - continuing without it`);
}

log(
  `supervisor started - bridge :${BRIDGE_PORT}, tunnel metrics :${TUNNEL_METRICS_PORT}, ` +
    `every ${INTERVAL_MS / 1000}s, restart after ${FAILURES_BEFORE_RESTART} failures, ` +
    `asset check every ${Math.round(ASSET_CHECK_INTERVAL_MS / 60000)}min, ` +
    `toast ${TOAST_ENABLED ? "on" : "off"}, webhook ${WEBHOOK ? WEBHOOK_FORMAT : "not configured"}`
);

// A crash here means no watchdog at all, so nothing is allowed to escape the
// loop. supervise.cmd relaunches the process if one does anyway.
process.on("unhandledRejection", (err) => log("unhandled rejection:", err?.message ?? String(err)));

await tick();
setInterval(() => { void tick(); }, INTERVAL_MS);

// The asset fleet on its own slow cadence, offset so it never coincides with a
// bridge/tunnel tick. First run is delayed so startup isn't a spawn storm.
setTimeout(() => {
  void assetTick();
  setInterval(() => { void assetTick(); }, ASSET_CHECK_INTERVAL_MS);
}, 90_000).unref();
