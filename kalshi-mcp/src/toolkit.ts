// read_market and myth_vs_reality — the judgment tools. Neither holds a price
// or a fee number; read_market produces the checklist and the research queries,
// and the live data comes back through the 'research' asset.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

// The order is deliberate and is the whole point of the tool: the rule comes
// before the price, and your own estimate comes before you look at the market.
// Doing these in the wrong order is how a correct forecast still loses money.
const CHECKLIST: Array<[string, string]> = [
  [
    "READ THE SETTLEMENT RULE FIRST — before the price",
    "Find the exact condition, the exact source, and the exact deadline. Write in one sentence what makes this pay $1. If you can't write that sentence, you don't understand the market well enough to trade it — and misread rules, not bad forecasts, are the most common way people lose here.",
  ],
  [
    "CHECK WHAT DECIDES IT",
    "Which agency, feed, or announcement settles this? Can it be delayed, revised, or disputed? A revision after the deadline generally does NOT reopen a settled market — it settles on the print that existed at the time.",
  ],
  [
    "FORM YOUR OWN PROBABILITY — before looking at the price",
    "Start from a base rate: how often has this kind of thing happened in comparable past cases? Then adjust for what's specific to this one. Write the number down. If you look at the price first you will anchor on it and call the result analysis.",
  ],
  [
    "NOW COMPARE TO THE MARKET",
    "If you disagree, ask WHY the other side is taking their position. If you can't state their reasoning, you're probably the one missing something — the base rate is that the market is closer to right than a retail estimate.",
  ],
  [
    "CHECK LIQUIDITY BEFORE SIZE",
    "Look at the depth on the book, not the top quote. A large order walks the book and gets a worse average price. If you couldn't exit at anything near the mid, size for holding to settlement.",
  ],
  [
    "RUN THE FEE MATH",
    "Breakeven is the price PLUS the fee, not the price. Use the 'price_check' tool. Near 50c the fee is largest, so a thin edge held to settlement is barely above breakeven and the same edge round-tripped is clearly below it — that's arithmetic, not pessimism.",
  ],
  [
    "SIZE FOR BEING WRONG",
    "Decide the size before you look at what you could win. Group correlated positions and size the group: five contracts on the same election are one bet.",
  ],
];

export function readMarket(rawQuestion?: string): string {
  const question = rawQuestion ? clean(rawQuestion) : "";
  const subject = question || "this market";

  return [
    `READ A MARKET${question ? ` — "${question}"` : ""}`,
    `BOTTOM LINE: work in this order — settlement rule, then your own probability, then the market price, then the fee math. Most losing trades on event contracts are misread rules or unpriced fees, not bad forecasts.`,
    ``,
    `THE CHECKLIST:`,
    ...CHECKLIST.flatMap(([title, body], i) => [`  ${i + 1}. ${title}`, `     ${body}`, ``]),
    `RESEARCH QUERIES TO RUN (this asset holds no live data — have 'research' run these):`,
    `  • "${subject}" Kalshi market settlement rules source`,
    `  • "${subject}" base rate historical frequency past occurrences`,
    `  • "${subject}" current forecast OR polling OR model estimate`,
    `  • "${subject}" scheduled announcement OR release date OR deadline`,
    `  • Kalshi current fee schedule (never trust a remembered fee number)`,
    ``,
    `THEN: feed your probability estimate and the market price into 'price_check' for the breakeven-after-fees answer, and use 'check_kalshi' for anything current — the fee schedule, whether this contract type is tradeable where you are, and what the market data actually says.`,
    ``,
    `HONEST FRAMING: a defined maximum loss makes this feel safer than it is. The instrument is transparent; the edge is not. Most retail participants in comparable markets lose money net of costs, and nothing in this checklist changes that base rate — it only stops you losing for the avoidable reasons.`,
  ].join("\n");
}

const MYTHS: Array<[string, string]> = [
  [
    "'The market price is the true probability.'",
    "It's the price at which strangers are currently willing to trade, which is a good estimate in aggregate and can be badly wrong in any single market. Calibration is a property of thousands of markets together — 'things priced at 70% happen about 70% of the time' can hold while the specific market in front of you is nonsense. Thin markets especially are one opinion wearing a crowd's clothes.",
  ],
  [
    "'Buying at 90c is nearly free money.'",
    "It pays 11c on 90c risked, so one loss erases roughly nine wins — and that's before fees. High-probability contracts are where confident people quietly bleed, because the loss feels like bad luck each time. The arithmetic was against them from the start.",
  ],
  [
    "'Prediction markets beat the polls / the experts.'",
    "Oversold. They aggregate information with money at stake, which is a real advantage, and they have a documented longshot bias — low-probability outcomes are systematically overpriced. They're a useful signal, not an oracle, and the studies showing they beat polls are narrower than the claim that gets repeated from them.",
  ],
  [
    "'It's just gambling.' / 'It's investing.'",
    "Neither. Unlike a sportsbook you trade against other participants on an exchange with explicit fees rather than against a house with its margin baked into the odds. But unlike owning a business there's no positive long-run drift — it's a transfer between participants minus costs. Calling it investing is the more expensive mistake of the two.",
  ],
  [
    "'I follow this closely, so I have an edge.'",
    "Reading the news is not an edge; everyone else read it too. Plausible edges are narrow: real domain expertise, patient base-rate work on a recurring series, or being a maker while others are impatient. Having a strong opinion is the single most common thing mistaken for an edge.",
  ],
  [
    "'Fees are small, they don't change much.'",
    "The fee is largest exactly at the coin-flip prices most people trade, and you pay it twice if you exit before settlement. At 50c it costs roughly 1.75c per contract to take, so a 2-point edge held to settlement clears breakeven by a hair and the same trade exited early is solidly negative. This is the calculation that decides most trades and the one most often skipped.",
  ],
  [
    "'It's federally regulated, so it's legal for me.'",
    "Federal regulation as a designated contract market is a real and meaningful status, but whether it pre-empts state gambling law is being actively litigated and has not been settled. Rulings so far have largely been preliminary injunctions — findings about likely success, not final law. Being able to place a trade in an app is not proof it's lawful where you are.",
  ],
  [
    "'I won several in a row, so my method works.'",
    "With binary outcomes, streaks are common and mean nothing at small samples. You cannot distinguish skill from luck without recording your predicted probability against outcomes over many markets and scoring it. Almost nobody does this, which is why almost everybody believes they're above average.",
  ],
];

export function mythVsReality(): string {
  return [
    `PREDICTION-MARKET MYTHS vs REALITY — the folklore that costs money`,
    `BOTTOM LINE: the two beliefs that do the most damage are that a market price is a fact about the world, and that a high-probability contract is nearly free money. Both feel like sophistication and both are expensive.`,
    ``,
    ...MYTHS.map(([m, r]) => `▸ MYTH: ${m}\n   REALITY: ${r}`),
    ``,
    `THE THROUGH-LINE: this instrument is unusually transparent — you can see your maximum loss before you trade, which is genuinely rare. That transparency is about RISK, not about EDGE. Knowing exactly how much you can lose tells you nothing about whether you're likely to.`,
  ].join("\n");
}
