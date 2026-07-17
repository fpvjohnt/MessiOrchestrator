// Stable, curated knowledge. This is the "how it all works" layer — it changes
// on the order of years, so it's safe to bake in. Anything with a current dollar
// figure lives in the reference store instead and gets verified live.

export const ROLES: Record<string, string> = {
  "real estate agent":
    "Licensed to help you buy/sell. A BUYER'S agent represents you; a LISTING agent represents the seller. Traditionally paid via commission from the sale. IMPORTANT (2024 change): after the NAR settlement, buyers now typically sign a buyer-broker agreement up front and may be responsible for their agent's fee directly, rather than it being automatically paid by the seller. Always read that agreement and ask how your agent gets paid.",
  realtor:
    "An agent who is a member of the National Association of Realtors and follows its code of ethics. Practically, 'Realtor' and 'agent' are used interchangeably — the license is what matters.",
  broker:
    "A higher license than an agent; brokers can own/run a brokerage and supervise agents. Your agent may work under a broker. A MORTGAGE broker is different — that person shops your loan across multiple lenders (vs. a loan officer who works for one bank).",
  "loan officer":
    "Works for ONE lender/bank and originates your mortgage there. Compare with a mortgage broker who shops multiple lenders. Either way, get quotes from 3+ sources the same day — rates vary.",
  "escrow officer":
    "A neutral third party who holds the money and documents and makes sure every condition is met before anything changes hands. In California, escrow companies (or title companies) run the closing. Your earnest-money deposit sits in escrow — not with the seller.",
  "assessor":
    "The COUNTY office that sets your property's assessed value for TAX purposes (in CA, based on your purchase price under Prop 13). Not the same as an appraiser. The Riverside County Assessor's records tell you a property's assessed value, tax history, and ownership.",
  appraiser:
    "Hired by your lender to independently estimate the home's market value, protecting the lender from over-lending. If the appraisal comes in below your offer, you may have to cover the gap in cash — an 'appraisal gap'.",
  inspector:
    "You hire this person (optional but do it) to examine the home's condition — roof, foundation, plumbing, electrical, HVAC. A general inspection is the start; add specialty ones (sewer/septic, roof, termite/pest, pool) as needed. Their report is your leverage to negotiate repairs or credits, or to walk away.",
};

export function explainRole(role?: string): string {
  if (!role) {
    const list = Object.entries(ROLES)
      .map(([k, v]) => `▸ ${k.toUpperCase()}\n${v}`)
      .join("\n\n");
    return `WHO'S WHO IN A HOME PURCHASE — and who's actually on your side\n\n${list}\n\nRule of thumb: only YOUR agent, YOUR loan officer/broker, and inspectors you hire work for you. The listing agent works for the seller. Escrow and the appraiser are neutral.`;
  }
  const key = role.toLowerCase().trim();
  const match = ROLES[key] ?? Object.entries(ROLES).find(([k]) => k.includes(key) || key.includes(k))?.[1];
  return match ? `${role.toUpperCase()}\n${match}` : `No entry for "${role}". Known roles: ${Object.keys(ROLES).join(", ")}.`;
}

export function buyingTimeline(): string {
  return [
    `THE HOME-BUYING JOURNEY (California)`,
    ``,
    `1. GET PRE-APPROVED — a lender checks your finances and issues a pre-approval letter (stronger than a "pre-qualification"). Do this first; it tells you your real budget and makes your offers credible.`,
    `2. HOUSE HUNT with your agent. Know the full monthly cost (tax, insurance, HOA, Mello-Roos), not just the price.`,
    `3. MAKE AN OFFER — includes price, your earnest-money deposit (~1–3%), and CONTINGENCIES.`,
    `4. ESCROW OPENS — your deposit goes to the neutral escrow holder, NOT the seller.`,
    `5. CONTINGENCY PERIOD (California default ~17 days) — THIS is what protects your deposit:`,
    `     • Inspection contingency — get inspections; negotiate repairs/credits or walk.`,
    `     • Appraisal contingency — if it appraises low, renegotiate or exit.`,
    `     • Loan contingency — if financing falls through, you're protected.`,
    `   ⚠️ Once you REMOVE contingencies, your deposit is genuinely at risk if you back out.`,
    `6. APPRAISAL & LOAN UNDERWRITING run in parallel. Review disclosures (in CA: the seller's TDS, natural-hazard/NHD report — fire/flood/earthquake zones).`,
    `7. FINAL WALKTHROUGH & CLOSING DISCLOSURE — the lender's final numbers (compare to the Loan Estimate).`,
    `8. CLOSE — sign, funds transfer, recording. You get the keys. Expect a one-time SUPPLEMENTAL tax bill weeks later.`,
    ``,
    `The whole thing is typically ~30–45 days from accepted offer to keys. Your contingencies are your seatbelt — understand each before you waive it.`,
  ].join("\n");
}

