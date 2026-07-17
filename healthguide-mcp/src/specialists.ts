import { fuzzyFind, displayKey } from "./match.js";

interface Specialist {
  label: string;
  handles: string;
  concern_keywords: string[]; // free-text hints that route here
  urgency_note: string;
}

export const SPECIALISTS: Record<string, Specialist> = {
  primary_care: {
    label: "Primary Care Doctor",
    handles: "Your first stop for almost anything — general health, checkups, referrals to specialists, and the person who sees the whole picture across your other doctors.",
    concern_keywords: ["general", "checkup", "physical", "annual", "referral", "not feeling well", "fatigue", "tired"],
    urgency_note: "Usually not urgent — schedule normally unless symptoms are severe or sudden.",
  },
  nutritionist: {
    label: "Nutritionist / Registered Dietitian",
    handles: "Food, eating patterns, weight, and how diet interacts with a medical condition (diabetes, heart disease, etc.) — evidence-based, not the internet-diet kind.",
    concern_keywords: ["diet", "nutrition", "weight", "eating", "food", "supplement", "vitamin"],
    urgency_note: "Not urgent.",
  },
  gastroenterologist: {
    label: "Gastroenterologist",
    handles: "Stomach, intestines, digestion — chronic heartburn, IBS, unexplained weight loss, blood in stool, swallowing problems.",
    concern_keywords: ["stomach", "digestion", "bowel", "ibs", "acid reflux", "heartburn", "nausea", "diarrhea", "constipation", "bloating"],
    urgency_note: "Blood in stool or vomit, or severe abdominal pain, needs urgent evaluation — don't wait for a routine appointment.",
  },
  hematologist: {
    label: "Hematologist",
    handles: "Blood disorders — anemia, clotting problems, unexplained bruising/bleeding, some blood cancers.",
    concern_keywords: ["blood", "anemia", "bruising", "clotting", "bleeding disorder", "low iron"],
    urgency_note: "Usually referred by a primary doctor after bloodwork shows something off.",
  },
  ophthalmologist: {
    label: "Ophthalmologist",
    handles: "The actual medical eye doctor (not just glasses/contacts like an optometrist) — eye disease, injury, surgery, diabetic eye exams, sudden vision changes.",
    concern_keywords: ["eye", "eyes", "vision", "blurry vision", "eye pain", "seeing spots"],
    urgency_note: "Sudden vision loss, eye pain with vision change, or a curtain/shadow across vision is urgent — same-day care.",
  },
  neurologist: {
    label: "Neurologist",
    handles: "Brain, nerves, and the muscles they control — migraines, seizures, numbness/tingling, memory issues, tremor.",
    concern_keywords: ["migraine", "headache", "seizure", "numbness", "tingling", "tremor", "memory", "dizziness", "nerve"],
    urgency_note: "The 'worst headache of your life,' sudden severe headache, or headache with confusion/vision change is an emergency — not a scheduling matter.",
  },
  cardiologist: {
    label: "Cardiologist",
    handles: "Heart and blood vessels — blood pressure, chest discomfort (non-emergency), palpitations, cholesterol, heart disease follow-up.",
    concern_keywords: ["heart", "blood pressure", "palpitations", "cholesterol", "hypertension"],
    urgency_note: "Any chest pain with shortness of breath, sweating, or pain spreading to arm/jaw is a 911 emergency, not a cardiology appointment.",
  },
  hepatologist: {
    label: "Hepatologist (Liver Specialist)",
    handles: "Liver-specific conditions — hepatitis, fatty liver disease, cirrhosis, abnormal liver bloodwork.",
    concern_keywords: ["liver", "hepatitis", "jaundice", "yellow skin", "yellow eyes", "fatty liver"],
    urgency_note: "Yellowing of the skin/eyes (jaundice), confusion, or severe abdominal swelling needs urgent evaluation.",
  },
  orthopedist: {
    label: "Orthopedist",
    handles: "Bones, joints, muscles, ligaments — fractures, arthritis, chronic joint pain, sports injuries, back pain.",
    concern_keywords: ["bone", "joint", "fracture", "sprain", "arthritis", "back pain", "knee", "shoulder", "hip"],
    urgency_note: "An obviously deformed limb, inability to bear weight, or an open fracture needs the ER, not a scheduled visit.",
  },
  urologist: {
    label: "Urologist",
    handles: "Urinary tract and male reproductive health — kidney stones, UTIs that don't resolve, prostate issues, blood in urine.",
    concern_keywords: ["urinary", "bladder", "kidney stone", "prostate", "blood in urine", "uti"],
    urgency_note: "Inability to urinate at all, or severe flank pain with fever, needs urgent care.",
  },
  infectious_disease: {
    label: "Infectious Disease Specialist",
    handles: "Complex or unclear infections, STDs, viruses that a primary doctor wants a specialist's input on.",
    concern_keywords: ["infection", "std", "sti", "virus", "fever that won't go away", "sexually transmitted"],
    urgency_note: "High fever with confusion, stiff neck, or a rapidly spreading rash needs urgent/ER evaluation.",
  },
  psychiatrist: {
    label: "Psychiatrist",
    handles: "Medication management for mental health conditions — depression, anxiety, bipolar disorder, ADHD. A medical doctor, can prescribe.",
    concern_keywords: ["depression", "anxiety", "medication for depression", "bipolar", "adhd", "psychiatric medication"],
    urgency_note: "See emergency_check for any thoughts of self-harm — that always comes first.",
  },
  therapist_counselor: {
    label: "Therapist / Counselor / Psychologist",
    handles: "Talk therapy — individual, marriage/couples counseling, family therapy (parent-child, sibling relationships), grief, trauma, life stress. Does not prescribe medication.",
    concern_keywords: ["therapy", "counseling", "marriage", "couples", "husband", "wife", "spouse", "father son", "father daughter", "mother son", "mother daughter", "family conflict", "relationship", "grief", "trauma", "stress", "sad", "depressed", "anxious"],
    urgency_note: "See emergency_check for any thoughts of self-harm — that always comes first.",
  },
  sports_trainer: {
    label: "Sports Trainer / Strength & Conditioning Coach",
    handles: "Exercise programming, technique, progressive overload, and sport-specific conditioning. NOT a medical role — doesn't diagnose or treat injuries.",
    concern_keywords: ["workout plan", "exercise program", "personal trainer", "strength training", "weight training", "calisthenics", "fitness plan", "sports performance", "conditioning"],
    urgency_note: "Not urgent — but see a doctor first before starting an intense new program if you have a heart condition, joint problems, or haven't exercised in a long time.",
  },
  surgeon: {
    label: "Surgeon (incl. Emergency Surgeon)",
    handles: "Procedures to physically fix a problem — planned surgery (referred by another specialist) or emergency surgery for acute injury/illness.",
    concern_keywords: ["surgery", "operation", "surgeon"],
    urgency_note: "If surgery is being discussed as an emergency, you are likely already in an ER — that's the right place.",
  },
};

