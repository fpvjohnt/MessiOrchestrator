# Nestegg MCP

Investing education in words a kid can follow — built as the `nestegg` asset
under [orchestrator-mcp](../README.md). It's a noise-filter, not an advisor:
it teaches how the machine works, who's on your side, and what the math says.
Every answer leads with a one-line BOTTOM LINE; big topics come one step at a
time (`order_of_operations step: 1`).

**The spine:** 401k/IRA/HSA are tax **BOXES**; stocks/index funds are
**THINGS** you put inside. Most confusion dies right there.

## Tools (16)

- **Explainers:** `explain_vehicle` (every vehicle incl. options/Kalshi/crypto
  with honest odds), `containers_vs_investments`, `order_of_operations`
  (7 steps, chunkable), `explain_tax` (incl. the California no-discount
  twist), `risk_ladder`, `explain_term`.
- **Insider lens:** `how_they_think` (broker, fiduciary-vs-commission advisor,
  fund manager, insurance pitch, crypto influencer, trading guru).
- **Traps:** `red_flag` (guaranteed returns, FOMO, beginner options, margin,
  gold dealers, wine platforms, seminars, pump groups).
- **Calculators:** `compound_growth`, `fee_drag`, `match_value`,
  `goal_timeline` (the <5-year rule — ties to the homebuyer down-payment plan).
- **Reference + verify loop:** `get_reference` / `list_stale_references` /
  `update_reference` (flag-only) — 2026 contribution limits, HYSA levels,
  cap-gains rates, each with an IRS/FDIC `verify_url` for the research asset.

## Setup

```sh
cd nestegg-mcp && npm install && npm run build
```

Education only — not licensed financial, tax, or legal advice. Confirm big
moves with a fee-only fiduciary.
