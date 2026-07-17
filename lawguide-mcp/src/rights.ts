import { fuzzyFind, displayKey } from "./match.js";

// Appended to high-stakes detail outputs so the "info not advice" frame is never
// missing where it matters most.
const GUARDRAIL = `\n\n(Legal information, not advice, and not confidential. For anything serious, get a licensed lawyer — often free. Run 'get_a_lawyer'.)`;

// Legal INFORMATION, plain words, bottom-line first. Not legal advice; nothing
// here is confidential. California + federal. For anything serious the honest
// answer is always: get a licensed lawyer (free/cheap options exist).

export const RIGHTS_STEP_COUNT = 6; // keep index.ts schema max in sync

const RIGHTS_STEPS: Array<{ title: string; body: string }> = [
  {
    title: "You have the right to stay silent — use it",
    body: "You almost never have to answer a police officer's questions beyond identifying yourself. Talking is how most people hurt themselves. Say it out loud: 'I am going to remain silent. I want a lawyer.' Then actually stop talking. Being polite is fine; explaining your side is not — save that for your lawyer.",
  },
  {
    title: "You have the right to a lawyer — even a free one",
    body: "For criminal charges, if you can't afford a lawyer the court gives you one for free: a public defender. Ask for a lawyer and stop answering questions. Once you ask for a lawyer, police are supposed to stop questioning you. Say the word 'lawyer' early and often.",
  },
  {
    title: "You can refuse a search",
    body: "You can say: 'I do not consent to a search.' Say it calmly. It may not physically stop them if they have a warrant or legal cause — but never give up the right by saying 'sure, go ahead.' Refusing a search is not a crime and is not evidence of guilt.",
  },
  {
    title: "Ask if you're free to go",
    body: "If you're not sure whether you're detained, ask: 'Officer, am I being detained, or am I free to go?' If free, you can calmly leave. If detained, stay calm, don't argue, and repeat that you want a lawyer and will stay silent.",
  },
  {
    title: "Comply physically, fight it later",
    body: "Even if the police are wrong, do NOT resist, run, or lie. Physically comply; keep your words to 'I want a lawyer, I'm staying silent.' You beat a bad stop in court with a lawyer — never on the street. Resisting or lying creates NEW crimes on top of whatever started it.",
  },
  {
    title: "You can record police in public (California)",
    body: "In California you may record officers doing their job in public, as long as you don't physically interfere. A recording can protect you. Keep a safe distance and keep your hands visible.",
  },
];

export function knowYourRights(step?: number): string {
  if (step !== undefined) {
    const i = Math.floor(step);
    if (i < 1 || i > RIGHTS_STEPS.length) return `Steps go 1 to ${RIGHTS_STEPS.length}. Ask for one at a time.`;
    const s = RIGHTS_STEPS[i - 1];
    const next = i < RIGHTS_STEPS.length ? `\n\nNext: ask for step ${i + 1}.` : `\n\nThat's the last one. The whole idea: stay calm, stay quiet, say 'lawyer'.`;
    return `RIGHT ${i} OF ${RIGHTS_STEPS.length}: ${s.title}\n\n${s.body}${next}${GUARDRAIL}`;
  }
  return [
    `BOTTOM LINE: stay calm, stay quiet, and say "I want a lawyer." That one habit prevents most self-inflicted legal damage.`,
    ``,
    ...RIGHTS_STEPS.map((s, i) => `  ${i + 1}. ${s.title}`),
    ``,
    `Want them one at a time, plain and simple? Ask for step 1.`,
    ``,
    `(This is legal information, not advice, and it is not confidential. For anything serious, get a real lawyer — see 'get_a_lawyer'.)`,
  ].join("\n");
}

// Rights across EVERY common situation, not just police. Bottom-line first,
// plain words, California-flavored. Undocumented people have most of these too.
interface RightsContext {
  bottom_line: string;
  rights: string[];
  move: string;
}

