import { fuzzyFind, displayKey } from "./match.js";

// Style rules for every entry in this file (hard requirements, not taste):
//  - BOTTOM LINE first, one sentence a kid could repeat.
//  - Plain words. Short sentences. Everyday pictures ("a box", "a slice", "rent").
//  - Any jargon gets a one-line translation immediately.
//  - Small chunks: big topics support step-at-a-time delivery.
//  - Honest odds on risky things. No hype, no preaching — just the math.

interface Vehicle {
  simple: string; // one line, kid-level
  pays: string; // how it actually makes money
  risk: string; // what can go wrong, plainly
  odds: string; // the honest statistical reality
  for_you: string; // who it fits
}

export const VEHICLES: Record<string, Vehicle> = {
  savings_hysa: {
    simple: "A piggy bank at the bank that pays you a little rent for keeping money there.",
    pays: "Interest — the bank pays you a few % a year. Your money never shrinks.",
    risk: "Almost none (insured up to $250k by the government). The quiet risk: prices rise over years, so cash slowly buys less.",
    odds: "You will never lose a dollar. You will also never get rich — it barely keeps up with rising prices.",
    for_you: "Emergency money, and money you'll need soon — like a house down payment.",
  },
  t_bills_cds: {
    simple: "You lend money to the government (T-bill) or a bank (CD) for a set time, and they pay you back with a tip.",
    pays: "Fixed interest, agreed up front. T-bills are the safest IOU on Earth.",
    risk: "Basically none if you hold to the end date. If you pull out early, CDs charge a penalty.",
    odds: "Guaranteed small win. Great parking spot, not a growth engine.",
    for_you: "Money with a date on it — 'I need this in 2 years for the house.'",
  },
  bonds: {
    simple: "You lend money to a company or government, and they pay you rent on your loan.",
    pays: "Regular interest payments, plus your money back at the end.",
    risk: "The borrower could fail (rare for governments), and if rates rise, older bonds are worth less if you sell early.",
    odds: "Steadier than stocks, smaller wins. The 'calm half' of a grown-up portfolio.",
    for_you: "People who want fewer stomach drops, or are closer to needing the money.",
  },
  stocks: {
    simple: "Buying a stock means buying a tiny slice of a real company.",
    pays: "Two ways: the slice gets more valuable if the company grows, and some companies mail you a share of profits (a 'dividend').",
    risk: "One company can crash or die, and your slice dies with it.",
    odds: "The stock MARKET grows over decades. Picking single WINNERS is where people lose — even most professionals fail to beat the market.",
    for_you: "Long-term money (5+ years). Best bought as bundles (see index_funds), not one-by-one.",
  },
  index_funds: {
    simple: "One purchase that buys you a tiny slice of ALL the big companies at once — the whole basket instead of one egg.",
    pays: "Grows as the whole economy grows. Historically ~7-10% a year AVERAGED over decades (some years way up, some way down).",
    risk: "In a bad year the whole basket can drop 20-30%. It has always recovered — but only for people who didn't panic-sell.",
    odds: "This is the boring thing that actually works. It beats ~90% of professionals over 20 years. Most millionaires-next-door got there on this.",
    for_you: "Almost everyone, for long-term money. This is the default answer.",
  },
  k401: {
    simple: "Not an investment — a special BOX from your job that you put investments inside. The tax man keeps his hands off while money grows.",
    pays: "The magic is the employer MATCH: many jobs add 50 cents or $1 for every $1 you put in, up to a limit. That's free money — an instant 50-100% win.",
    risk: "The box is safe; what you put INSIDE it (usually index funds) goes up and down. Taking money out before age 59½ costs taxes + a 10% penalty.",
    odds: "The match is the single best deal in all of investing. Nothing else guarantees +50-100% on day one.",
    for_you: "Anyone whose job offers one. Grab at least the full match, always.",
  },
  ira_roth: {
    simple: "A tax-protected box YOU open yourself (no job needed). Roth = pay tax now, never again. Traditional = skip tax now, pay when you take it out.",
    pays: "Whatever you put inside it (index funds again). The win is the tax savings, which compounds huge over decades.",
    risk: "Same as what's inside. Early withdrawal rules apply (Roth is friendlier — your contributions can come out anytime).",
    odds: "For most younger people, Roth wins: decades of growth, all tax-free.",
    for_you: "Anyone with earned income. Usually the step right after the 401k match.",
  },
  hsa: {
    simple: "A health-costs box with the best tax deal in America: no tax going in, no tax growing, no tax coming out for medical costs.",
    pays: "Triple tax-free growth if used for health costs. After 65 it acts like another retirement account.",
    risk: "Only available with a high-deductible health plan. Non-medical withdrawals before 65 get taxed + penalized.",
    odds: "If you qualify, it's mathematically the strongest box that exists.",
    for_you: "People on high-deductible health insurance plans.",
  },
  crypto: {
    simple: "Internet money whose price is whatever the crowd believes today. No company, no profits, no rent — just belief.",
    pays: "Only one way: someone later pays more than you did. Nothing underneath generates money.",
    risk: "Drops of 50-80% have happened repeatedly. Exchanges have collapsed and taken people's money. Scams are everywhere.",
    odds: "A few early people got rich; most people who bought peaks lost badly. Studies show the majority of active crypto traders lose money.",
    for_you: "Only money you can 100% afford to lose — think lottery-ticket bucket, 5% of investments max, if at all.",
  },
  options: {
    simple: "Calls and puts are BETS on where a stock goes by a deadline. A call bets UP, a put bets DOWN. Not slices of anything — tickets that expire.",
    pays: "Guess the direction AND the size AND the timing right, and a small bet pays big. Miss any of the three and the ticket expires worth $0.",
    risk: "Most options expire worthless. Selling certain options can lose MORE than you put in.",
    odds: "Studies of retail traders: the large majority lose money on options, and the house (market makers) wins the spread either way. This is closer to sports betting than investing.",
    for_you: "Honestly? Almost nobody starting out. Learn it to understand the casino — not to play in it.",
  },
  kalshi_prediction: {
    simple: "A legal betting market on real-world events — 'Will X happen by Y date?' You buy YES or NO for cents on the dollar.",
    pays: "Right answer pays $1 per contract; wrong pays $0.",
    risk: "It's zero-sum: every dollar you win, someone lost — minus the platform's cut. Winnings are taxed as income.",
    odds: "Same shape as gambling with better dressing. Fine as entertainment money; it is not investing — nothing grows.",
    for_you: "Entertainment budget only.",
  },
  real_estate: {
    simple: "Buy a property; a tenant pays you rent, and the building may grow in value.",
    pays: "Monthly rent minus all costs, plus appreciation, plus the loan slowly paid off by the tenant.",
    risk: "One roof, one address: vacancies, bad tenants, repairs, insurance, and you can't sell a bathroom if you need quick cash.",
    odds: "Real wealth gets built here, but it's a part-time JOB, not a set-and-forget. Margins are thinner than TikTok implies once you count everything.",
    for_you: "Later — after the boring boxes are full and you actually want landlord work. (Your own home comes first — see the homebuyer tools.)",
  },
  gold_metals: {
    simple: "A shiny rock people trust when they're scared. It doesn't grow, pay rent, or invent anything — it just sits there.",
    pays: "Only if someone later pays more. Over long periods it roughly keeps up with inflation, with big flat decades.",
    risk: "Dealers and TV ads sell it at fat markups — that's where the seller wins and you lose. Storage/insurance costs eat returns.",
    odds: "As a small 'insurance slice' (0-5%) it's defensible. As a main plan, it has lost to index funds massively over every long stretch.",
    for_you: "People who already finished the basics and want a small anxiety hedge.",
  },
  wine_collectibles: {
    simple: "Wine, art, cards, watches — betting a rare thing gets rarer. The websites selling this make THEIR money on fees either way.",
    pays: "Only resale to a bigger enthusiast. Illiquid: selling can take months and cost 10-25% in fees.",
    risk: "Fakes, storage, fashion shifts, and platforms that mark up 2-3x what the item resells for.",
    odds: "The platforms' fees are the only guaranteed return, and they go to the platform. Hobby first, investment barely.",
    for_you: "People who'd enjoy owning it even if it never sold. That's the honest test.",
  },
};

