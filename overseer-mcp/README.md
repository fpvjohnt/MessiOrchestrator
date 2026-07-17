# overseer-mcp

**Observability for orchestrator-style MCP agent systems.** Point it at an
orchestrator's case store and it tells you what the system actually did, whether
it worked, and whether it's drifting.

It reads a `cases.json` (and `registry.json`) — it never writes to them — so it's
safe to run against a live system, and it's **not tied to one deployment**: every
tool takes an optional `cases_path` / `registry_path`, so the same build can
inspect any orchestrator whose case log matches the expected shape.

## Tools

| Tool | Answers |
|------|---------|
| `list_cases_brief` | What cases exist (id, status, objective) |
| `replay_case` | What happened in one case — routing + every asset call, with args and result/error |
| `audit_report` | Calls & errors per asset; warns on assets called but not registered |
| `detect_drift` | Did similar questions get routed **differently** over time (a fix, or a regression) |
| `analyze_errors` | What actually failed — real error messages, grouped by type |
| `detect_answer_drift` | Did a deterministic tool's answer change for an identical call (code changed under it) |
| `outcome_report` | Resolution rate & per-asset quality, from recorded case outcomes (coverage-honest) |
| `latency_report` | How slow each asset is (avg/p50/p95/max) and the slowest calls |
| `start_here` | Orientation |

## Expected case-store shape

Each case in `cases.json`:

```jsonc
{
  "id": "…", "objective": "…", "assignedAssets": ["…"],
  "status": "open" | "closed", "openedAt": "ISO", "closedAt": "ISO?",
  "outcome": "resolved" | "partial" | "unresolved" | "misrouted",   // optional
  "log": [
    { "asset": "…", "tool": "…", "arguments": {}, "result": {} | "error": "…",
      "timestamp": "ISO", "durationMs": 123 }                        // durationMs optional
  ]
}
```

`registry.json` (for `audit_report`) is an array of `{ name, status, tags, ... }`.

## Setup

```sh
npm install
npm run build          # -> dist/index.js (a stdio MCP server)
```

Register it with any MCP client, or recruit it into an orchestrator as an asset.
It defaults to the sibling orchestrator's `../data/cases.json`; override per call
with `cases_path` to inspect a different one:

```
detect_drift({ cases_path: "/path/to/other/data/cases.json" })
```

## Design notes

- **Read-only.** No file locks or writes — it only ever inspects.
- **Coverage-honest.** `outcome_report` and `latency_report` report how much of
  the data is actually labeled/timed and refuse to fake a rate over a handful of
  samples.
- **Deterministic.** No model calls — every report is computed from the log.
