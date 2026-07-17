// find_care, navigate_care, prep_for_appointment — the hospital/insurance/
// admin side. Baked permanent facts (911/988/poison control never change) +
// CA county resources + live-research hooks for anything local/current.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const PERMANENT_NUMBERS = [
  "Emergency: 911",
  "Suicide & Crisis Lifeline: call or text 988 (24/7, free, confidential)",
  "Crisis Text Line: text HOME to 741741",
  "Poison Control: 1-800-222-1222 (24/7, free)",
];

interface CountyResources {
  county: string;
  community_health: string;
  mental_health: string;
}

const COUNTIES: Record<string, CountyResources> = {
  riverside: {
    county: "Riverside County",
    community_health: "Riverside University Health System clinics — sliding-scale/low-cost care: https://www.ruhealth.org",
    mental_health: "Riverside County Behavioral Health (incl. crisis lines): https://www.rcdmh.org",
  },
  "los angeles": {
    county: "Los Angeles County",
    community_health: "LA County Dept of Health Services clinics — sliding-scale: https://dhs.lacounty.gov",
    mental_health: "LA County Dept of Mental Health (24/7 Help Line): https://dmh.lacounty.gov",
  },
  "san diego": {
    county: "San Diego County",
    community_health: "San Diego County community clinics — sliding-scale: https://www.sandiegocounty.gov/hhsa",
    mental_health: "San Diego County Access & Crisis Line (24/7): https://www.optumsandiego.com",
  },
};

const CITY_TO_COUNTY: Record<string, string> = {
  murrieta: "riverside", temecula: "riverside", menifee: "riverside", wildomar: "riverside",
  "canyon lake": "riverside", "lake elsinore": "riverside", riverside: "riverside",
  "san pedro": "los angeles", "long beach": "los angeles", "los angeles": "los angeles",
  "san diego": "san diego", "chula vista": "san diego",
};

export function findCare(rawNeed: string, rawArea?: string): string {
  const need = clean(rawNeed);
  const areaKey = (rawArea ?? "").toLowerCase().trim();
  const countyKey = Object.hasOwn(COUNTIES, areaKey) ? areaKey : CITY_TO_COUNTY[areaKey];
  const county = countyKey ? COUNTIES[countyKey] : undefined;

  const local = county
    ? [``, `LOCAL (${county.county}):`, `  - Low-cost/sliding-scale care: ${county.community_health}`, `  - Mental health access line: ${county.mental_health}`]
    : rawArea
    ? [``, `(No baked list for "${clean(rawArea)}" yet — the numbers above are universal; have research find local urgent care/community clinics.)`]
    : [``, `(Tell me your county — Riverside, Los Angeles, San Diego... — for local low-cost options.)`];

  return [
    `CARE OPTIONS FOR: ${need}`,
    `BOTTOM LINE: match the URGENCY to the RIGHT place — ER for emergencies, urgent care for same-day non-emergencies, telehealth/primary care for routine.`,
    ``,
    `ALWAYS AVAILABLE:`,
    ...PERMANENT_NUMBERS.map((n) => `  - ${n}`),
    ...local,
    ``,
    `HAVE RESEARCH CHECK CURRENT LOCAL OPTIONS:`,
    `  - "free or low-cost clinic ${need} ${rawArea ?? "near me"}"`,
    `  - "urgent care vs ER for ${need}"`,
    ``,
    `Uninsured or underinsured? Community health centers (FQHCs) charge on a sliding scale by income regardless of insurance status — that's a real, legitimate option, not a last resort.`,
  ].join("\n");
}

export function navigateCare(rawNeed: string): string {
  const need = clean(rawNeed);
  return [
    `NAVIGATING: ${need}`,
    `BOTTOM LINE: most insurance/records problems have a real, documented process — the trick is knowing which one applies.`,
    ``,
    `Common situations:`,
    `  - Insurance denied a claim/treatment → you have a right to APPEAL, usually in two stages (internal, then external/independent review). Deadlines are real — see 'get_reference'.`,
    `  - Need your own medical records → you have a legal right to them (HIPAA, and stronger CA-specific rights — see 'lawguide' for the exact deadline). Ask the provider's medical records department directly; they can't refuse a reasonable request.`,
    `  - Prior authorization needed before a procedure → your doctor's office typically submits this; ask them directly what's pending and follow up if it's been more than a few business days.`,
    `  - Inpatient registration/admission paperwork → bring ID, insurance card, a list of current medications, and an emergency contact — this alone speeds up admission significantly.`,
    ``,
    `HAVE RESEARCH VERIFY (rules and deadlines get updated):`,
    `  - "${need} insurance appeal process 2026"`,
    `  - "how to request medical records California 2026"`,
    ``,
    `For anything that becomes a legal dispute (a wrongful denial, a billing dispute that won't resolve) — that's 'lawguide' territory, not this one.`,
  ].join("\n");
}

const APPOINTMENT_PREP: Record<string, string[]> = {
  general: [
    "A list of ALL current medications and supplements, with doses.",
    "Your main concern in one sentence, plus when it started (see 'root_cause_questions').",
    "Any relevant family history.",
    "Questions you want answered, written down — it's easy to blank in the room.",
  ],
  mental_health: [
    "How long you've felt this way, and anything that changed around when it started.",
    "What you've already tried (therapy, medication, lifestyle changes) and what happened.",
    "Sleep, appetite, and energy patterns over the last few weeks.",
    "Anyone in your life this affects or involves, if relevant (relationship/family context).",
  ],
  specialist_followup: [
    "Copies or access to any prior test results/imaging related to this issue.",
    "A log of symptom timing/severity since the last visit if it's an ongoing issue.",
    "What's changed since the last appointment — better, worse, same.",
  ],
};

export function prepForAppointment(kind?: string): string {
  const key = (kind ?? "general").toLowerCase().replace(/[\s-]+/g, "_");
  const list = APPOINTMENT_PREP[key] ?? APPOINTMENT_PREP.general;
  return [
    `APPOINTMENT PREP${kind ? ` — ${clean(kind)}` : ""}`,
    `BOTTOM LINE: showing up organized gets you a better appointment — doctors have limited time and can only work with what you bring them.`,
    ``,
    `Bring/track:`,
    ...list.map((x) => `  - ${x}`),
    ``,
    `Types available: general, mental_health, specialist_followup.`,
  ].join("\n");
}
