// KALSHI & EVENT CONTRACTS — prediction markets as an instrument, honestly.
// Three lenses:
//   mechanics  — what a contract IS, the series/event/market hierarchy, the
//                order book, settlement, and how a price becomes a probability
//   math       — the part almost nobody does: fees against edge, breakeven,
//                expected value, sizing, and why "price = probability" is only
//                approximately true
//   context    — who regulates this and why that is unsettled, how it differs
//                from a sportsbook and from Polymarket, taxes, and where the
//                free market data actually comes from
//
// SCOPE LINE: this asset owns EVENT CONTRACTS as an instrument — the mechanics,
// the math, and the honest case against trading them. It does NOT own general
// investing, portfolios, or retirement ('nestegg'), and it does NOT give legal
// or tax advice ('lawguide'). It holds NO market data: prices, fee schedules,
// legality in your state, and which markets exist all move, so every one of
// them goes through check_kalshi → kalshi_verdict, never recalled from memory.
//
// Same reverse-index shape as aiforge/gitforge/promptcraft/apiforge topics.ts.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Area = "mechanics" | "math" | "context";

export const AREA_LABELS: Record<Area, string> = {
  mechanics: "How the instrument works",
  math: "The math that decides if it's worth it",
  context: "Regulation, alternatives, and data",
};

export interface Topic {
  label: string;
  keys: string[];
  area: Area;
  what: string;
  why: string;
  key_ideas: string[];
  how: string[];
  pitfalls: string[];
  handoff: string;
}