export const RIGHTS_CONTEXTS: Record<string, RightsContext> = {
  police_stop: {
    bottom_line: "You can stay silent, refuse a search, and ask if you're free to go. (Full step-by-step: 'know_your_rights'.)",
    rights: [
      "Right to remain silent — 'I'm going to remain silent.'",
      "Right to refuse a search — 'I do not consent to a search.'",
      "Right to ask 'Am I being detained, or free to go?'",
      "Right to record police in public (California).",
    ],
    move: "Stay calm, comply physically, say little, ask for a lawyer. Fight a bad stop in court, never on the street.",
  },
  arrested: {
    bottom_line: "Silence + a lawyer (free if you can't afford one). Say it and stop talking.",
    rights: [
      "Right to remain silent — anything you say is used against you.",
      "Right to a lawyer, and a FREE public defender if you can't afford one.",
      "Miranda warning required before they question you in custody.",
      "Right to know the charges and to a reasonably speedy trial.",
    ],
    move: "'I'm going to remain silent. I want a lawyer.' Then stop. Don't explain, resist, or sign anything.",
  },
  workplace: {
    bottom_line: "California workers have strong rights — minimum wage, overtime, breaks, a safe workplace, and protection from discrimination — even if undocumented.",
    rights: [
      "Minimum wage + overtime (over 8 hrs/day or 40/week).",
      "Meal and rest breaks; timely final paycheck (immediately if fired).",
      "Protection from discrimination/harassment (race, sex, religion, disability, age 40+, etc.).",
      "Right to discuss your pay with coworkers; workers' comp if injured; whistleblower protection.",
      "'At-will' — but they still can't fire you for an ILLEGAL reason (retaliation, discrimination).",
    ],
    move: "Document everything in writing. For wage issues: CA Labor Commissioner. For discrimination: CA Civil Rights Dept. Legal aid helps free.",
  },
  housing: {
    bottom_line: "As a tenant you have a right to a livable home, proper notice, your deposit back, and no illegal lock-outs — California protects renters heavily.",
    rights: [
      "A habitable home (working plumbing, heat, safety) — landlord must repair.",
      "Proper notice before entry (usually 24 hrs) and before eviction.",
      "Security-deposit limits and an itemized return.",
      "Protection from retaliation and discrimination; often 'just-cause' eviction rules.",
      "Landlord CANNOT lock you out, remove your stuff, or shut off utilities to force you out ('self-help' eviction is illegal).",
    ],
    move: "Everything in writing, keep photos. Eviction notices have very short deadlines (days) — get tenant legal aid FAST ('find_legal_resources').",
  },
  driving: {
    bottom_line: "Show license/registration/insurance and stay calm — but you can still refuse a car search and stay silent beyond IDing yourself.",
    rights: [
      "Must provide license, registration, insurance when driving.",
      "You can decline a vehicle search — they need cause or a warrant.",
      "Right to remain silent beyond identifying yourself.",
      "DUI: 'implied consent' — refusing a chemical test after arrest has license consequences.",
    ],
    move: "Hands visible, be polite, don't admit anything ('where are you coming from?' — you can decline). A DUI is criminal — get a lawyer.",
  },
  debt: {
    bottom_line: "You can't be jailed for owing consumer debt, and collectors have hard legal limits — a lot of their scare tactics are illegal.",
    rights: [
      "No debtor's prison — you can't be arrested for owing a normal debt.",
      "FDCPA: no harassment, threats, calls at odd hours, or pretending to be police/lawyers.",
      "Right to demand written 'validation' of the debt.",
      "Right to dispute errors on your credit report (FCRA).",
      "Debt past the statute of limitations is generally uncollectable.",
    ],
    move: "Get it in writing, don't admit or pay on old debt without checking the SOL. Consumer-rights legal aid is often free.",
  },
  consumer: {
    bottom_line: "You have rights against scams and bad products — warranties, some cancel-rights, and truth in advertising.",
    rights: [
      "3-day 'cooling-off' right to cancel certain door-to-door / high-pressure sales.",
      "Warranty protections (implied warranty that goods work).",
      "Protection from false advertising and bait-and-switch (CA is strong here).",
      "Right to dispute fraudulent credit-card charges.",
    ],
    move: "Keep receipts and written promises. CA Dept of Consumer Affairs and small claims court are your friends for smaller disputes.",
  },
  immigration: {
    bottom_line: "You have rights REGARDLESS of immigration status: stay silent, don't open the door without a judge's warrant, don't sign anything, get a lawyer. NEVER a notario.",
    rights: [
      "Right to remain silent — you don't have to answer about status or birthplace.",
      "Right NOT to open your door unless they show a warrant SIGNED BY A JUDGE (an ICE 'administrative' form is not enough).",
      "Right to speak to a lawyer (not free, but the right exists) and to call your consulate.",
      "Right NOT to sign anything you don't understand — signing can waive rights or agree to leave.",
    ],
    move: "Say 'I want to remain silent and speak to a lawyer.' Carry a know-your-rights card. Get a licensed immigration attorney/accredited rep immediately — never a notario.",
  },
  privacy: {
    bottom_line: "In California you have real data-privacy rights (CCPA) and it's a two-party recording state — both people must consent to record a private call.",
    rights: [
      "CCPA/CPRA: right to know what data companies collect, to delete it, and to opt out of its sale.",
      "California is a TWO-PARTY consent state — recording a private conversation needs everyone's consent.",
      "Medical records are protected (HIPAA).",
    ],
    move: "You can formally request or delete your data from companies. Recording police in PUBLIC is different — that's allowed.",
  },
  healthcare: {
    bottom_line: "You have a right to emergency care regardless of ability to pay or status, to informed consent, and to medical privacy.",
    rights: [
      "Emergency rooms must treat/stabilize you regardless of money or immigration status (EMTALA).",
      "Right to informed consent before treatment.",
      "Right to your medical records and to privacy (HIPAA).",
    ],
    move: "Ask for itemized bills; hospitals have charity-care/financial-assistance programs — ask for them.",
  },
};

