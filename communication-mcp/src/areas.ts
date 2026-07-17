// The areas of communication: speaking in public, at work, at home; debate;
// listening/understanding the other side; reading people; and nonverbal.
// Each: what it is, the real techniques, the common mistake/myth, how to
// practice. Plain words, bottom-line first.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export interface Area {
  label: string;
  keys: string[];
  what: string;
  skills: string[];
  common_mistake: string;
  practice: string[];
}

export const AREAS: Record<string, Area> = {
  public_speaking: {
    label: "Public Speaking & Presenting",
    keys: ["publicspeaking", "speech", "presentation", "presenting", "stage", "audience", "pitch", "talk", "speaking", "toastmasters", "nerves", "keynote"],
    what: "Getting a message across to a room without losing them — speeches, presentations, pitches.",
    skills: [
      "Open with a hook — a question, a short story, a surprising fact. Never 'um, so, today I'm going to talk about...'",
      "One core message. If they remember a single sentence tomorrow, what is it?",
      "Structure of three: tell them what you'll say, say it, remind them.",
      "Slow down and use pauses — silence feels long to you but powerful to them.",
      "Eye contact in 3-second holds with one person at a time, not a scan of the back wall.",
    ],
    common_mistake: "Trying to sound smart with dense slides and jargon. Clarity beats cleverness — a confused audience quietly checks out.",
    practice: ["Record yourself and watch it once (painful, but gold).", "Rehearse out loud and standing, not silently in your head.", "Memorize the open and close cold; improvise the middle."],
  },
  business: {
    label: "Business & Workplace Communication",
    keys: ["business", "work", "workplace", "meeting", "meetings", "email", "leadership", "boss", "executive", "professional", "office", "presentup", "manager"],
    what: "Meetings, email, presenting up to leadership, and the hard conversations at work.",
    skills: [
      "Lead with the bottom line (BLUF — bottom line up front). Busy people want the answer first, the detail after.",
      "Walk into any meeting knowing your ONE ask.",
      "Email: the subject names the action, the first line says what you need, the rest is skimmable.",
      "Presenting up: frame in THEIR terms — cost, risk, outcome — not your process.",
      "Disagree without damage: 'Help me understand...' and 'What if we...' beat 'You're wrong.'",
    ],
    common_mistake: "Burying the ask under paragraphs of context. Leaders decide in the first 15 seconds whether they're getting to the point — give them the point.",
    practice: ["Write your one-sentence ask before every meeting.", "Rewrite a long email to half the length.", "Study how the most-respected person in the room communicates."],
  },
  home_personal: {
    label: "At Home & Personal Relationships",
    keys: ["home", "family", "partner", "spouse", "marriage", "relationship", "friend", "personal", "kids", "parenting", "conflict", "fight"],
    what: "Talking with family, a partner, and friends — where the stakes are emotional, not logical.",
    skills: [
      "Listen to understand, not to reply. Most home fights are two people waiting for their turn to talk.",
      "Use 'I' statements: 'I feel X when Y' instead of 'You always Z' (which starts a war).",
      "Name the emotion — yours and theirs. 'You seem frustrated' de-escalates fast.",
      "Pick the moment. A hard talk when someone's tired, hungry, or rushed is a talk that fails.",
      "Repair beats winning. Being right and alone is still losing.",
    ],
    common_mistake: "Treating a relationship conflict like a debate to win. At home the goal is connection, not a verdict.",
    practice: ["Reflect back what you heard before responding ('so you're saying...').", "Ask one more question before giving your opinion.", "Apologize specifically, with no 'but' attached."],
  },
  debate_persuasion: {
    label: "Debate & Persuasion",
    keys: ["debate", "persuasion", "persuade", "argue", "argument", "convince", "rhetoric", "influence", "negotiation", "negotiate", "rebuttal"],
    what: "Making an argument that holds — and changing a mind without a fight.",
    skills: [
      "Ethos, pathos, logos: credibility, emotion, logic. You need all three, not just being right.",
      "Claim → evidence → reasoning. Say HOW the evidence proves the claim, don't leave it implied.",
      "Anticipate the rebuttal and answer it before they raise it.",
      "Concede the true parts of their side — it makes you credible and lowers their guard.",
      "Persuasion isn't overpowering; it's giving someone a way to change their mind without losing face.",
    ],
    common_mistake: "Trying to win by force. People dig in when attacked — you change minds by making it cheap and safe to agree with you.",
    practice: ["Argue the OTHER side out loud until you can do it well.", "Spot one logical fallacy a day in the wild (see spot_fallacies).", "Swap 'but' for 'and' to keep them listening."],
  },
  listening_understanding: {
    label: "Listening & Understanding the Other Side",
    keys: ["listening", "listen", "understand", "empathy", "perspective", "otherside", "steelman", "diligent", "diligence", "openminded", "curious"],
    what: "Genuinely getting where the other person is coming from — the skill under empathy, negotiation, and real diligence.",
    skills: [
      "Steelman, don't strawman: state their view so well that THEY would say 'yes, exactly' (see the steelman tool).",
      "Ask open questions ('what led you to that?') and then actually stop talking.",
      "Reflect and label: 'it sounds like you're worried about X.' People who feel heard open up.",
      "Assume you're missing something — you usually are.",
      "Separate the person from the position. They have a reason, even when you hate the conclusion.",
    ],
    common_mistake: "Listening only to find the flaw to attack. That's ammunition-gathering, not understanding — and people can feel the difference.",
    practice: ["Before disagreeing, summarize their point to THEIR satisfaction.", "Get curious about WHY they believe it, not just that they're wrong.", "Catch yourself rehearsing a reply instead of listening."],
  },
  reading_people: {
    label: "Reading People (the honest version)",
    keys: ["reading", "readpeople", "interrogator", "interrogation", "detective", "breadcrumb", "breadcrumbs", "tell", "tells", "deception", "lying", "liar", "behindtheeyes"],
    what: "Picking up what someone isn't saying — inconsistencies, hesitations, the 'breadcrumbs' — WITHOUT pretending you can read minds.",
    skills: [
      "Baseline first: how does THIS person act when they're relaxed and honest? Deviations from their own baseline are the signal — there is no universal 'tell'.",
      "Look for CLUSTERS, not single cues. One crossed arm is cold, not guilt.",
      "Notice mismatches: the words say yes but everything else says no. That gap earns a gentle question, not a verdict.",
      "Ask open, then funnel: broad question, let them talk, then narrow toward the inconsistency.",
      "Listen for what's ODD — over-explaining, an unprompted denial, a detail that doesn't fit (the breadcrumb) — and follow it with curiosity, not accusation.",
    ],
    common_mistake: "Believing body language is a lie detector. It is NOT — the biggest myth in the field (see myth_vs_reality). No gesture reliably reveals a lie; even trained interrogators barely beat a coin flip. The real edge is good questions and consistency, not reading twitches.",
    practice: ["Practice spotting baselines on people who AREN'T under suspicion.", "When something feels off, ask a question instead of concluding.", "Get comfortable with silence — people fill it, and that's where breadcrumbs fall."],
  },
  nonverbal: {
    label: "Body Language & Nonverbal",
    keys: ["bodylanguage", "nonverbal", "posture", "eyecontact", "gesture", "gestures", "microexpression", "tone", "voice", "mirroring", "proxemics", "handshake"],
    what: "What posture, eye contact, gestures, distance, and tone add to (or subtract from) your words — and what they honestly can and can't tell you.",
    skills: [
      "YOUR nonverbals matter most: open posture, steady eye contact, and a calm voice make you credible before you say a word.",
      "Feet and hands leak comfort/discomfort more than the face, which people consciously control.",
      "Mirroring builds rapport — subtly match the other person's energy and pace.",
      "Context and culture rule everything: eye contact, personal space, and gestures mean opposite things in different places.",
      "Read tone and pace as much as the body — a voice that speeds up or tightens is a real signal.",
    ],
    common_mistake: "The '93% of communication is body language' claim. That's a misused 1970s lab study (Mehrabian) about feelings-vs-tone in a narrow setup — NOT proof that your words barely matter. Your actual message still matters most.",
    practice: ["Fix your own baseline first (posture, voice) — it's the part you control.", "Watch muted video and guess the emotion, then check.", "Notice distance: where someone chooses to stand tells you their comfort."],
  },
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "").replace(/[^a-z0-9]/g, "");
}

