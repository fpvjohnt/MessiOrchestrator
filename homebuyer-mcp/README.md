# Homebuyer MCP

A California first-time home-buyer advisor, built as an asset under
[orchestrator-mcp](../README.md) (recruited as `homebuyer`). It has two layers:

- **Stable knowledge (baked in)** — how the whole thing *works*: roles,
  timeline, terms, house-vs-condo, loan types, Prop 13 / Mello-Roos mechanics.
  Deterministic, offline, changes only on the order of years.
- **Live reference data (research-verifiable)** — the *numbers* (rates, loan
  limits, program terms, prices) stored with an `as_of` date, a `source`, a
  confidence rating, and the authoritative `verify_url` the `research` asset
  fetches to re-check them.

It is an **educator and calculator, not a licensed professional**. Every
calculator shows its assumptions and uses your inputs — it never invents a
rate, price, or fee. Anything with a current dollar figure is stamped "as of"
and points to the authoritative source.

## Tools

**Explainers:** `explain_role`, `buying_timeline`, `explain_term`,
`house_vs_condo`, `explain_financing`.

**Calculators (transparent math):** `affordability` (28/36 DTI),
`monthly_cost` (full PITI + HOA + Mello-Roos + PMI), `closing_costs`,
`cash_to_close`, `rent_vs_buy` (break-even with maintenance, appreciation,
selling costs).

**Reference + verification loop:** `get_reference`, `list_stale_references`,
`update_reference` (**flag-only** — previews the change and writes nothing
without `confirm: true`).

**Profile + orientation:** `set_profile` / `get_profile` (enter your numbers
once; calculators reuse them), `start_here` (roadmap for the overwhelmed).

## The two-for-one verification loop

The homebuyer server holds the structured source of truth; the `research`
server holds the live internet; the orchestrator makes them check each other:

1. A home question hits the orchestrator and routes to `homebuyer`.
2. `homebuyer` answers, and for any live number returns its `verify_url`.
3. The orchestrator has `research` fetch that authoritative URL and compare.
4. Result: **✅ VERIFIED** (matches), **🔄 UPDATED** (source changed — shown
   old-vs-new with citation, but the stored value is *not* rewritten until a
   human approves via `update_reference confirm:true`), or **⚠️ UNVERIFIABLE**
   (couldn't reach the source — keeps the stored value, hands you the link).

It never fakes a ✅, and never silently rewrites its own source of truth.

## Seeded reference data (as of July 2026)

Includes: CA/national 30-yr rates; Riverside County conforming ($832,750),
FHA ($690,000), USDA ($433,020) limits; Dream For All structure + income
limits; the CA insurance-market status; Murrieta/Temecula prices; Prop 13 /
Mello-Roos. Each carries its source, confidence, and verify URL. See
[data/reference-2026.json](data/reference-2026.json).

## Setup

```sh
cd homebuyer-mcp
npm install
npm run build
```

## Caveats

- Estimates and education, **not** legal/financial/tax advice — verify with a
  licensed lender, agent, inspector, or attorney.
- Single-source reference values (FHA/USDA limits, Dream For All income
  limits) are marked lower-confidence and point to the official source.
- For a *specific property's* Mello-Roos, HOA, or permits, only the
  county/city/HOA record is authoritative — the tool points you there.
- `data/profile.json` stores your income/debts/down payment in **plaintext**
  in this directory — same posture as the other servers' stores. Keep that in
  mind when backing up or syncing.
