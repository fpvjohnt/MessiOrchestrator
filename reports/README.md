# reports/

Output from scheduled cloud agents. One file per run, never overwritten — the point is the time series.

## youtube-momentum-YYYY-MM-DD.md

Written every Friday by the routine `trig_01BWthNqX6jh7WCoGkofEX5Y` ("YouTube momentum — weekly Friday report").

**Why a file in git and not an email.** Measured 2026-08-05: the Gmail connector exposes **zero tools** in a headless cloud run — not merely "cannot send", but no `create_draft`, no `list_drafts`, no search. Two live runs produced no deliverable at all while every other step succeeded. Slack and Notion are the same claude.ai OAuth class and would be expected to fail identically. The orchestrator connector works because it is a plain HTTP endpoint at `mcp.johntapia.com` with no interactive auth.

A file in the repo has no OAuth in its path, so it cannot fail that way. It also solves a second problem for free: the agent has **no memory between runs**, and reading last week's file is how it does the week-over-week comparison.

## Reading these

Two numbers carry most of the meaning, and they are not interchangeable:

- **lifetime rate** — total views ÷ age. An *average over the whole life* of the video. A video that spiked two years ago and is dead now still scores well. **This is not momentum.**
- **observed rate** — real Δviews between two snapshots the server actually took. **This is momentum.**

Early reports are mostly lifetime, because observed rates need the video to have been seen twice. The first run (2026-08-05) had 0 of 29 observed — that is the data-collection phase working, not a failure. Each Friday's run records the snapshots the next Friday measures against, so the observed count should climb week over week. If it does not, something is wrong with the snapshot store (`youtube-mcp/.cache/snapshots.json`).

Any age/gender figure in these reports covers **logged-in viewers only** and is a share of the signed-in audience, not of the audience.
