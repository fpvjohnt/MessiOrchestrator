// "What would I need to know to answer this WELL?"
//
// The orchestrator routes an objective and then answers it. What it never did
// was notice that the objective was missing the one fact that decides the
// answer — so a question like "should I take the offer" got a confident
// general reply when the honest response is "that depends on a number you have
// not told me". The caller then has to discover the gap by reading an answer
// that does not fit their situation.
//
// This detects those gaps DETERMINISTICALLY and hands the caller a sharper way
// to ask. No model, no network — the same design constraint as the router, and
// for the same reason: it has to be testable and it has to give the same answer
// twice.
//
// THE BAR FOR ADDING A RULE, and it is deliberately high: the missing fact must
// plausibly CHANGE the answer, not merely add detail. A tool that asks for
// clarification on everything is worse than one that asks for none — it trains
// the reader to skip the section, and it turns a direct question into an
// interrogation. Each rule below names the fact, why it swings the answer, and
// a concrete rewrite the caller can copy.

export interface ContextGap {
  what: string; // the missing fact
  why: string; // why it changes the answer, not just decorates it
  ask: string; // a concrete sharper phrasing the caller can lift
}

const has = (t: string, re: RegExp) => re.test(t);

const MONEY = /\$\s?[\d,]+|\b\d[\d,]*\s?(k\b|dollars|usd)|\bbudget\b|\bprice[ds]?\b|\bsalary\b/i;
// Two patterns, because they need OPPOSITE case sensitivity and merging them
// broke both. Written as one case-SENSITIVE regex, "in California" did not match
// its own lowercase alternative, so the detector asked for a state that the
// objective had already named — a gap-finder that demands information already
// present is worse than no gap-finder, because it teaches the reader to ignore
// the section. Caught by running it over real objective shapes before shipping.
const PLACE_NAME =
  /\b(california|calif|texas|florida|new york|washington|oregon|nevada|arizona|illinois|georgia|colorado|county|city of|zip\s?code|\bstate of\b)\b/i;
// "Temecula, CA" — this one genuinely needs case, so it stays separate.
const PLACE_CITY_STATE = /\b[A-Z][a-z]+,\s?[A-Z]{2}\b/;
const hasPlace = (t: string) => PLACE_NAME.test(t) || PLACE_CITY_STATE.test(t);
const TIMEFRAME = /\b(today|this week|this month|this year|by \w+|within \d+|\d+\s?(day|week|month|year)s?|deadline|20\d\d|q[1-4]\b|short[- ]term|long[- ]term|retire\w*)\b/i;
const AGE_OR_HORIZON = /\b(\d{2}\s?(years old|yo\b)|age\s?\d{2}|i am \d{2}|retire\w*|horizon)\b/i;
const AMOUNT = /\b\d+(\.\d+)?\s?(g\b|grams?|mol\b|moles?|ml\b|l\b|liters?|litres?|m\b|molar)\b/i;
const RECENCY = /\b(current|currently|latest|now|today|recent|202\d|up[- ]to[- ]date|as of)\b/i;

// Words that only make sense if something earlier said what they refer to.
const DANGLING_REFERENT = /^\s*(it|this|that|they|them|those|these|he|she)\b/i;

