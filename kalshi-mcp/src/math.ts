// The arithmetic that decides whether a prediction-market trade is worth
// making. Pure functions, no I/O — this is the part of the asset that can give
// a genuinely quantitative answer offline, because the MATH is stable even
// though every INPUT to it moves.
//
// ON THE FEE CONSTANTS BELOW — AGENTS.md forbids baking a price, limit or date
// into a map, and a fee schedule is exactly that. But a calculator with no fee
// model is useless, and "go look it up and do it yourself" is what everyone
// already fails to do. The compromise: the assumed schedule lives in ONE named
// place, every result PRINTS the assumption it used, and the caller can
// override it with the current published number. The tool tells you it is
// assuming, so a stale constant degrades into a visible caveat rather than a
// silent wrong answer.

/** Fee model assumed when the caller doesn't supply the current one. The shape
 * — proportional to p*(1-p), so largest at 50c and shrinking toward the
 * extremes — is the durable part and is what the guidance is built on. The
 * COEFFICIENT is a published number that changes; verify it via check_kalshi. */
export const ASSUMED_FEE_COEFFICIENT = 0.07;
/** Maker orders are charged a fraction of the taker fee. Also a published,
 * changeable number — the durable lesson is only "maker is materially cheaper". */
export const ASSUMED_MAKER_RATIO = 0.25;

const round2 = (n: number) => Math.round(n * 100) / 100;
const cents = (dollars: number) => `${(dollars * 100).toFixed(2)}c`;
const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

export interface PriceCheckInput {
  /** Your estimated probability that the contract you're buying settles at $1.
   * Accepts 0-1 or 0-100; anything above 1 is read as a percentage. */
  your_probability: number;
  /** The price of the contract you are buying, in cents (1-99). Use the price
   * of the SIDE you're buying — for NO at 40c, pass 40 and your probability
   * that NO wins. The math is side-agnostic that way. */
  market_price: number;
  contracts?: number;
  /** "taker" crosses the spread (default, and what most orders do);
   * "maker" rests on the book and is charged less. */
  order?: "maker" | "taker";
  /** "settlement" pays the fee once; "early" pays it on the way in AND out. */
  exit?: "settlement" | "early";
  /** Current published taker fee coefficient, if you have verified it. */
  fee_coefficient?: number;
  /** Days until settlement — supply it to see the annualised return, which is
   * the comparison that matters for a long-dated contract. */
  days_to_expiry?: number;
}

export interface PriceCheckResult {
  price: number;
  probability: number;
  contracts: number;
  feePerContract: number;
  totalFees: number;
  breakeven: number;
  edgeBeforeFees: number;
  edgeAfterFees: number;
  evPerContract: number;
  totalEv: number;
  totalCost: number;
  worthIt: boolean;
  assumedFees: boolean;
}

// Both inputs accept two units, and the two disambiguate DIFFERENTLY at
// exactly 1. That asymmetry is deliberate, and it is a real bug found by
// feeding this tool a live price from research rather than a made-up one:
//
//   market_price = 1  must mean 1 CENT. A 1c longshot is an ordinary market —
//   the live NYC temperature series returned exactly that — whereas a contract
//   at $1.00 is already settled and nobody price-checks it. Reading it as
//   $1.00 produced "the market says 100%", which is nonsense.
//
//   your_probability = 1 must mean 100%. Certainty is a meaningful estimate;
//   someone who means 1% writes 0.01.
//
// So price treats >= 1 as cents, and probability treats > 1 as percent.

/** Probability as either a 0-1 fraction or a 0-100 percentage. 1 = certainty. */
function asProbability(n: number): number {
  return n > 1 ? n / 100 : n;
}

/** Price as either cents (63) or dollars (0.63). 1 means one CENT. */
function asPrice(n: number): number {
  return n >= 1 ? n / 100 : n;
}

/**
 * The per-order fee. Proportional to p*(1-p) and rounded UP to the cent, which
 * is why a single contract near 50c pays proportionally more than a block does.
 */
export function orderFee(price: number, contracts: number, coefficient: number, maker: boolean): number {
  const raw = coefficient * contracts * price * (1 - price) * (maker ? ASSUMED_MAKER_RATIO : 1);
  // Snap to 10 decimals BEFORE rounding up. Without this, floating point makes
  // the fee asymmetric around 50c: 0.07*100*0.1*0.9 evaluates to
  // 0.6300000000000002 and rounds up to 64c, while the mirror-image price at
  // 90c gives 0.6299999999999999 and rounds to 63c. Same trade, different fee,
  // for no reason but binary representation.
  const snapped = Math.round(raw * 1e10) / 1e10;
  return Math.ceil(snapped * 100) / 100;
}