export const TOPICS: Record<string, Topic> = {
  // ── Mechanics ─────────────────────────────────────────────────────────────
  event_contract: {
    label: "What an event contract is",
    keys: ["eventcontract", "contract", "binary", "whatiskalshi", "kalshi", "predictionmarket", "predictionmarkets", "eventcontracts"],
    area: "mechanics",
    what: "A binary contract on a real-world question that settles at $1 if the event happens and $0 if it doesn't. You buy it for somewhere in between, and the price is the market's answer.",
    why: "Every other idea here follows from this one sentence. A contract that pays $1 or $0 means your maximum loss is what you paid and your maximum gain is $1 minus what you paid — the whole risk profile is visible before you trade, which is genuinely unusual.",
    key_ideas: [
      "Settlement is binary: $1.00 or $0.00 per contract. There is no partial outcome, so the only question that matters is whether the stated condition is met by the stated deadline.",
      "The settlement SOURCE is part of the contract, not a detail. 'Will inflation exceed X' means a specific series from a specific agency at a specific release — not inflation as you understand it. Read the rules before the price.",
      "YES and NO are two sides of the same contract. Buying NO at 40c is economically the same as selling YES at 60c; the two prices sum to $1 by construction.",
      "Your maximum loss per contract is what you paid — there is no margin call and no losing more than you put in. That is a real structural difference from futures or options.",
      "The deadline is as binding as the condition. A question that resolves 'true' one day after expiry settles at $0, and being early is the same as being wrong.",
    ],
    how: [
      "Read the settlement rules FIRST, then the price. Most bad trades on prediction markets are misread rules, not bad forecasts.",
      "Identify the exact source and timestamp that decides the outcome, and check whether that source can be delayed, revised, or ambiguous.",
      "Decide what YOU think the probability is BEFORE you look at the market price, or you will anchor on it and call it analysis.",
    ],
    pitfalls: [
      "Trading the headline instead of the rules — 'will the government shut down' has a precise legal definition that may not match the news.",
      "Forgetting that a revision doesn't reopen a settled market: it settles on the print that existed at the deadline.",
      "Treating a 90c contract as 'nearly free money' — it pays 11c on a dollar risked, and the 10% of the time it fails wipes out nine wins.",
    ],
    handoff: "How prices become probabilities → 'price_as_probability'. Whether the trade is worth it after costs → 'fees_and_edge' and the 'price_check' tool.",
  },
  market_hierarchy: {
    label: "Series, events, and markets",
    keys: ["series", "event", "market", "ticker", "hierarchy", "structure", "eventticker", "markets"],
    area: "mechanics",
    what: "Kalshi organises questions in three levels: a SERIES is the recurring question type, an EVENT is one instance of it, and a MARKET is a single yes/no contract within that event.",
    why: "The API and the site are both built on this hierarchy, so you cannot query market data or reason about related contracts without it. It is also why one 'question' can be a dozen tradeable markets.",
    key_ideas: [
      "SERIES: the template that recurs — e.g. a monthly economic release, or a recurring championship question.",
      "EVENT: one dated instance of a series, holding the markets that resolve together.",
      "MARKET: the individual contract you actually trade, with its own ticker, order book, and settlement rule.",
      "One event often contains MUTUALLY EXCLUSIVE markets (a range of outcomes). Their prices should roughly sum to $1 across the set — when they don't, that gap is either an opportunity or a sign you've misread the rules.",
      "Tickers are hierarchical and stable, which is what makes automated tracking possible.",
    ],
    how: [
      "Start at the series to see the history of how this question has resolved before — recurring series are where a real edge is most findable.",
      "Within an event, list every market before trading one: the range structure often prices the tails badly relative to the middle.",
      "Use the ticker, not the title, as the identity of a market — titles get reworded.",
    ],
    pitfalls: [
      "Comparing prices across two events of the same series without checking that the settlement rule didn't change between them.",
      "Assuming the markets in an event are exhaustive — check whether a 'none of the above' outcome exists.",
    ],
    handoff: "Pulling the actual data → 'market_data_access'. Reading one market properly → the 'read_market' tool.",
  },
  order_book: {
    label: "The order book and order types",
    // "bid" and "ask" are NOT keys here. The shared resolver does a loose
    // contains-match on keys of 3+ characters, so "ask" matched inside
    // "underwater basket weaving" and confidently returned this topic for a
    // nonsense query. Three-letter keys are substrings of ordinary English —
    // use the compound instead.
    keys: ["orderbook", "order", "orders", "limit", "limitorder", "marketorder", "spread", "liquidity", "maker", "taker", "bidask"],
    area: "mechanics",
    what: "Prices come from a live order book of resting bids and offers. A limit order joins the book (maker); an order that crosses the spread takes an existing one (taker).",
    why: "The maker/taker distinction is not trivia — it is one of the largest controllable costs on the platform, and on thin markets the spread costs more than the fee does.",
    key_ideas: [
      "MAKER: your order rests on the book and waits. TAKER: your order executes immediately against someone else's. Makers are charged materially less — verify the current ratio, it is a published schedule.",
      "The SPREAD is the gap between the best bid and best offer, and you pay half of it on entry and half on exit if you cross both times.",
      "Liquidity is wildly uneven. Headline markets are tight; a niche market can have a spread wide enough to erase any realistic edge.",
      "Displayed depth is what you can trade at that price — a large order walks the book and gets a worse average price than the top-of-book quote suggests.",
      "You are trading against other participants, not against the house. Nobody is obliged to give you a fill.",
    ],
    how: [
      "Default to LIMIT orders. On a market with any spread at all, patience is worth more than immediacy.",
      "Before sizing, look at the depth, not the quote — ask what average price you'd actually get for the size you want.",
      "Check both sides: sometimes the NO side of the same question is better priced than the YES side.",
    ],
    pitfalls: [
      "Using market orders on thin books and paying several cents of slippage on a contract whose whole range is a dollar.",
      "Counting a paper gain at the mid-price when the book couldn't absorb your exit at anything near it.",
      "Assuming you can always exit — an illiquid market may leave you holding to settlement, which is fine only if you sized for that.",
    ],
    handoff: "What the fee actually costs you → 'fees_and_edge'. Running the numbers → the 'price_check' tool.",
  },
  settlement: {
    label: "Settlement, expiry, and disputes",
    keys: ["settlement", "settle", "expiry", "expiration", "resolve", "resolution", "dispute", "payout"],
    area: "mechanics",
    what: "At expiry the contract resolves against the named source and pays $1 or $0. Settlement follows the written rule, not the spirit of the question.",
    why: "The gap between what a question appears to ask and what its rule actually says is the most common way a correct forecast still loses money.",
    key_ideas: [
      "The rule text governs. If the rule names a source, a threshold, and a time, all three must be met — a near miss on any of them settles against you.",
      "Data revisions after the deadline generally do not reopen a settled market.",
      "Ambiguous real-world events do happen, and the exchange has a defined process for resolving them. That process is a risk you are taking, not a formality.",
      "Holding to settlement is a valid strategy and avoids exit slippage entirely — but it locks up your capital until expiry.",
    ],
    how: [
      "Read the rule and write down, in one sentence, the exact condition that makes this pay $1. If you can't, don't trade it.",
      "Check the release/announcement calendar for the source — including whether it can be delayed.",
      "For anything where the outcome could be genuinely contested, size smaller.",
    ],
    pitfalls: [
      "Assuming 'obviously that happened' beats a rule that says otherwise. It does not.",
      "Ignoring time zones on a deadline.",
    ],
    handoff: "Legal status of a given market type → 'regulation'. Whether an edge survives costs → 'fees_and_edge'.",
  },

  // ── The math ──────────────────────────────────────────────────────────────
  price_as_probability: {
    label: "Price as implied probability (and where that breaks)",
    keys: ["price", "probability", "impliedprobability", "odds", "calibration", "accuracy", "forecast"],
    area: "math",
    what: "A contract trading at 63c implies roughly a 63% chance in the market's view. 'Roughly' is doing real work in that sentence.",
    why: "The claim that prediction markets are well-calibrated is the main argument for using them at all — and it is true enough to be useful and false enough to be dangerous if taken literally.",
    key_ideas: [
      "The mid-price is the cleanest read. Using the last trade or one side of a wide spread systematically misleads you.",
      "Fees and spread mean the price you can actually TRANSACT at is worse than the implied probability on both sides — the tradeable band is wider than the quoted number.",
      "Calibration is an aggregate property, not a per-market guarantee. 'Things priced at 70% happen about 70% of the time' can hold across thousands of markets while any single market is badly wrong.",
      "Longshot bias is real and documented across betting-style markets: very low-probability contracts tend to be overpriced relative to how often they pay.",
      "Capital has a cost. Tying up money for six months to earn 4c on 96c is not a 4% return, it is an annualised return you should compare against a risk-free rate.",
      "Thin markets are opinions, not consensus. A price set by a handful of contracts is not wisdom of crowds.",
    ],
    how: [
      "Form your own probability first, in writing, with the reasoning. Then compare to the market and ask who is more likely to be wrong.",
      "Convert any edge to expected value AFTER fees before treating it as an edge (the 'price_check' tool does this).",
      "For long-dated contracts, annualise the return and compare against just holding cash.",
    ],
    pitfalls: [
      "Reading a market price as a fact about the world rather than a price at which strangers are willing to trade.",
      "Confusing 'the market is usually well calibrated' with 'this market is right'.",
      "Treating your disagreement with the market as automatic edge — the base rate is that you are the one who is wrong.",
    ],
    handoff: "Turning a probability disagreement into a decision → 'fees_and_edge' and the 'price_check' tool.",
  },
  fees_and_edge: {
    label: "Fees against edge — the calculation nobody does",
    keys: ["fee", "fees", "edge", "cost", "breakeven", "expectedvalue", "ev", "profitability", "feedrag"],
    area: "math",
    what: "Trading fees on event contracts are charged per contract and are largest exactly where most people trade — near 50c. Your edge has to clear them twice if you plan to exit early.",
    why: "This is the single most decisive number and the one most often skipped. A 3-point edge sounds like a lot until you see what the round trip costs.",
    key_ideas: [
      "The fee is not a flat percentage — it is shaped like uncertainty itself, largest at 50c and shrinking toward both extremes. Trading the coin-flip is where you pay the most.",
      "Maker orders are charged materially less than taker orders. Being patient is a direct, reliable, repeatable saving — verify the current ratio and treat it as free money.",
      "If you plan to exit before settlement you pay on the way in AND the way out. Holding to settlement halves that.",
      "Breakeven is not the market price. Breakeven is the price plus the fee, expressed as the probability you need to be right at just to lose nothing.",
      "Concretely, at the assumed schedule a 50c contract costs roughly 1.75c per contract to take. So an edge of about 2 points held to settlement is barely above breakeven, an edge below that is negative, and ANY of those turns clearly negative if you exit early and pay the fee twice. Run it rather than eyeballing it.",
      "Exact fee amounts and the maker/taker ratio are a published schedule that changes — check the current one rather than trusting any number you remember, including one this asset's calculator assumes.",
    ],
    how: [
      "Compute breakeven probability including fees, then ask honestly whether your estimate is far enough above it to survive being somewhat wrong.",
      "Prefer maker orders and prefer holding to settlement, in that order, if you want the cost side improved.",
      "Use the 'price_check' tool — it does this arithmetic and tells you when the fee eats the edge.",
    ],
    pitfalls: [
      "Comparing your probability to the market price with no fee adjustment and calling the difference 'edge'.",
      "Frequent small-edge trading near 50c, which is the most expensive possible pattern.",
      "Assuming a stale fee number. It is a schedule; it moves.",
    ],
    handoff: "The actual arithmetic → the 'price_check' tool. Current fee schedule → 'check_kalshi'.",
  },
  sizing: {
    label: "Position sizing and bankroll",
    keys: ["sizing", "size", "bankroll", "kelly", "riskmanagement", "position", "allocation", "howmuch"],
    area: "math",
    what: "How much to put on a contract, given that your probability estimate is itself uncertain. The honest answer is almost always 'less than you were going to'.",
    why: "Ruin is a function of sizing, not of accuracy. A good forecaster who oversizes goes broke before the edge shows up.",
    key_ideas: [
      "The Kelly criterion gives the growth-optimal stake for a KNOWN edge. Your edge is not known — it is an estimate with error bars, which is why practitioners bet a fraction of Kelly.",
      "Overestimating your edge is the normal case, so full Kelly on a self-assessed edge reliably overbets.",
      "Correlated positions are one position. Five contracts that all depend on the same election, release, or storm are a single concentrated bet wearing a diversification costume.",
      "Money locked until settlement is money you cannot redeploy — an opportunity cost that does not show up in any P&L until you look for it.",
      "This is speculation with a defined loss, not investing. It has no expected long-run drift the way owning productive assets does.",
    ],
    how: [
      "Size so that being wrong on your single most confident position is survivable and boring.",
      "Group correlated contracts and size the GROUP, not each contract.",
      "Decide the size before you look at how much you could win.",
    ],
    pitfalls: [
      "Sizing up because you are 'sure' — confidence is uncorrelated with accuracy for most forecasters.",
      "Treating a bankroll you would need for real life as trading capital.",
    ],
    handoff: "Whether the trade clears costs at all → 'fees_and_edge'. Where this fits in an actual financial life → 'nestegg' (the retirement/portfolio asset).",
  },
  finding_edge: {
    label: "Where an edge could actually come from",
    keys: ["edge", "strategy", "alpha", "advantage", "arbitrage", "howtowin", "profitable"],
    area: "math",
    what: "The honest list of places a non-professional could plausibly be better than the market — and the much longer list of places they are not.",
    why: "Most people arrive with an implicit theory that reading the news carefully is an edge. It is not; everyone else read it too.",
    key_ideas: [
      "PLAUSIBLE: recurring, rule-heavy series where you have done the historical base-rate work and most participants have not.",
      "PLAUSIBLE: domain expertise that is genuinely specialist — an actual meteorologist on weather contracts, not an enthusiast.",
      "PLAUSIBLE: mechanical mispricings — mutually exclusive markets in one event whose prices don't sum sensibly, or the same question priced differently on two venues. Both are usually small and eaten by fees.",
      "PLAUSIBLE: patience as a maker in markets others trade impatiently — you're being paid for providing liquidity, not for forecasting.",
      "NOT AN EDGE: having read the news, having a strong opinion, or noticing a market 'feels' mispriced.",
      "NOT AN EDGE: a model you fit to a handful of past events. With this few observations you cannot distinguish a real signal from noise.",
      "The base rate for retail speculation across every comparable market is that most participants lose money net of costs. Assume you are in that group until your own records say otherwise.",
    ],
    how: [
      "Pick ONE narrow series and learn its base rates properly before trading anything else.",
      "Keep a written record of your predicted probability, the price, and the outcome — then score yourself. Without this you cannot tell edge from luck.",
      "Compare any strategy's return against simply not trading. That is the real benchmark.",
    ],
    pitfalls: [
      "Backtesting on a handful of events and believing the result.",
      "Confusing a run of wins with skill — with binary outcomes, streaks are common and mean nothing at small samples.",
      "Chasing arbitrage across venues without counting fees, transfer time, and the capital tied up on both sides.",
    ],
    handoff: "Scoring yourself honestly → 'price_as_probability' (calibration). The cost side → 'fees_and_edge'.",
  },

  // ── Context ───────────────────────────────────────────────────────────────
  regulation: {
    label: "Who regulates this, and why that's unsettled",
    keys: ["regulation", "regulated", "legal", "legality", "cftc", "dcm", "law", "state", "gambling", "illegal", "banned"],
    area: "context",
    what: "Kalshi operates as a CFTC-regulated designated contract market — a federally regulated exchange, not a sportsbook. Whether federal registration overrides state gambling law is being actively litigated and is not settled.",
    why: "This determines whether you can legally trade a given contract where you live, and the answer has been changing repeatedly. It is the single fastest-moving fact about the entire platform.",
    key_ideas: [
      "A DCM is a federally regulated exchange under the Commodity Exchange Act, supervised by the CFTC. That is a genuinely different legal category from a betting operator.",
      "The live dispute is whether the CEA gives the CFTC EXCLUSIVE jurisdiction, pre-empting state gambling regulators — particularly for sports-related contracts.",
      "Federal appellate courts have been split-ish and the rulings so far have largely been on preliminary injunctions — a finding about likelihood of success, NOT a final merits decision. Do not read a headline about a win as a settled rule.",
      "Because circuits can disagree, the question may end up at the Supreme Court, and the answer may differ by state in the meantime.",
      "Being federally regulated is a statement about oversight and segregated funds, not a statement that any particular contract is a good idea.",
      "Nothing here is legal advice, and the status changes on a timescale of weeks.",
    ],
    how: [
      "Verify the CURRENT status for your state and for the specific contract type before trading — use check_kalshi, which routes it to live research.",
      "Distinguish 'a court granted an injunction' from 'the law is settled'. They are very different.",
      "For anything with real money or real consequences, ask a lawyer — see the 'lawguide' asset.",
    ],
    pitfalls: [
      "Assuming a ruling in one circuit applies nationwide.",
      "Assuming that because an app lets you place a trade, it is lawful where you are.",
      "Recalling the legal status from memory. This asset deliberately refuses to, and so should you.",
    ],
    handoff: "Your rights and legal process generally → 'lawguide'. Current status → 'check_kalshi' → 'kalshi_verdict'.",
  },
  vs_alternatives: {
    label: "Versus sportsbooks, Polymarket, and just investing",
    keys: ["polymarket", "sportsbook", "betting", "draftkings", "comparison", "alternatives", "versus", "difference"],
    area: "context",
    what: "Event contracts sit between a betting market and a financial exchange, and the differences that matter are counterparty, pricing mechanism, and what happens to your money.",
    why: "People choose a venue by brand familiarity and then discover the structural differences after they've traded.",
    key_ideas: [
      "Against a SPORTSBOOK: a book sets prices and takes the other side, with its margin baked into the odds. An exchange matches you against other participants and charges an explicit fee. Explicit costs are easier to measure than embedded ones.",
      "Against POLYMARKET: broadly similar instrument, materially different regulatory posture, settlement currency, and funding mechanics. Compare the fee model and the resolution process, not just the headline price.",
      "Against INVESTING: owning a share of a business has a positive expected long-run drift. A binary contract does not — it is a transfer between participants minus fees. Do not let 'it's on an exchange' blur that line.",
      "Cross-venue price differences on the 'same' question are frequently not arbitrage, because the settlement rules differ in ways that matter.",
    ],
    how: [
      "Compare total round-trip cost, not headline price, when choosing a venue.",
      "Read both settlement rules before assuming two markets are the same question.",
      "Keep speculation capital separate from money that has a job.",
    ],
    pitfalls: [
      "Assuming identical titles mean identical contracts.",
      "Treating a prediction-market position as part of a retirement allocation.",
    ],
    handoff: "Where money that has a job should go → 'nestegg'. Current fee comparison → 'check_kalshi'.",
  },
  market_data_access: {
    label: "Getting the market data (free, no key)",
    keys: ["api", "data", "marketdata", "endpoint", "rest", "websocket", "free", "publicapi", "quotes"],
    area: "context",
    what: "Kalshi publishes a REST API whose market-data endpoints — series, events, markets, and order books — are readable without authentication. Trading endpoints require a signed API key; reading does not.",
    why: "This is the rare genuinely free, no-key, no-scraping data source for live probability estimates, which makes it usable by an offline-first system like this one.",
    key_ideas: [
      "The read path is public: series, events, markets, and order book data are retrievable with no credentials.",
      "The trade path is authenticated with an API key pair and a per-request signature — a different security model from a simple bearer token, and out of scope for a read-only integration.",
      "Rate limits, exact paths, and the base URL are versioned and DO change — confirm them against the official documentation rather than any example you find in a blog post or in this text.",
      "In THIS system, an asset never makes network calls. Live market data belongs to the 'research' asset; this asset supplies the questions to ask and the framework to interpret the answers.",
    ],
    how: [
      "Verify the current base URL, paths, and rate limits from the official docs via check_kalshi before wiring anything.",
      "For a read-only integration, no key is needed — do not build an authentication flow you don't require.",
      "Cache aggressively and respect rate limits; probabilities do not change meaningfully every second.",
    ],
    pitfalls: [
      "Copying a base URL from an old tutorial — this API's host and version path have changed before.",
      "Building key-based auth for data that is public anyway.",
      "Putting an API key in an asset in this repo. Assets hold no credentials and make no network calls, by design.",
    ],
    handoff: "Calling and testing an HTTP API properly → 'apiforge'. Running the live query → the 'research' asset.",
  },
  taxes: {
    label: "Taxes on event contracts",
    keys: ["tax", "taxes", "irs", "1099", "reporting", "capitalgains", "1256"],
    area: "context",
    what: "How event-contract gains are taxed is genuinely unsettled in ways that ordinary stock trading is not, and the treatment can differ from both gambling winnings and standard capital gains.",
    why: "The tax treatment can change the after-tax return enough to flip a marginally profitable strategy negative — and getting it wrong is an expensive surprise.",
    key_ideas: [
      "Do not assume gambling treatment, and do not assume standard capital-gains treatment. Exchange-traded event contracts don't map cleanly onto either.",
      "Whether favourable futures-style treatment applies to these instruments is a real question, not a settled one, and it is exactly the kind of thing that changes with guidance.",
      "You are responsible for reporting regardless of what forms you receive.",
      "Keep per-trade records from day one. Reconstructing a year of binary contracts afterwards is miserable.",
    ],
    how: [
      "Verify current treatment before year-end, not after — use check_kalshi to route it to live research.",
      "Talk to an actual tax professional if the amounts are meaningful.",
      "Export and keep your trade history continuously.",
    ],
    pitfalls: [
      "Copying tax treatment from a forum post.",
      "Assuming the platform's tax form settles the question of how to report.",
    ],
    handoff: "Legal and regulatory framing → 'lawguide'. Current treatment → 'check_kalshi' → 'kalshi_verdict'.",
  },
};