// The shape of a question that expects a DECISION, not a survey.
const DECISION_SHAPE =
  /\b(should i|which (one|is|should)|what'?s better|better (option|choice)|vs\.?|versus|compare|instead of|or should|worth it|recommend)\b/i;

/**
 * Gaps worth raising for this objective, given who it routed to.
 *
 * Keyed on the ASSIGNED ASSETS as well as the text, because the same missing
 * fact matters enormously in one domain and not at all in another: no dollar
 * figure is fatal to a mortgage question and irrelevant to a chemistry one.
 */
export function contextGaps(objective: string, assigned: string[]): ContextGap[] {
  const t = objective;
  const a = new Set(assigned);
  const gaps: ContextGap[] = [];
  const words = t.trim().split(/\s+/).filter(Boolean);

  // --- generic shape problems -------------------------------------------------
  if (words.length <= 4) {
    gaps.push({
      what: "The objective is very short, so almost every specific has been left open.",
      why: "A four-word question can be read several ways, and the answer to each reading is different. Whatever is assumed here will be assumed silently.",
      ask: "Add what you already know and what you want to do with the answer — 'X, for <situation>, because I need to decide <Y>'.",
    });
  }
  if (DANGLING_REFERENT.test(t)) {
    gaps.push({
      what: `The objective opens with a pronoun ("${words[0]}") that has nothing to refer to.`,
      why: "Nothing carried over from a previous message, so the subject is being guessed. A wrong guess here makes the entire answer wrong rather than partly wrong.",
      ask: "Name the thing outright in the first few words instead of referring back to it.",
    });
  }
  const questionCount = (t.match(/\?/g) ?? []).length;
  if (questionCount >= 3) {
    gaps.push({
      what: `There are ${questionCount} separate questions here.`,
      why: "They get merged into one answer, and the shortest one usually swallows the others. Each would get a better answer asked on its own.",
      ask: "Ask the one that unblocks you first; keep the rest for follow-ups.",
    });
  }

  // --- domain-specific missing facts ------------------------------------------
  if ((a.has("homebuyer") || a.has("nestegg")) && !has(t, MONEY)) {
    gaps.push({
      what: "No dollar figure — budget, price, income, or amount.",
      why: "Affordability, loan type, tax treatment and whether an option is even available all turn on the number. Without it the answer has to be generic.",
      ask: "Add the amount you are working with, even as a range: 'on a $400–425k purchase with $X down'.",
    });
  }
  if ((a.has("homebuyer") || a.has("lawguide") || a.has("jobhunt")) && !hasPlace(t)) {
    gaps.push({
      what: "No state or city given.",
      why: "These assets are built around California and federal rules. Somewhere else, parts of the answer are simply wrong rather than approximate — and that will not be obvious from reading it.",
      ask: "Name the state (and county or city if it is a local rule).",
    });
  }
  if (a.has("nestegg") && !has(t, AGE_OR_HORIZON)) {
    gaps.push({
      what: "No time horizon or age.",
      why: "It is the single biggest input in investing. The same question has opposite answers at a 3-year and a 30-year horizon.",
      ask: "Add when you need the money: 'I'm 34 and won't touch this for 25 years'.",
    });
  }
  if (a.has("healthguide") && !/\b(\d+\s?(day|week|month|year|hour)s?|since|started)\b/i.test(t)) {
    gaps.push({
      what: "No duration — how long this has been going on.",
      why: "Duration is what separates 'watch it' from 'be seen today' for most symptoms, and it changes the urgency of the whole answer.",
      ask: "Add when it started and whether it is getting better, worse, or staying the same.",
    });
  }
  if (a.has("chemistry") && /\b(yield|how much|produce|need|require)\b/i.test(t) && !has(t, AMOUNT)) {
    gaps.push({
      what: "No quantity given (grams, moles, or a concentration).",
      why: "A yield or limiting-reagent question is arithmetic — without a starting amount there is a method but no number.",
      ask: "Add what you are starting with: 'from 25 g of Ca(NO3)2'.",
    });
  }
  if (a.has("youtube") && !/\b(my channel|my video|@[\w-]+|youtu\.?be|watch\?v=|[\w-]{11})\b/i.test(t)) {
    gaps.push({
      what: "No channel or video identified.",
      why: "Public stats need an id or handle, and the owner-only demographics need to know it is your channel. Without one the answer is about YouTube in general, which is probably not the question.",
      ask: "Add the handle, URL, or say 'my own channel'.",
    });
  }
  if ((a.has("kalshi") || a.has("research")) && has(t, RECENCY) === false && /\b(price|rate|odds|score|standings|who is winning)\b/i.test(t)) {
    gaps.push({
      what: "No 'as of when'.",
      why: "This asks for something that moves. Without a date the answer silently means 'whenever the sources happened to be written'.",
      ask: "Say 'as of today' if you want it current — that also switches on the live-lookup verifier.",
    });
  }

  return gaps;
}

/** Does this objective expect a DECISION rather than a survey of possibilities? */
export function expectsDecision(objective: string): boolean {
  return DECISION_SHAPE.test(objective);
}

/** Render gaps for the open_case response. Empty string when there is nothing worth saying. */
export function renderGaps(gaps: ContextGap[], decision: boolean): string {
  const out: string[] = [];
  if (gaps.length) {
    out.push(
      ``,
      `TO ANSWER THIS WELL, ${gaps.length} thing${gaps.length === 1 ? " is" : "s are"} missing:`,
      ...gaps.flatMap((g) => [`  ▸ ${g.what}`, `    Why it matters: ${g.why}`, `    Sharper: ${g.ask}`]),
      ``,
      `This is not a refusal — the case is open and the work can proceed on stated assumptions.`,
      `It is what a careful colleague would ask before starting. If you answer without these,`,
      `SAY which assumption you made, in the answer, where the reader will see it.`
    );
  }
  if (decision) {
    out.push(
      ``,
      `THIS OBJECTIVE ASKS YOU TO CHOOSE. Laying out the options and stopping is a non-answer.`,
      `End with ONE recommendation, name the single fact that decided it, and say what would`,
      `have to be true for the other option to win instead. If the evidence genuinely does not`,
      `separate them, say THAT plainly — "these are close, and here is the tiebreaker to check"`,
      `— rather than manufacturing a preference or hedging into silence.`
    );
  }
  return out.join("\n");
}