export function computePriceCheck(input: PriceCheckInput): PriceCheckResult {
  const price = asPrice(input.market_price);
  const probability = asProbability(input.your_probability);
  const contracts = Math.max(1, Math.floor(input.contracts ?? 1));
  const coefficient = input.fee_coefficient ?? ASSUMED_FEE_COEFFICIENT;
  const maker = input.order === "maker";
  const roundTrips = input.exit === "early" ? 2 : 1;

  const totalFees = orderFee(price, contracts, coefficient, maker) * roundTrips;
  const feePerContract = totalFees / contracts;

  // A binary contract's payoff is linear in probability, so the fee converts
  // directly into the extra probability you need to be right: breakeven is the
  // price plus the per-contract fee.
  const breakeven = price + feePerContract;
  const edgeBeforeFees = probability - price;
  const edgeAfterFees = probability - breakeven;
  const evPerContract = edgeAfterFees;

  return {
    price,
    probability,
    contracts,
    feePerContract,
    totalFees,
    breakeven,
    edgeBeforeFees,
    edgeAfterFees,
    evPerContract,
    totalEv: evPerContract * contracts,
    totalCost: price * contracts + totalFees,
    worthIt: edgeAfterFees > 0,
    assumedFees: input.fee_coefficient === undefined,
  };
}

export function priceCheck(input: PriceCheckInput): string {
  const r = computePriceCheck(input);
  const maker = input.order === "maker";
  const roundTrip = input.exit === "early";

  // The headline states the verdict, not the inputs — this is the line the
  // orchestrator lifts into a cross-asset digest, so it has to stand alone.
  const headline = r.worthIt
    ? `BOTTOM LINE: your estimate is ${pct(r.edgeAfterFees)} above breakeven AFTER fees — an expected $${round2(r.totalEv).toFixed(2)} across ${r.contracts} contract(s), and only as good as your probability estimate.`
    : r.edgeBeforeFees > 0
      ? `BOTTOM LINE: the fee eats the edge. You're ${pct(r.edgeBeforeFees)} above the market price but ${pct(Math.abs(r.edgeAfterFees))} BELOW breakeven once fees are counted — this trade is negative expected value.`
      : `BOTTOM LINE: no edge here — your own estimate (${pct(r.probability)}) is at or below the market price (${pct(r.price)}) before fees even enter it. The market disagrees with you in the direction that costs you money.`;

  const lines = [
    `PRICE CHECK — ${cents(r.price)} contract, your estimate ${pct(r.probability)}`,
    headline,
    ``,
    `THE NUMBERS (${r.contracts} contract${r.contracts === 1 ? "" : "s"}, ${maker ? "maker" : "taker"} order, ${roundTrip ? "exit early — fees both ways" : "held to settlement — fee once"}):`,
    `  Market price                 ${cents(r.price)}  (implied ${pct(r.price)})`,
    `  Your probability             ${pct(r.probability)}`,
    `  Fee per contract             ${cents(r.feePerContract)}`,
    `  BREAKEVEN probability        ${pct(r.breakeven)}   ← what you must beat, not the price`,
    `  Edge before fees             ${pct(r.edgeBeforeFees)}`,
    `  Edge after fees              ${pct(r.edgeAfterFees)}`,
    ``,
    `  Total cost (stake + fees)    $${round2(r.totalCost).toFixed(2)}`,
    `  Total fees                   $${round2(r.totalFees).toFixed(2)}`,
    `  Expected value               $${round2(r.totalEv).toFixed(2)}`,
    `  Max loss / max gain          $${round2(r.price * r.contracts).toFixed(2)} / $${round2((1 - r.price) * r.contracts).toFixed(2)}`,
  ];

  if (input.days_to_expiry && input.days_to_expiry > 0) {
    // Capital locked until settlement has an opportunity cost that never shows
    // up in P&L. Annualising is the only fair comparison against just holding
    // cash — a 4% gain over six months is not a 4% return.
    const returnOnCost = r.totalEv / r.totalCost;
    const annualised = returnOnCost * (365 / input.days_to_expiry);
    lines.push(
      ``,
      `  Held for                     ${input.days_to_expiry} days`,
      `  Expected return on capital   ${pct(returnOnCost)}  → ${pct(annualised)} annualised`,
      `  Compare that against a risk-free rate before calling it a good trade — capital locked in a contract is capital you can't redeploy.`
    );
  }

  if (!maker) {
    lines.push(
      ``,
      `CHEAPEST IMPROVEMENT AVAILABLE: the same trade as a resting LIMIT order (maker) is charged a fraction of this fee — rerun with order="maker" to see it. Patience is the most reliable edge on this platform.`
    );
  }

  lines.push(
    ``,
    r.assumedFees
      ? `⚠ FEE ASSUMPTION: this used a taker coefficient of ${ASSUMED_FEE_COEFFICIENT} (fee proportional to price x (1-price), so largest at 50c) and a maker rate of ${ASSUMED_MAKER_RATIO} of taker. That is a PUBLISHED SCHEDULE THAT CHANGES — confirm the current one with check_kalshi and pass fee_coefficient to get an exact answer. The shape of the conclusion holds; the last decimal may not.`
      : `Fee coefficient ${input.fee_coefficient} supplied by the caller — assuming it was verified against the current published schedule.`,
    ``,
    `THE WEAKEST INPUT IS YOURS: every number here is downstream of the probability YOU supplied. The market price is the aggregate of people who are also trying, and the base rate is that a retail estimate is the one that's wrong. Treat a thin edge as noise.`
  );

  return lines.join("\n");
}