export function explainVehicle(vehicle?: string): string {
  if (!vehicle) {
    return (
      `EVERY WAY PEOPLE INVEST — one line each. Ask for any one by name to go deeper.\n\n` +
      Object.entries(VEHICLES)
        .map(([k, v]) => `▸ ${k}: ${v.simple}`)
        .join("\n") +
      `\n\n(401k / IRA / HSA are BOXES, not investments — run 'containers_vs_investments' first if that sounds odd.)`
    );
  }
  const norm = vehicle.toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/^401k?$/, "k401");
  // Map common aliases to canonical keys before fuzzy matching.
  const aliased = /(call|put)/.test(norm) ? "options" : /roth|ira/.test(norm) ? "ira_roth" : /bitcoin|eth/.test(norm) ? "crypto" : norm;
  const found = fuzzyFind(VEHICLES, aliased);
  if (!found) return `Don't know "${vehicle}". I know: ${Object.keys(VEHICLES).join(", ")}.`;
  const v = found.value;
  return [
    `${displayKey(found.key)} — BOTTOM LINE: ${v.simple}`,
    ``,
    `How it makes money: ${v.pays}`,
    `What can go wrong: ${v.risk}`,
    `Honest odds: ${v.odds}`,
    `Good for: ${v.for_you}`,
  ].join("\n");
}

