// check_kalshi / kalshi_verdict. Almost everything a user actually wants to
// know about this platform is fast-moving: the fee schedule is published and
// revised, the legality of a contract type depends on unsettled litigation that
// has moved repeatedly through 2026, which markets exist changes constantly,
// and the API's base URL and paths are versioned. So this asset holds NONE of
// it and verifies all of it.
//
// The legal question deserves the strongest warning of any verify loop in this
// repo: a wrong answer here is not a stale API path, it's someone trading
// something they shouldn't where they live.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "kalshi.com's own fee schedule document — the only authoritative source for current fees. Fee blogs are frequently out of date and they all copy each other.",
  "docs.kalshi.com — the official API reference for base URL, endpoints, auth, and rate limits. These are versioned and have changed before.",
  "CFTC.gov — orders, proposed rules, and enforcement actions on event contracts. The regulator's own words, not coverage of them.",
  "Court opinions and reputable law-firm analysis for the jurisdictional fight (Third Circuit, Ninth Circuit, and any Supreme Court action). Law firm client memos are unusually good on this topic.",
  "The exchange's own rulebook / contract specifications for how a specific market settles — the settlement rule is the contract.",
  "For tax treatment: IRS guidance or a tax professional. NOT a forum post, and not an analogy to gambling or to stock trading, because event contracts map cleanly onto neither.",
];

const RED_FLAGS = [
  "A fee number quoted without a date or a link to the schedule — fees are revised, and a confident stale number is worse than no number.",
  "'Kalshi is legal in all 50 states' or any flat statement of legality — the jurisdictional question is unsettled and has moved repeatedly. Treat any absolute claim as a signal the source isn't tracking it.",
  "Reading a court win as settled law. Most rulings so far have been on PRELIMINARY INJUNCTIONS — a finding of likely success, not a final merits decision, and not necessarily nationwide.",
  "An API example with a base URL from an old tutorial — the host and version path have changed; confirm against docs.kalshi.com.",
  "Tax treatment asserted by analogy ('it's like gambling' / 'it's like futures'). The treatment is genuinely contested; analogies are not guidance.",
  "Affiliate-driven 'best prediction market' content — much of the fee and legality writing on this topic is marketing with a referral link.",
  "Backtests or strategy claims based on a handful of events. With this few observations, signal and noise are indistinguishable.",
];

export function checkKalshi(rawTopic: string): string {
  const topic = clean(rawTopic);
  const year = new Date().getFullYear();
  return [
    `KALSHI CHECK — "${topic}"`,
    `BOTTOM LINE: don't answer this from memory. Fees, legality by state, which markets exist, and the API's shape all change — and on this platform the legal question in particular has moved repeatedly. Have research check the sources this tool lists, then call kalshi_verdict with what it finds.`,
    ``,
    `CHECK THESE SOURCES:`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • "${topic}" site:kalshi.com OR site:docs.kalshi.com`,
    `  • Kalshi fee schedule current ${year}`,
    `  • "${topic}" CFTC event contracts ruling ${year}`,
    `  • Kalshi legal status by state ${year} prediction markets litigation`,
    `  • "${topic}" Kalshi settlement rules OR contract specifications`,
    ``,
    `RED FLAGS to watch for in what comes back:`,
    ...RED_FLAGS.map((r) => `  - ${r}`),
    ``,
    `Once research reports back, call kalshi_verdict(topic, findings) for the graded, honest answer.`,
  ].join("\n");
}

export function kalshiVerdict(rawTopic: string, findings: string): string {
  const topic = clean(rawTopic);
  const notes = clean(findings);
  return [
    `KALSHI VERDICT — "${topic}"`,
    `BOTTOM LINE: grade how CURRENT and how OFFICIAL this is, and separate the exchange's own documents from commentary about them. On anything legal, say plainly whether it is settled law or a preliminary ruling — that distinction is the whole answer.`,
    ``,
    `Findings reported: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `Evidence tiers, strongest to weakest:`,
    `  1. Primary and current — the exchange's own fee schedule or rulebook, the official API docs, a CFTC order, or a court opinion itself. Trust it, and cite the date.`,
    `  2. Expert analysis of a primary source — a law-firm memo on a ruling, dated and specific. Good, but check it against the ruling for anything decisive.`,
    `  3. Reporting — accurate on the event, often loose on whether something is settled or preliminary. Verify the legal characterisation.`,
    `  4. Stale — a fee number, market list, base URL, or legal status from an earlier period. Say what changed and give the current value.`,
    `  5. Marketing or affiliate content — comparison and 'best platform' pages with referral links. Don't price or plan from these.`,
    ``,
    `Label VERIFIED (primary source confirms it as current), UPDATED (research found the current value differs — give the corrected value AND its date), or UNVERIFIED (couldn't confirm — say so plainly rather than guessing).`,
    ``,
    `THREE THINGS THIS VERDICT MUST NOT DO:`,
    `  ✗ State a fee without its date. The schedule is revised; an undated fee is not an answer.`,
    `  ✗ State that trading is legal or illegal somewhere as settled fact while the litigation is live. Report the current posture, name the court, and say explicitly whether it is preliminary. This is not legal advice — for a real decision, see the 'lawguide' asset or a lawyer.`,
    `  ✗ Turn a verified fact into a recommendation to trade. Confirming a fee schedule says nothing about whether anyone should be placing the trade.`,
  ].join("\n");
}
