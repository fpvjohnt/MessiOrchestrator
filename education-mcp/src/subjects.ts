// The subjects of school, HS through university, with the actual classes (in
// rough order), why the subject matters, how to actually study it, and what it
// connects to. Plain words, bottom-line first.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export interface Subject {
  label: string;
  keys: string[];
  what: string;
  classes: string[]; // roughly ordered, HS -> college -> advanced
  why: string;
  how_to_study: string[];
  connects: string[];
}

export const SUBJECTS: Record<string, Subject> = {
  mathematics: {
    label: "Mathematics",
    keys: ["math", "mathematics", "algebra", "geometry", "trigonometry", "trig", "precalculus", "calculus", "statistics", "stats", "arithmetic", "linearalgebra", "numbers"],
    what: "The language of patterns, quantity, and logic — from counting to the calculus that models change itself.",
    classes: ["Pre-Algebra", "Algebra I", "Geometry", "Algebra II", "Trigonometry", "Pre-Calculus", "Calculus (AB/BC)", "Statistics", "Linear Algebra", "Discrete Math", "Differential Equations"],
    why: "The gate to every STEM field, finance, and data work — and the best training there is in rigorous, step-by-step reasoning.",
    how_to_study: [
      "Do problems — math is a doing subject, reading about it isn't enough.",
      "Master each layer before the next; gaps compound fast (weak algebra wrecks calculus).",
      "Write every step; most wrong answers are careless slips, not concept gaps.",
      "Explain a solution out loud — if you can't, you don't own it yet.",
    ],
    connects: ["Physics", "Computer Science", "Economics", "Statistics"],
  },
  sciences: {
    label: "Natural Sciences",
    keys: ["science", "sciences", "biology", "chemistry", "physics", "earthscience", "environmental", "anatomy", "astronomy", "lab", "geology"],
    what: "How the natural world works, pinned down by experiment — living things, matter, energy, and the planet.",
    classes: ["Biology", "Chemistry", "Physics", "Earth/Environmental Science", "Anatomy & Physiology", "Astronomy", "Organic Chemistry", "Microbiology", "Genetics"],
    why: "The road into medicine, engineering, and research — and how you tell a real finding from a viral myth.",
    how_to_study: [
      "Chase the mechanism — why it happens, not just what happens.",
      "Draw the cycles and diagrams from memory (Krebs, the water cycle, circuits).",
      "The lab IS the subject — understand the experiment, not just the number it gave.",
      "For any claim, ask what evidence backs it — the curiosity asset's check_claim is built for exactly this.",
    ],
    connects: ["Mathematics", "the curiosity asset (the science behind the class)"],
  },
  english_language_arts: {
    label: "English & Language Arts",
    keys: ["english", "ela", "writing", "composition", "literature", "reading", "grammar", "rhetoric", "essay", "creativewriting", "poetry"],
    what: "Reading closely, writing clearly, and building an argument that holds — the most transferable skill set in school.",
    classes: ["English 9-12", "Composition", "Literature", "Creative Writing", "Rhetoric", "AP Language", "AP Literature", "College Writing"],
    why: "Every field runs on clear writing and reading. This is the skill that quietly decides how far the others take you.",
    how_to_study: [
      "Read actively — annotate, ask questions, summarize each section in a sentence.",
      "Write a bad draft first, then revise; the draft is not the essay.",
      "Read your own writing aloud — your ear catches what your eye skips.",
      "Learn the argument spine (claim → evidence → reasoning); it transfers to every subject and job.",
    ],
    connects: ["Social Studies", "World Languages", "the lawguide asset (argument)"],
  },
  social_studies: {
    label: "Social Studies",
    keys: ["socialstudies", "history", "geography", "government", "civics", "economics", "econ", "psychology", "sociology", "politics"],
    what: "How humans organize, govern, trade, and remember — societies past and present, and the forces that move them.",
    classes: ["World History", "US History", "Geography", "Government/Civics", "Economics", "Psychology", "Sociology", "Political Science", "Anthropology"],
    why: "Informed citizenship, and understanding the three things that run the world — power, money, and people.",
    how_to_study: [
      "Learn the story and the causes, not a list of dates — dates are hooks, causation is the point.",
      "Compare across time and place; the same patterns repeat (revolutions, bubbles, empires).",
      "Read primary sources and ask what the author wanted you to think.",
      "Tie the past to today — history is just the news with the ending known.",
    ],
    connects: ["a future civics/government asset", "the curiosity asset (ancient history)", "Economics"],
  },
  world_languages: {
    label: "World Languages",
    keys: ["language", "languages", "spanish", "french", "german", "mandarin", "chinese", "latin", "japanese", "asl", "bilingual"],
    what: "Communicating in another language — and getting a second window onto how the world is thought about.",
    classes: ["Spanish I-IV", "French I-IV", "German", "Mandarin", "Latin", "Japanese", "ASL", "AP Language & Culture"],
    why: "A career edge, real travel, sharper thinking, and the ability to actually connect with people on their terms.",
    how_to_study: [
      "Short daily practice beats weekly cramming — a language needs frequent reps.",
      "Speak early and badly; fluency comes from use, not from waiting to be perfect.",
      "Immerse cheaply — music, shows, phone in the target language — make input constant.",
      "Learn high-frequency words first; the top ~1,000 words cover most everyday conversation.",
    ],
    connects: ["a future linguistics asset", "the culture and history behind the language"],
  },
  arts: {
    label: "Arts",
    keys: ["art", "arts", "music", "drawing", "painting", "theater", "drama", "dance", "film", "photography", "band", "choir", "design"],
    what: "Making and understanding creative work — visual, musical, and performed — and the craft underneath it.",
    classes: ["Visual Art", "Drawing & Painting", "Music (Band/Choir/Theory)", "Theater/Drama", "Dance", "Film", "Photography", "Art History"],
    why: "Creativity and expression — and it strengthens focus, pattern-sense, and discipline that carry into everything else.",
    how_to_study: [
      "Practice deliberately — aim at the weak spot, not the part that's already fun.",
      "Study the masters, imitate to learn the moves, then diverge into your own.",
      "Volume of finished work beats agonizing over one perfect piece.",
      "Get feedback often, and separate the critique from your ego — it's about the work.",
    ],
    connects: ["English (creative writing)", "the curiosity asset (art history)", "Computer/Tech (digital media)"],
  },
  computer_technology: {
    label: "Computer Science & Technology",
    keys: ["computer", "computerscience", "cs", "coding", "programming", "webdesign", "robotics", "engineering", "cybersecurity", "technology", "techED", "data"],
    what: "How computers work and how to make them do things — code, systems, hardware, and the logic under all of it.",
    classes: ["Intro to Computer Science", "AP CS Principles", "AP CS A (Java)", "Web Design", "Programming", "Robotics", "Engineering/Tech Ed", "Cybersecurity", "Data Science"],
    why: "Among the highest-demand skills anywhere — the subject that builds tools and automates the boring parts.",
    how_to_study: [
      "Build things — small projects teach what lectures can't.",
      "Break a problem into the smallest steps and debug them one at a time.",
      "Read the error message carefully; it almost always names the fix.",
      "Learn one language well before chasing five — the concepts transfer.",
    ],
    connects: ["Mathematics", "the polymath asset (the professional/career version)"],
  },
  career_technical: {
    label: "Career & Technical (CTE / Vocational)",
    keys: ["cte", "vocational", "trade", "trades", "business", "accounting", "marketing", "nursing", "culinary", "automotive", "construction", "welding", "agriculture", "cosmetology"],
    what: "Hands-on, job-focused programs that teach a real trade or career skill directly, often with an industry certification at the end.",
    classes: ["Business & Accounting", "Marketing", "Health Science / Nursing pathway", "Culinary Arts", "Automotive", "Construction & Trades", "Welding", "Agriculture", "Cosmetology"],
    why: "A direct path to a paycheck and a credential — frequently without needing a four-year degree.",
    how_to_study: [
      "Get the hands-on hours — CTE rewards practice, not memorization.",
      "Chase the industry certification the program prepares you for (it's the real payoff).",
      "Keep a portfolio or logbook of actual work you've done.",
      "Network — CTE instructors usually have direct industry contacts.",
    ],
    connects: ["the jobhunt asset (career pathways)", "the polymath asset (technical trades)"],
  },
  health_pe: {
    label: "Health & Physical Education",
    keys: ["health", "pe", "physicaleducation", "fitness", "nutrition", "sports", "weighttraining", "firstaid", "wellness"],
    what: "The body — fitness, health, and how to keep both running for life.",
    classes: ["Physical Education", "Health", "Nutrition", "Sports/Athletics", "Weight Training", "First Aid/CPR"],
    why: "Lifelong health — and exercise is one of the most reliable ways to boost the learning you do in every other class.",
    how_to_study: [
      "Apply it — health is a daily practice, not a test to pass and forget.",
      "Understand the why (why protein, why cardio, why sleep) — the healthguide asset goes deep on this.",
      "Consistency beats intensity — small habits held for years win.",
    ],
    connects: ["the healthguide asset", "Biology"],
  },
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "").replace(/[^a-z0-9]/g, "");
}

