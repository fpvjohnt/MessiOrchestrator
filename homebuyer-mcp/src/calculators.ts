// All money is plain numbers (USD). Every calculator returns both the numbers
// and the assumptions it used, so nothing is a black box. Defaults are labeled
// California-typical values the caller can override — never silent magic.

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number) => `${n.toFixed(2)}%`;

// California-typical default assumptions (all overridable).
export const DEFAULTS = {
  property_tax_rate_pct: 1.15, // Prop 13 ~1% base + local; effective 1.1–1.25%
  home_insurance_rate_pct: 0.35, // % of home value per year (CA volatile — see insurance reference)
  pmi_rate_pct: 0.55, // annual % of loan when down payment < 20% (conventional)
  maintenance_rate_pct: 1.0, // % of home value per year set aside
};

/** Monthly principal + interest for a fully-amortizing loan. */
export function monthlyPI(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (n <= 0 || principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  const factor = Math.pow(1 + r, n);
  return (principal * (r * factor)) / (factor - 1);
}

/** Inverse: the loan principal a given monthly P&I budget can support. */
export function loanFromPayment(payment: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (n <= 0 || payment <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return payment * n;
  const factor = Math.pow(1 + r, n);
  return (payment * (factor - 1)) / (r * factor);
}

export interface MonthlyCostInput {
  price: number;
  down_payment: number;
  rate_pct: number;
  term_years?: number;
  property_tax_rate_pct?: number;
  home_insurance_monthly?: number;
  hoa_monthly?: number;
  mello_roos_monthly?: number;
  pmi_rate_pct?: number;
}

export function monthlyCost(input: MonthlyCostInput): string {
  const term = input.term_years ?? 30;
  const loan = Math.max(0, input.price - input.down_payment);
  const ltv = input.price > 0 ? loan / input.price : 0;
  const taxRate = input.property_tax_rate_pct ?? DEFAULTS.property_tax_rate_pct;

  const pi = monthlyPI(loan, input.rate_pct, term);
  const tax = (input.price * taxRate) / 100 / 12;
  const insurance = input.home_insurance_monthly ?? (input.price * DEFAULTS.home_insurance_rate_pct) / 100 / 12;
  const hoa = input.hoa_monthly ?? 0;
  const mello = input.mello_roos_monthly ?? 0;
  const pmiRate = input.pmi_rate_pct ?? DEFAULTS.pmi_rate_pct;
  const pmi = ltv > 0.8 ? (loan * pmiRate) / 100 / 12 : 0;

  const total = pi + tax + insurance + hoa + mello + pmi;

  const lines = [
    `BOTTOM LINE: ~${usd(total)}/month all-in${mello === 0 ? " (before any Mello-Roos — check the property)" : ""}.`,
    ``,
    `MONTHLY COST — ${usd(input.price)} home, ${usd(input.down_payment)} down (${pct(ltv * 100)} LTV), ${pct(input.rate_pct)} over ${term} yrs`,
    ``,
    `  Principal & interest ....... ${usd(pi)}   (loan ${usd(loan)})`,
    `  Property tax ............... ${usd(tax)}   (${pct(taxRate)} of price /yr, Prop 13 basis)`,
    `  Home insurance ............. ${usd(insurance)}   ${input.home_insurance_monthly === undefined ? `(est. ${pct(DEFAULTS.home_insurance_rate_pct)}/yr — CA market volatile, get a real quote)` : "(your figure)"}`,
    `  HOA ........................ ${usd(hoa)}   ${hoa === 0 ? "(none entered)" : ""}`,
    `  Mello-Roos ................. ${usd(mello)}   ${mello === 0 ? "(none entered — VERY common in SW Riverside; check the tax bill)" : ""}`,
    `  PMI ........................ ${usd(pmi)}   ${pmi > 0 ? `(down payment <20%, est. ${pct(pmiRate)}/yr of loan)` : "(none — 20%+ down)"}`,
    `  ${"".padEnd(30, "─")}`,
    `  TOTAL / month .............. ${usd(total)}`,
    ``,
    `Estimate. Insurance and Mello-Roos are the two that most often surprise buyers — confirm both for the specific property. Not a lender quote.`,
  ];
  return lines.join("\n");
}

export interface AffordabilityInput {
  annual_income: number;
  monthly_debts: number;
  down_payment: number;
  rate_pct: number;
  term_years?: number;
  front_end_pct?: number; // housing / income
  back_end_pct?: number; // total debt / income
  property_tax_rate_pct?: number;
  home_insurance_rate_pct?: number;
  hoa_monthly?: number;
  mello_roos_monthly?: number;
}

export function affordability(input: AffordabilityInput): string {
  const term = input.term_years ?? 30;
  const frontEnd = input.front_end_pct ?? 28;
  const backEnd = input.back_end_pct ?? 36;
  const grossMonthly = input.annual_income / 12;
  const taxRate = input.property_tax_rate_pct ?? DEFAULTS.property_tax_rate_pct;
  const insRate = input.home_insurance_rate_pct ?? DEFAULTS.home_insurance_rate_pct;
  const hoa = input.hoa_monthly ?? 0;
  const mello = input.mello_roos_monthly ?? 0;

  // Housing budget = the lower of the two lender ratios.
  const frontBudget = grossMonthly * (frontEnd / 100);
  const backBudget = grossMonthly * (backEnd / 100) - input.monthly_debts;
  const maxHousing = Math.max(0, Math.min(frontBudget, backBudget));

  // Housing budget covers PITI + HOA + Mello + PMI, and tax/insurance/PMI depend
  // on price, which depends on the loan — so iterate to convergence. The PMI term
  // is discontinuous at 80% LTV, which makes a naive iteration oscillate forever
  // between the PMI-on and PMI-off solutions right at 20% down (exactly where
  // real buyers cluster). Instead: solve each branch with PMI FIXED on/off, then
  // keep whichever solution is self-consistent with its own LTV; at the boundary,
  // fall back to the price where LTV is exactly 80%.
  const solveBranch = (pmiOn: boolean): number => {
    let p = input.down_payment + maxHousing * 100; // rough starting guess
    for (let i = 0; i < 60; i++) {
      const monthlyTax = (p * taxRate) / 100 / 12;
      const monthlyIns = (p * insRate) / 100 / 12;
      const loanGuess = Math.max(0, p - input.down_payment);
      const monthlyPmi = pmiOn ? (loanGuess * DEFAULTS.pmi_rate_pct) / 100 / 12 : 0;
      const piBudget = maxHousing - monthlyTax - monthlyIns - hoa - mello - monthlyPmi;
      if (piBudget <= 0) return input.down_payment;
      const newPrice = loanFromPayment(piBudget, input.rate_pct, term) + input.down_payment;
      if (Math.abs(newPrice - p) < 1) return newPrice;
      p = newPrice;
    }
    return p;
  };
  const ltvOf = (p: number) => (p > 0 ? Math.max(0, p - input.down_payment) / p : 0);

  const priceNoPmi = solveBranch(false);
  const priceWithPmi = solveBranch(true);
  let price: number;
  if (ltvOf(priceNoPmi) <= 0.8) {
    price = priceNoPmi; // consistent: at this price, 20%+ down, no PMI applies
  } else if (ltvOf(priceWithPmi) > 0.8) {
    price = priceWithPmi; // consistent: under 20% down, PMI correctly included
  } else {
    price = input.down_payment * 5; // exactly-80%-LTV boundary
  }

  const loan = Math.max(0, price - input.down_payment);
  const pi = monthlyPI(loan, input.rate_pct, term);

  const binding = frontBudget <= backBudget ? `front-end (${frontEnd}% housing)` : `back-end (${backEnd}% total debt)`;

  return [
    `BOTTOM LINE: you can afford roughly ${usd(price)} (loan ~${usd(loan)}, payment ~${usd(pi)}/mo P&I).`,
    ``,
    `AFFORDABILITY ESTIMATE`,
    `  Gross monthly income ....... ${usd(grossMonthly)}   (${usd(input.annual_income)}/yr)`,
    `  Other monthly debts ........ ${usd(input.monthly_debts)}`,
    `  Down payment ............... ${usd(input.down_payment)}`,
    `  Rate / term ................ ${pct(input.rate_pct)} / ${term} yrs`,
    ``,
    `  Max housing payment ........ ${usd(maxHousing)}/mo   (limited by ${binding})`,
    `  ≈ Max home price ........... ${usd(price)}`,
    `  ≈ Loan amount .............. ${usd(loan)}   (P&I ${usd(pi)}/mo)`,
    ``,
    `Uses the ${frontEnd}/${backEnd} debt-to-income rule most conventional lenders apply. FHA often allows more (~31/43+). This is a ceiling, not a target — borrowing the max leaves no cushion. Get pre-approved for your real number.`,
  ].join("\n");
}

export interface ClosingCostsInput {
  price: number;
  down_payment: number;
}

export function closingCosts(input: ClosingCostsInput): string {
  const loan = Math.max(0, input.price - input.down_payment);
  // California-typical buyer closing costs. Ranges, since custom varies by county.
  const items: Array<[string, number, number]> = [
    ["Loan origination / points", loan * 0.005, loan * 0.01],
    ["Appraisal", 600, 900],
    ["Credit report / underwriting", 500, 900],
    ["Title insurance (lender's)", input.price * 0.004, input.price * 0.006],
    ["Escrow / settlement fee", 1500, 2500],
    ["Recording & transfer (buyer share)", 250, 800],
    ["Prepaids (taxes, insurance, interest)", input.price * 0.006, input.price * 0.012],
    ["Inspections (general + specialty)", 500, 1200],
  ];
  const lowTotal = items.reduce((s, [, lo]) => s + lo, 0);
  const highTotal = items.reduce((s, [, , hi]) => s + hi, 0);

  const lines = items.map(([name, lo, hi]) => `  ${name.padEnd(38, ".")} ${usd(lo)} – ${usd(hi)}`);
  return [
    `BOTTOM LINE: budget ~${usd(lowTotal)}–${usd(highTotal)} in closing costs (often negotiable onto the seller).`,
    ``,
    `CLOSING COSTS ESTIMATE — ${usd(input.price)} home, ${usd(loan)} loan`,
    ...lines,
    `  ${"".padEnd(50, "─")}`,
    `  TOTAL ..................................... ${usd(lowTotal)} – ${usd(highTotal)}`,
    `  (roughly ${pct((lowTotal / input.price) * 100)}–${pct((highTotal / input.price) * 100)} of price)`,
    ``,
    `Estimate of BUYER costs only. In California some fees (e.g., county transfer tax, title) are often negotiated between buyer and seller and vary by county custom. In today's cooler market you can often ask the seller for a closing-cost credit. Your Loan Estimate from the lender is the real number.`,
  ].join("\n");
}

export interface CashToCloseInput {
  down_payment: number;
  closing_costs: number;
  reserves?: number;
  earnest_money_paid?: number;
}

export function cashToClose(input: CashToCloseInput): string {
  const reserves = input.reserves ?? 0;
  const earnest = input.earnest_money_paid ?? 0;
  const total = input.down_payment + input.closing_costs + reserves;
  const dueAtClosing = Math.max(0, total - earnest);
  return [
    `BOTTOM LINE: bring ~${usd(dueAtClosing)} to closing.`,
    ``,
    `CASH NEEDED`,
    `  Down payment ............... ${usd(input.down_payment)}`,
    `  Closing costs .............. ${usd(input.closing_costs)}`,
    `  Reserves / cushion ......... ${usd(reserves)}   ${reserves === 0 ? "(none entered — lenders often want a few months' payments)" : ""}`,
    `  ${"".padEnd(30, "─")}`,
    `  Total cash needed .......... ${usd(total)}`,
    earnest > 0 ? `  Less earnest already paid .. −${usd(earnest)}   (your deposit counts toward this)` : ``,
    `  Due at closing ............. ${usd(dueAtClosing)}`,
    ``,
    `Your earnest-money deposit isn't an extra cost — it's applied toward your down payment / closing at the end. Moving, immediate repairs, and furnishing are on top of this.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface RentVsBuyInput {
  monthly_rent: number;
  rent_growth_pct?: number;
  price: number;
  down_payment: number;
  rate_pct: number;
  term_years?: number;
  property_tax_rate_pct?: number;
  home_insurance_rate_pct?: number;
  hoa_monthly?: number;
  mello_roos_monthly?: number;
  maintenance_rate_pct?: number;
  appreciation_pct?: number;
  years: number;
}

export function rentVsBuy(input: RentVsBuyInput): string {
  // Defensive clamp independent of schema bounds: the year loop is O(years*12),
  // so an absurd horizon must not be able to peg the event loop.
  const years = Math.min(Math.max(1, Math.floor(input.years)), 100);
  const term = input.term_years ?? 30;
  const rentGrowth = (input.rent_growth_pct ?? 3) / 100;
  const taxRate = (input.property_tax_rate_pct ?? DEFAULTS.property_tax_rate_pct) / 100;
  const insRate = (input.home_insurance_rate_pct ?? DEFAULTS.home_insurance_rate_pct) / 100;
  const maintRate = (input.maintenance_rate_pct ?? DEFAULTS.maintenance_rate_pct) / 100;
  const appreciation = (input.appreciation_pct ?? 3) / 100;
  const hoa = input.hoa_monthly ?? 0;
  const mello = input.mello_roos_monthly ?? 0;
  const loan0 = Math.max(0, input.price - input.down_payment);
  const monthlyRateN = input.rate_pct / 100 / 12;
  const nPayments = Math.round(term * 12);
  const pi = monthlyPI(loan0, input.rate_pct, term);

  // Selling costs when the owner exits (agent + title + transfer), ~7%.
  const SELL_COST = 0.07;

  let rentCumulative = 0;
  let ownCashCumulative = input.down_payment; // upfront cash in
  let rent = input.monthly_rent;
  let loanBalance = loan0;
  let breakevenYear: number | null = null;

  for (let year = 1; year <= years; year++) {
    // Rent side
    for (let m = 0; m < 12; m++) {
      rentCumulative += rent;
      rent *= 1 + rentGrowth / 12;
    }
    // Own side: 12 months of carrying cost; amortize the loan.
    const homeValue = input.price * Math.pow(1 + appreciation, year);
    for (let m = 0; m < 12; m++) {
      // Mortgage payment only while a balance exists; the payoff month pays
      // interest + remaining balance, and after payoff only carrying costs
      // continue. (Charging full P&I forever would fabricate hundreds of
      // thousands in phantom cost on horizons beyond the loan term.)
      let payment = 0;
      if (loanBalance > 0) {
        const interest = loanBalance * monthlyRateN;
        const principal = Math.min(loanBalance, Math.max(0, pi - interest));
        payment = interest + principal;
        loanBalance = Math.max(0, loanBalance - principal);
      }
      const monthlyTax = (input.price * taxRate) / 12;
      const monthlyIns = (input.price * insRate) / 12;
      const monthlyMaint = (input.price * maintRate) / 12;
      ownCashCumulative += payment + monthlyTax + monthlyIns + monthlyMaint + hoa + mello;
    }
    // Net position if you SOLD at end of this year: recover equity minus selling costs.
    const equityIfSold = homeValue * (1 - SELL_COST) - loanBalance;
    const netOwnCost = ownCashCumulative - equityIfSold; // true cost of owning so far
    if (breakevenYear === null && netOwnCost <= rentCumulative) {
      breakevenYear = year;
    }
  }

  // Final snapshot at the horizon.
  const finalValue = input.price * Math.pow(1 + appreciation, years);
  const equityIfSold = finalValue * (1 - SELL_COST) - loanBalance;
  const netOwnCost = ownCashCumulative - equityIfSold;

  return [
    breakevenYear
      ? `BOTTOM LINE: buying pulls ahead around year ${breakevenYear} — worth it if you stay past then.`
      : `BOTTOM LINE: renting wins for the whole ${years}-year window at these assumptions.`,
    ``,
    `RENT vs BUY — over ${years} year(s)`,
    `  Renting: start ${usd(input.monthly_rent)}/mo, +${(rentGrowth * 100).toFixed(1)}%/yr`,
    `  Buying:  ${usd(input.price)} home, ${usd(input.down_payment)} down, ${pct(input.rate_pct)}, ${(appreciation * 100).toFixed(1)}%/yr appreciation`,
    ``,
    `  Total spent renting ........ ${usd(rentCumulative)}`,
    `  Net cost of owning ......... ${usd(netOwnCost)}   (cash out ${usd(ownCashCumulative)} − equity recovered ${usd(equityIfSold)})`,
    ``,
    breakevenYear
      ? `  ➜ Buying pulls ahead around year ${breakevenYear}.`
      : `  ➜ Renting stays cheaper for the whole ${input.years}-year window at these assumptions.`,
    ``,
    `The "5-year rule": transaction costs (${(SELL_COST * 100).toFixed(0)}% to sell) mean buying usually only wins if you stay put several years. Appreciation and rent-growth assumptions swing this a lot — in your area, Mello-Roos and insurance can flip it. Note: this model doesn't credit the renter for investing the down payment elsewhere (a bias toward buying). This is a model, not a prediction.`,
  ].join("\n");
}