export function containersVsInvestments(): string {
  return [
    `BOTTOM LINE: a 401k is a BOX. A stock is a THING you put in a box. Mixing these up causes most of the confusion.`,
    ``,
    `Picture it like this:`,
    `  BOXES (where money sits): 401k, IRA, Roth IRA, HSA, regular brokerage account.`,
    `  THINGS (what money buys): stocks, bonds, index funds, crypto, gold.`,
    ``,
    `The boxes differ in ONE way: how the tax man treats them.`,
    `  • 401k/Trad IRA: no tax going in, taxed coming out (retirement).`,
    `  • Roth IRA: taxed going in, NEVER taxed again.`,
    `  • HSA: never taxed at all (for health costs). Best box in the game.`,
    `  • Regular brokerage: no protection — you pay tax on gains.`,
    ``,
    `So "should I do a 401k or buy stocks?" isn't a real choice — you buy stocks (index funds) INSIDE the 401k.`,
    ``,
    `Next: run 'order_of_operations' to see which box to fill first.`,
  ].join("\n");
}

const ORDER_STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Grab the 401k match — free money first",
    body: "If your job matches 401k money, put in exactly enough to get ALL of it. Every $1 you put in comes with an instant 50¢-$1 free. Nothing else in investing pays a guaranteed +50-100% on day one. Skipping this is leaving part of your paycheck on the table.",
  },
  {
    title: "Kill high-interest debt (credit cards)",
    body: "A credit card charging 24% means paying it off IS a guaranteed 24% return — better than any investment on Earth can promise. Card debt gone before anything fancy. (A cheap mortgage or car loan can wait; this is about the expensive stuff.)",
  },
  {
    title: "Build the emergency fund",
    body: "3-6 months of bills in a high-yield savings account (HYSA). This is the wall that stops one bad month — a layoff, a transmission — from forcing you to sell investments at the worst time or swipe the card at 24%.",
  },
  {
    title: "Park 'soon money' somewhere safe",
    body: "Any money you'll need within ~5 years — like a HOUSE DOWN PAYMENT — does NOT go in stocks. Stocks can drop 30% the year you need the cash. Soon-money lives in HYSA, T-bills, or CDs: smaller reward, zero heartbreak. (This connects directly to your home-buying plan.)",
  },
  {
    title: "Fill a Roth IRA",
    body: "Open it yourself in 10 minutes at any big brokerage. Put in up to the yearly limit, buy a broad index fund inside it, done. Decades of growth, then every penny comes out tax-free.",
  },
  {
    title: "Go back and fill more of the 401k",
    body: "Raise your 401k percentage past the match, toward the yearly max if you can. Same index funds inside. Every extra percent now is worth multiples later.",
  },
  {
    title: "Then — and only then — everything else",
    body: "Regular brokerage account with index funds for long-term extra. Only after ALL the above is the 'exciting' stuff even a conversation — single stocks, crypto, alternatives — and only with a small slice (5-10%) you could lose without pain.",
  },
];

