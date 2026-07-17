// Transparent math, kid-simple output. Bounded inputs (schemas enforce too, but
// clamp defensively — loops must never be able to peg the event loop).

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const clampYears = (y: number) => Math.min(Math.max(1, Math.floor(y)), 80);

/** Future value of monthly contributions at a yearly rate. */
function futureValue(monthly: number, years: number, annualPct: number): number {
  const n = clampYears(years) * 12;
  const r = annualPct / 100 / 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
}

export function compoundGrowth(monthly: number, years: number, annualPct = 7): string {
  const y = clampYears(years);
  const total = futureValue(monthly, y, annualPct);
  const putIn = monthly * y * 12;
  const growth = total - putIn;
  const lines = [
    `BOTTOM LINE: ${usd(monthly)}/month for ${y} years ≈ ${usd(total)} — and ${usd(growth)} of that is money your money made on its own.`,
    ``,
    `  You put in .......... ${usd(putIn)}`,
    `  Growth did .......... ${usd(growth)}   (at ${annualPct}%/yr, the long-run index-fund average)`,
    `  Total ............... ${usd(total)}`,
  ];
  // The half-time "back-loading" point only makes sense over a real horizon;
  // at 1-3 years half-time ≈ full and the line contradicts itself.
  if (y >= 4) {
    const halfY = Math.floor(y / 2);
    const half = futureValue(monthly, halfY, annualPct);
    lines.push(``, `The time trick: stopping at ${halfY} years gives only ${usd(half)} — the LAST years do the heavy lifting. That's why starting now beats starting bigger later.`);
  }
  lines.push(``, `(${annualPct}% is a historical average, not a promise — real years swing high and low.)`);
  return lines.join("\n");
}

export function feeDrag(monthly: number, years: number, feePct: number, annualPct = 7): string {
  const y = clampYears(years);
  const without = futureValue(monthly, y, annualPct);
  const withFee = futureValue(monthly, y, annualPct - feePct);
  const cost = without - withFee;
  return [
    `BOTTOM LINE: a "${feePct}%" fee quietly takes ${usd(cost)} of your money over ${y} years. Fees are the silent killer.`,
    ``,
    `  ${usd(monthly)}/mo at ${annualPct}%/yr, no fee ....... ${usd(without)}`,
    `  Same, minus a ${feePct}% yearly fee ......... ${usd(withFee)}`,
    `  The fee's cut ........................ ${usd(cost)}  (${((cost / without) * 100).toFixed(0)}% of your ending pile)`,
    ``,
    `Why: the fee isn't just taken each year — every dollar taken also stops compounding forever.`,
    `Good index funds charge ~0.03-0.1%. A "1% advisor" or an expensive fund must beat the market by more than their fee every year, forever, just to break even for you. Almost none do.`,
  ].join("\n");
}

export function matchValue(salary: number, matchPct: number, matchLimitPct: number): string {
  const yourShare = (salary * matchLimitPct) / 100;
  const freeMoney = (yourShare * matchPct) / 100;
  const twentyYears = futureValue(freeMoney / 12, 20, 7);
  return [
    `BOTTOM LINE: your match is ${usd(freeMoney)}/year of FREE money — grab all of it before anything else.`,
    ``,
    `  Your job matches ${matchPct}% of what you put in, up to ${matchLimitPct}% of salary.`,
    `  You contribute ${usd(yourShare)}/yr (${matchLimitPct}% of ${usd(salary)}) → job adds ${usd(freeMoney)}/yr.`,
    `  That's an instant ${matchPct}% return on day one — no investment on Earth promises that.`,
    ``,
    `  Left invested, the match alone ≈ ${usd(twentyYears)} after 20 years.`,
    `  Skipping the match = telling your boss "keep part of my pay." Nobody means to say that.`,
  ].join("\n");
}

export function goalTimeline(goal: number, currentSaved: number, monthly: number, safePct = 4): string {
  const remaining = Math.max(0, goal - currentSaved);
  if (remaining === 0) {
    return `BOTTOM LINE: you're already there — ${usd(currentSaved)} saved covers the ${usd(goal)} goal. Keep it parked somewhere safe (HYSA/T-bills), not stocks.`;
  }
  // Months to goal with monthly deposits at safe rate, starting from currentSaved.
  const r = safePct / 100 / 12;
  let bal = currentSaved;
  let months = 0;
  const MAX_MONTHS = 1200; // 100 years — hard bound
  while (bal < goal && months < MAX_MONTHS) {
    bal = bal * (1 + r) + monthly;
    months++;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  // Only report failure if we actually didn't reach the goal — hitting it on
  // exactly month 1200 is a success, not a "raise the amount".
  const reachedGoal = bal >= goal;
  const when = !reachedGoal ? "more than 100 years (raise the monthly amount)" : `${years > 0 ? `${years} year${years === 1 ? "" : "s"}` : ""}${years > 0 && rem > 0 ? ", " : ""}${rem > 0 ? `${rem} month${rem === 1 ? "" : "s"}` : ""}`;
  const inFive = months <= 60;
  return [
    `BOTTOM LINE: at ${usd(monthly)}/month you hit ${usd(goal)} in about ${when}.`,
    ``,
    `  Starting from ....... ${usd(currentSaved)}`,
    `  Adding .............. ${usd(monthly)}/month`,
    `  Parked at ........... ${safePct}%/yr (HYSA/T-bill territory — safe, boring, right for goal money)`,
    ``,
    inFive
      ? `Since this lands within ~5 years, KEEP it in safe parking (HYSA, T-bills, CDs). Stocks could drop 30% the year you need it — goal money doesn't gamble.`
      : `This is beyond ~5 years out, so you COULD put part in index funds for faster growth — knowing a bad year could push the date back. The closer the goal gets, the more should move to safe parking.`,
    ``,
    `(If this goal is your house down payment, this connects straight to your homebuyer plan.)`,
  ].join("\n");
}
