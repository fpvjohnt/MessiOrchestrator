# Lawguide MCP

California + federal **legal information** — built as the `lawguide` asset under
[orchestrator-mcp](../README.md). It teaches your rights, how the system works,
how a lawyer would handle a situation, and where to get help (often free).

**Hard rule:** this is legal **information and possibilities, NOT legal advice**,
and unlike a real attorney it is **not confidential**. It shows how the process
works and what *could* happen — it never predicts your specific case. For
anything serious (arrest, charges, a lawsuit served, immigration, IRS), the
answer is always: get a licensed lawyer — and you likely qualify for free/low-cost
help. Immigration especially: a real attorney or DOJ-accredited rep, **never a
notario**.

## Tools (14)

- **Rights & system:** `know_your_rights` (chunkable, step-by-step),
  `which_arena` (criminal/civil/traffic/administrative/immigration),
  `explain_process`, `explain_term`, `deadlines`.
- **Insider lens:** `how_they_think` — prosecutor, defense attorney, public
  defender, judge, police, detective, PI, court clerk, paralegal, bail
  bondsman, immigration officer, IRS agent.
- **Traps:** `red_flag` — talking to police, missing court, notario fraud,
  signing under pressure, self-rep on serious charges, debt-collector abuse,
  the other side's insurance adjuster.
- **Think like a lawyer:** `think_like_a_lawyer(situation)` — for arrested /
  sued / accused / contract / landlord / car accident / debt / immigration
  stop / IRS / traffic: first moves, the questions a lawyer would ask YOU,
  what they'd do, the range of possibilities, and what lawyer you need.
- **Find help:** `get_a_lawyer` (incl. free options), `find_legal_resources`
  (statewide + Riverside/LA/San Diego county orgs baked in, plus live research
  queries).
- **Reference + verify loop:** `get_reference` / `list_stale_references` /
  `update_reference` (flag-only) — CA small-claims limit, statutes of
  limitation, answer deadline, right to counsel — each with a courts.ca.gov /
  leginfo verify URL.

## Setup

```sh
cd lawguide-mcp && npm install && npm run build
```

Legal information only — not a lawyer, not legal advice, not confidential.
