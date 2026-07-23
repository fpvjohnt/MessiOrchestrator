const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

// ── prepare: playbooks for a specific high-stakes moment ────────────────────
const SITUATIONS: Record<string, { label: string; steps: string[] }> = {
  speech: {
    label: "A speech or presentation",
    steps: ["Nail the ONE message and the open + close first.", "Cut every slide/word that doesn't serve that message.", "Rehearse out loud, timed, standing.", "Plan the first 20 seconds word-for-word — that's where nerves hit.", "Arrive early, own the room, breathe slow before you start."],
  },
  difficult_conversation: {
    label: "A difficult conversation (work or home)",
    steps: ["Get clear on YOUR one goal — connection or a decision, not 'winning'.", "Open soft: 'I want to talk about X, and I want us both okay after.'", "Lead with the impact on you ('I felt...'), not the accusation ('you did...').", "Ask for their side and actually listen before you respond.", "Pick a calm time and private place — never tired, hungry, or in front of others."],
  },
  negotiation: {
    label: "A negotiation",
    steps: ["Know your walk-away number and your target before you start.", "Let them name a figure first when you can.", "Anchor high (but defensibly), then trade — never just concede.", "Ask 'what would make this work for you?' — find their real interest, not just their position.", "Silence is leverage; after an offer, don't rush to fill the gap."],
  },
  interview: {
    label: "A job interview",
    steps: ["Have 5-6 STAR stories ready (Situation, Task, Action, Result) with numbers.", "Research the company and tie your answers to THEIR problem.", "Prepare smart questions to ask THEM — it signals you're evaluating too.", "First 30 seconds set the tone: warm, composed, a firm greeting.", "(The jobhunt asset has the full interview + funnel playbook.)"],
  },
  debate: {
    label: "A debate or argument you want to win fairly",
    steps: ["Know your strongest 2-3 points and your single best piece of evidence.", "Steelman their side first so you're not surprised (see steelman).", "Prepare the rebuttal to their best argument, not their weakest.", "Concede what's true — it buys credibility for where you disagree.", "Aim to persuade the room, not to crush the person."],
  },
  feedback: {
    label: "Giving someone feedback",
    steps: ["Be specific and behavioral: what they DID, not who they ARE.", "Lead with intent: 'I'm telling you this because I want you to do well.'", "One or two things, not a pile — people can only act on so much.", "Make it a dialogue: ask how they see it.", "End with the path forward, not the failure."],
  },
  apology: {
    label: "A real apology",
    steps: ["Name the specific thing you did.", "No 'but', no 'if you felt' — those erase the apology.", "Acknowledge the impact on them.", "Say what you'll do differently.", "Then give them space; an apology isn't a demand for instant forgiveness."],
  },
};

export function prepare(rawSituation: string): string {
  const situation = clean(rawSituation);
  const norm = situation.toLowerCase().replace(/[\s-]+/g, "_");
  const key = Object.keys(SITUATIONS).find((k) => k === norm || norm.includes(k) || k.includes(norm)) ??
    Object.entries(SITUATIONS).find(([, v]) => v.label.toLowerCase().split(/\W+/).some((w) => w.length > 3 && norm.includes(w)))?.[0];
  if (!key) {
    return `PREP — "${situation}"\n\nTell me which kind of moment it is and I'll give the playbook: ${Object.keys(SITUATIONS).join(", ")}.`;
  }
  const s = SITUATIONS[key];
  return [`PREP — ${s.label}`, `BOTTOM LINE: prepare the opening and the goal; improvise the rest.`, ``, ...s.steps.map((st, i) => `  ${i + 1}. ${st}`)].join("\n");
}