const SUBJECT_INDEX: Record<string, string> = {};
for (const [key, s] of Object.entries(SUBJECTS)) {
  SUBJECT_INDEX[normalize(key)] = key;
  SUBJECT_INDEX[normalize(s.label)] = key;
  for (const k of s.keys) SUBJECT_INDEX[normalize(k)] = key;
}

export function resolveSubject(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(SUBJECT_INDEX, norm)) return SUBJECT_INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(SUBJECT_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

export function exploreSubject(subject?: string): string {
  if (!subject) {
    return (
      `THE SUBJECTS OF SCHOOL (high school → college → university) — pick one, or name any class:\n\n` +
      Object.values(SUBJECTS).map((s) => `▸ ${s.label}: ${s.what}`).join("\n") +
      `\n\nAsk by subject or a specific class ("calculus", "chemistry", "AP world history", "welding"). For the class ladder use course_path; for how to learn it use study_skills.`
    );
  }
  const key = resolveSubject(subject);
  if (!key) return `Not sure which subject "${clean(subject)}" is. Subjects: ${Object.values(SUBJECTS).map((s) => s.label).join(", ")}.`;
  const s = SUBJECTS[key];
  return [
    `${s.label}${normalize(subject) !== normalize(key) ? ` (from "${clean(subject)}")` : ""}`,
    `BOTTOM LINE: ${s.what}`,
    ``,
    `Classes (roughly in order): ${s.classes.join(" → ")}`,
    ``,
    `Why it's worth it: ${s.why}`,
    ``,
    `How to actually study it:`,
    ...s.how_to_study.map((h) => `  • ${h}`),
    ``,
    `Connects to: ${s.connects.join(", ")}`,
  ].join("\n");
}

export function coursePath(subject?: string): string {
  if (!subject) {
    return (
      `COURSE LADDERS — the usual order of classes per subject (name a subject for one):\n\n` +
      Object.values(SUBJECTS).map((s) => `▸ ${s.label}: ${s.classes.join(" → ")}`).join("\n")
    );
  }
  const key = resolveSubject(subject);
  if (!key) return `Not sure which subject "${clean(subject)}" is. Try one of: ${Object.keys(SUBJECTS).join(", ")}.`;
  const s = SUBJECTS[key];
  return [
    `COURSE LADDER — ${s.label}`,
    `BOTTOM LINE: take these roughly in order; each one leans on the one before it.`,
    ``,
    ...s.classes.map((c, i) => `  ${i + 1}. ${c}`),
    ``,
    `The rule that matters: don't skip a rung. A shaky class low on the ladder makes every class above it harder than it should be. Solidify, then climb.`,
  ].join("\n");
}

const UNIVERSAL_STUDY = [
  "Active recall — close the book and retrieve it from memory; testing yourself beats re-reading, by a lot.",
  "Spaced repetition — review a little across several days; cramming fades within a week.",
  "Teach it — explaining a topic to someone (or an empty room) exposes exactly what you don't actually know.",
  "Focused blocks — one thing at a time (try 25 min on / 5 off); multitasking quietly halves your learning.",
  "Sleep is study — memory consolidates overnight; an all-nighter trades tomorrow's recall for tonight's cramming.",
];

export function studySkills(subject?: string): string {
  const universal = [`HOW TO ACTUALLY LEARN (works for every subject):`, ...UNIVERSAL_STUDY.map((u) => `  • ${u}`)];
  if (!subject) return universal.join("\n");
  const key = resolveSubject(subject);
  if (!key) return [...universal, ``, `(No subject matched "${clean(subject)}" for subject-specific tips — the universal ones above still apply.)`].join("\n");
  const s = SUBJECTS[key];
  return [
    `STUDYING ${s.label.toUpperCase()}`,
    ...s.how_to_study.map((h) => `  • ${h}`),
    ``,
    ...universal,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is the map of school — every subject and class from high school through university, how they ladder, and how to actually learn them.`,
    ``,
    `  • What's a subject/class about → 'explore_subject <name>' (or no name for the full map).`,
    `  • What order to take classes → 'course_path <subject>'.`,
    `  • How to study well → 'study_skills' (universal) or 'study_skills <subject>'.`,
    `  • What it takes to graduate / get a degree → 'requirements' (verify your school's specifics via research).`,
    ``,
    `Course content itself (the actual chemistry, the actual history) lives in the curiosity asset and research — this asset maps the education, and points you there.`,
  ].join("\n");
}