export function rightsIn(context?: string): string {
  if (!context) {
    return (
      `YOUR RIGHTS — pick the situation you're in:\n\n` +
      Object.entries(RIGHTS_CONTEXTS).map(([k, r]) => `▸ ${displayKey(k)}: ${r.bottom_line}`).join("\n") +
      `\n\nAsk for any by name (e.g. "work", "housing", "immigration"). For police stops step-by-step, use 'know_your_rights'.`
    );
  }
  const found = fuzzyFind(RIGHTS_CONTEXTS, context);
  if (!found) return `Don't have a rights sheet for "${context}". I cover: ${Object.keys(RIGHTS_CONTEXTS).join(", ")}.`;
  const r = found.value;
  return [
    `YOUR RIGHTS — ${displayKey(found.key)}`,
    `BOTTOM LINE: ${r.bottom_line}`,
    ``,
    `You have the right to:`,
    ...r.rights.map((x) => `  • ${x}`),
    ``,
    `Your move: ${r.move}`,
    ``,
    `(Legal information, not advice, and not confidential. For anything serious, get a licensed lawyer — often free. Run 'get_a_lawyer'.)`,
  ].join("\n");
}

const ARENAS: Record<string, string> = {
  criminal:
    "BOTTOM LINE: the GOVERNMENT is trying to punish you and you could lose your freedom.\n\nA prosecutor (the DA) must prove you guilty 'beyond a reasonable doubt' — the highest bar. You get big protections: the right to stay silent, a free lawyer if you can't afford one, and a jury. Levels: infraction (fine only, like most tickets) < misdemeanor (up to ~1 year jail) < felony (prison). If it's criminal: say little, get a lawyer FIRST.",
  civil:
    "BOTTOM LINE: a person or company is fighting you over MONEY, not jail.\n\nNobody goes to jail; it's about who pays whom. Lower bar to lose ('more likely than not', 51%). No free lawyer is provided. Starts when you're 'served' with a complaint — and you usually have only ~30 days to file a written 'answer' or you AUTO-LOSE (default judgment). Deadlines are everything here.",
  traffic:
    "BOTTOM LINE: usually a fine + points, but ignoring it turns small into big.\n\nMost tickets are infractions (fine, no jail). You can pay, contest, or often do traffic school to keep points off your insurance. BUT miss the deadline on the ticket and it becomes a bigger problem (extra fees, hold on your license). Some 'traffic' matters (DUI, reckless) are actually CRIMINAL — different arena.",
  administrative:
    "BOTTOM LINE: a government AGENCY (IRS, DMV, unemployment, licensing) is acting, with its own rules and its own appeal process.\n\nNot a normal court. Each agency has deadlines and an appeals path. You often have a right to respond and appeal — but you must do it in writing, on time. For the IRS specifically, the Taxpayer Advocate Service and Low-Income Taxpayer Clinics can help free.",
  immigration:
    "BOTTOM LINE: FEDERAL, and the stakes are the highest of all — staying in the country.\n\nImmigration court is separate from criminal court, but a criminal case can trigger immigration consequences. Decisions can be permanent (deportation, bars on returning). There is NO free government lawyer in immigration court — but nonprofit clinics help. ⚠️ NEVER use a 'notario' — they are not lawyers and wreck cases. Use a real immigration attorney or an accredited representative.",
};