export function resolveTopic(input: string): string | undefined {
  const q = normalize(input);
  if (!q) return undefined;
  if (TOPICS[q]) return q;
  for (const [key, t] of Object.entries(TOPICS)) {
    if (normalize(key) === q) return key;
    if (normalize(t.label) === q) return key;
    if (t.keys.some((k) => normalize(k) === q)) return key;
  }
  const scored: Array<{ key: string; len: number }> = [];
  for (const [key, t] of Object.entries(TOPICS)) {
    for (const k of [key, ...t.keys]) {
      const nk = normalize(k);
      if (nk.length >= 3 && (q.includes(nk) || nk.includes(q))) scored.push({ key, len: nk.length });
    }
  }
  if (!scored.length) return undefined;
  scored.sort((a, b) => b.len - a.len);
  return scored[0].key;
}

function topicsByArea(area: Area): string[] {
  return Object.entries(TOPICS)
    .filter(([, t]) => t.area === area)
    .map(([k]) => k);
}

export function explainTopic(topic?: string): string {
  if (!topic) {
    const areas = Object.keys(AREA_LABELS) as Area[];
    return [
      `KALSHI & EVENT CONTRACTS — prediction markets as an instrument, honestly`,
      `BOTTOM LINE: a contract that pays $1 or $0 makes your risk visible up front, which is genuinely useful — but the fee is largest exactly at the coin-flip prices most people trade, so the deciding question is never "will it happen", it's "does my edge survive the costs".`,
      ``,
      ...areas.flatMap((area) => [
        `${AREA_LABELS[area]}:`,
        ...topicsByArea(area).map((k) => `  ▸ ${TOPICS[k].label} — 'explain_topic ${k}'`),
        ``,
      ]),
      `Other tools: read_market <question> (how to analyse one market properly), price_check (the fee-vs-edge arithmetic), myth_vs_reality, and check_kalshi → kalshi_verdict for anything current (fees, legality by state, which markets exist, API specifics).`,
      ``,
      `SCOPE: event contracts as an instrument. Portfolios, retirement, and money that has a job → 'nestegg'. Legal advice → 'lawguide'. Calling the API → 'apiforge'. This asset holds NO prices, NO fee numbers, and NO legal status — all of that moves, so it is verified, never recalled.`,
    ].join("\n");
  }
  const key = resolveTopic(topic);
  if (!key) {
    return `Not sure which prediction-market topic "${clean(topic)}" is. Topics: ${Object.values(TOPICS)
      .map((t) => t.label)
      .join(", ")}.`;
  }
  const t = TOPICS[key];
  return [
    `${t.label}  [${AREA_LABELS[t.area]}]${normalize(topic) !== normalize(key) ? ` (from "${clean(topic)}")` : ""}`,
    `BOTTOM LINE: ${t.what}`,
    ``,
    `Why it matters: ${t.why}`,
    ``,
    `The key ideas:`,
    ...t.key_ideas.map((k) => `  • ${k}`),
    ``,
    `How you actually do it:`,
    ...t.how.map((h) => `  → ${h}`),
    ``,
    `⚠ PITFALLS that burn people:`,
    ...t.pitfalls.map((p) => `  ✗ ${p}`),
    ``,
    `Handoff: ${t.handoff}`,
    ``,
    `Fees, legality, market availability, and API specifics all move — anything current is verified via check_kalshi → kalshi_verdict, never recalled.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is the event-contract expert — what a prediction-market contract actually is, and whether trading one is worth it after costs. It is deliberately unenthusiastic: the instrument is interesting, the arithmetic is unforgiving, and most retail participants in comparable markets lose money net of fees.`,
    ``,
    `THREE LENSES:`,
    `  • HOW THE INSTRUMENT WORKS — binary $1/$0 settlement, the series/event/market hierarchy, the order book and maker vs taker, and how settlement really resolves → 'explain_topic mechanics'.`,
    `  • THE MATH THAT DECIDES IT — price as implied probability and where that breaks, fees against edge, position sizing, and the honest list of where an edge could come from → 'explain_topic math'.`,
    `  • REGULATION, ALTERNATIVES, DATA — who regulates this and why it's unsettled, how it compares to a sportsbook or Polymarket, taxes, and the free public market-data API → 'explain_topic context'.`,
    ``,
    `THE TOOLS:`,
    `  • 'explain_topic <topic>' — the front door; no arg for the full map.`,
    `  • 'read_market <question>' — the checklist for analysing ONE market: the rules to read first, what to estimate, and the research queries to run.`,
    `  • 'price_check <your probability> <market price>' — the arithmetic almost nobody does: breakeven after fees, expected value, and a straight answer on whether the fee eats the edge.`,
    `  • 'myth_vs_reality' — 'the market is always right', 'it's basically free money at 90c', 'prediction markets beat the polls', 'it's just gambling'.`,
    `  • 'check_kalshi' → 'kalshi_verdict' — fees, legality in your state, available markets, API specifics. All fast-moving; all verified via research.`,
    ``,
    `THE THREE RULES THAT PREVENT THE MOST PAIN: (1) read the SETTLEMENT RULE before the price — most losing trades are misread rules, not bad forecasts. (2) Compute breakeven AFTER fees; a small edge on a 50c market is routinely negative EV. (3) Never recall the legal status or the fee schedule from memory — both change, and this asset refuses to guess at either.`,
    ``,
    `SCOPE: this is speculation with a defined maximum loss, not investing — there is no long-run positive drift here the way there is in owning productive assets. Retirement and portfolio questions → 'nestegg'. Legal advice → 'lawguide'.`,
  ].join("\n");
}
