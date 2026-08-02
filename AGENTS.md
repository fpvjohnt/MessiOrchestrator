# AGENTS.md — John MCP orchestrator + assets

Multi-MCP system: one orchestrator (root) that routes a case objective to child "assets" (28 of them), tasks their tools, and synthesizes results. Node/TypeScript. Windows.

## Layout

- `src/` + `dist/` — the **orchestrator**. `router.ts` (asset selection), `synthesis.ts`, `health.ts`, `cases.ts`.
- `<name>-mcp/` — one **asset** per directory (research, homebuyer, polymath, loop, openai, …). Each is a standalone MCP server.
- `data/registry.json` — the asset registry (name, description, tags, command/args). **Routing reads this.**
- `data/cases.json` — case log.
- `golden-set.mjs` — routing answer key. `regression.mjs` — pure-function suite. `bootstrap.mjs` — install+build all.

## Commands

```
npm run setup      # install + build every package (28 assets + root)
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
- **Deterministic and offline by default.** Assets do no network I/O and hold no API keys. Anything live routes through the `research` asset — *unless* the asset is on the explicit exception list below. There are exactly two exceptions and adding a third requires the same justification.
- **Reverse index.** Every domain map ships a `resolveX(input)` that matches key → label → `keys` → loose contains-match (longest key wins). It **must return `undefined`** for unknown input, never `null` — `regression.mjs` asserts this.
- **Honesty tools.** Assets carry a `myth_vs_reality` and, where facts move, a two-step verify loop. Never bake a price, model ID, limit, or date into a map — that's what the verify loop is for.
- Plain words over jargon. Say the honest thing, including "don't use this."

## Networked assets (exceptions)

Two assets hold credentials and touch the network. Everything else is offline, and the offline rule is the default precisely because these two are where the operational risk lives.

| asset | credentials | why it cannot route through `research` |
|---|---|---|
| `research` | optional search keys (`BRAVE_API_KEY`, `TAVILY_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_CSE_ID`) | It *is* the live path. Its keyless structured sources (`sec_filings`, `kalshi_markets`) deliberately add no secret-management burden. |
| `youtube` | `YOUTUBE_API_KEY`, `YOUTUBE_OAUTH_CLIENT_ID/_SECRET/_REFRESH_TOKEN` | Viewer demographics require **OAuth plus channel ownership** — Google's channel-reports doc: *"The user authorizing the request must be the owner of the channel."* A generic fetcher cannot hold a per-user refresh token, and the Data API's quota must be metered per-key by whoever spends it. |

Rules for a networked asset, all of which `youtube` follows:

- **Host allowlist, asserted not assumed.** Caller input may land only in a URL's path and query, never its origin. `youtube-mcp/src/http.ts` throws on any non-allowlisted host. (`research` needs the stronger `pinnedFetch` + `ssrf-guard` because its `fetch_page` takes a caller-supplied *host* — a different threat model.)
- **Credentials via the asset's own `.env`**, loaded by an `env-file.ts` imported FIRST in `index.ts`. Never in `registry.json`.
- **Missing credentials are a reported state, not a crash.** Each tool returns its own setup instructions. A server that won't start is worse than one that explains what it needs — and `npm run health` must still count it UP.
- **Meter the quota in the asset.** `youtube-mcp/src/quota.ts` ledgers Google's documented buckets (search.list: its own **100 calls/day**; everything else: 10,000 units/day). Reserve *before* the request, or a timed-out call spends real quota while the ledger reports plenty left. The ledger is a guardrail, not an accountant — the bridge's worker pool can undercount, and it says so.
- **Cache, because quota is the binding constraint.** Not an optimisation: 100 searches/day means an uncached search tool dies before lunch.
- **Third-party text gets fenced.** A video title or comment containing `BOTTOM LINE:` would otherwise be lifted into the cross-asset digest by `src/synthesis.ts` as if it were the asset's own conclusion.
- **Label the provenance of anything unofficial.** `youtube_get_transcript` reads an undocumented endpoint because the official `captions.download` "requires the user to have permission to edit the video"; every response says so and says not to cite it.

## Do not

- **Do not duplicate a key across two entries in the same map.** `regression.mjs` catches it, but it means two entries fight over one word.
- **Do not claim another asset's tags** in `registry.json`. Tags are the routing signal; overlap breaks it. (`loop` owns agent/llm/prompt/eval/rag; `polymath` owns the specialty titles; `openai` owns openai/chatgpt/codex.)
- **Do not write long registry descriptions, and do not repeat generic verbs in them** (`build`, `work`, `explain`, `use`). Keep descriptions short and noun-heavy; let tags route. The router no longer *rewards* length — each distinct description word counts once, and an asset matching on description alone is dropped whenever any other asset matched a tag or name (`anchored` in `router.ts`). But prose still breaks ties between two tag-matched assets, so a bloated description remains a way to lose a boundary case.
- **Do not add a tag that another domain uses in a different sense.** Tested, not assumed twice over. `overseer` gaining `asset`/`assets` for "which asset logged the most errors" also captured "protect my assets from a lawsuit" (lawguide) and "what assets should I own in retirement" (nestegg). The golden set never saw it. A `synonyms.ts` entry fixed the same case with no collision. The same thing happened again adding `kalshi`: `odds` captured "what are the odds the Lakers win" (sports), `bet` captured casual usage, and `cents` captured "how many cents on the dollar will creditors take" (lawguide) — all three were measured, then dropped. Reach for vocabulary before tags, and probe the neighbouring domains by hand.
- Do not lower a threshold to fix routing. The lever is tags and vocabulary.
- Do not edit `golden-set.mjs` labels to match observed behavior. Label by intent; a wrong route must show as a miss or the number is a lie.
- **Do not let a new asset claim a word another asset owns in a different sense — check the registry, don't eyeball it.** Adding `psychology` made this concrete: `attention` is aiforge's (attention mechanism), `memory` is loop's (agent memory), `bodylanguage`/`nonverbal`/`posture`/`eyecontact` are communication's, and `attachment` is docingest's (file attachments) — which OUTSCORED psychology 7-5 on "how does attachment theory work in child development" when the bare tag was tried. Enumerate ownership first (map every `registry.json` tag to its owner), claim only the unambiguous technical terms (`kinesics`, `proxemics`, `paralanguage`), and push the contested meaning into a PHRASE in `src/synonyms.ts` instead. NOTE: this rule is about REGISTRY TAGS only. A domain map's internal `keys` may use any word freely — they only select a branch AFTER routing has already landed on the asset.
- **A safety-critical route needs its own probe, not just a golden entry.** The psychology boundary test "I think I might be depressed and I don't know what to do" routed to `research`, not `healthguide`: healthguide tags the NOUN `depression`, the router does no stemming, and nobody says "I have depression" first. The one asset carrying a non-suppressible 911/988 override never saw the question. Fixed in `src/synonyms.ts` with CONCEPT mappings (`depressed`/`despondent`/`hopeless` → `depression`, `suicidal`/`suicide`/`selfharm` → `crisis`) and locked in `probe.mjs` with `mustNot: "psychology"`. The bug was pre-existing and invisible until a neighbouring asset was added — which is the argument for writing the boundary probes BEFORE shipping, not after.
- Do not add network calls, API keys, or credentials to any asset **outside the two on the exception list above**. If a new asset genuinely cannot work through `research`, say why in that table before writing the fetch — the bar is "a generic fetcher structurally cannot do this" (per-user OAuth, per-key quota), not "it would be more convenient here."
- **Do not report a demographic split as audience composition.** `ageGroup` and `gender` describe *logged-in* viewers only — Google's dimensions doc says so in as many words — and `gender` has exactly three values (`female`, `male`, `user_specified`). Percentages that sum below ~100 are viewers YouTube declined to bucket plus every signed-out viewer; that missing mass is unknown, not zero. `youtube-mcp/src/cohorts.ts` carries the caveat as a constant so no tool can emit the numbers without it.
- **Do not rank YouTube videos by views÷age and call it growth.** That is a lifetime average, so a video that spiked two years ago and is now dead outranks something genuinely climbing — it inverts the answer. `growth.ts` keeps `lifetimeRate` and `observedRate` (a real Δviews/Δt between two stored snapshots) as separate fields with separate labels, and every stats call records a snapshot so the second look can measure instead of estimate.
- **Do not let a tool's description teach a word its schema rejects.** The real case log's failed calls were overwhelmingly this: `analyze_asset` said "Given a ticker" while the parameter was `symbol`; `match_job` said "the posting's required skills" while the parameter was `required`; `search` takes `query` while its sibling `research` takes `question`. Callers used the word they were taught and the call hard-failed. Either name the parameter what the prose calls it, or accept both — several tools now accept both.
- **Do not let a `*_verdict` tool print the rubric instead of applying it.** Measured over the real log, `openai_verdict`, `practice_verdict` and `science_verdict` were 88% / 85% / 82% IDENTICAL text call-to-call: each took `findings`, echoed it for display, never read it, and listed the evidence tiers for the caller to self-apply. The caller had just written those findings, so that is self-grading one layer below the outcome labels. A verdict tool must COMMIT to a label from countable properties of the findings, and print only the tier it landed on. `regression.mjs` now asserts the label changes when the evidence changes.
- **Do not test a signal word without a negation guard.** A regex reads the word, not the sense. `/randomi[sz]ed/` matched "**no** randomized trials identified" and graded an observational finding as TIER 2 trial evidence — a false upgrade on a health claim, produced by the tool built to prevent exactly that. Positive signals run against non-negated clauses only; signals that are themselves about absence read the full text. Split clauses on sentence-ending punctuation, never on every `.`, or `platform.openai.com` shreds into three fragments and URL matching silently fails.
- **Do not measure similarity with Jaccard when the two strings differ in length.** Jaccard's union is dominated by the longer string, so it charges a LENGTH difference as a TOPIC difference. `detect_drift` reported "nothing to check yet" across 107 cases that contained quantum physics asked three times (jaccard 0.07/0.31/0.08 against a 0.6 bar). Containment — `inter / min(|a|,|b|)` — scored the same pairs 0.67/1.00/1.00 with the threshold untouched. Fix the metric before you touch the threshold.
- **Do not set a length cap you have not measured.** `ask_the_expert` capped questions at 500 characters and rejected 7 real ones between 507 and 1923, dead-ending the whole consult loop over a slightly long question. Size caps from `data/cases.json`, and keep a two-step loop's caps in sync (step 2 usually receives step 1's string).

## Done means

1. `npm run build:all` clean.
2. `npm test` — **all green** (currently 2786/2786).
3. `npm run golden` — baseline holds (currently 100% primary, 96% clean, 96% rank-1 across 135 entries). New assets add golden entries, including the boundary cases against the neighbouring asset.
4. `npm run caselog` — real-traffic coverage holds (**currently 80%, not 82%** — it moves as `data/cases.json` grows, which is exactly why the note below says to re-measure rather than trust a figure).

   **A NEW ASSET ALWAYS LOOKS LIKE NOISE HERE, and it is an artifact.** The noise metric counts an asset that was *assigned* but never *tasked*. Every case in `cases.json` predates the asset you just added, so it could not possibly have been tasked on any of them — a brand-new asset is structurally guaranteed to score as pure noise even when its routing is perfect. Adding `youtube` moved noise 43% → 44% against a 45% gate; measuring it properly (run the router over every objective in `cases.json` and count) showed `youtube` fired on 3/184 cases and **all 3 were genuine YouTube questions**, i.e. zero false positives and +1 total assignment. Do not tune tags to "fix" this number on a new asset. Measure which cases it fired on and judge those; the metric only becomes meaningful once real traffic has had a chance to task it.

   Related, and already known: an ablation showed the whole `PHRASES` layer changes ZERO real-traffic decisions. Re-confirmed 2026-07-29 by stashing a 4-entry synonyms change and re-running — caselog was byte-identical at 190/434. So a synonyms edit that fixes a golden/probe miss will look free here. That is not evidence it is worthless; it is evidence this corpus cannot see it. **This is the honest number**; golden is self-authored and reads ~18 points higher. Note it moves as `data/cases.json` grows, so compare before/after on the SAME file — stash your changes and re-run rather than trusting a remembered figure. An ablation showed the whole `PHRASES` layer changes ZERO real-traffic decisions while adding +11 on the self-written paraphrase set. Trust this one. New assets add golden entries, including the boundary cases against the neighbouring asset.
5. `npm run health` — N/N reachable, your asset UP with its tool count.

If you changed routing, report the golden primary-hit and clean-hit numbers before and after. A drop is a regression even if the suite is green.
