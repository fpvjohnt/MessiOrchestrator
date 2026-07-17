# Jobhunt MCP

California job-search coaching — built as the `jobhunt` asset under
[orchestrator-mcp](../README.md). It helps you figure out what job fits you,
how to get from where you are to a better role, why you're getting stuck, and
how to earn a real California living wage. Coaching with research-verified
data — not a job guarantee.

**The spine:** your resume passes through gates (ATS robot → recruiter →
hiring manager → interview → offer → onboarding). Most people fail at a gate
they didn't know existed — `diagnose` finds yours.

## Tools (21)

- **Profile:** `set_candidate_profile`, `get_profile` (enter your background
  once; everything personalizes).
- **Career discovery + pathways:** `career_match` ("what job fits me?", RIASEC-
  based), `career_path` ("how do I get from A to B?" — transferable skills, the
  cheapest bridge cert, timeline, pay jump; e.g. tech support→cybersecurity,
  retail→manager, CNA→RN).
- **The diagnostic ⭐:** `diagnose` — no_responses / no_interviews / no_offers /
  low_pay / no_direction → the broken gate + fixes.
- **Land the job:** `the_funnel`, `beat_the_ats`, `resume_tips`,
  `interview_prep`, `find_hiring_manager`.
- **Vet before you apply:** `vet_company` (ghost-job check vs the company's own
  careers page, culture via Glassdoor/Indeed/Blind, real remote policy, can you
  move up or get stuck, stability, pay — plus questions to ask them; research
  runs the searches), `match_job` (score your skills vs a posting's
  requirements, what to mirror, the gaps).
- **Insider lens:** `how_they_think` — recruiter, hiring_manager, ats_robot,
  hr, references.
- **Traps:** `red_flag` — generic resume, ATS-breaking format, apply-online-only,
  lowballing yourself, no follow-up, job scams.
- **Money:** `negotiate_salary`, `living_wage` (CA, ties to homebuyer/nestegg),
  `job_market` (highest→lowest paying, in-demand fields).
- **Reference + verify loop:** `get_reference` / `list_stale_references` /
  `update_reference` (flag-only) — CA living wage, pay by field — each with a
  BLS / O*NET / CA EDD / MIT Living Wage verify URL.

## Setup

```sh
cd jobhunt-mcp && npm install && npm run build
```

Coaching + data, not a job guarantee. Pay figures are rough and
research-verified against official sources.