export const TERMS: Record<string, string> = {
  "earnest money":
    "A good-faith deposit (~1–3% of price) you put down with your offer, held in escrow. It's applied to your down payment/closing at the end — not an extra cost. Protected by your contingencies; at risk once you remove them.",
  contingency:
    "A condition in your contract that lets you exit and keep your deposit — inspection, appraisal, and loan are the big three. California gives a default 17-day window to act on them.",
  escrow:
    "The neutral process/company holding money and documents until all conditions are met. Also refers to the lender's monthly 'impound' account that collects your tax + insurance.",
  pmi:
    "Private Mortgage Insurance — an extra monthly charge when your down payment is under 20% on a conventional loan. It protects the LENDER, not you. Falls off as you build 20% equity. (FHA has a similar 'MIP' with different rules.)",
  points:
    "Discount points — an upfront fee (1 point = 1% of the loan) to buy your interest rate down. Worth it only if you keep the loan long enough to recoup the cost.",
  "title insurance":
    "One-time coverage against someone later claiming ownership or a lien on your property. Lender's title protects the bank; owner's title protects you.",
  "mello-roos":
    "A special tax (Community Facilities District / CFD) funding infrastructure in newer developments — VERY common in SW Riverside County. Adds $100–400+/month on top of property tax, often for decades. Two similar homes can have very different real costs because of it. Always check a specific property's tax bill.",
  contingency_removal:
    "The point where you formally waive a contingency. After this, backing out can cost you your earnest-money deposit. Don't remove contingencies until you're genuinely satisfied.",
  "appraisal gap":
    "When the appraised value is below your offer price. Your lender only lends against the appraisal, so you'd cover the difference in cash — or renegotiate/walk if you kept the appraisal contingency.",
};

export function explainTerm(term?: string): string {
  if (!term) {
    return (
      `GLOSSARY\n\n` +
      Object.entries(TERMS)
        .map(([k, v]) => `▸ ${k}: ${v}`)
        .join("\n\n")
    );
  }
  const key = term.toLowerCase().trim();
  const match = TERMS[key] ?? Object.entries(TERMS).find(([k]) => k.includes(key) || key.includes(k))?.[1];
  return match ? `${term}: ${match}` : `No entry for "${term}". Known terms: ${Object.keys(TERMS).join(", ")}.`;
}

export function houseVsCondo(): string {
  return [
    `HOUSE vs CONDO`,
    ``,
    `HOUSE (single-family): you own the building AND the land. More space and control, no shared walls, usually no HOA (or a light one). You pay for ALL maintenance yourself. Generally appreciates well because you own land.`,
    ``,
    `CONDO: you own your unit's interior; the HOA owns the land/exterior/common areas. Lower price of entry, exterior maintenance handled — but you pay HOA dues, follow HOA rules, and share big-repair costs via assessments.`,
    ``,
    `On your "is HOA bad?" question: HOA isn't good or bad — it's a monthly cost that CAN and does rise, plus special-assessment risk (a surprise bill for a big repair the reserves don't cover). Before buying into any HOA, ask for: current dues, reserve-fund health, recent/planned special assessments, and the rules (CC&Rs).`,
    ``,
    `Financing note: condos must be on approved lists for some loans (FHA/VA especially) and a poorly-run or under-insured HOA can make a condo hard to finance. Houses avoid that hurdle.`,
    ``,
    `Also note: even many single-family homes in SW Riverside planned communities have an HOA AND Mello-Roos — check both.`,
  ].join("\n");
}

export const FINANCING: Record<string, string> = {
  conventional:
    "The standard loan (backed by Fannie/Freddie). As little as 3% down for first-timers. Under 20% down triggers PMI, which falls off later. Best if you have decent credit. Must be at/under the conforming limit (see reference: conforming_limit_riverside).",
  fha:
    "Government-insured, easier credit, 3.5% down. Carries mortgage insurance (MIP) that often lasts the life of the loan. Good for lower credit or small down payments. Has its own county limit (see reference: fha_limit_riverside).",
  va:
    "For eligible veterans/service members and some spouses: 0% down, no PMI, excellent terms. If you or your spouse served, this is often the best option available — ask a VA-savvy lender.",
  usda:
    "0% down for homes in eligible RURAL areas. Parts of outer Riverside County may qualify — check the USDA eligibility map for the address. Income limits apply.",
  calhfa:
    "California Housing Finance Agency programs, including down-payment assistance layered on top of a first mortgage. The Dream For All shared-appreciation program is one (see reference: dream_for_all_structure). These assistance loans are usually deferred SECOND loans repaid on sale/refi — not a monthly bill.",
};

export function explainFinancing(loanType?: string): string {
  const downPaymentMyth =
    "The 20%-down myth: you almost never need 20%. 20% just removes PMI. First-timers routinely put down 3–3.5% (or 0% with VA/USDA).";
  if (!loanType) {
    return (
      `LOAN TYPES — how you'd actually pay for the home\n\n` +
      Object.entries(FINANCING)
        .map(([k, v]) => `▸ ${k.toUpperCase()}: ${v}`)
        .join("\n\n") +
      `\n\n${downPaymentMyth}\n\nDown-payment ASSISTANCE (CalHFA/Dream For All) is a separate second loan or shared-appreciation deal repaid when you sell/refinance — not a monthly payment, and unrelated to a Section 8 rental voucher.`
    );
  }
  const key = loanType.toLowerCase().trim();
  const match = FINANCING[key] ?? Object.entries(FINANCING).find(([k]) => k.includes(key) || key.includes(k))?.[1];
  return match ? `${loanType.toUpperCase()}: ${match}\n\n${downPaymentMyth}` : `No entry for "${loanType}". Known: ${Object.keys(FINANCING).join(", ")}.`;
}
