// Vet a company/job BEFORE you apply or accept. Same "plan + authoritative
// sources + what to look for" shape as the other MCPs — research then fetches.
// Answers the stuff people find out too late: is this a real/ghost posting, how
// bad/restrictive is it, is it truly remote, and can you actually move up.

// Strip newlines/quotes so a pasted company/role can't forge lines or queries.
const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const q = (s: string) => encodeURIComponent(clean(s));

export function vetCompany(rawCompany: string, rawRole?: string): string {
  const company = clean(rawCompany);
  const role = rawRole ? clean(rawRole) : undefined;
  const roleBit = role ? ` ${role}` : "";
  return [
    `VET BEFORE YOU APPLY — ${company}${role ? ` (${role})` : ""}`,
    ``,
    `BOTTOM LINE: find out what it's really like BEFORE you waste an application or accept a bad job. A LinkedIn "Easy Apply" tells you almost nothing — dig here.`,
    ``,
    `IS THE JOB EVEN REAL? (ghost-job check)`,
    `  • Check the company's OWN careers page for this role. If "Easy Apply" exists but it's NOT on their site, or it's been reposted for months, it may be a ghost/stale listing.`,
    `    → search: "${clean(company)} careers ${clean(role ?? "")}"  and the company's jobs page directly.`,
    ``,
    `WHAT'S IT LIKE TO WORK THERE? (culture / how restrictive)`,
    `  • Glassdoor reviews + rating (under ~3.5 is a caution): https://www.glassdoor.com/Search/results.htm?keyword=${q(company)}`,
    `  • Indeed company reviews: https://www.indeed.com/cmp/${q(company)}/reviews`,
    `  • Candid employee talk (esp. tech): https://www.teamblind.com  → search "${clean(company)}"`,
    `    → look for repeated words: "micromanaged", "no work-life balance", "high turnover", "burnout" = real signals.`,
    ``,
    `IS IT ACTUALLY REMOTE / FLEXIBLE?`,
    `  • The posting may say "remote" but reviews reveal RTO/hybrid reality.`,
    `    → search: "${clean(company)} remote work from home return to office policy"`,
    ``,
    `CAN YOU MOVE UP, OR GET STUCK?`,
    `  • Reviews mentioning "no growth / no promotions / dead end" = you'll be stuck.`,
    `  • On LinkedIn, look at employees in this role: do they get promoted, or leave in ~1 year (churn)?`,
    `    → search: "${clean(company)} career growth promotion reviews" + the company's LinkedIn People tab.`,
    ``,
    `STABLE + PAYS FAIR?`,
    `  • Recent layoffs / scandals / funding: search "${clean(company)} layoffs news 2026".`,
    `  • Real pay: Levels.fyi (tech) https://www.levels.fyi/  and Glassdoor salaries — compare to the offer.`,
    ``,
    `QUESTIONS TO ASK THEM (to surface the truth in the interview):`,
    `  • "Why is this role open?" (someone left vs. new growth)`,
    `  • "Can you give an example of someone who moved up from this role?"`,
    `  • "What's the remote/hybrid policy — really?"`,
    `  • "What's the typical workload and hours for this team?"`,
    `  • "What's the average tenure on this team?"`,
    ``,
    `Hand the searches above to research and I'll pull what people actually say. A job that looks fine on the posting can be very different inside — this is how you find out first.`,
  ].join("\n");
}

// ---- match_job: how well do YOU fit this posting? -------------------------

// Two tokens match if equal, or one CONTAINS the other — but substring is only
// allowed when the shorter token is >=3 chars, so "r"/"go"/"c" don't match
// everything (mirrors match.ts's rule). Prevents telling users they're a
// "strong match" off a one-letter skill.
function skillsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 3 && longer.includes(shorter);
}

export function matchJob(required: string[], have: string[]): string {
  const norm = (s: string) => s.toLowerCase().trim();
  const haveSet = have.map(norm).filter(Boolean);
  // De-dupe requirements by normalized form so repeats don't skew the %.
  const seenReq = new Set<string>();
  const reqClean = required
    .map((r) => clean(r))
    .filter((r) => r && !seenReq.has(norm(r)) && (seenReq.add(norm(r)), true));
  if (reqClean.length === 0) return `Paste the job's required skills/keywords (from the posting) and I'll score your match. Add your skills to your profile or pass them in.`;

  const matched: string[] = [];
  const missing: string[] = [];
  for (const req of reqClean) {
    const r = norm(req);
    const hit = haveSet.some((h) => skillsMatch(h, r));
    (hit ? matched : missing).push(req);
  }
  const pct = Math.round((matched.length / reqClean.length) * 100);
  const band =
    pct >= 75 ? "Strong match — apply, and mirror their words in your resume." :
    pct >= 50 ? "Decent match — apply if you can show the missing ones are learnable; tailor hard." :
    "Stretch — apply only if you can bridge the gaps or really want it; consider 'career_path' first.";

  return [
    `JOB MATCH: ${pct}% (${matched.length} of ${reqClean.length} requirements)`,
    `BOTTOM LINE: ${band}`,
    ``,
    `You have (mirror these EXACT words in your resume — beats the ATS):`,
    matched.length ? matched.map((x) => `  ✓ ${x}`).join("\n") : "  (none matched — check your profile skills)",
    ``,
    `Gaps (address or downplay):`,
    missing.length ? missing.map((x) => `  ✗ ${x}`).join("\n") : "  (none — you match everything!)",
    ``,
    `Tailoring: put the ✓ items front-and-center with results. For ✗ items, show the closest thing you've done, or note it's in progress (a cheap cert can close many — see 'career_path'). Don't lie; do frame honestly.`,
  ].join("\n");
}
