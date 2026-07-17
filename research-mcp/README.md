# Research MCP

The research arm of the multi-purpose MCP system. It searches multiple web
providers at once, cross-checks which sources independent engines agree on,
fetches the top pages, and returns a **dossier** — primary text plus
follow-up leads — so whatever reads it can reason from sources of truth
instead of one engine's snippets. It runs as an **asset** under
[orchestrator-mcp](../README.md) (already recruited in the orchestrator's
registry as `research`), but also works standalone in any MCP client.

## Providers

| Provider | Needs | Status |
|---|---|---|
| DuckDuckGo | nothing | works out of the box |
| Wikipedia | nothing | works out of the box |
| Brave Search | `BRAVE_API_KEY` | free tier at brave.com/search/api |
| Tavily | `TAVILY_API_KEY` | free tier at tavily.com, built for AI agents |
| Google Programmable Search | `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` | 100 free queries/day |

Set the env var(s) and the provider becomes active automatically — no code
changes. When running under the orchestrator, pass keys via the asset's
`env` (note: persisted in plaintext in the orchestrator's `data/registry.json`).

**Bing is intentionally absent** — Microsoft retired the Bing Search API in
August 2025. Other options worth knowing: Serper.dev (Google results, free
tier), Exa (neural search), SearXNG (self-hosted metasearch aggregating many
engines, no keys), plus specialized sources like arXiv, GitHub search, and
Stack Exchange — any of these can be added as another provider in
`src/providers.ts`.

## Tools

- `list_providers()` — every provider, whether it's usable, and what would
  enable it.
- `search(query, providers?, max_per_provider?)` — fan out to all available
  providers, dedupe by URL, rank by **corroboration** (a URL returned by
  several independent engines outranks any single engine's top hit).
- `fetch_page(url, max_chars?)` — fetch a URL and extract readable text
  (scripts/styles/nav stripped, `<main>`/`<article>` preferred, download
  capped at 1.5 MB).
- `research(question, providers?, fetch_top?)` — the full pipeline: search →
  rank → fetch top sources → dossier with per-source excerpts,
  corroboration counts, unfetched leads, and synthesis guidance that pushes
  the caller to propose **solutions and next steps for every problem found**,
  not just describe the issues.

## Safety & hardening

- **SSRF guard** ([src/ssrf-guard.ts](src/ssrf-guard.ts)): `fetch_page` and the
  fetch step of `research` refuse any URL whose host resolves to a
  loopback/private/link-local address (127.0.0.1, 10/8, 172.16/12, 192.168/16,
  169.254/16 incl. the cloud-metadata IP, CGNAT, `::1`, `fc00::/7`, `localhost`).
  Redirects are followed **manually** and re-checked at every hop, so a public
  page that 302s to an internal address is blocked at the redirect.
- **Untrusted-content fencing**: fetched page text is wrapped in explicit
  `UNTRUSTED PAGE CONTENT` markers in the dossier, and any line that mimics the
  server's own `SOURCE:` / `SYNTHESIS GUIDANCE:` scaffolding is neutralized, so
  a hostile page can't impersonate the report structure or inject instructions.
  This is a mitigation, not a guarantee — treat fetched content as data.
- **Size caps**: page downloads are capped at 1.5 MB and provider API responses
  at 5 MB, so a huge or malicious response can't exhaust memory.
- Provider API keys are sent as request headers (not URL query strings) so they
  can't leak into access logs, and error messages report only the host, never
  the full URL or key.

## Setup

```sh
cd research-mcp
npm install
npm run build
```

## How it plugs into the orchestrator

The orchestrator's registry already contains this server as the `research`
asset with routing tags like `research`, `question`, `docs`, `truth`,
`solution` — so `open_case` objectives phrased as questions route here
first. Typical flow:

```
open_case({ objective: "research why X fails and how to fix it" })
// -> routes to "research"
task_asset({ case_id, asset: "research", tool: "research", arguments: { question: "..." } })
// -> dossier lands in the case log; correlate with other assets from here
```