export function whichArena(situation?: string): string {
  if (!situation) {
    return (
      `WHICH ARENA ARE YOU IN? The law splits into worlds that work totally differently:\n\n` +
      Object.entries(ARENAS).map(([k, v]) => `▸ ${displayKey(k)}: ${v.split("\n")[0].replace("BOTTOM LINE: ", "")}`).join("\n") +
      `\n\nAsk for any one by name to understand it. Knowing your arena tells you your rights, your deadlines, and your stakes.`
    );
  }
  const found = fuzzyFind(ARENAS, situation);
  return found ? `${displayKey(found.key)}\n${found.value}${GUARDRAIL}` : `Don't know "${situation}". Arenas: ${Object.keys(ARENAS).join(", ")}.`;
}

const PROCESSES: Record<string, string> = {
  criminal:
    "HOW A CRIMINAL CASE FLOWS:\n  1. Stop/arrest → 2. Booking → 3. Arraignment (you hear the charges, enter a plea, bail is set) → 4. Pretrial / preliminary hearing (judge checks if there's enough evidence) → 5. Motions & plea bargaining (most cases end here in a deal) → 6. Trial → 7. Sentencing.\nGet a lawyer BEFORE the arraignment if you can. Most cases are resolved by plea, not trial — a lawyer's job is often to shrink the charge/penalty.",
  civil:
    "HOW A LAWSUIT FLOWS:\n  1. You're SERVED a complaint → 2. You file an ANSWER within ~30 days (miss this = auto-lose) → 3. Discovery (both sides swap evidence, do depositions) → 4. Motions → 5. Settlement talks (most cases settle) → 6. Trial → 7. Judgment/collection.\nThe first move that matters: answer on time. Even a simple answer stops a default judgment.",
  traffic:
    "HOW A TRAFFIC TICKET FLOWS:\n  1. You get the ticket (note the due date!) → 2. Choose: pay (admits guilt), contest (court date), or ask about traffic school → 3. If you contest: arraignment, then a trial where the officer must show up → 4. Outcome: dismissed, reduced, or fine + points.\nTraffic school often keeps the point off your record/insurance — ask the court if you're eligible.",
  small_claims:
    "SMALL CLAIMS (do-it-yourself court for smaller money disputes):\n  1. Try to demand payment in writing first → 2. File your claim (small fee) → 3. Serve the other side → 4. Show up with your evidence (photos, texts, contracts, receipts) → 5. The judge decides that day.\nNo lawyers allowed in the hearing — it's built for regular people. California's dollar limit is in the reference data ('get_reference').",
  immigration:
    "HOW IMMIGRATION COURT FLOWS (removal cases):\n  1. Notice to Appear (NTA) → 2. Master calendar hearing (scheduling, you say what relief you'll seek) → 3. File applications → 4. Individual (merits) hearing → 5. Judge's decision → 6. Appeal (BIA) if needed.\nDeadlines are strict and missing a hearing can mean an automatic removal order. Get an immigration attorney or accredited rep IMMEDIATELY — never a notario.",
};

