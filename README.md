# Orchestrator MCP

An "AI Orchestrator" MCP server: it doesn't do any work itself, it **recruits**
other MCP servers as **assets**, **tasks** them against a **case** (an
objective), and compiles what comes back into a **report**. Think of it as an
analyst desk, not a field agent — the actual work (files, search, whatever)
still happens in the sub-MCP servers you register.

This is the first piece of a larger multi-purpose MCP system: everything else
you build later plugs in as an asset instead of being wired directly into
whatever client you're using.

Assets in this repo so far:

- [research-mcp](research-mcp/README.md) — multi-provider web research
  (DuckDuckGo/Wikipedia out of the box; Brave/Tavily/Google via API keys),
  page fetching, and solution-oriented research dossiers. Recruited as the
  `research` asset.
- [homebuyer-mcp](homebuyer-mcp/README.md) — California first-time home-buyer
  advisor: explainers + transparent calculators + research-verifiable live
  reference data (rates, loan limits, programs, prices). Recruited as the
  `homebuyer` asset. Cross-checks its live numbers against sources via
  `research` — the "two-for-one" verification loop.
- [nestegg-mcp](nestegg-mcp/README.md) — investing education in kid-simple
  words: every vehicle with honest odds, the order-of-operations ladder
  (step-by-step), tax rules, insider reads, money-trap red flags, calculators,
  and a stock/crypto signal-analysis engine (SEC EDGAR + research). Recruited
  as the `nestegg` asset; same research-verified reference loop.
- [lawguide-mcp](lawguide-mcp/README.md) — California + federal legal
  information: know-your-rights, which-arena, how-a-lawyer-would-handle-it
  playbooks, the players' mindsets, red-flag traps, and a live CA legal-resource
  finder. Recruited as the `lawguide` asset. Information + resources, never
  legal advice; always routes serious matters to a licensed lawyer.
- [jobhunt-mcp](jobhunt-mcp/README.md) — California job-search coaching:
  career discovery + pathways (what fits you / how to get from A to B), the
  hiring funnel + beat-the-ATS, resume/interview, how recruiters think, the
  "why am I stuck?" diagnostic, salary negotiation, and CA living-wage/market
  data (research-verified). Recruited as the `jobhunt` asset.
- [polymath-mcp](polymath-mcp/README.md) — technical-domain expertise across
  AI engineering/ops, data & BI, cloud/infra, security/trust/forensics,
  systems support, and leadership/delivery (~35 titles → 6 practice families):
  build_it/finalize_build for projects, level_up for climbing toward a target
  role, how_its_done for regional differences. Recruited as the `polymath`
  asset; every current fact routes through the research verify loop.
- [healthguide-mcp](healthguide-mcp/README.md) — health information and
  navigation: a non-suppressible emergency/crisis override (911/988) on every
  tool, specialist routing (incl. family/marriage counseling), SOCRATES-style
  root-cause questions, multi-country research-verified evidence-checking for
  health/nutrition claims, macronutrient/insulin/training science, and a
  crisis-gated hope tool. Recruited as the `healthguide` asset. Information
  and navigation only — never diagnosis or treatment.
