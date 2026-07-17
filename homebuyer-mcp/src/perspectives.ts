// The "stay ahead" layer: how each party actually thinks (their incentive, where
// it clashes with yours, your counter-move), and a problem playbook for red flags.
// Bottom-line-first: every entry leads with the one-line takeaway.

interface Perspective {
  motive: string; // their real incentive, one line
  thinks: string; // how they reason
  clash: string; // where their interest diverges from yours
  move: string; // what you do to stay ahead
}

export const PLAYERS: Record<string, Perspective> = {
  buyer_agent: {
    motive: "Paid a % of the price only if the deal closes — so they want you to buy, and buy soon.",
    thinks: "Volume and closings. A 'good' client is decisive and doesn't waste showings. They rarely lose money telling you to offer more.",
    clash: "Their commission rises with price and vanishes if you walk — mild pressure toward higher offers and faster removal of contingencies.",
    move: "Make them earn it: ask for comps in writing, ask 'what would you offer and why,' and never let them rush your contingency removal.",
  },
  listing_agent: {
    motive: "Works for the SELLER. Paid to get the highest price and a clean, certain close.",
    thinks: "Create urgency and competition — 'multiple offers,' 'offers due Sunday,' deadlines. Screens buyers for who will actually close.",
    clash: "Everything they say is a sales pitch aimed at your wallet. 'Lots of interest' may or may not be real.",
    move: "Stay unemotional. Ask concrete questions: days on market, price history, why selling. A long DOM or price cuts = your leverage.",
  },
  loan_officer: {
    motive: "Paid when the loan funds — wants you approved and closed.",
    thinks: "Will you qualify, and which product closes fastest. May quote a low rate that needs points to achieve.",
    clash: "The cheapest-sounding quote isn't always cheapest after fees. They benefit from you not shopping around.",
    move: "Get 3+ Loan Estimates on the SAME day and compare the APR and total fees, not the headline rate.",
  },
  inspector: {
    motive: "You hire them; their reputation and liability ride on what they miss.",
    thinks: "Document everything, flag anything arguable to cover themselves. Won't give you a buy/don't-buy verdict.",
    clash: "None with you — but they hedge, so the report reads scarier than reality. They won't estimate repair costs.",
    move: "Attend the inspection. Ask 'what would you fix first and what would you ignore.' Get quotes on the big flags before you negotiate.",
  },
  appraiser: {
    motive: "Neutral, hired by the lender to protect the BANK from over-lending.",
    thinks: "Conservative, comp-driven. Won't stretch to hit your contract price.",
    clash: "If they come in low, YOU cover the gap in cash — not the bank.",
    move: "Keep an appraisal contingency. If it's low, ask the lender for the comps used and dispute or renegotiate with the seller.",
  },
  assessor: {
    motive: "County office setting your TAX value — in CA, based on your purchase price (Prop 13).",
    thinks: "Reassesses at sale. New purchase price = new tax basis. Plus a one-time supplemental bill after you buy.",
    clash: "A higher purchase price locks in higher property tax for as long as you own it.",
    move: "Budget tax on your actual price, not the seller's old (lower) bill. Expect the supplemental bill weeks after closing.",
  },
  escrow: {
    motive: "Neutral third party paid to close cleanly and on schedule.",
    thinks: "Checklist and deadlines. Holds your deposit and every document; releases nothing until conditions are met.",
    clash: "None — but they won't advise you; they just execute. Missing a deadline is on you.",
    move: "Track your contingency and closing dates yourself. Ask escrow for the timeline in writing and confirm your deposit is with them, not the seller.",
  },
  seller: {
    motive: "Highest price — but their situation sets how motivated they are.",
    thinks: "Emotional about the home + financial about the number. Relocation, divorce, job change, or distress = motivated = your leverage.",
    clash: "They'll anchor high and may hide problems behind 'as-is.'",
    move: "Learn WHY they're selling and how long it's sat. Motivated seller + long DOM = room to negotiate price, credits, or repairs.",
  },
  underwriter: {
    motive: "The lender's risk gatekeeper — paid to protect the bank, and can kill the deal.",
    thinks: "Risk-averse and literal. Verifies income, assets, appraisal, and property condition. Hates surprises (big deposits, job changes, unpermitted work).",
    clash: "They can deny financing late over things that feel minor to you.",
    move: "Don't change jobs, make big purchases, or move money around mid-escrow. Disclose everything up front.",
  },
};

export function howTheyThink(role?: string): string {
  if (!role) {
    return (
      `HOW EACH PLAYER THINKS — who's on your side, who isn't\n\n` +
      Object.entries(PLAYERS)
        .map(([k, p]) => `▸ ${k.replace(/_/g, " ").toUpperCase()}: ${p.motive}`)
        .join("\n") +
      `\n\nAsk for any one by name for their full playbook (e.g. "listing_agent").`
    );
  }
  const key = role.toLowerCase().trim().replace(/[\s-]+/g, "_");
  const p = PLAYERS[key] ?? Object.entries(PLAYERS).find(([k]) => k.includes(key) || key.includes(k))?.[1];
  if (!p) return `No entry for "${role}". Known: ${Object.keys(PLAYERS).join(", ")}.`;
  const name = role.toUpperCase();
  return [
    `${name} — BOTTOM LINE: ${p.motive}`,
    ``,
    `How they think: ${p.thinks}`,
    `Where it clashes with you: ${p.clash}`,
    `Your move: ${p.move}`,
  ].join("\n");
}