export function explainProcess(arena?: string): string {
  if (!arena) {
    return `HOW CASES FLOW — pick an arena:\n\n` + Object.keys(PROCESSES).map((k) => `▸ ${k}`).join("\n") + `\n\nAsk for one by name (e.g. "criminal").`;
  }
  const found = fuzzyFind(PROCESSES, arena);
  return found ? found.value : `Don't know "${arena}". I have: ${Object.keys(PROCESSES).join(", ")}.`;
}

export const TERMS: Record<string, string> = {
  arraignment: "Your first court date, where you hear the charges and say guilty / not guilty. Have a lawyer by now if you can.",
  plea: "Your answer to a charge: guilty, not guilty, or 'no contest' (not fighting it). A 'plea bargain' is a deal to plead to something smaller.",
  discovery: "The evidence-swap phase — both sides must show each other what they have (documents, witness lists, depositions). It's how you see the case against you.",
  subpoena: "A legal order to show up or hand over documents. Ignoring one is serious — talk to a lawyer, don't just blow it off.",
  infraction: "The smallest offense — fine only, no jail (most traffic tickets). No right to a jury or a free lawyer.",
  misdemeanor: "A crime punishable by up to about a year in county jail (e.g. petty theft, first DUI). You DO get a free lawyer if you can't afford one.",
  felony: "The most serious crime level — punishable by prison. Never face one without a lawyer.",
  plaintiff: "The person who STARTS a lawsuit (the one suing).",
  defendant: "The person being sued or charged (probably you, if you're reading this).",
  statute_of_limitations: "The DEADLINE to sue or to be charged. Miss it and the case usually can't happen. Periods vary by claim — see 'deadlines'.",
  bail: "Money to get out of jail while the case is pending; you get it back if you make your court dates. A bail bondsman charges a non-refundable fee (~10%) to post it for you.",
  default_judgment: "You LOSE automatically because you didn't respond in time. The #1 avoidable disaster in civil cases — answer by your deadline.",
  probation: "Supervised freedom instead of (or after) jail, with rules. Break the rules and you can be locked up.",
  deposition: "Sworn out-of-court questioning, recorded, during discovery. Your lawyer preps you; you answer truthfully and briefly.",
};

export function explainTerm(term?: string): string {
  if (!term) return `LEGAL WORDS, PLAIN ENGLISH — ask for any:\n\n` + Object.entries(TERMS).map(([k, v]) => `▸ ${displayKey(k)}: ${v}`).join("\n");
  const found = fuzzyFind(TERMS, term);
  return found ? `${displayKey(found.key)}: ${found.value}` : `Don't know "${term}". I have: ${Object.keys(TERMS).join(", ")}.`;
}

export function deadlines(): string {
  return [
    `BOTTOM LINE: legal deadlines are brutal — miss one and you can lose without ever being heard. These are common California ones (VERIFY the exact date for your case with the court or a lawyer; run 'get_reference' for live figures).`,
    ``,
    `RESPONDING when something happens TO you:`,
    `  • Served a lawsuit → file your ANSWER within ~30 days, or you auto-lose (default).`,
    `  • Traffic ticket → respond by the date printed on it.`,
    `  • Agency notice (IRS/DMV) → each has its own appeal deadline in the letter — do it in writing, on time.`,
    `  • Immigration hearing → SHOW UP; missing it can mean an automatic removal order.`,
    ``,
    `STARTING a case (statute of limitations — deadline to SUE):`,
    `  • Personal injury (car crash, etc.): ~2 years in CA.`,
    `  • Written contract: ~4 years. Oral contract: ~2 years. Property damage: ~3 years.`,
    `  • Against a government entity: as little as 6 MONTHS to file a claim — very short.`,
    ``,
    `The move: the day something legal lands on you, write down the date and find the deadline THAT DAY. When in doubt, a lawyer or the court self-help center will tell you the exact clock.`,
  ].join("\n");
}
