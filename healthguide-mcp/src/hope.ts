// find_next_step: for when someone feels stuck, like nothing has worked, and
// is close to giving up. This is NOT crisis counseling — that's what 911/988
// are for, and this tool is wrapped with guardEmergency so any crisis language
// routes there FIRST, unconditionally, before this content ever runs.
//
// What this tool does instead: state a real, clinically true fact — treatment
// that hasn't worked yet doesn't mean options are exhausted. "Treatment-
// resistant" is a whole field with real next steps, not a dead end. That's
// genuine information, not a platitude, and it's the actual reason psychiatry
// keeps trying after a first treatment doesn't work.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const NEXT_STEP_CATEGORIES: Array<{ title: string; detail: string }> = [
  {
    title: "A different therapy approach",
    detail: "CBT, DBT, EMDR, and others work differently — one not fitting doesn't mean therapy itself doesn't work for you. A different modality or a different therapist (fit matters a lot) is a real, common next step.",
  },
  {
    title: "A different medication or combination",
    detail: "There are multiple classes of antidepressant/anti-anxiety medication, and psychiatrists have real, structured protocols for what to try next when the first one doesn't fully work — switching, combining, or augmenting.",
  },
  {
    title: "Newer options beyond standard medication",
    detail: "For situations that haven't responded to usual treatment, options like TMS (transcranial magnetic stimulation) or, for severe cases, other specialist-directed treatments exist. These are real, established parts of psychiatric care, not experimental fringe ideas.",
  },
  {
    title: "Ruling out an underlying medical cause",
    detail: "Thyroid problems, sleep apnea, vitamin deficiencies, and some medications can all cause or worsen depression/anxiety symptoms. A medical workup with your primary doctor is a legitimate next step, not a delay tactic.",
  },
  {
    title: "The relationship or family piece",
    detail: "If the weight is coming from a marriage, a parent-child relationship, or a family conflict, individual treatment alone may not touch the real source — couples or family therapy addresses the thing that's actually driving it.",
  },
  {
    title: "Support beyond the clinical system",
    detail: "Support groups (in-person or online, for your specific situation) connect you with people who've been where you are — this isn't a replacement for treatment, but it's a real, evidence-supported addition to it.",
  },
];

export function findNextStep(rawSituation: string): string {
  const situation = clean(rawSituation);
  return [
    `BOTTOM LINE: if what's been tried hasn't worked, that does not mean you're out of options — it means you haven't reached the next one yet. That's not a comforting phrase, it's how this field actually works.`,
    ``,
    `About what you described: ${situation}`,
    ``,
    `Real next steps that exist and get used every day:`,
    ...NEXT_STEP_CATEGORIES.map((c, i) => `  ${i + 1}. ${c.title} — ${c.detail}`),
    ``,
    `None of this replaces talking to a real provider — a doctor, therapist, or psychiatrist is who actually walks you through which of these fits your situation. What this is meant to do is keep you from concluding there's nothing left to try, because there almost always is.`,
    ``,
    `If things ever feel urgent or unsafe, that comes before all of this: call or text 988 (Suicide & Crisis Lifeline), free and confidential, 24/7. You don't have to be in crisis to call — "I don't know what else to try" is a completely valid reason to call.`,
  ].join("\n");
}