- [overseer-mcp](overseer-mcp/README.md) — observability over the orchestrator's
  own case store: `replay_case` (one case's full timeline), `audit_report`
  (calls/errors per asset), `detect_drift` (routing changed over time),
  `analyze_errors`, `detect_answer_drift`, `outcome_report` (resolution rate
  from case outcomes), and `latency_report`. Reads any orchestrator's
  `cases.json` by path, so it's not tied to this deployment. Recruited as the
  `overseer` asset.
- [curiosity-mcp](curiosity-mcp) — science & curiosity across physics/quantum,
  space, biology, earth, chemistry/materials, ancient history, great scientific
  minds, and computing/AI, with a rigorous `check_claim` → `claim_verdict` loop
  that separates real science from pseudoscience. Recruited as `curiosity`.
- [education-mcp](education-mcp) — general education (high school → university):
  every subject and its classes, the course ladders, study skills, and
  graduation/degree requirements. Recruited as `education`.
- [communication-mcp](communication-mcp) — how to speak in public/at work/at
  home, debate & persuade, steelman the other side, spot fallacies, and read
  people honestly (no lie-detector myths). Recruited as `communication`.
- [sports-mcp](sports-mcp) — sports centered on soccer: how the game works and
  how talent is really identified (the four-corners scouting model). Recruited
  as `sports`.
- [government-mcp](government-mcp) — world governments and immigration/visas/work
  permits by region (US, Europe, Middle East, Japan, Russia, South America).
  General info, not legal advice. Recruited as `government`.
- [linguistics-mcp](linguistics-mcp) — the world's languages: families, how
  language works, and how to learn one. Recruited as `linguistics`.
- [faiths-mcp](faiths-mcp) — world religions explained neutrally (Christianity,
  Islam, Judaism incl. Kabbalah, Buddhism, Hinduism, Sikhism, and more).
  Recruited as `faiths`.
- [loop-mcp](loop-mcp) — Loop Engineering: how to design, build, debug, and
  honestly evaluate agentic AI loops. Two layers: the loop PATTERNS
  (`explain_pattern`, `design_loop` — ReAct, plan-and-execute, reflexion,
  tool-use, RAG, multi-agent, evaluator-optimizer, human-in-the-loop,
  memory/state) and the INFRASTRUCTURE that makes a loop autonomous
  (`building_blocks` — Connectors/MCP collection, Automations, Skills,
  Subagents/maker≠checker, Memory, Worktrees — and `model_requirements`).
  `debug_loop` diagnoses runaway/thrashing/drifting loops, `eval_loop` teaches
  consistency ≠ correctness, `myth_vs_reality` debunks the folklore, and
  `check_practice` → `practice_verdict` verify fast-moving specifics via
  research. Recruited as `loop`.

## Concepts

| Term | Meaning |
|---|---|
| Asset | A registered MCP server this orchestrator can connect to and call tools on. |
| Recruit / retire | Register a new asset / stop considering it for new work. |
| Case | An objective, plus the assets assigned to work it and a log of every call made. |
| Task | A single tool call made against an asset, recorded in a case's log. |
| Report | The compiled dossier for a case: objective, assigned assets, full tasking log. |

## Setup

Requires Node.js 18+.

**Fresh machine (one command):**

```sh
npm run setup    # install + build the orchestrator and all 8 asset packages
```

**Just the orchestrator:**

```sh
npm install
npm run build
```

This produces `dist/index.js`, a stdio MCP server. After wiring it into a
client (below) and restarting, run `npm run health` to confirm every asset is
reachable and current.

## Development commands

| Command | Purpose |
|---|---|
| `npm run setup` | Install + build every package (fresh-machine bootstrap) |
| `npm run build:all` | Rebuild orchestrator + polymath + overseer |
| `npm run check` | Full quality gate: regression + routing accuracy + paraphrase safety |
| `npm run verify` | Rebuild + regression (consistency invariants) |
| `npm run golden` | Routing-accuracy measurement against the labeled golden set |
| `npm run paraphrase` | Natural-phrasing robustness + fail-safe check |
| `npm run health` | Live liveness/staleness probe of all assets |

Run `npm run check` after any code change. Code changes to a running asset need
that asset (or the whole app) restarted to take effect — `npm run health` flags
anything **STALE** (built after the orchestrator process started).

## Wiring it into an MCP client

Add it as a server pointing at the built entrypoint, e.g. in a
`claude_desktop_config.json` / Claude Code MCP config:

```json
{
  "mcpServers": {
    "orchestrator": {
      "command": "node",
      "args": ["D:/John MCP/dist/index.js"]
    }
  }
}
```

## Tools

- `recruit_asset(name, description, tags, transport, command/args/cwd/env | url, fallback?)` —
  register a new asset. `transport: "stdio"` spawns a local process (like most
  MCP servers); `transport: "http"` connects to a URL. Set `fallback: true` to
  make it a first-line responder for unmatched/question objectives (see
  Routing below). Re-recruiting under a name that belongs to a *retired* asset
  replaces it; re-recruiting an *active* name is rejected (use `update_asset`
  instead).
- `update_asset(name, description?, tags?, transport?, command?/args?/cwd?/env?/url?, fallback?, reactivate?)` —
  edit an asset's config in place, toggle `fallback`, or set `reactivate: true`
  to bring a retired asset back. Drops any live connection so the next call
  reconnects with the new config.
- `list_assets(status?, query?, verbose?)` — list assets, one condensed line
  each (full description + tags only with `verbose: true`). Defaults to active
  assets; pass `status: "all"` to include retired ones, or `query` to filter
  by name/description/tag substring.
- `debrief_asset(name)` — connect to an asset and list the tools it exposes.
- `retire_asset(name)` — stop routing work to an asset and disconnect it.
- `open_case(objective, preferred_assets?)` — open a case. Without
  `preferred_assets`, routing scores each active asset by token overlap
  between the objective and the asset's name/description/tags (tag matches
  count 3x, name matches 2x, description matches 1x — tags are the
  deliberate routing signal), and assigns the top 3 matches. Grammatical
  stopwords ("the", "a", "for", ...) are filtered so they can't cause a
  false-positive match. `preferred_assets` must all be active or the call
  is rejected.
- `assign_asset(case_id, asset)` — add an active asset to an already-open
  case after the fact, e.g. when auto-routing found nothing.
