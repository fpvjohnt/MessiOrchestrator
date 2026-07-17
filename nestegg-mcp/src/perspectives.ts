import { fuzzyFind, displayKey } from "./match.js";

// Who's on your side in the money world — and the traps. Same style rules:
// bottom line first, plain words, short, honest odds.

interface Player {
  motive: string;
  thinks: string;
  clash: string;
  move: string;
}

export const PLAYERS: Record<string, Player> = {
  stockbroker: {
    motive: "Paid when you TRADE — commissions and fees per transaction.",
    thinks: "Activity. A client who buys and holds an index fund for 30 years earns them almost nothing.",
    clash: "The best strategy for you (buy, hold, ignore) is the worst for their paycheck.",
    move: "You probably don't need one. A brokerage app and an index fund replace this job for most people.",
  },
  financial_advisor: {
    motive: "Two totally different animals wear this same badge: FIDUCIARIES (legally must put you first, usually flat-fee) and COMMISSION advisors (paid by whoever's product they sell you).",
    thinks: "The commission kind thinks: which fund/annuity/policy pays ME the most and can still be defended to you.",
    clash: "A commission advisor can legally sell you a mediocre fund with a 5% load because it pays them best.",
    move: "One question filters them: 'Are you a fiduciary, and how exactly do you get paid?' Flat-fee fiduciary = fine. Vague answer = leave.",
  },
  robo_advisor: {
    motive: "Apps (Betterment etc.) charging ~0.25%/yr to auto-manage index funds for you.",
    thinks: "Keep you invested and calm; the algorithm does the boring right thing.",
    clash: "Mild: that 0.25% buys automation you could do yourself for free with one index fund.",
    move: "Not a bad training-wheels option. Graduating to DIY saves the fee.",
  },
  fund_manager: {
    motive: "Paid a % of the money in their fund — win or lose, they collect.",
    thinks: "Gather more money under management. Marketing beats performance for their income.",
    clash: "Their 1% fee comes out whether they beat the market or not — and ~90% DON'T over 20 years.",
    move: "Check the expense ratio before anything else. Over 0.2%, ask what you're paying for. Usually the answer is: their boat.",
  },
  insurance_salesman: {
    motive: "Whole-life and annuity commissions are among the FATTEST in finance — often 50-100% of your first year's payments.",
    thinks: "Sell 'investment + insurance in one!' It sounds prudent and pays them enormously.",
    clash: "For most people, cheap term life insurance + index funds beats whole-life by a mile. The complexity hides the fees.",
    move: "The phrase 'life insurance as an investment' = hand on wallet, walk. Buy term if you need coverage; invest the difference.",
  },
  crypto_influencer: {
    motive: "Paid by views, sponsors, and — often — by quietly holding the coin BEFORE telling you to buy it.",
    thinks: "Urgency and FOMO: 'last chance,' 'next bitcoin,' '100x.' Your click is the product; your buy pumps their bag.",
    clash: "They win when you buy, even if you lose. There is zero penalty to them for being wrong.",
    move: "Assume anyone promising a specific coin will moon is selling you their exit. No exceptions have aged well.",
  },
  trading_guru: {
    motive: "Sells courses, signals, and 'discords' — the fees are the business, not the trading.",
    thinks: "Screenshot the wins, bury the losses, sell the dream of quitting your job.",
    clash: "If day trading actually paid them, they wouldn't need your $997 course. Studies: 70-97% of day traders lose money over time.",
    move: "The course-seller math IS the answer: the reliable money was in selling courses. Keep yours.",
  },
};

export function howTheyThink(role?: string): string {
  if (!role) {
    return (
      `WHO'S WHO IN THE MONEY WORLD — one line each; ask for any by name:\n\n` +
      Object.entries(PLAYERS)
        .map(([k, p]) => `▸ ${k.toUpperCase()}: ${p.motive}`)
        .join("\n") +
      `\n\nThe pattern: follow how each one gets PAID and you know whose side they're on. The only one legally on your side is a fiduciary.`
    );
  }
  const found = fuzzyFind(PLAYERS, role);
  if (!found) return `Don't know "${role}". I know: ${Object.keys(PLAYERS).join(", ")}.`;
  const p = found.value;
  return [
    `${displayKey(found.key)} — BOTTOM LINE: ${p.motive}`,
    ``,
    `How they think: ${p.thinks}`,
    `Where it clashes with you: ${p.clash}`,
    `Your move: ${p.move}`,
  ].join("\n");
}

interface Flag {
  bottom_line: string;
  looks_like: string;
  math: string;
  move: string;
}

