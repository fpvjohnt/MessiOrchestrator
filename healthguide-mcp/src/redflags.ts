import { fuzzyFind, displayKey } from "./match.js";

interface Flag {
  bottom_line: string;
  looks_like: string;
  why: string;
  move: string;
}

export const RED_FLAGS: Record<string, Flag> = {
  self_diagnosis_online: {
    bottom_line: "Symptom-searching online reliably lands on the scariest possible answer — that's how the algorithm works, not how medicine works.",
    looks_like: "Googling a symptom and landing on a rare, serious disease within three clicks.",
    why: "Search results favor dramatic content, not statistical likelihood. Common things are common; a real exam changes the odds completely.",
    move: "Use 'root_cause_questions' to organize the pattern, then bring it to a real doctor instead of a search engine.",
  },
  stopping_medication_abruptly: {
    bottom_line: "Stopping a prescribed medication suddenly on your own can be more dangerous than the side effect that made you want to stop.",
    looks_like: "Quitting an antidepressant, blood pressure med, or steroid cold-turkey because of a side effect or a bad day.",
    why: "Several medication classes cause real withdrawal/rebound effects if stopped abruptly — this is a medical fact, not a scare tactic.",
    move: "Call the prescriber before stopping anything. Almost every medication has a safer way to adjust or come off it.",
  },
  supplement_interactions: {
    bottom_line: "\"Natural\" supplements are not automatically safe to combine with medications or each other.",
    looks_like: "Stacking multiple supplements, or adding one alongside a prescription, based on an influencer recommendation.",
    why: "Supplements can meaningfully change how prescription drugs are absorbed or metabolized (e.g. St. John's Wort with many medications, high-dose vitamin K with blood thinners).",
    move: "Tell your doctor and pharmacist about every supplement you take — pharmacists specifically are trained on interactions and it's a free question to ask.",
  },
  std_testing_stigma: {
    bottom_line: "Avoiding STD testing out of embarrassment is how treatable things become serious, and how they spread to others.",
    looks_like: "Delaying testing/treatment, or avoiding it because of shame.",
    why: "Most STDs are very treatable, testing is confidential, and delay is what causes real complications — not the test itself.",
    move: "Same-day/low-cost testing exists at community health clinics — see 'find_care'. It is routine medical care, not a judgment.",
  },
  miracle_cure_claims: {
    bottom_line: "'This one thing cures/reverses/melts away X' is the single most reliable tell of health misinformation.",
    looks_like: "A product or protocol promising a dramatic result that mainstream medicine 'doesn't want you to know.'",
    why: "Real medical breakthroughs are reported by major health bodies and covered widely — not gatekept to one video or one seller.",
    move: "Run the claim through 'check_the_science' before spending money or changing your treatment based on it.",
  },
  skipping_follow_up: {
    bottom_line: "Feeling better is not the same as being done — skipping follow-up is how manageable conditions become serious ones.",
    looks_like: "Stopping antibiotics early, skipping a recheck after a scan, or not going back because symptoms improved.",
    why: "Many conditions look better before they're actually resolved (infections, cancer screening follow-ups, medication-dose adjustments).",
    move: "Keep the follow-up appointment even if you feel fine — it's often the appointment that catches the thing that matters.",
  },
};

export function redFlag(issue?: string): string {
  if (!issue) return `HEALTH TRAPS — one line each; ask for any:\n\n` + Object.entries(RED_FLAGS).map(([k, f]) => `- ${displayKey(k)}: ${f.bottom_line}`).join("\n");
  const found = fuzzyFind(RED_FLAGS, issue);
  if (!found) return `Don't know "${issue}". I have: ${Object.keys(RED_FLAGS).join(", ")}.`;
  const f = found.value;
  return [`${displayKey(found.key)} — BOTTOM LINE: ${f.bottom_line}`, ``, `What it looks like: ${f.looks_like}`, `Why it's dangerous: ${f.why}`, `Your move: ${f.move}`].join("\n");
}
