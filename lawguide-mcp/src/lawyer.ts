import { fuzzyFind, displayKey } from "./match.js";

// "How would a lawyer handle this?" — for a situation type, the 5-part playbook
// a good attorney runs: first moves, the questions they'd ask YOU, what they'd
// do, the range of POSSIBILITIES (not a prediction of your case), and what
// lawyer + how urgent. Information that empowers — never advice on your specific
// case, never an outcome prediction, never confidential.

interface Playbook {
  arena: string;
  first_moves: string[];
  they_ask_you: string[];
  lawyer_does: string[];
  possibilities: string[];
  lawyer_type: string;
}

export const SITUATIONS: Record<string, Playbook> = {
  traffic_ticket: {
    arena: "traffic (infraction — usually fine + points)",
    first_moves: ["Note the response deadline on the ticket.", "Don't just ignore it — that escalates fast.", "Photograph the ticket and the scene/signs if relevant."],
    they_ask_you: ["What exactly were you cited for (the code section)?", "What did the officer say?", "Any dashcam/photos/witnesses?", "Is your record clean — are you eligible for traffic school?"],
    lawyer_does: ["Checks whether traffic school keeps the point off.", "Weighs contesting (officer must show up — sometimes they don't) vs. paying.", "For anything that's actually criminal (DUI/reckless), treats it as a criminal case, not a ticket."],
    possibilities: ["Pay and move on (admits it, points may hit insurance).", "Traffic school → point kept off record.", "Contest → dismissed/reduced if the case is weak, or fine + points if not."],
    lawyer_type: "Usually none needed for a simple ticket — the court self-help center is enough. Get a lawyer if it's a DUI or the ticket threatens your license/job.",
  },
  arrested: {
    arena: "criminal — your freedom is at stake",
    first_moves: ["Say it out loud: 'I'm going to remain silent. I want a lawyer.' Then stop talking.", "Do NOT explain, argue, or resist — comply physically.", "Don't sign anything or agree to anything without a lawyer.", "Memorize/ask for the charge and your next court date."],
    they_ask_you: ["What were you arrested for and when?", "What EXACTLY did you say to police (word for word)?", "Were you read your Miranda rights, and when?", "Were you searched? Did you consent?", "Any witnesses, cameras, or injuries?"],
    lawyer_does: ["Gets you a lawyer/public defender before arraignment.", "Reviews how the stop/search/questioning was done (bad procedure can sink evidence).", "Handles bail arguments and negotiates charges — most cases resolve in a deal, not trial."],
    possibilities: ["Charges dropped or reduced (weak case / bad procedure).", "Plea deal to a lesser charge/penalty (most common).", "Diversion or probation instead of jail.", "Trial. — These are POSSIBILITIES, not a prediction of YOUR case."],
    lawyer_type: "A criminal defense attorney NOW — or ask the court for a free public defender at your first hearing. This is urgent.",
  },
  accused_crime: {
    arena: "criminal (pre-arrest — someone's pointing at you)",
    first_moves: ["Do not contact the accuser or 'clear it up' — it can become evidence or a new charge.", "Do not talk to police/detectives without a lawyer, even to 'help.'", "Preserve everything: texts, emails, location proof, witnesses.", "Write down your timeline privately while it's fresh."],
    they_ask_you: ["Who's accusing you of what, and when did you learn about it?", "Have police contacted you? What was said?", "What evidence exists on each side (messages, cameras, witnesses)?", "Any prior history with the accuser?"],
    lawyer_does: ["Speaks to police FOR you so you don't self-incriminate.", "Gets ahead of it — sometimes stops charges from being filed.", "Preserves your evidence and lines up witnesses early."],
    possibilities: ["No charges ever filed.", "Charges filed → then the criminal path.", "Getting a lawyer early sometimes prevents filing altogether. — Possibilities, not a prediction."],
    lawyer_type: "A criminal defense attorney, early — before charges, if possible. Free help via public defender once charged.",
  },
  sued_civil: {
    arena: "civil — about money, not jail",
    first_moves: ["Find the DEADLINE (usually ~30 days from being served) — this is the whole ballgame.", "Do NOT ignore it: no answer = automatic loss (default judgment).", "Gather every related document, contract, text, and receipt.", "Note who's suing and for exactly what/how much."],
    they_ask_you: ["When were you served (exact date)?", "Who's suing and what do they claim you owe/did?", "What's your side, with documents?", "Is the amount even correct — and is it past the statute of limitations?"],
    lawyer_does: ["Files a timely answer so you don't auto-lose.", "Checks if the claim is time-barred or the amount is wrong.", "Pushes settlement (most cases settle) and handles discovery."],
    possibilities: ["Case dismissed (time-barred / no proof).", "Settlement for less.", "You win, you lose, or a payment plan. — Possibilities, not a prediction. Small enough? See small claims."],
    lawyer_type: "A civil attorney; legal aid if you're income-qualified. For small amounts, small claims court is DIY.",
  },
  contract_dispute: {
    arena: "civil (contracts — leases, jobs, loans, services)",
    first_moves: ["Find and re-read the actual signed contract.", "Gather what was promised vs. what happened (texts, emails, invoices).", "Note any deadlines/notice requirements in the contract itself."],
    they_ask_you: ["Is it in writing? What does it actually say?", "Who broke what, and what did it cost you?", "Did you give required notice / follow the contract's steps?", "What outcome do you want — money, cancel, fix it?"],
    lawyer_does: ["Reads the fine print for who's really obligated and any 'gotcha' clauses.", "Checks statute of limitations (written contract ~4 yrs in CA).", "Sends a demand letter (often resolves it) before any lawsuit."],
    possibilities: ["Resolved by a demand letter.", "Settlement or small claims.", "Full lawsuit for bigger amounts. — Possibilities, not a prediction."],
    lawyer_type: "A civil/contract attorney; many do a free consult. Small amounts → small claims yourself.",
  },
  landlord_tenant: {
    arena: "civil (housing — California heavily protects tenants)",
    first_moves: ["Put everything in writing with your landlord; keep copies.", "Photograph conditions; save all notices and texts.", "Do NOT move out or withhold rent on your own without advice — there are specific legal steps.", "Note any deadline on an eviction notice (very short — days)."],
    they_ask_you: ["What's the issue — repairs, deposit, rent, eviction notice?", "What does your lease say and what's in writing?", "What notices have you gotten, and when?", "Is your unit rent-controlled / covered by CA tenant protections?"],
    lawyer_does: ["Knows CA tenant law (notice rules, habitability, deposit limits, just-cause eviction).", "Responds to an eviction FAST — deadlines are days, not weeks.", "Uses tenant legal-aid resources (often free)."],
    possibilities: ["Landlord must fix/return deposit.", "Eviction stopped or delayed on procedure.", "Negotiated move-out or payment plan. — Possibilities, not a prediction."],
    lawyer_type: "A tenant-rights attorney or legal-aid housing clinic — usually free/low-cost and fast. Run 'find_legal_resources'.",
  },
  car_accident: {
    arena: "civil (injury/property — plus insurance)",
    first_moves: ["Get medical care even if you feel fine (injuries hide for days).", "Photograph everything; get the other driver's info and any witnesses.", "Report as required, but do NOT give the OTHER side's insurer a recorded statement.", "Don't sign any release from the other insurer."],
    they_ask_you: ["What happened, and who did what?", "Injuries and treatment?", "What have you told which insurer?", "Photos, police report, witnesses?"],
    lawyer_does: ["Deals with the adjusters so you don't get lowballed.", "Values your claim including future/hidden injury costs.", "Watches the ~2-year injury deadline in CA."],
    possibilities: ["Fair insurance settlement.", "Lawsuit if they won't pay fairly.", "Depends heavily on injuries/fault. — Possibilities, not a prediction."],
    lawyer_type: "A personal-injury attorney — typically FREE unless you win (contingency). Low risk to consult.",
  },
  debt_collection: {
    arena: "civil (money) + consumer-protection law",
    first_moves: ["Don't admit the debt or promise payment on the phone.", "Demand written 'validation' of the debt.", "Check how OLD it is (past the statute of limitations = usually uncollectable).", "Save every call, letter, and voicemail."],
    they_ask_you: ["Who's collecting, for how much, on what original debt?", "How old is it? Do you even recognize it?", "What have they said/done (threats, hours, lies)?"],
    lawyer_does: ["Checks the SOL and whether they even own/proved the debt.", "Uses the FDCPA — you can sometimes get PAID for illegal harassment.", "Stops abusive contact and negotiates down."],
    possibilities: ["Debt time-barred / unvalidated → goes away.", "Negotiated payoff for less.", "Counter-claim if they broke the law. — Possibilities, not a prediction."],
    lawyer_type: "A consumer-rights attorney or legal aid — often free. Many FDCPA cases the lawyer gets paid by the collector.",
  },
  immigration_stop: {
    arena: "immigration (FEDERAL — highest stakes, can be permanent)",
    first_moves: ["You can say: 'I want to remain silent and speak to a lawyer.'", "Do NOT sign anything you don't understand — signing can waive rights or agree to leave.", "Do not lie or show false documents.", "Memorize an immigration lawyer's number; tell family where you are."],
    they_ask_you: ["What happened and what did officers ask/say?", "Did you sign anything? What?", "Your immigration history and any prior orders?", "Any criminal history (it interacts with immigration)?"],
    lawyer_does: ["Protects you from self-incriminating admissions.", "Finds relief you may qualify for and files it on time.", "Fights removal and handles the strict court deadlines."],
    possibilities: ["Release/bond and a path to fight the case.", "Relief you didn't know you qualified for.", "Removal if unaddressed. — Possibilities, not a prediction. Acting fast matters enormously."],
    lawyer_type: "A licensed IMMIGRATION attorney or DOJ-accredited rep IMMEDIATELY. ⚠️ NEVER a notario. Nonprofit clinics help free — run 'find_legal_resources'.",
  },
  irs_notice: {
    arena: "administrative (federal tax)",
    first_moves: ["Don't panic and don't ignore — find the DEADLINE in the letter.", "Read what they're actually claiming (often a mismatch, not fraud).", "Gather your records for the year in question.", "Respond in WRITING by the deadline; keep copies."],
    they_ask_you: ["What does the notice say and what's the deadline?", "Do you agree with the numbers?", "What records back up your return?", "Can you pay, or need a plan?"],
    lawyer_does: ["Responds/appeals correctly and on time.", "Sets up payment plans or challenges the amount.", "Uses the free Taxpayer Advocate Service / Low-Income Taxpayer Clinics."],
    possibilities: ["Notice resolved with the right documents.", "Reduced amount or payment plan.", "Appeal. — Possibilities, not a prediction. Most IRS notices are fixable."],
    lawyer_type: "A CPA or tax attorney for big amounts; free help via IRS Taxpayer Advocate Service and Low-Income Taxpayer Clinics.",
  },
};

