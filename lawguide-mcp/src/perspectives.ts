import { fuzzyFind, displayKey } from "./match.js";

const GUARDRAIL = `\n\n(Legal information, not advice, and not confidential. For anything serious, get a licensed lawyer — often free. Run 'get_a_lawyer'.)`;

interface Player {
  motive: string;
  thinks: string;
  clash: string;
  move: string;
}

export const PLAYERS: Record<string, Player> = {
  prosecutor:
    {
      motive: "The DA works for the STATE, not for justice-for-you. Paid/measured on convictions and closing cases.",
      thinks: "Which charges will stick, and how to get a guilty plea without a trial. Your friendly 'just tell me your side' is evidence-gathering.",
      clash: "Everything you say to police flows to them and gets used against you. They are never on your side, even when polite.",
      move: "Never explain yourself to police or a DA without a lawyer. Your lawyer talks to them, not you.",
    },
  defense_attorney:
    {
      motive: "Hired by YOU to protect you and shrink the damage. This is your person.",
      thinks: "Where's the weakness in the state's case, what's the best realistic outcome, fight vs. deal.",
      clash: "None — but be fully honest with them; unlike this tool, your lawyer IS confidential (attorney-client privilege).",
      move: "Tell your defense lawyer everything, early. Hold nothing back — they can only protect what they know.",
    },
  public_defender:
    {
      motive: "A real, licensed defense lawyer the court gives you FREE if you can't afford one. Often very experienced.",
      thinks: "Same as any defense lawyer — but juggling a heavy caseload, so be organized and responsive.",
      clash: "Overloaded, not underqualified. Some people wrongly dismiss them — don't.",
      move: "If you can't afford a lawyer for a criminal charge, ASK the court for a public defender at your first hearing. Then help them help you: bring documents, answer calls.",
    },
  judge:
    {
      motive: "Neutral referee applying the law and running the courtroom on schedule.",
      thinks: "Did each side follow the rules and meet deadlines; is this being wasted or handled seriously.",
      clash: "Not against you — but unimpressed by excuses, lateness, and drama. Respect and preparation matter.",
      move: "Show up early, dress neatly, call them 'Your Honor', never interrupt, and let your lawyer do the talking.",
    },
  police_officer:
    {
      motive: "Build a case and close the call. Trained to get you talking.",
      thinks: "Gather statements and evidence now; sort truth later. 'Help me understand' is a tactic, not a favor.",
      clash: "Friendly questions are still an investigation. They can legally mislead you during questioning.",
      move: "Be calm and polite, comply physically, and say only: 'I'm going to remain silent. I want a lawyer.'",
    },
  detective:
    {
      motive: "Same as police but focused on building the strongest possible case against a suspect — maybe you.",
      thinks: "Get a recorded statement, catch inconsistencies, use time and pressure. A 'friendly chat at the station' is an interrogation.",
      clash: "If a detective wants to 'just talk', they likely already see you as a suspect.",
      move: "Politely decline to talk without a lawyer. 'I'd like to help, but I need my lawyer present.' Then stop.",
    },
  private_investigator:
    {
      motive: "Hired (by a lawyer, insurer, or person) to dig up facts, documents, and witnesses — for whichever side is paying.",
      thinks: "Find what helps their client. In the other side's hands, that means finding what hurts you.",
      clash: "A PI working for the opponent is not neutral. They may record or surveil (legally, in public).",
      move: "Assume anything public can be found. Your own lawyer can hire a PI to dig in YOUR favor.",
    },
  court_clerk:
    {
      motive: "Runs the court's paperwork, files, dates, and fees. Keeps the machine moving.",
      thinks: "Is your form filled out right and filed on time. They can't give legal advice, but they know the process.",
      clash: "None — but they can't tell you what to argue, only how to file.",
      move: "Be kind to clerks; they'll tell you deadlines, forms, and fees. Pair them with the court's SELF-HELP center for how-to.",
    },
  paralegal:
    {
      motive: "Trained legal staff who do research and prepare documents for attorneys (cannot give you legal advice on their own).",
      thinks: "Organize the case, draft the filings, gather the records.",
      clash: "Not a lawyer — a paralegal working 'independently' selling legal help may be operating illegally.",
      move: "Great inside a law firm. Outside one, be wary of anyone non-lawyer charging for 'legal help' (see notario fraud).",
    },
  bail_bondsman:
    {
      motive: "A business that posts your bail for a NON-refundable fee (~10%). They profit whether or not you're guilty.",
      thinks: "Will you show up to court (so they don't lose the bond). They'll want collateral and a co-signer.",
      clash: "The ~10% fee is gone forever, even if charges are dropped. High-pressure sales are common.",
      move: "Understand the fee is not refundable. Sometimes the court will release you without bail — ask your lawyer first.",
    },
  immigration_officer:
    {
      motive: "ICE/CBP enforce federal immigration law — detain and remove. Not on your side.",
      thinks: "Confirm status, get admissions, act fast. Questions and forms can be used to remove you.",
      clash: "You may not have to answer questions or sign anything — signing can waive your rights or agree to leave.",
      move: "You can say 'I want to remain silent and speak to a lawyer.' Do NOT sign anything you don't understand. Get an immigration attorney immediately — never a notario.",
    },
  irs_agent:
    {
      motive: "Collect the correct tax (their view of it) for the government.",
      thinks: "Does the return match the records; what's owed. Procedures and deadlines drive everything.",
      clash: "Not on your side, but bound by rules — and you have appeal rights and the free Taxpayer Advocate Service.",
      move: "Respond in writing by the deadline, keep records, and for anything big get a tax pro (CPA/tax attorney) or a free Low-Income Taxpayer Clinic.",
    },
};