const AREA_INDEX: Record<string, string> = {};
for (const [key, a] of Object.entries(AREAS)) {
  AREA_INDEX[normalize(key)] = key;
  AREA_INDEX[normalize(a.label)] = key;
  for (const k of a.keys) AREA_INDEX[normalize(k)] = key;
}

export function resolveArea(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(AREA_INDEX, norm)) return AREA_INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(AREA_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

export function explainSkill(area?: string): string {
  if (!area) {
    return (
      `THE AREAS OF COMMUNICATION — pick one, or describe your situation:\n\n` +
      Object.values(AREAS).map((a) => `▸ ${a.label}: ${a.what}`).join("\n") +
      `\n\nFor a specific moment (a speech, a hard talk, a negotiation) use prepare. To read someone honestly use read_people. To fairly understand the other side use steelman.`
    );
  }
  const key = resolveArea(area);
  if (!key) return `Not sure which area "${clean(area)}" is. Areas: ${Object.values(AREAS).map((a) => a.label).join(", ")}.`;
  const a = AREAS[key];
  return [
    `${a.label}${normalize(area) !== normalize(key) ? ` (from "${clean(area)}")` : ""}`,
    `BOTTOM LINE: ${a.what}`,
    ``,
    `The real techniques:`,
    ...a.skills.map((s) => `  • ${s}`),
    ``,
    `The common mistake: ${a.common_mistake}`,
    ``,
    `How to get better:`,
    ...a.practice.map((p) => `  • ${p}`),
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is how to communicate and read people — speak in public, at work, at home; debate and persuade; understand the other side; and read people HONESTLY (no mind-reading myths).`,
    ``,
    `  • A skill area → 'explain_skill <area>' (or no area for the map).`,
    `  • A specific moment (speech, hard talk, negotiation, interview) → 'prepare <situation>'.`,
    `  • Reading someone / thinking like an interrogator → 'read_people' (honest version).`,
    `  • Understand the other side fairly → 'steelman'.  Be hard to fool → 'spot_fallacies'.`,
    `  • The truth about body language → 'myth_vs_reality'.`,
    ``,
    `The through-line: real technique and honesty. No foolproof 'tells' — because those are a myth, and knowing that is what makes you good.`,
  ].join("\n");
}
