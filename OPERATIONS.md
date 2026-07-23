# Operations

How to run, watch, diagnose, and rebuild this system. PLAYBOOK.md covers how it
is *designed*; this covers how it *runs*.

Everything here is per-user. Nothing needs administrator rights, and nothing is
installed as a Windows service.

---

## What is running

| piece | what it is | started by |
|---|---|---|
| **bridge** | HTTP server on `127.0.0.1:8787` that puts the stdio orchestrator on a port | `bridge/start-all.cmd` |
| **cloudflared** | tunnel from `mcp.johntapia.com` to the bridge | `bridge/start-all.cmd` |
| **supervisor** | probes both, restarts what is broken, raises alerts | `bridge/supervise.cmd` |
| **archive job** | daily trim of `data/cases.json` | Scheduled Task, 03:30 |
| **orchestrator** | one stdio process per consumer; the actual MCP server | spawned on demand |

The orchestrator is never started directly. Claude Desktop spawns one as a
child; the bridge spawns one per phone session and reaps it after 30 idle
minutes. Both write `data/cases.json`, which is why the cross-process lock in
`src/file-lock.ts` exists.

### The logon chain

```
Startup folder
  └─ MCP Orchestrator.lnk  ->  wscript.exe bridge\supervise.vbs
       └─ supervise.cmd  (relaunches node if it ever exits)
            └─ node bridge\supervisor.mjs   ← the watchdog
                 └─ bridge\start-all.cmd    ← only when something needs restarting
                      ├─ node bridge\server.mjs
                      └─ cloudflared tunnel run --metrics 127.0.0.1:20241 mcp
```

`supervise.vbs` exists because a shortcut set to "minimized" still flashes a
console at logon. `start-all.cmd` skips whatever is already running, so it is
safe to run by hand at any time.

---

## Is it healthy?

```sh
curl http://127.0.0.1:8787/healthz    # {"ok":true,"sessions":1,"oldestIdleMin":8,"uptime":6408}
curl http://127.0.0.1:20241/ready     # {"status":200,"readyConnections":4}
npm run health                        # every asset: up/down, tool count, build time
```

Three numbers matter:

- **`readyConnections`** — live connections to the Cloudflare edge. **Zero means
  the phone cannot reach anything**, even though `cloudflared.exe` is running.
  This is the failure that every process-existence check reports as healthy.
- **`oldestIdleMin`** — if it climbs past 30, the session reaper has stopped and
  sessions are accumulating. The supervisor alerts on this as *degraded* and
  deliberately does not restart: the bridge is still serving.
- **`uptime`** — a value that keeps resetting means something is crash-looping.

---

## Logs

| file | what |
|---|---|
| `logs/supervisor.log` | every probe, every restart decision |
| `logs/alerts.log` | only the things you were told about |
| `logs/archive.log` | each daily archive run |
| `%TEMP%\mcp-bridge.log` | the bridge's own output |
| `%TEMP%\mcp-cloudflared.log` | tunnel output |
| `%TEMP%\mcp-startup.log` | what `start-all.cmd` did or skipped |
| `%TEMP%\mcp-supervisor.log` | supervisor process starts and crashes |

`logs/` rotates at 5 MB. `%TEMP%` files do not.

**Read `logs/alerts.log` first.** It only contains transitions — a broken
component, a restart, a recovery — so it is short by construction.

---

## Alerts

Windows toast + `logs/alerts.log` always. A webhook, if configured in `.env`,
is the only channel that reaches you away from the machine — see
`.env.example`.

| when | what you get |
|---|---|
| one failed probe | nothing |
| two in a row | *"bridge is down, restarting it"* |
| still down after a restart | urgent, with the attempt count |
| still down 30 min later | one repeat, so a long outage does not go quiet |
| back up | a recovery notice |

Restarts back off (2, 4, 8, 16, 32 further failed cycles) so a component that
*cannot* start is not killed every minute forever. A blip that never reached
the alert threshold recovers silently.

The webhook crosses the open internet and can drop — one drill in three did,
while the toast and log were unaffected. It retries once. **A quiet phone is
not proof that nothing happened; the log file is the record.**

---

## Common operations

### Restart the bridge and tunnel

```sh
# The supervisor does this automatically. To force it by hand:
taskkill /F /T /PID <pid listening on 8787>
taskkill /F /IM cloudflared.exe
cmd /c "bridge\start-all.cmd"
```