export function howTheyThink(role?: string): string {
  if (!role) {
    return (
      `EVERYONE IN THE LEGAL SYSTEM — and whose side they're really on:\n\n` +
      Object.entries(PLAYERS).map(([k, p]) => `▸ ${displayKey(k)}: ${p.motive}`).join("\n") +
      `\n\nAsk for any by name for the full read. The pattern: only YOUR OWN lawyer (or public defender) is truly on your side and confidential.`
    );
  }
  const found = fuzzyFind(PLAYERS, role);
  if (!found) return `Don't know "${role}". I have: ${Object.keys(PLAYERS).join(", ")}.`;
  const p = found.value;
  return [
    `${displayKey(found.key)} — BOTTOM LINE: ${p.motive}`,
    ``,
    `How they think: ${p.thinks}`,
    `Where it clashes with you: ${p.clash}`,
    `Your move: ${p.move}`,
  ].join("\n") + GUARDRAIL;
}

interface Flag { bottom_line: string; looks_like: string; why: string; move: string; }

export const RED_FLAGS: Record<string, Flag> = {
  talking_to_police: {
    bottom_line: "Explaining your side to police almost always hurts you. Silence is your shield.",
    looks_like: "'You're not in trouble, just help me understand.' 'If you're innocent, why not talk?' A friendly chat at the station.",
    why: "Anything you say can be used against you; police can legally mislead you; innocent people talk themselves into charges every day.",
    move: "'I'm going to remain silent. I want a lawyer.' Say it, then stop. That's not suspicious — it's smart.",
  },
  missing_court_date: {
    bottom_line: "Miss a court date and a judge can issue a warrant for your ARREST. Never skip one.",
    looks_like: "Forgetting the date, assuming a minor ticket doesn't matter, or being too scared to show up.",
    why: "A 'failure to appear' adds new charges/fees, a bench warrant, and a hold on your license — turning small into big.",
    move: "Put every court date in three places. If you truly can't make it, call the clerk or your lawyer BEFORE the date to reschedule.",
  },
  notario_fraud: {
    bottom_line: "A 'notario' is NOT a lawyer. Paying one can destroy your immigration case — this is a massive scam in California.",
    looks_like: "Storefronts/ads promising visas, green cards, or 'papers' fast and cheap; 'notario público' (means something totally different abroad).",
    why: "They aren't licensed, file wrong or fraudulent paperwork, take your money, and leave you deportable with a ruined record.",
    move: "Only use a licensed immigration ATTORNEY or a DOJ-accredited representative. Verify them; use nonprofit clinics. Run 'find_legal_resources'.",
  },
  signing_under_pressure: {
    bottom_line: "Don't sign anything you don't fully understand — signatures can waive rights or admit fault.",
    looks_like: "'Just sign here so we can wrap this up.' Forms from police, immigration, insurers, landlords, or debt collectors.",
    why: "A signature can mean you agreed to leave the country, admitted liability, or gave up a defense — permanently.",
    move: "'I need to read this / have a lawyer look at it first.' Take a photo, take it home, get advice. Real deadlines still leave time to read.",
  },
  self_rep_serious: {
    bottom_line: "Representing yourself on a serious charge or big lawsuit is how good cases get lost.",
    looks_like: "'I'll just explain to the judge what really happened.' Skipping a lawyer to save money on a felony/major suit.",
    why: "You don't know the rules of evidence, deadlines, or plea leverage. Small claims/traffic can be DIY; serious matters cannot.",
    move: "Get a lawyer — free (public defender/legal aid) if you qualify. Run 'get_a_lawyer'.",
  },
  debt_collector_abuse: {
    bottom_line: "Debt collectors have hard legal limits — a lot of what they do to scare you is illegal.",
    looks_like: "Calls at all hours, threats of arrest, pretending to be police/lawyers, demanding payment on debt you don't recognize.",
    why: "Federal law (FDCPA) bans harassment, threats, and lies. They also can't collect past the statute of limitations.",
    move: "Ask for it IN WRITING ('validation'). Don't admit the debt or pay on an old one without checking the SOL. Legal aid handles this free.",
  },
  insurance_adjuster: {
    bottom_line: "The other driver's insurance adjuster is not your friend — they're paid to pay you as little as possible.",
    looks_like: "A fast, friendly call after an accident: 'just give a quick recorded statement' or 'here's a quick settlement.'",
    why: "A recorded statement or early lowball signature can lock you out of fair compensation for injuries you don't know about yet.",
    move: "Don't give a recorded statement or sign a release for the OTHER side. Get checked medically; talk to your own lawyer (injury lawyers are usually free unless you win).",
  },
};

export function redFlag(issue?: string): string {
  if (!issue) return `LEGAL TRAPS — one line each; ask for any:\n\n` + Object.entries(RED_FLAGS).map(([k, f]) => `▸ ${displayKey(k)}: ${f.bottom_line}`).join("\n");
  const found = fuzzyFind(RED_FLAGS, issue);
  if (!found) return `Don't know "${issue}". I have: ${Object.keys(RED_FLAGS).join(", ")}.`;
  const f = found.value;
  return [
    `${displayKey(found.key)} — BOTTOM LINE: ${f.bottom_line}`,
    ``,
    `What it looks like: ${f.looks_like}`,
    `Why it's dangerous: ${f.why}`,
    `Your move: ${f.move}`,
  ].join("\n") + GUARDRAIL;
}