export function orderOfOperations(step?: number): string {
  if (step !== undefined) {
    const i = Math.floor(step);
    if (i < 1 || i > ORDER_STEPS.length) {
      return `Steps go 1 to ${ORDER_STEPS.length}. Ask for one at a time — that's the point.`;
    }
    const s = ORDER_STEPS[i - 1];
    const next = i < ORDER_STEPS.length ? `\n\nNext: ask for step ${i + 1}.` : `\n\nThat's the last step. You now know the whole ladder.`;
    return `STEP ${i} OF ${ORDER_STEPS.length}: ${s.title}\n\n${s.body}${next}`;
  }
  return [
    `BOTTOM LINE: fill your money buckets in THIS order. Skipping ahead is how people lose.`,
    ``,
    ...ORDER_STEPS.map((s, i) => `  ${i + 1}. ${s.title}`),
    ``,
    `This is the same boring ladder pros actually use for their own money.`,
    `Want it one piece at a time? Ask for step 1.`,
  ].join("\n");
}

const TAX_TOPICS: Record<string, string> = {
  capital_gains:
    "BOTTOM LINE: hold longer than 1 year and the federal tax man takes a smaller bite.\n\nSell an investment for more than you paid = a 'capital gain.'\n  • Held UNDER 1 year: taxed like your paycheck (up to 37% federal).\n  • Held OVER 1 year: special lower rates — 0%, 15%, or 20% depending on income. Most people pay 15%.\nCALIFORNIA twist: the state gives NO discount — CA taxes all gains like regular income on top of federal. That's the piece most articles forget to mention.",
  retirement_withdrawals:
    "BOTTOM LINE: retirement boxes punish early grabs — about 10% penalty PLUS taxes before age 59½.\n\n  • 401k/Trad IRA: withdrawals in retirement are taxed like a paycheck. Before 59½: taxes + 10% penalty (with narrow exceptions).\n  • Roth IRA: the money you PUT IN can come out anytime, free. The GROWTH must wait until 59½ (and 5 years) to be free.\n  • First-home note: up to $10k of IRA earnings can come out penalty-free for a first house — relevant to your plan.",
  dividends:
    "BOTTOM LINE: 'qualified' dividends (most normal US stock dividends held a while) get the low capital-gains rate; interest from savings/bonds is taxed like a paycheck.\n\nInside a 401k/IRA/HSA none of this matters — that's the whole point of the boxes.",
  crypto_tax:
    "BOTTOM LINE: the IRS treats crypto like stock — every sale, swap, or purchase WITH crypto is a taxable event.\n\nSwapping bitcoin for another coin? Taxable. Buying a pizza with it? Taxable. Exchanges report to the IRS now. People get surprise bills because nobody told them swaps count.",
  kalshi_gambling:
    "BOTTOM LINE: prediction-market and gambling winnings are taxed as plain income — no long-term discount ever.",
  the_boxes:
    "BOTTOM LINE: the entire reason 401k/IRA/HSA exist is tax. Same index fund, different box, wildly different take-home.\n\n$100k of growth in a regular account: you owe capital gains + CA income tax.\nSame growth in a Roth: you owe $0. That difference — often tens of thousands — is why order_of_operations fills tax boxes first.",
};