export function whichSpecialist(concern: string): string {
  const c = concern.toLowerCase();
  const scored = Object.entries(SPECIALISTS)
    .map(([key, s]) => {
      const score = s.concern_keywords.filter((k) => c.includes(k)).length;
      return { key, s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return [
      `Couldn't confidently match "${concern}" to a specialist type.`,
      `Known types: ${Object.keys(SPECIALISTS).map(displayKey).join(", ")}.`,
      `When in doubt, your primary care doctor is always a safe first stop — they can refer you to the right specialist.`,
    ].join("\n");
  }

  const top = scored.slice(0, 2);
  const blocks = top.map(({ key, s }) => [`${displayKey(key)}`, `  Handles: ${s.handles}`, `  Urgency: ${s.urgency_note}`].join("\n"));

  return [
    `BOTTOM LINE: this sounds like something typically handled by ${top.map(({ key }) => displayKey(key)).join(" or ")}.`,
    ``,
    blocks.join("\n\n"),
    ``,
    `This is a starting point for who to call, not a diagnosis — only a licensed professional examining you can tell you what's actually going on.`,
  ].join("\n");
}

export function listSpecialists(): string {
  return (
    `SPECIALISTS THIS COVERS:\n\n` +
    Object.entries(SPECIALISTS).map(([k, s]) => `- ${displayKey(k)}: ${s.handles}`).join("\n") +
    `\n\nDescribe your concern in plain words and I'll suggest who typically handles it.`
  );
}

// ---- root_cause_questions: SOCRATES-style diagnostic-thinking framework ----
// A real clinical history-taking mnemonic (Site, Onset, Character, Radiation,
// Associated symptoms, Time course, Exacerbating/relieving factors, Severity) —
// organizes YOUR thinking so you and a real doctor find the cause faster. This
// never concludes with a diagnosis; it only structures the questions.

const SOCRATES: Array<{ letter: string; question: string }> = [
  { letter: "S — Site", question: "Exactly where is it? Can you point to one spot, or is it spread out / hard to pin down?" },
  { letter: "O — Onset", question: "When did it start? Suddenly (seconds/minutes) or gradually (hours/days/weeks)? What were you doing when it started?" },
  { letter: "C — Character", question: "What does it feel like — sharp, dull, burning, throbbing, pressure, aching?" },
  { letter: "R — Radiation", question: "Does it spread or move anywhere else (e.g. from chest to arm/jaw, or from back down a leg)?" },
  { letter: "A — Associated symptoms", question: "What else is happening alongside it (fever, nausea, numbness, shortness of breath, weight change)?" },
  { letter: "T — Time course", question: "Is it constant or does it come and go? Is it getting better, worse, or staying the same over time?" },
  { letter: "E — Exacerbating/relieving", question: "What makes it worse (movement, food, position, stress)? What makes it better (rest, medication, heat/ice)?" },
  { letter: "S — Severity", question: "On a 1-10 scale, how bad is it — and how is it affecting your daily life (sleep, work, appetite)?" },
];

export function rootCauseQuestions(concern: string): string {
  const lines = SOCRATES.map((s) => `  ${s.letter}: ${s.question}`);
  return [
    `ROOT-CAUSE QUESTIONS for: ${concern}`,
    `BOTTOM LINE: answer these and you (and your doctor) will find the real cause far faster than describing it vaguely. This is the same framework doctors are trained to use — it doesn't diagnose anything, it organizes the pattern.`,
    ``,
    ...lines,
    ``,
    `Two of these matter most for deciding urgency: ONSET (sudden is more concerning than gradual) and whether it's getting WORSE over time. If either of those is true, don't wait — see 'which_specialist' or go get seen now.`,
    ``,
    `Write your answers down before your appointment — see 'prep_for_appointment'.`,
  ].join("\n");
}
