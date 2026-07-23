# Multi-MCP System Playbook

How to reproduce this whole system on a new collection / project / topic set.
Hand this file (plus one existing asset folder as a template) to a fresh session
and say: **"Build a multi-MCP system like this playbook. Here are the specialists
I want: …"** — then follow the loop below, one asset at a time.

---

## 0. What it is (the "show what it does" part)

One **orchestrator** MCP is the single front door. You ask it any question; it
**routes** to the right specialist **asset** MCP(s), runs a **case** (a logged
objective), and can **merge** their results. Around that: a **research** asset
that verifies live facts, an **overseer** asset that watches everything, and
**self-verifying quality gates** so nothing ships broken.

```
                 ┌─────────────┐
   you  ─────▶   │ orchestrator│  routes by tag/keyword, runs a case
                 └──────┬──────┘
        ┌───────────┬───┴────┬───────────┬──────────┐
     [asset A]  [asset B]  [research]  [ …assets ]  [overseer]
     specialist specialist verify-loop            observability
```

## 1. The architecture (fixed parts — reuse as-is)

- **orchestrator** — routing (`open_case`), tasking (`task_asset`), `synthesize_case`,
  `health_check`, `outcome` tracking, and the case store. Reuse this whole package
  unchanged; you only add assets.
- **research** — multi-provider web search + page fetch + corroborated dossiers.
  Mark it `fallback: true`. Every asset routes live/current facts here to verify.
- **overseer** — read-only observability over the case store (replay, audit, drift,
  errors, outcomes, latency). Portable; reuse unchanged.
- **assets** — one MCP per domain. This is the only part you write per collection.

## 2. The asset template (copy this per new specialist)

Each asset is a small stdio MCP with this shape:

```
<name>-mcp/
  package.json     # name, "type":"module", build:"tsc", deps: @modelcontextprotocol/sdk + zod
  tsconfig.json    # copy from any existing asset
  .gitignore       # node_modules/ dist/ *.log  (+ .env if it holds keys)
  src/
    index.ts       # McpServer + one registerTool() per tool; thin wrappers
    <domain>.ts    # the CONTENT: a MAP of entries + a resolve<X>() reverse index + render fns
    (reference-store.ts + data/*.json)   # OPTIONAL: for the verify loop
```

**The content pattern (`<domain>.ts`):**
```ts
export const ENTRIES = {
  some_key: { label, keys: [...routing words...], /* fields */ },
  ...
};
// reverse index: key + label + every keyword -> the entry
const INDEX = {}; for (const [k,e] of Object.entries(ENTRIES)) {
  INDEX[norm(k)] = k; INDEX[norm(e.label)] = k; for (const w of e.keys) INDEX[norm(w)] = k;
}
export function resolveX(input) { /* exact match, then substring for len>=3 */ }
export function explainX(input?) { /* BOTTOM LINE first, then the detail */ }
```

## 3. The repeatable loop (do this once per asset)

1. **Scaffold** — copy the 5 shared infra files + tsconfig/.gitignore from an
   existing asset; write `package.json`.
2. **Write** the domain map + tools (`<domain>.ts` + `index.ts`).
3. **Build** — `npm install && npm run build`.
4. **Recruit** — `recruit_asset(name, description, tags, "stdio", "node", ["<name>-mcp/dist/index.js"], cwd)`.
   Tags are the routing signal — see §4.
5. **Gate-check** — run `golden` + `paraphrase`. Fix any tag collision the gates
   surface (this is where most bugs are — trust the gates).
6. **Smoke test** one tool live through the orchestrator.
7. **Cover it** — add the asset's `resolveX`/render fns to `regression.mjs`
   (auto-derived key coverage + a render smoke). Then `npm run check` must be green.
8. **Record** one line in the project memory.

## 4. Tag hygiene (the #1 thing that breaks routing)

- Tags must be **distinctive to the domain**, never generic words. Banned magnets
  we learned the hard way: `how`, `work`, `money`, `world`, `material`, bare country
  names, `pitch`, `training`. They grab unrelated questions.
- Watch **cross-asset collisions** — if two assets both claim a word, decide who
  owns it and drop it from the other (e.g. education owns `class`, curiosity owns
  the bare science topics; linguistics owns `language`, not `english`).
- Remember **stemming**: a plural tag (`materials`) also matches the singular
  (`material`) — so a homonym can sneak back in.
- **Let the gates find these.** Add golden/paraphrase entries for the new asset;
  a dip in the number or a hard miss *is* the collision, named.

## 5. The conventions that make answers good

- **BOTTOM LINE first** — every tool leads with the one-sentence answer.
- **Honesty backbone** — separate fact from myth, grade evidence honestly, and
  **defer what you shouldn't answer** (medical → a doctor, legal → a lawyer,
  spiritual → the person's own teachers). Never fake confidence.
- **Verify live facts (the self-verifying loop)** — anything current (prices, rules,
  stats) is stored with a `verify_url` and routed to `research` to confirm; write-backs
  are **flag-only** (`confirm:true` required) so nothing silently rewrites itself. This
  loop is now a **standing convention**, not ad-hoc: the orchestrator hands every client
  a verify-loop protocol via the MCP `instructions` channel (`ORCHESTRATOR_INSTRUCTIONS`
  in `src/index.ts`). After any asset answers with a checkable/current fact, the client
  runs the maker≠checker loop — the asset's own `check_X`→`X_verdict` two-step, or
  `research` — and labels the answer **VERIFIED / UPDATED / UNVERIFIED**. The orchestrator
  has no LLM, so the *client* (Desktop/Cowork/Code) is the checker; the instructions are
  what make it always close the loop. Takes effect on the next full app relaunch (server
  instructions are read at connect).
