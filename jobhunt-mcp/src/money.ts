// Salary negotiation, California living wage, and the job market. Money numbers
// are live-sensitive → framework baked here, current figures via research +
// reference (job_market / get_reference). Bottom-line, plain words.

export function negotiateSalary(): string {
  return [
    `BOTTOM LINE: you rarely lose a real offer by negotiating politely — and the first number is almost never their best. Not asking can cost you thousands a year, every year.`,
    ``,
    `  • Let THEM name a number first if you can ("what's the budgeted range for this role?").`,
    `  • Know the market range before you talk (research the role + area — 'job_market').`,
    `  • Anchor at the high end of reasonable, then meet in the middle. Aim high, not desperate.`,
    `  • Negotiate the WHOLE package: base, signing bonus, PTO, schedule, remote, start date.`,
    `  • Script: "I'm excited about this. Based on my experience and the market, I was expecting closer to $X. Can we get there?" Then stop talking.`,
    `  • Get the final offer IN WRITING before you resign anything.`,
    ``,
    `The fear "if I ask for more, I'll lose it" is usually wrong — employers expect a counter and budget for it. Lowballing yourself is the costlier mistake. (See red_flag 'lowballing_yourself'.)`,
  ].join("\n");
}

export function livingWage(area?: string): string {
  const where = area ? area : "your California area (Riverside / LA / San Diego...)";
  return [
    `BOTTOM LINE: in California a "job" isn't enough — the pay has to clear your real cost of living. Aim at roles that pay a LIVING wage, not just any wage.`,
    ``,
    `California is expensive: rent, gas, food, and housing all run high — a single adult in much of Southern California needs roughly the mid-$50k-to-$60k+ range just to cover basics, and much more with kids. Your exact number depends on ${where}.`,
    ``,
    `Do this:`,
    `  • Get your real number: the MIT Living Wage Calculator for your county — https://livingwage.mit.edu`,
    `  • Compare target jobs' pay to THAT number, not to what feels like "a lot."`,
    `  • If a path doesn't clear your living wage, treat it as a stepping stone, not the destination ('career_path').`,
    ``,
    `Tie-in: your target salary should cover rent/housing (see the homebuyer tools), leave room to save (see the nestegg tools), and beat your living wage. Have research pull the current MIT figure for ${where}.`,
  ].join("\n");
}

export function jobMarket(): string {
  return [
    `BOTTOM LINE: aim where the money AND the demand are. In California the reliable winners are healthcare, skilled trades, and tech — many without a 4-year degree.`,
    ``,
    `HIGHER-PAYING, in-demand in CA (rough ranges — VERIFY live):`,
    `  • Healthcare: RN ($110k-$150k+), and the CNA→LVN→RN ladder into it.`,
    `  • Skilled trades: electrician / HVAC / plumber ($70k-$110k+), apprenticeships pay while you learn.`,
    `  • Tech: cybersecurity, cloud, software, data ($90k-$150k+), cert-friendly entry.`,
    `  • Management / project management / skilled sales ($80k-$130k+).`,
    ``,
    `LOWER-PAYING (fine as stepping stones, hard as destinations in CA):`,
    `  • Retail, food service, general customer service, basic warehouse — often below a CA living wage alone. Use them to ladder UP ('career_path').`,
    ``,
    `Get the REAL numbers (have research pull these):`,
    `  • Pay + outlook by job: U.S. Bureau of Labor Statistics — https://www.bls.gov/ooh · O*NET — https://www.onetonline.org`,
    `  • California specifics: CA EDD Labor Market Info — https://labormarketinfo.edd.ca.gov`,
    ``,
    `The play: pick a direction that fits you ('career_match'), that clears your living wage ('living_wage'), and has a cheap on-ramp ('career_path'). Skills + a cert often beat waiting years for a degree.`,
  ].join("\n");
}
