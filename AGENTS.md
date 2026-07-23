# AGENTS.md — John MCP orchestrator + assets

Multi-MCP system: one orchestrator (root) that routes a case objective to child "assets" (17 of them), tasks their tools, and synthesizes results. Node/TypeScript. Windows.

## Layout

- `src/` + `dist/` — the **orchestrator**. `router.ts` (asset selection), `synthesis.ts`, `health.ts`, `cases.ts`.
- `<name>-mcp/` — one **asset** per directory (research, homebuyer, polymath, loop, openai, …). Each is a standalone MCP server.
- `data/registry.json` — the asset registry (name, description, tags, command/args). **Routing reads this.**
- `data/cases.json` — case log.
- `golden-set.mjs` — routing answer key. `regression.mjs` — pure-function suite. `bootstrap.mjs` — install+build all.

## Commands

```
npm run setup      # install + build every package (17 assets + root)
npm run build:all  # build root + every asset
npm test           # regression.mjs — pure functions from dist/, no spawn, no network
npm run golden     # routing accuracy vs golden-set.mjs
npm run health     # spawns every asset, confirms reachable + tool count
npm run check      # verify + golden + paraphrase — the full gate
```

Run `npm run build:all` before `npm test` — the suite tests compiled `dist/`, not `src/`.

## Asset anatomy

An asset is: `package.json`, `tsconfig.json` (copy an existing one verbatim), and `src/`:

- `index.ts` — `McpServer` + `registerTool` per tool + `StdioServerTransport`. Every handler wraps its call in try/catch and returns `errorResult(err)` on throw.
- One or more **domain maps** (`primitives.ts`, `patterns.ts`, `roles.ts`, `clusters.ts`) — a `Record<string, Entry>` where each entry has `label`, `keys: string[]`, and content fields.
- `verify.ts` — the `check_x` → `x_verdict` research loop, if the asset has any fast-moving facts.

Build output goes to `dist/`. Register in `data/registry.json` with `command: "node"`, `args: ["<name>-mcp/dist/index.js"]`, `cwd: "D:/John MCP"`.

## Conventions

- **BOTTOM LINE first.** Every tool's output opens with a one-line headline — the orchestrator's synthesis extracts it.
- **Deterministic and offline.** Assets do no network I/O and hold no API keys. Anything live routes through the `research` asset.
- **Reverse index.** Every domain map ships a `resolveX(input)` that matches key → label → `keys` → loose contains-match (longest key wins). It **must return `undefined`** for unknown input, never `null` — `regression.mjs` asserts this.
- **Honesty tools.** Assets carry a `myth_vs_reality` and, where facts move, a two-step verify loop. Never bake a price, model ID, limit, or date into a map — that's what the verify loop is for.
- Plain words over jargon. Say the honest thing, including "don't use this."

## Do not

- **Do not duplicate a key across two entries in the same map.** `regression.mjs` catches it, but it means two entries fight over one word.
- **Do not claim another asset's tags** in `registry.json`. Tags are the routing signal; overlap breaks it. (`loop` owns agent/llm/prompt/eval/rag; `polymath` owns the specialty titles; `openai` owns openai/chatgpt/codex.)
- **Do not write long registry descriptions, and do not repeat generic verbs in them** (`build`, `work`, `explain`, `use`). Keep descriptions short and noun-heavy; let tags route. The router no longer *rewards* length — each distinct description word counts once, and an asset matching on description alone is dropped whenever any other asset matched a tag or name (`anchored` in `router.ts`). But prose still breaks ties between two tag-matched assets, so a bloated description remains a way to lose a boundary case.
- **Do not add a tag that another domain uses in a different sense.** Tested, not assumed: `overseer` gaining `asset`/`assets` for "which asset logged the most errors" also captured "protect my assets from a lawsuit" (lawguide) and "what assets should I own in retirement" (nestegg). The golden set never saw it. A `synonyms.ts` entry fixed the same case with no collision — reach for vocabulary before tags, and probe the neighbouring domains by hand.
- Do not lower a threshold to fix routing. The lever is tags and vocabulary.
- Do not edit `golden-set.mjs` labels to match observed behavior. Label by intent; a wrong route must show as a miss or the number is a lie.
- Do not add network calls, API keys, or credentials to any asset.

## Done means

1. `npm run build:all` clean.
2. `npm test` — **all green** (currently 1394/1394).
3. `npm run golden` — baseline holds (currently 73/75 primary). New assets add golden entries, including the boundary cases against the neighbouring asset.
4. `npm run health` — N/N reachable, your asset UP with its tool count.

If you changed routing, report the golden primary-hit and clean-hit numbers before and after. A drop is a regression even if the suite is green.