- `task_asset(case_id, asset, tool, arguments?)` — call a tool on an asset
  assigned to the case; result or error is appended to the case log. Rejects
  calls against a closed case. The asset's own content blocks (text, images,
  embedded resources) are forwarded as-is rather than re-encoded as JSON
  text, so nothing but a small prefix line is added.
- `case_report(case_id)` — compile the full dossier for a case.
- `list_cases(status?, query?, limit?)` — list cases, most recent first.
  Defaults to the 20 most recent across all statuses; pass `status`/`query` to
  narrow, or a higher `limit` (max 200) to look further back.
- `close_case(case_id, summary?, outcome?)` — close a case with an optional
  summary and an optional `outcome` (`resolved` / `partial` / `unresolved` /
  `misrouted`) — the feedback signal `overseer`'s `outcome_report` aggregates
  into a quality read. Once closed, `task_asset` against it is rejected.
- `health_check()` — Platform liveness/staleness probe: connects to every
  active asset and reports whether it's reachable, its tool count and version,
  and whether its built code is **stale** (rebuilt after this orchestrator
  started, so a restart is needed to load it).

## Example flow

```
recruit_asset({
  name: "filesystem",
  description: "Read and write local files",
  tags: ["files", "filesystem", "read", "write"],
  transport: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "D:/John MCP"]
})

open_case({ objective: "find every TODO comment in the project files" })
// -> routes to "filesystem" based on tag overlap

task_asset({ case_id: "...", asset: "filesystem", tool: "search_files", arguments: { pattern: "TODO" } })

case_report({ case_id: "..." })
```

## Data

Assets and cases persist as JSON under `data/` (`registry.json`,
`cases.json`) so state survives restarts. Writes go through an in-process
mutex per file ([src/file-lock.ts](src/file-lock.ts)) so concurrent tool
calls (e.g. tasking several assets at once) can't silently clobber each
other's updates, and are written atomically (temp file + rename) so a crash
mid-write can't corrupt the store. This only protects against races within
one running server process — it is not a cross-process or cross-machine
lock.

**Security notes:**

- `recruit_asset` lets any caller with access to this server spawn an
  arbitrary local command with arbitrary arguments/env, or point at an
  arbitrary URL. There is no sandboxing or allowlist. Treat access to this
  server as equivalent to local code execution — don't expose it to anything
  you wouldn't already trust with a shell.
- Anything you pass as an asset's `env` (API keys etc.), plus tool arguments
  and result previews, is persisted **in plaintext** in `data/*.json` and
  stays there even after the asset is retired. Don't put secrets there that
  you wouldn't store in a plain config file, and remember this directory
  when backing up or syncing.
- Task results persisted to the case log are capped at 8 KB per entry
  (marked `truncated: true` with a preview when over); the live tool
  response is never truncated. This stops a verbose or hostile sub-server
  from bloating `cases.json` without bound and degrading every later call.

## Notes on routing

The router is intentionally simple: weighted token overlap between the
objective and each asset's name/description/tags (see
[src/router.ts](src/router.ts)), no LLM call. It stays deterministic while
handling natural phrasing via a curated concept/synonym layer
([src/synonyms.ts](src/synonyms.ts): "cops" → police, "leasing" → rent) plus
light plural stemming, a score floor so a stray word can't claim a case, and a
competitive-secondary rule. Routing quality is measured, not assumed —
`npm run golden` (labeled accuracy) and `npm run paraphrase` (natural-phrasing
robustness) gate it.

**Fallback assets.** A plain-language question ("what causes X?", "how do I
Y?") often shares no literal words with any asset's tags, so keyword routing
alone would miss it. Any asset recruited with `fallback: true` is assigned as
a first-line responder whenever no other asset matches by keyword — so
questions route to it automatically. This is how the `research` asset becomes
the "search first, then correlate" entry point: state a question, the
orchestrator opens a case and routes it to research, research returns a
source-of-truth dossier, and you correlate from there. If a more specific
asset *does* match the objective's keywords, it wins and the fallback stays
out of the way.

If nothing matches and no fallback is registered, `open_case` opens with no
assets assigned and says so — you can then call `assign_asset` or reopen with
`preferred_assets`. A smarter/LLM-driven router can replace `src/router.ts`
later without touching anything else.

## Connection handling

`src/client-manager.ts` caches one MCP client connection per asset and
reuses it across calls. Concurrent first calls to the same asset share a
single in-flight connection attempt (no duplicate child processes). If an
asset's connection drops or errors, it's evicted from the cache
automatically so the next call reconnects instead of reusing a dead client.
Connection attempts time out after 15s so a misconfigured command that
hangs on launch can't stall a tool call forever — and if a timed-out
attempt succeeds late, the resulting connection is closed rather than
leaked as an orphaned child process.

On shutdown — stdin EOF (the normal client-exit handshake), SIGINT, or
SIGTERM — the orchestrator disconnects all assets and exits, so sub-server
child processes don't outlive the session.