- **Fail safe** — if routing is unsure, it falls through to `research`, never to a
  confidently-wrong specialist.

## 6. The quality gates (one command: `npm run check`)

- **`regression.mjs`** — pure-logic unit checks; MUST be 100%. Includes an
  auto-derived test that every asset keyword resolves to its own entry (this alone
  caught real in-asset collisions), plus a render smoke for every tool.
- **`golden.mjs`** — routing **accuracy** against ~2 intent-labeled questions per
  asset. Gated at a baseline; the sweep confirms the thresholds.
- **`paraphrase.mjs`** — routing **robustness** to natural rephrasing. Gated on
  *hard misses* (wrong specialist), not perfection — soft misses to research are OK.
- **`health_check`** (orchestrator tool) — every asset reachable + not stale.
- **`bootstrap.mjs`** (`npm run setup`) — install + build every package on a fresh
  machine. **Keep its package list in sync when you add an asset.**

## 7. Commands

```sh
npm run setup      # fresh machine: install + build everything
npm run check      # the gate: regression + golden + paraphrase
npm run health     # liveness + staleness of all assets
npm run build:all  # rebuild orchestrator + all assets regression touches
```

## 8. Wiring into Claude Desktop / Cowork

Only the **orchestrator** goes in `claude_desktop_config.json` (`mcpServers`).
Assets are *not* listed there — they're recruited into the orchestrator's
`registry.json`, so **recruiting = wiring**. Cowork shares the same config.
After changes, **fully quit + relaunch** the app (the orchestrator process must
respawn), then `health_check` to confirm.

## 9. Kickoff prompt to paste into a new collection

> I'm building a multi-MCP system per the attached PLAYBOOK.md. Reuse the
> orchestrator, research, and overseer packages unchanged. Build me these
> specialist assets, one at a time, following the loop in §3 and the tag hygiene
> in §4: **[list your domains]**. For each: scaffold from the template, write the
> domain map + tools with a BOTTOM-LINE-first honesty backbone, recruit it,
> gate-check with golden/paraphrase, smoke-test one tool, add regression
> coverage, and keep `npm run check` green. Verify with `health_check` at the end.

## 10. Monitoring & alerts

`bridge/supervisor.mjs` watches the phone's path to the orchestrator. It is
started at logon by `supervise.vbs` → `supervise.cmd`, probes every 30s, and
restarts what it finds broken.

**It probes for an answer, not for a process.** A wedged bridge still holds its
listening socket and a cloudflared with zero edge connections is still a running
executable — both pass a `netstat`/`tasklist` check throughout a total outage.

| component | probe | down when |
|---|---|---|
| bridge | `GET 127.0.0.1:8787/healthz` | no answer in 5s, non-200, or `ok !== true` |
| cloudflared | `GET 127.0.0.1:20241/ready` | no answer, or `readyConnections < 1` |

`--metrics 127.0.0.1:20241` is pinned in `start-all.cmd` — unset, cloudflared
picks its own port and the probe becomes a guess.

**Escalation.** Two consecutive failures before any restart (one blip is not
worth dropping live sessions). Then backoff — 2, 4, 8, 16, 32 further failed
cycles between retries — so a component that *cannot* start isn't killed every
60s forever. Alerts fire on transition, on each restart, and every 30 min while
still broken; a recovery notice closes it out. A blip that never reached the
alert threshold recovers silently.

**Degraded** is a third state: answering, but `oldestIdleMin` has passed twice
the reap TTL, meaning the session reaper has stopped. It alerts and never
restarts — killing a bridge that is still serving would cost more than the leak.

**Where alerts go.** Windows toast + `logs/alerts.log`, always — both are local
and effectively cannot fail. The webhook crosses the open internet and can:
one drill in three lost both alerts to a transient transport error, so it gets
one retry (transport errors and 5xx only — a 4xx means a bad URL and will fail
identically forever). It is never awaited, so a slow POST cannot delay the
restart it is announcing, and a failure to deliver is itself logged.

Toast only reaches you at the machine; for anywhere else add a webhook to `.env`:

```sh
# ntfy.sh needs no account — pick an unguessable topic and subscribe on your phone
MCP_ALERT_WEBHOOK=https://ntfy.sh/<your-unguessable-topic>
MCP_ALERT_WEBHOOK_FORMAT=ntfy        # or: slack | discord | json
MCP_ALERT_TOAST=0                    # optional: silence desktop toasts
```

Other knobs: `MCP_SUPERVISOR_INTERVAL_MS`, `MCP_SUPERVISOR_PROBE_TIMEOUT_MS`,
`MCP_SUPERVISOR_FAILURES_BEFORE_RESTART`, `MCP_ALERT_REPEAT_MS`,
`MCP_TUNNEL_METRICS_PORT`.

**Windows scripts must be CRLF.** `cmd.exe` does not reject an LF-only batch
file — it half-executes it, eating leading characters until commands stop
resolving. `start-all.cmd` hit this: its "already listening?" guard silently
evaluated as failed, it logged `starting bridge`, started nothing, and never
reached the cloudflared half. `.gitattributes` pins `eol=crlf` and
`regression.mjs` asserts it, because that governs what git writes but not what
an in-place edit leaves behind.

---

*The pattern is domain-agnostic: swap the specialists and it works for anything —
a company knowledge base, a support system, a research desk, a personal-life
advisor. The orchestrator, the gates, and the loop stay the same.*
