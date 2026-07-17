# Polymath MCP

Technical-domain expertise spanning ~35 job titles, collapsed into **6 practice
families** — built as the `polymath` asset under [orchestrator-mcp](../README.md).
For building projects, leveling up technically, and understanding how a
practice differs across regions. Every current fact (stacks, certs, pay, regs)
routes through the `research` verify loop — nothing here is guessed and left
unchecked.

## The 6 clusters

1. **AI Engineering & Ops** — AI Automation/Ops/Solutions Engineer, MLOps, GenAI
   Tool Support, AI Support Engineer, Senior AI Workflow & Systems Engineer
2. **Data & BI** — Senior Data Analyst, Data Analytics Engineer, Data Scientist,
   Looker Developer, Tableau Developer/Systems Engineer, Senior BI Analyst
3. **Cloud & Infrastructure** — AI+AWS SDE, Senior Platform Engineer, Senior
   Network Automation Engineer, IT Ops Engineer, Cloud Project/System Engineer
4. **Security, Trust & Forensics** — Cybersecurity Analyst, Senior InfoSec
   Analyst, Trust & Safety Specialist, Digital Forensics Examiner
5. **Systems & Technical Support** — Senior Technical Engineer, Integration
   Support Engineer, Enterprise Technical Support, Senior Systems
   Analyst/Engineer, Senior Media Technology Engineer
6. **Leadership & Delivery** — Project Manager, Business System Analyst,
   Product Architect, Technical Leader

Every position named when this MCP was scoped (~40 titles) is individually
recognized by exact name — not just the 6 family names — via a reverse title
index (`resolveCluster` in `clusters.ts`). Ask `day_in_the_life("Trust and
Safety Specialist")` or `how_its_done("Digital Forensics Examiner", "japan")`
directly; you don't need to know which of the 6 clusters it lives in.

## Tools (9)

- `day_in_the_life(cluster?)` — what a cluster actually does, core tools, the ladder.
- `build_it(idea, cluster_hint?)` / `finalize_build(idea, findings)` — two-step
  loop (same shape as nestegg's stock analyzer): plan + relevant clusters +
  the exact research queries to verify the current stack, then turn verified
  findings into an architecture + first step + risks.
- `level_up(current_role, target_role)` — the real gap to a target role, the
  ladder, how to close it without faking anything, live-verify queries for
  what's actually in demand.
- `how_its_done(cluster?, region?)` — regs/culture by region (US, UK, France,
  Canada, Mexico, South America, Japan) + live pay/hiring queries.
- `get_reference` / `list_stale_references` / `update_reference` (flag-only).
- `start_here`.

## Setup

```sh
cd polymath-mcp && npm install && npm run build
```

## Roadmap (v1.5, not built yet)

- `pitch_it` — packaging this expertise into a consulting engagement/proposal.
- Deeper regional coverage (currently a light v1 pass: stable regs/culture +
  live-verify hooks, not full per-country depth).