export const RED_FLAGS: Record<string, Flag> = {
  guaranteed_returns: {
    bottom_line: "'Guaranteed 12%' = scam. Every time. No exceptions.",
    looks_like: "Steady high returns, no down years, pressure to bring friends. (Madoff's exact recipe.)",
    math: "Real safe returns are ~4-5% right now. Anything 'guaranteed' above that is paying old investors with new investors' money — until it can't.",
    move: "Walk. Report if bold. Verify any 'fund' at sec.gov before a dollar moves.",
  },
  fomo_picks: {
    bottom_line: "By the time a hot stock/coin reaches your feed, the smart money is selling it — to you.",
    looks_like: "'Everyone's making money on X,' friends bragging, influencers with rockets emojis.",
    math: "Retail investors who chase hype buy high and panic-sell low almost by definition — the hype IS the top forming.",
    move: "The boring test: would you still want it if you couldn't tell anyone? Wait 30 days. The urge usually dies before the price does.",
  },
  options_beginner: {
    bottom_line: "Options as a beginner = donating your money to professionals, statistically.",
    looks_like: "Reddit screenshots of 1000% wins, 'just buy calls,' apps that made betting feel like a game.",
    math: "The winners post; the far-more-numerous losers don't. Majority of retail options traders lose; the house takes a cut either way.",
    move: "Learn the mechanics if curious (explain_vehicle options) — with play-money apps, not rent money.",
  },
  margin_loans: {
    bottom_line: "Borrowing to invest doubles wins AND losses — and lets the broker force-sell you at the bottom.",
    looks_like: "'Leverage yourself,' margin offers inside your broker app, crypto 10x buttons.",
    math: "A 50% drop on 2x margin = 100% wiped, plus interest. Forced liquidation locks the loss at the worst moment.",
    move: "Beginners: never. The pros who use it hedge; the amateurs who use it vanish.",
  },
  gold_dealers: {
    bottom_line: "TV/radio gold dealers make their money on MARKUP the moment you buy — you start 10-30% underwater.",
    looks_like: "Fear ads ('dollar collapse!'), 'free' coins, collectible/proof coins priced way over melt value.",
    math: "Their spread is the business. The 'collectible' coin resells at metal value — the story premium evaporates.",
    move: "If you truly want a metal slice, a gold ETF costs ~0.4%/yr with no markup, no safe, no ads.",
  },
  wine_alt_platforms: {
    bottom_line: "Wine/art/cards 'investing' sites earn fees no matter what your bottle does — you carry all the risk.",
    looks_like: "'Fine wine returned 10%/yr!' marketing, sleek apps, entry fees + storage fees + exit fees.",
    math: "Their cited indexes skip fees, insurance, and the months it takes to actually sell. Net of all that, returns shrink toward zero for most.",
    move: "Hobby money only, and only if you'd enjoy owning it unsold. That's the honest test.",
  },
  free_seminar: {
    bottom_line: "The free steak dinner seminar costs more than any dinner you've ever bought.",
    looks_like: "Invites for retirees/new investors, 'wealth workshop,' a charming speaker, urgency paperwork at the end.",
    math: "The room, the steak, the speaker — all paid for by the commissions on whatever they sell the room. Usually annuities or whole-life.",
    move: "Eat the steak if you like. Sign nothing for 30 days, and run it past a fee-only fiduciary first.",
  },
  pump_groups: {
    bottom_line: "Chat groups coordinating a coin/stock 'to the moon' are using YOU as the exit — it's illegal in stocks and it's how members lose in crypto.",
    looks_like: "Telegram/Discord 'signals,' countdowns to a coordinated buy, insiders 'sharing alpha.'",
    math: "The organizers bought first. Your coordinated buy IS their sell order. Every pump chart has the same cliff on the right side.",
    move: "Leave the group. If it was stocks, you were also being recruited into securities fraud.",
  },
};

export function redFlag(issue?: string): string {
  if (!issue) {
    return (
      `MONEY TRAPS — one line each; ask for any by name:\n\n` +
      Object.entries(RED_FLAGS)
        .map(([k, f]) => `▸ ${k.replace(/_/g, " ").toUpperCase()}: ${f.bottom_line}`)
        .join("\n")
    );
  }
  const found = fuzzyFind(RED_FLAGS, issue);
  if (!found) return `Don't know "${issue}". I know: ${Object.keys(RED_FLAGS).join(", ")}.`;
  const f = found.value;
  return [
    `${displayKey(found.key)} — BOTTOM LINE: ${f.bottom_line}`,
    ``,
    `What it looks like: ${f.looks_like}`,
    `The math against you: ${f.math}`,
    `Your move: ${f.move}`,
  ].join("\n");
}