interface RedFlag {
  bottom_line: string;
  means: string;
  scares: string; // who it scares (lender/insurer/etc.)
  cost: string;
  move: string;
}

export const RED_FLAGS: Record<string, RedFlag> = {
  unpermitted_addition: {
    bottom_line: "Common and fixable, but it can block your loan and bite you at resale.",
    means: "A room, garage conversion, or ADU built without city permits — may not be legal, safe, or counted in the square footage.",
    scares: "Lender + appraiser (won't value unpermitted space) and your future buyer.",
    cost: "Permitting/retroactive inspection $2k–$15k+; worst case, tear-out.",
    move: "Ask the city for permit history. Make the seller permit it or credit you, or price it as if the space doesn't exist.",
  },
  old_wiring: {
    bottom_line: "Zinsco or Federal Pacific panels can get your insurance DENIED — treat as serious.",
    means: "Outdated/failure-prone electrical panels or knob-and-tube wiring; real fire risk.",
    scares: "Insurers (may refuse coverage = no loan) and the inspector.",
    cost: "Panel replacement $2k–$4k; full rewire $8k–$20k+.",
    move: "Get an electrician's quote before removing contingencies, and confirm you can actually insure the home.",
  },
  foundation: {
    bottom_line: "The scariest words in a report — get a specialist before you go further.",
    means: "Cracks, settling, or slab issues. Some are cosmetic, some are structural and expensive.",
    scares: "Lender, appraiser, insurer, and every future buyer.",
    cost: "Minor $1k–$5k; major structural $20k–$100k+.",
    move: "Pay for a structural engineer (not just the general inspector). Their report decides walk vs. negotiate.",
  },
  roof: {
    bottom_line: "Age is everything — a roof near end of life is a near-term five-figure bill.",
    means: "Worn/old roofing; typical asphalt lasts ~20–25 yrs.",
    scares: "Insurers (may not cover an old roof) and the appraiser.",
    cost: "Full replacement $10k–$30k+ depending on size/material.",
    move: "Ask the roof's age. If near end of life, negotiate a credit or replacement as a condition.",
  },
  sewer_septic: {
    bottom_line: "Cheap to inspect, brutal to fix — always scope the line, especially on older or rural homes.",
    means: "Blocked/broken sewer lateral, or a failing septic system (common on rural Riverside parcels).",
    scares: "You — this one's often missed because a general inspection doesn't include it.",
    cost: "Sewer line $3k–$25k; septic replacement $10k–$30k+.",
    move: "Pay ~$200 for a sewer-scope / septic inspection as a separate contingency item.",
  },
  hoa_trouble: {
    bottom_line: "A broke HOA means surprise special assessments — read the financials before you buy.",
    means: "Underfunded reserves, pending litigation, or planned big repairs the dues don't cover.",
    scares: "Lender (can make a condo unfinanceable) and your budget.",
    cost: "Special assessments $1k–$50k+ as a lump sum, plus rising dues.",
    move: "Demand the HOA's reserve study, budget, and meeting minutes. Weak reserves or lawsuits = walk or discount.",
  },
  appraisal_low: {
    bottom_line: "You cover the gap in cash — or renegotiate. Don't panic.",
    means: "Home appraised below your offer; the lender only lends against the appraisal.",
    scares: "You (the cash gap is yours) — the seller too, if they want the deal.",
    cost: "The difference between offer and appraisal, out of pocket.",
    move: "With an appraisal contingency: ask the seller to drop to value, split the gap, or walk. Or dispute with better comps.",
  },
};

export function redFlag(issue?: string): string {
  if (!issue) {
    return (
      `RED-FLAG PLAYBOOK — spot it, price it, act\n\n` +
      Object.entries(RED_FLAGS)
        .map(([k, f]) => `▸ ${k.replace(/_/g, " ").toUpperCase()}: ${f.bottom_line}`)
        .join("\n") +
      `\n\nAsk for any one by name for the full playbook (e.g. "old_wiring").`
    );
  }
  const key = issue.toLowerCase().trim().replace(/[\s-]+/g, "_");
  const f = RED_FLAGS[key] ?? Object.entries(RED_FLAGS).find(([k]) => k.includes(key) || key.includes(k))?.[1];
  if (!f) return `No entry for "${issue}". Known: ${Object.keys(RED_FLAGS).join(", ")}.`;
  return [
    `${issue.toUpperCase()} — BOTTOM LINE: ${f.bottom_line}`,
    ``,
    `What it means: ${f.means}`,
    `Who it scares: ${f.scares}`,
    `Rough cost: ${f.cost}`,
    `Your move: ${f.move}`,
  ].join("\n");
}
