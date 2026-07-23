# AGENTS.md — John MCP orchestrator + assets

Multi-MCP system: one orchestrator (root) that routes a case objective to child "assets" (22 of them), tasks their tools, and synthesizes results. Node/TypeScript. Windows.

## Layout

- `src/` + `dist/` — the **orchestrator**. `router.ts` (asset selection), `synthesis.ts`, `health.ts`, `cases.ts`.
- `<name>-mcp/` — one **asset** per directory (research, homebuyer, polymath, loop, openai, …). Each is a standalone MCP server.
- `data/registry.json` — the asset registry (name, description, tags, command/args). **Routing reads this.**
- `data/cases.json` — case log.
- `golden-set.mjs` — routing answer key. `regression.mjs` — pure-function suite. `bootstrap.mjs` — install+build all.

## Commands

```
npm run setup      # install + build every package (22 assets + root)
npm run build:all  # build root + every asset
npm test           # regression.mjs — pure functions from dist/, no spawn, no network
npm run golden     # routing accuracy vs golden-set.mjs
npm run health     # spawns every asset, confirms reachable + tool count
npm run check      # verify + golden + paraphrase + caselog — the full gate
npm run caselog    # routing vs REAL traffic (data/cases.json) — the non-self-graded number
```

Run `npm run build:all` before `npm test` — the suite tests compiled `dist/`, not `src/`.

## Asset anatomy

An asset is: `package.json`, `tsconfig.json` (copy an existing one verbatim), and `src/`:

- `index.ts` — `McpServer` + `registerTool` per tool + `StdioServerTransport`. Every handler wraps its call in try/catch and returns `errorResult(err)` on throw.
- One or more **domain maps** (`primitives.ts`, `patterns.ts`, `roles.ts`, `clusters.ts`) — a `Record<string, Entry>` where each entry has `label`, `keys: string[]`, and content fields.
- `verify.ts` — the `check_x` → `x_verdict` research loop, if the asset has any fast-moving facts.

Build output goes to `dist/`. Register in `data/registry.json` with `command: "node"`, `args: ["<name>-mcp/dist/index.js"]`, `cwd: "D:/John MCP"` — AND in `data/registry.example.json` (the tracked file, with `cwd: "/path/to/John MCP"` and `env: {}`), `package.json`'s `build:all`, and `bootstrap.mjs`. Regression asserts the two registries stay the same length.

## Conventions

- **BOTTOM LINE first.** Every tool's output opens with a one-line headline — the orchestrator's synthesis extracts every line matching `/^BOTTOM LINE/` and builds the cross-asset digest from them. Two consequences, both now enforced by `regression.mjs`:
  - **A tool with no BOTTOM LINE is invisible to the orchestrator.** Not untidy — invisible. Synthesis prints "(no headline extracted)" and the specialist drops out of the merged answer entirely. This was true of 13 of 71 tools before it was measured, including four `myth_vs_reality` tools whose entire job is to state the conclusion.
  - **The headline is read OUTSIDE its own output**, next to other assets' headlines. "Verify it against the sources below" points at nothing there. Write a headline that stands alone; 19 of them didn't.
- **Deterministic and offline.** Assets do no network I/O and hold no API keys. Anything live routes through the `research` asset.
- **Reverse index.** Every domain map ships a `resolveX(input)` that matches key → label → `keys` → loose contains-match (longest key wins). It **must return `undefined`** for unknown input, never `null` — `regression.mjs` asserts this.
- **Honesty tools.** Assets carry a `myth_vs_reality` and, where facts move, a two-step verify loop. Never bake a price, model ID, limit, or date into a map — that's what the verify loop is for.
- Plain words over jargon. Say the honest thing, including "don't use this."

## Do not

- **Do not duplicate a key across two entries in the same map.** `regression.mjs` catches it, but it means two entries fight over one word.
- **Do not claim another asset's tags** in `registry.json`. Tags are the routing signal; overlap breaks it. (`loop` owns agent/llm/prompt/eval/rag; `polymath` owns the specialty titles; `openai` owns openai/chatgpt/codex.)
- **Do not write long registry descriptions, and do not repeat generic verbs in them** (`build`, `work`, `explain`, `use`). Keep descriptions short and noun-heavy; let tags route. The router no longer *rewards* length — each distinct description word counts once, and an asset matching on description alone is dropped whenever any other asset matched a tag or name (`anchored` in `router.ts`). But prose still breaks ties between two tag-matched assets, so a bloated description remains a way to lose a boundary case.
- **Do not add a tag that another domain uses in a different sense.** Tested, not assumed twice over. `overseer` gaining `asset`/`assets` for "which asset logged the most errors" also captured "protect my assets from a lawsuit" (lawguide) and "what assets should I own in retirement" (nestegg). The golden set never saw it. A `synonyms.ts` entry fixed the same case with no collision. The same thing happened again adding `kalshi`: `odds` captured "what are the odds the Lakers win" (sports), `bet` captured casual usage, and `cents` captured "how many cents on the dollar will creditors take" (lawguide) — all three were measured, then dropped. Reach for vocabulary before tags, and probe the neighbouring domains by hand.
- Do not lower a threshold to fix routing. The lever is tags and vocabulary.
- Do not edit `golden-set.mjs` labels to match observed behavior. Label by intent; a wrong route must show as a miss or the number is a lie.
- Do not add network calls, API keys, or credentials to any asset.
- **Do not let a tool's description teach a word its schema rejects.** The real case log's failed calls were overwhelmingly this: `analyze_asset` said "Given a ticker" while the parameter was `symbol`; `match_job` said "the posting's required skills" while the parameter was `required`; `search` takes `query` while its sibling `research` takes `question`. Callers used the word they were taught and the call hard-failed. Either name the parameter what the prose calls it, or accept both — several tools now accept both.
- **Do not set a length cap you have not measured.** `ask_the_expert` capped questions at 500 characters and rejected 7 real ones between 507 and 1923, dead-ending the whole consult loop over a slightly long question. Size caps from `data/cases.json`, and keep a two-step loop's caps in sync (step 2 usually receives step 1's string).

## Done means

1. `npm run build:all` clean.
2. `npm test` — **all green** (currently 2656/2656).
3. `npm run golden` — baseline holds (currently 104/105 primary, 102/105 clean). New assets add golden entries, including the boundary cases against the neighbouring asset.
4. `npm run caselog` — real-traffic coverage holds (currently 71%). **This is the honest number**; golden is self-authored and reads ~30 points higher. An ablation showed the whole `PHRASES` layer changes ZERO real-traffic decisions while adding +11 on the self-written paraphrase set. Trust this one. New assets add golden entries, including the boundary cases against the neighbouring asset.
5. `npm run health` — N/N reachable, your asset UP with its tool count.

If you changed routing, report the golden primary-hit and clean-hit numbers before and after. A drop is a regression even if the suite is green.
