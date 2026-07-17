# Healthguide MCP

Health information and navigation — built as the `healthguide` asset under
[orchestrator-mcp](../README.md). This is the highest-stakes server in the
system, and it's built to match: **information and navigation only, never
diagnosis or treatment**, with one rule that overrides everything else.

## The non-negotiable rule

Every tool that accepts free text runs an **emergency/crisis scan first**,
before its own logic. If red-flag physical symptoms (heart attack/stroke
signs, severe bleeding, breathing trouble) or crisis language (suicidal
ideation) are detected, the tool returns an unconditional 911/988 banner
**instead of** its normal output — no matter which tool was called or what
else was asked. This is enforced in code (`emergency.ts`'s `guardEmergency`
wrapper), not a prose reminder, and it was verified to survive being routed
through the orchestrator, not just called directly.

## Tools (16)

- **Safety:** `emergency_check` (standalone), plus the override wrapping every tool below.
- **Routing & diagnosis-adjacent:** `which_specialist` (concern → specialist,
  including marriage/family/parent-child counseling and sports trainers),
  `root_cause_questions` (the SOCRATES clinical history-taking framework —
  organizes the pattern, never concludes a diagnosis).
- **Evidence-checking loop:** `check_the_science` / `science_verdict` — a
  two-step research loop (same shape as nestegg's stock analyzer) that checks
  any health/nutrition/aging claim against NIH, Japan's MHLW/NIHN, EFSA,
  Health Canada, WHO, and Cochrane. Never answers from static memory.
- **Body science:** `explain_macronutrient` (carbs, protein, fat, insulin,
  sports nutrition — stable biology + the aging-specific angle),
  `explain_training_method` (weight training, calisthenics, military
  calisthenics).
- **The hope tool:** `find_next_step` — crisis-gated first, then the real
  clinical fact that "treatment-resistant" isn't a dead end; genuine
  information to keep someone from giving up, never a replacement for care.
- **Traps:** `red_flag` (self-diagnosis online, stopping medication abruptly,
  supplement interactions, STD-testing stigma, miracle cures, skipping
  follow-up).
- **Navigation:** `find_care` (ER vs urgent care vs telehealth vs community
  clinic, CA county resources, permanent crisis/poison-control numbers),
  `navigate_care` (insurance appeals, medical records, HIPAA — cross-refs
  `lawguide`), `prep_for_appointment`.
- **Reference + verify loop:** `get_reference` / `list_stale_references` /
  `update_reference` (flag-only).
- `start_here`.

## Setup

```sh
cd healthguide-mcp && npm install && npm run build
```

Information and navigation only. Not a diagnosis, not a treatment plan, not a
replacement for a licensed doctor or therapist. In an emergency: call 911. In
crisis: call or text 988.