export function explainTax(topic?: string): string {
  if (!topic) {
    return (
      `TAX, THE SHORT VERSION — ask for any topic by name:\n\n` +
      Object.entries(TAX_TOPICS)
        .map(([k, v]) => `▸ ${k}: ${v.split("\n")[0].replace("BOTTOM LINE: ", "")}`)
        .join("\n") +
      `\n\nGolden rule: taxes are the biggest fee you'll ever pay — the boxes exist to shrink it legally.`
    );
  }
  const found = fuzzyFind(TAX_TOPICS, topic);
  return found ? found.value : `Don't know "${topic}". I know: ${Object.keys(TAX_TOPICS).join(", ")}. (I'm education, not a CPA — confirm big moves with a tax pro.)`;
}

export function riskLadder(): string {
  return [
    `BOTTOM LINE: every rung up pays more but can hurt more. Know which rung you're standing on.`,
    ``,
    `  Rung 1 — Savings/HYSA: can't lose a dollar. ~4%ish. Sleep like a baby.`,
    `  Rung 2 — T-bills/CDs: can't lose if held to date. Slightly more.`,
    `  Rung 3 — Bonds: small wobbles. Steady rent.`,
    `  Rung 4 — Index funds: drops 20-30% some years, historically grows ~7-10%/yr over decades. The workhorse.`,
    `  Rung 5 — Single stocks: one company can go to zero. Some win huge; most people pick wrong.`,
    `  Rung 6 — Crypto: 50-80% crashes are normal. Pure belief pricing.`,
    `  Rung 7 — Options/margin/prediction bets: most players lose; can lose MORE than you put in (margin). This rung is a casino with better lighting.`,
    ``,
    `The move that works: most of your money on rung 4 inside tax boxes, soon-money on rungs 1-2, and rungs 5-7 only with a small fun-money slice — or never. Boring wins.`,
  ].join("\n");
}

export const TERMS: Record<string, string> = {
  compound_interest: "Money making babies, and the babies making babies. $100 earning 10% is $110 — next year the $10 earns too. Decades of this is how ordinary savers end up rich. Time matters more than amount.",
  dividend: "A company mailing shareholders a slice of its profits, usually every 3 months. Like rent from a slice of a business.",
  etf: "A basket of many investments you buy in one click, like an index fund. (Tiny difference: ETFs trade all day like stocks; index mutual funds trade once daily. For you: same idea.)",
  expense_ratio: "The yearly fee a fund quietly takes, as a %. 0.03% = great. 1% = highway robbery over 30 years (run 'fee_drag' to see the damage).",
  fiduciary: "THE magic word. A fiduciary must legally put YOUR interests first. A regular 'advisor' can legally sell you whatever pays them the best commission. Always ask: 'Are you a fiduciary, yes or no?'",
  diversification: "Don't put all eggs in one basket. Index funds are instant diversification — thousands of baskets in one click.",
  bull_bear: "Bull market = prices climbing. Bear market = prices down 20%+. Bears happen every few years; they've always ended. Panic-selling in a bear is how paper losses become real ones.",
  dollar_cost_averaging: "Investing the same amount every payday no matter what the market's doing. Auto-buys more shares when cheap, fewer when pricey — and removes the worst investor in the room: your feelings.",
  margin: "Investing with BORROWED money. Wins double, losses double, and the broker can force-sell your stuff at the bottom. Beginners: never.",
  liquidity: "How fast something turns back into cash. Savings = instant. Stocks = days. A house or wine collection = months. Soon-money needs liquid places.",
  brokerage: "The store where you buy investments (Fidelity, Schwab, Vanguard...). Opening an account is as hard as opening email. The big three are all fine and basically free.",
};

export function explainTerm(term?: string): string {
  if (!term) {
    return `WORDS PEOPLE THROW AROUND — ask for any:\n\n` + Object.entries(TERMS).map(([k, v]) => `▸ ${k}: ${v.split(".")[0]}.`).join("\n");
  }
  const found = fuzzyFind(TERMS, term);
  return found ? `${displayKey(found.key)}: ${found.value}` : `Don't know "${term}". I know: ${Object.keys(TERMS).join(", ")}.`;
}