// ── read_people: the honest interrogator/detective toolkit ──────────────────
export function readPeople(): string {
  return [
    `READING PEOPLE — the honest toolkit (what real investigators actually rely on)`,
    `BOTTOM LINE: you cannot read minds or detect lies from a gesture. What you CAN do is spot deviations from someone's own baseline, follow inconsistencies, and ask better questions. That's the whole real skill.`,
    ``,
    `1. BASELINE FIRST. Watch how the person acts when relaxed and talking about easy, true things. Everything after is measured against THAT, not some universal 'tell'. A fidgeter fidgeting means nothing; a still person suddenly fidgeting means look closer.`,
    `2. CLUSTERS, NOT CUES. One signal is noise. A shift in posture + a change in voice + a pause, all at the same question — that's a cluster worth a follow-up.`,
    `3. THE MISMATCH. When the words ('I'm fine', 'sure, no problem') don't match the tone, face, or timing — that gap is the breadcrumb. Don't conclude; get curious.`,
    `4. FUNNEL QUESTIONS. Open wide ('walk me through what happened'), let them talk freely (liars and honest people both reveal more when talking more), then narrow to the odd detail.`,
    `5. USE SILENCE. After a key answer, say nothing. People rush to fill silence, and that's where the extra, unplanned detail slips out.`,
    `6. NOTICE THE ODD. Over-explaining, an unprompted denial ('I would never...'), a story too smooth or told out of order, a detail that contradicts an earlier one — follow the crumb with another question, not an accusation.`,
    ``,
    `THE HONESTY CAVEAT (this matters): nervousness looks exactly like guilt, and calm looks exactly like innocence — both are wrong as often as right. Innocent people fidget under pressure; practiced liars are smooth. Use this to ask sharper questions and find CONSISTENCY, never to convict someone in your head. If it's high-stakes (legal, safety), that's for professionals — see the lawguide asset.`,
  ].join("\n");
}

// ── steelman: fairly represent the other side ───────────────────────────────
export function steelman(rawTopic?: string): string {
  const topic = rawTopic ? clean(rawTopic) : "";
  return [
    `STEELMAN${topic ? ` — ${topic}` : ""}`,
    `BOTTOM LINE: state the OTHER side's view so well and so fairly that they'd say "yes, that's exactly it." Then you actually understand it — and you argue from strength, not against a cartoon.`,
    ``,
    `How to build a steelman:`,
    `  1. Find the BEST version of their argument, not the dumbest one you've heard.`,
    `  2. Ask: what would a smart, decent person who believes this be worried about or valuing?`,
    `  3. State their strongest evidence and their most reasonable concern — out loud, in their words.`,
    `  4. Only THEN respond — now to their real position, not a strawman.`,
    ``,
    `Why it wins: people stop defending and start listening once they feel truly understood. And half the time, steelmanning shows you where THEY have a real point — which is the honest, diligent outcome.`,
    topic ? `\nFor "${topic}": have research pull the strongest arguments on the side you DISagree with, then state them fairly before you counter.` : ``,
  ].filter(Boolean).join("\n");
}

// ── spot_fallacies: recognize weak/deceptive arguments ──────────────────────
const FALLACIES: Record<string, { label: string; spot: string; counter: string }> = {
  ad_hominem: { label: "Ad hominem", spot: "Attacking the person instead of their argument ('you're just a...').", counter: "Point it out and return to the actual claim: 'that's about me, not the point — the point is...'" },
  strawman: { label: "Strawman", spot: "Arguing against a distorted, weaker version of what you said.", counter: "Restate your actual position: 'that's not what I said — what I said is...'" },
  false_dichotomy: { label: "False dilemma", spot: "'Either A or B' when there are other options.", counter: "Name the third option: 'those aren't the only two choices.'" },
  appeal_emotion: { label: "Appeal to emotion", spot: "Using fear, pity, or outrage instead of evidence.", counter: "Acknowledge the feeling, then ask for the evidence: 'I hear that — but what actually shows it's true?'" },
  whataboutism: { label: "Whataboutism", spot: "Deflecting a criticism by pointing at someone else's fault.", counter: "'That may also be a problem — but it doesn't answer this one.'" },
  gish_gallop: { label: "Gish gallop", spot: "Burying you in a flood of weak claims faster than you can answer.", counter: "Refuse the pace: pick the strongest one and demand it be defended before moving on." },
  appeal_authority: { label: "False appeal to authority", spot: "'An expert said so' — when they're not an expert in THIS, or it's a lone voice vs the field.", counter: "Ask: expert in what, exactly? And what does the consensus say?" },
  slippery_slope: { label: "Slippery slope", spot: "'If we allow X, then inevitably Z' with no real chain shown.", counter: "Ask them to show each step is actually likely, not just imaginable." },
  bandwagon: { label: "Bandwagon", spot: "'Everyone believes it, so it's true.'", counter: "Popularity isn't proof — 'lots of people can be wrong; what's the evidence?'" },
  circular: { label: "Circular reasoning", spot: "The conclusion is smuggled into the premise ('it's true because it says so').", counter: "Point at the loop: 'that just assumes what we're trying to prove.'" },
};