export function thinkLikeALawyer(situation?: string): string {
  if (!situation) {
    return (
      `HOW A LAWYER WOULD HANDLE IT — pick your situation:\n\n` +
      Object.keys(SITUATIONS).map((k) => `▸ ${k}`).join("\n") +
      `\n\nAsk for one by name (e.g. "arrested"). You get: first moves, the questions a lawyer would ask you, what they'd do, the range of possibilities, and what lawyer you need.`
    );
  }
  const found = fuzzyFind(SITUATIONS, situation);
  if (!found) return `Don't have a playbook for "${situation}". I have: ${Object.keys(SITUATIONS).join(", ")}.`;
  const p = found.value;
  const list = (title: string, items: string[]) => `${title}:\n` + items.map((x) => `  • ${x}`).join("\n");
  return [
    `HOW A LAWYER WOULD HANDLE: ${displayKey(found.key)}`,
    `Arena: ${p.arena}`,
    ``,
    `BOTTOM LINE: ${p.first_moves[0]}`,
    ``,
    list("1) FIRST MOVES (right now)", p.first_moves),
    ``,
    list("2) WHAT A LAWYER WOULD ASK YOU (have these ready)", p.they_ask_you),
    ``,
    list("3) WHAT A LAWYER WOULD DO", p.lawyer_does),
    ``,
    list("4) THE RANGE OF POSSIBILITIES", p.possibilities),
    ``,
    `5) WHAT YOU NEED: ${p.lawyer_type}`,
    ``,
    `⚖️ This is information about how the process works and what COULD happen — not a prediction of your case, not legal advice, and not confidential. Get a licensed lawyer for your actual situation ('get_a_lawyer' / 'find_legal_resources').`,
  ].join("\n");
}

export function getALawyer(): string {
  return [
    `BOTTOM LINE: you can almost always get real legal help — much of it FREE — if you know where to look.`,
    ``,
    `  • CRIMINAL charge, can't afford a lawyer → ask the court for a PUBLIC DEFENDER at your first hearing. Free.`,
    `  • CIVIL problem, low income → LEGAL AID (free): housing, debt, benefits, family, some immigration.`,
    `  • INJURY (car crash, etc.) → personal-injury lawyers work on CONTINGENCY: free unless you win.`,
    `  • NEED A REFERRAL → the State Bar Lawyer Referral Service; many lawyers give a free 30-min consult.`,
    `  • DIY-friendly (small claims, traffic, forms) → the court's SELF-HELP CENTER and county LAW LIBRARY, free.`,
    `  • IMMIGRATION → a licensed immigration attorney or DOJ-accredited nonprofit. ⚠️ NEVER a notario.`,
    `  • IRS → free Taxpayer Advocate Service and Low-Income Taxpayer Clinics.`,
    ``,
    `Run 'find_legal_resources' with your county (Riverside, Los Angeles, San Diego...) for the actual names, phones, and links — pulled live.`,
  ].join("\n");
}
