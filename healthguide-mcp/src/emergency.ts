// The one piece of this server that is NOT suppressible by design. Every tool
// that takes free-text input scans it here FIRST. A false positive costs
// nothing (the user still gets pointed at real help); a false negative could
// cost a life — so these patterns deliberately err toward over-triggering.

export interface EmergencyMatch {
  kind: "physical" | "crisis";
  matchedPhrase: string;
}

const PHYSICAL_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(crushing|severe|sudden)\b.{0,20}\bchest (pain|pressure|tightness)\b/i, label: "possible heart attack signs" },
  { re: /\bchest (pain|pressure|tightness)\b.{0,40}\b(arm|jaw|back|shortness of breath|sweating|nausea)\b/i, label: "possible heart attack signs" },
  { re: /\b(face|one side)\b.{0,15}\bdroop/i, label: "possible stroke signs" },
  { re: /\bslurred speech\b/i, label: "possible stroke signs" },
  { re: /\bsudden\b.{0,25}\b(numbness|weakness|confusion|vision loss)\b/i, label: "possible stroke signs" },
  { re: /\bcan'?t (breathe|catch my breath)\b/i, label: "severe breathing difficulty" },
  { re: /\btrouble breathing\b/i, label: "severe breathing difficulty" },
  { re: /\b(severe|uncontrolled|won'?t stop)\b.{0,15}\bbleeding\b/i, label: "severe bleeding" },
  { re: /\b(anaphylaxis|throat (is )?closing)\b/i, label: "possible severe allergic reaction" },
  { re: /\bswelling\b.{0,20}\b(throat|tongue)\b/i, label: "possible severe allergic reaction" },
  { re: /\bcoughing up blood\b/i, label: "coughing up blood" },
  { re: /\b(fainted|lost consciousness|passed out)\b/i, label: "loss of consciousness" },
  { re: /\bseizure\b/i, label: "seizure" },
  { re: /\b(overdose|took too many (pills|painkillers))\b/i, label: "possible overdose" },
  { re: /\bsevere (abdominal|stomach|belly) pain\b/i, label: "severe abdominal pain" },
];

const CRISIS_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(kill myself|end my life|suicid(e|al)|want to die|don'?t want to (be alive|live)|no reason to live)\b/i, label: "thoughts of suicide" },
  { re: /\b(hurt|harm) myself\b/i, label: "thoughts of self-harm" },
  { re: /\bplan to (kill|hurt|harm) myself\b/i, label: "a plan for self-harm" },
];

export function scanForEmergency(...texts: Array<string | undefined>): EmergencyMatch | null {
  const combined = texts.filter(Boolean).join(" ");
  for (const p of CRISIS_PATTERNS) {
    if (p.re.test(combined)) return { kind: "crisis", matchedPhrase: p.label };
  }
  for (const p of PHYSICAL_PATTERNS) {
    if (p.re.test(combined)) return { kind: "physical", matchedPhrase: p.label };
  }
  return null;
}

export function emergencyBanner(match: EmergencyMatch): string {
  if (match.kind === "crisis") {
    return [
      `STOP — THIS COMES FIRST, BEFORE ANYTHING ELSE`,
      ``,
      `What you described (${match.matchedPhrase}) matters, and you deserve real support right now, not a tool response.`,
      ``,
      `  - Call or text 988 (Suicide & Crisis Lifeline) — free, 24/7, confidential.`,
      `  - Text HOME to 741741 (Crisis Text Line) if you'd rather text.`,
      `  - If you are in immediate danger, call 911 or go to the nearest ER.`,
      ``,
      `You are not out of options, and you do not have to go through this alone. Please reach out to one of the above right now — everything else can wait.`,
    ].join("\n");
  }
  return [
    `STOP — THIS COMES FIRST, BEFORE ANYTHING ELSE`,
    ``,
    `What you described (${match.matchedPhrase}) can be a medical emergency.`,
    ``,
    `  - CALL 911 NOW, or have someone drive you to the nearest Emergency Room immediately.`,
    `  - Do not wait to see if it gets better. Do not drive yourself if you can avoid it.`,
    ``,
    `This is not the moment to look up a specialist or research anything else — get emergency help first.`,
  ].join("\n");
}

/**
 * Wraps a tool's core logic so it short-circuits to the emergency banner
 * whenever red-flag language appears in ANY of its text inputs — before the
 * tool's own logic ever runs. Used by every tool in this server that accepts
 * free text. This is the structural guarantee, not a prose reminder.
 */
export function guardEmergency<A>(extractText: (args: A) => Array<string | undefined>, handler: (args: A) => string): (args: A) => string {
  return (args: A) => {
    const match = scanForEmergency(...extractText(args));
    if (match) return emergencyBanner(match);
    return handler(args);
  };
}