export function spotFallacies(rawFallacy?: string): string {
  const entries = Object.entries(FALLACIES);
  if (!rawFallacy) {
    return [
      `SPOT THE FAULTY ARGUMENT — the common tricks, how to catch them, how to counter:`,
      `BOTTOM LINE: naming the trick out loud is most of the counter — a faulty argument only works while nobody says what it's doing.`,
      ``,
      ...entries.map(([, f]) => `▸ ${f.label}: ${f.spot}`),
      ``,
      `Name one for the counter-move, or just watch for these — spotting them is half of being diligent and hard to fool.`,
    ].join("\n");
  }
  const norm = rawFallacy.toLowerCase().replace(/[\s-]+/g, "_");
  const hit = entries.find(([k, f]) => k.includes(norm) || norm.includes(k) || f.label.toLowerCase().includes(clean(rawFallacy).toLowerCase()));
  if (!hit) return `Known tricks: ${entries.map(([, f]) => f.label).join(", ")}.`;
  const f = hit[1];
  return [
    `${f.label.toUpperCase()}`,
    `BOTTOM LINE: ${f.counter}`,
    ``,
    `Spot it: ${f.spot}`,
  ].join("\n");
}

// ── myth_vs_reality: the honest truth about reading people ──────────────────
export function mythVsReality(): string {
  const myths = [
    ["'93% of communication is body language / tone.'", "A misused 1970s study (Mehrabian) about how people judge FEELINGS when words and tone conflict, in a narrow lab setup. It was never about normal communication. Your words carry most of your meaning."],
    ["'You can detect lies from body language.'", "You basically can't. Meta-analyses show people — including trained police and agents — detect lies at barely above 50% (chance). There is NO reliable physical 'tell'. Nervousness and lying look the same."],
    ["'Looking up-left/right shows lying.' (the NLP eye-direction claim)", "Tested and debunked — eye direction does not indicate lying. It's one of the most confidently repeated myths with zero reliable evidence."],
    ["'Crossed arms means they're defensive or hiding something.'", "Often it just means they're cold, comfortable, or that's their habit. A single cue out of context tells you almost nothing — read clusters against a baseline."],
    ["'Good eye contact = honesty.'", "Liars often make MORE eye contact deliberately, because they know this myth. Eye contact is about culture and comfort, not truth."],
  ];
  return [
    `READING-PEOPLE MYTHS vs REALITY — the honest version (this is where pop psychology lies to you)`,
    `BOTTOM LINE: nobody reliably detects lies from body language — not you, not trained investigators. Every confident "tell" in the popular list has been tested and failed. What works is baselines and better questions, not gestures.`,
    ``,
    ...myths.map(([m, r]) => `▸ MYTH: ${m}\n   REALITY: ${r}`),
    ``,
    `The real takeaway: reading people is about baselines, clusters, consistency, and good questions — not decoding gestures. Anyone selling you a foolproof 'tell' is selling a myth. That honesty is what makes you actually harder to fool.`,
  ].join("\n");
}