Kill with `/T`. Each bridge session spawns an orchestrator, which spawns its
asset servers; killing only the parent orphans the tree. That leak once put 37
node processes and 2.46 GB on this box.

### Restart the supervisor

```sh
taskkill /F /PID <cmd.exe running supervise.cmd>
taskkill /F /PID <node.exe running supervisor.mjs>
wscript.exe "bridge\supervise.vbs"
```

Kill both — `supervise.cmd` relaunches node on exit, so killing only node
restarts it right back.

> **Do not edit a `.cmd` file while it is running.** `cmd.exe` reads batch files
> from disk by byte offset as it executes, so an edit shifts the offsets of a
> running script mid-loop. Kill it first.

### Archiving

```sh
node archive-cases.mjs --dry-run     # what would move
npm run archive                      # apply
schtasks /run /tn "MCP Archive Cases"        # trigger the daily job now
schtasks /delete /tn "MCP Archive Cases" /f  # stop it running daily
cmd /c "bridge\install-archive-task.cmd"     # register (or re-register) it
```

### Backup and restore

```sh
npm run backup                       # -> backups/<timestamp>/
```

Backs up `registry.json`, `cases.json`, `cases-archive.json`, the homebuyer and
jobhunt profiles, the saved work context, and OAuth state — keeping the last 14
runs (`--keep=`).
**It writes to the same drive by default** — that covers accidental deletion
and corruption, not drive failure. Point `MCP_BACKUP_DIR` at a cloud-synced
folder or another drive for real disaster recovery.

To restore, stop everything that writes (Claude Desktop, and the bridge), copy
the file back, then start them again. Restoring under a live writer will be
overwritten by its next save.

---

## When something is wrong

**The phone gets nothing, but the machine looks fine.**
Check `readyConnections` on `:20241/ready`. Zero means the tunnel process is
alive with no path to the edge. The supervisor treats that as down and restarts
cloudflared.

**`cases.json is empty` on startup.**
This is deliberate and it is protecting you. The store is written atomically,
so an empty file means its contents were lost — not a fresh install. Restore
from `backups/`. Do not write `[]` into it unless you genuinely mean to discard
your history.

**A batch file "runs" but does nothing.**
Check its line endings. `cmd.exe` half-executes an LF-only batch file, eating
leading characters until commands stop resolving, and reports nothing.
`.gitattributes` pins CRLF and `npm test` asserts it.

**Log files show `â€"` instead of punctuation.**
A UTF-8 character reached a log read by an ANSI viewer. Operational scripts are
asserted to print ASCII only; if you see this, something new broke that rule.

**Settings in `.env` appear to do nothing.**
For the bridge, they genuinely do — see the warning in `.env.example`. Only
`MCP_BRIDGE_TOKEN` is delivered to it today.

**Everything is up but answers are routed to the wrong specialist.**
That is not an ops problem. `npm run golden` and `npm run paraphrase` are the
gates; PLAYBOOK.md §4 covers tag hygiene.

---

## Rebuilding on a new machine

1. Install Node 18+ and `cloudflared`.
2. `git clone` the repo, then `npm run setup` (installs and builds everything).
3. `cp .env.example .env` and set `MCP_BRIDGE_TOKEN` — generate it with the
   command in that file. The bridge refuses to start without it.
4. Optionally `cp research-mcp/.env.example research-mcp/.env` and add search
   API keys. All optional; research works keyless via DuckDuckGo and Wikipedia.
5. `data/registry.json` is recreated from `data/registry.example.json` on first
   run. It is gitignored, because `AssetConfig.env` is a per-asset secret
   channel and this repo is public.
6. Point Claude Desktop at `dist/index.js`. On the Microsoft Store build the
   config is **not** at `%APPDATA%\Claude` — that path is redirected to:
   `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`
7. Put a shortcut to `wscript.exe "…\bridge\supervise.vbs"` in the Startup
   folder (`shell:startup`).
8. `cmd /c "bridge\install-archive-task.cmd"` to register the daily archive.
9. `npm run check` — must be green before you trust any of it.

---

## Restarting Claude Desktop

Desktop spawns its orchestrator once, at startup, and that child keeps running
the code it loaded then. **After any change under `src/`, Desktop keeps using
the old build until it is restarted** — the bridge does not, because it spawns
a fresh orchestrator per session.

This matters most for `src/file-lock.ts`: a Desktop still running an older
build writes `cases.json` under the older locking rules, alongside processes
using the new ones.
