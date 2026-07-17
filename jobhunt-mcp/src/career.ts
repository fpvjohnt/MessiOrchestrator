import { fuzzyFind, displayKey } from "./match.js";

// career_match: "what job fits ME?" — grounded in the RIASEC / O*NET work-style
// framework (the one career counselors actually use). career_path: the concrete
// ladder from one role to a better one. Bottom-line, plain words. CA pay is a
// rough range — verify live via research/reference (job_market).

interface WorkStyle {
  label: string;
  fits: string;
  careers: string[]; // concrete CA-relevant roles
  first_step: string;
}

// Light RIASEC mapping (Realistic/Investigative/Artistic/Social/Enterprising/Conventional).
export const WORK_STYLES: Record<string, WorkStyle> = {
  hands_on: {
    label: "Hands-on / building / fixing (Realistic)",
    fits: "You'd rather DO and build than sit at a desk. Tools, machines, movement.",
    careers: ["Skilled trades: electrician, HVAC, plumber (CA apprenticeships pay while you learn — often $70k-$110k+)", "Auto/diesel tech", "Warehouse → logistics/operations", "Solar installer"],
    first_step: "Look up union/state apprenticeships (earn while you learn, no debt). Trades pay well in CA and can't be offshored.",
  },
  analytical: {
    label: "Analytical / problem-solving (Investigative)",
    fits: "You like figuring things out, data, systems, why things work.",
    careers: ["IT help desk → cybersecurity / cloud / data (~$50k → $90k-$130k+)", "Data analyst", "Lab/medical tech", "Accounting/bookkeeping"],
    first_step: "A cheap entry cert (CompTIA A+/Security+, Google Data) + a home project beats waiting for a degree. See 'career_path'.",
  },
  creative: {
    label: "Creative / design (Artistic)",
    fits: "You like making things look/sound/read well — visual, writing, media.",
    careers: ["UX/UI design", "Graphic/motion design", "Marketing/content", "Video/photo production"],
    first_step: "Build a small PORTFOLIO (3-4 real pieces). In creative fields, proof beats a diploma.",
  },
  helping: {
    label: "Helping / people (Social)",
    fits: "You're good with people and want work that helps them.",
    careers: ["Healthcare ladder: CNA → LVN → RN (RN often $110k-$150k+ in CA)", "Teaching/education aide → teacher", "Social/community services", "Customer success"],
    first_step: "Healthcare has short, cheap entry rungs (CNA in weeks) that ladder to great CA pay. See 'career_path' CNA→RN.",
  },
  leading: {
    label: "Leading / selling / persuading (Enterprising)",
    fits: "You like driving results, convincing people, running things.",
    careers: ["Retail → shift lead → store/district manager", "Sales / account management (uncapped commission)", "Real estate", "Operations/project management"],
    first_step: "Ask your current job for lead/keyholder duties NOW — documented leadership is the bridge up. See 'career_path' retail→manager.",
  },
  organizing: {
    label: "Organizing / detail / process (Conventional)",
    fits: "You like order, accuracy, systems, getting details right.",
    careers: ["Bookkeeping/accounting", "Administrative → office manager → project coordinator", "Medical billing/coding", "HR/operations"],
    first_step: "A short cert (QuickBooks, medical coding, admin) + your reliability is a fast, cheap on-ramp.",
  },
};

export function careerMatch(styles?: string[]): string {
  if (!styles || styles.length === 0) {
    return (
      `WHAT JOB FITS YOU? Tell me how you like to work — pick any that sound like you:\n\n` +
      Object.entries(WORK_STYLES).map(([k, w]) => `▸ ${k}: ${w.fits}`).join("\n") +
      `\n\nCall career_match with your styles (e.g. ["hands_on","analytical"]) and I'll suggest fitting careers + first steps. Don't overthink it — pick what feels true.`
    );
  }
  const matched = styles.map((s) => fuzzyFind(WORK_STYLES, s)).filter((x): x is { key: string; value: WorkStyle } => !!x);
  if (matched.length === 0) return `Didn't recognize those. Options: ${Object.keys(WORK_STYLES).join(", ")}.`;
  // De-dupe by canonical key.
  const seen = new Set<string>();
  const unique = matched.filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true)));
  const blocks = unique.map((m) => {
    const w = m.value;
    return [
      `▶ ${w.label}`,
      `  Why it fits: ${w.fits}`,
      `  Careers to look at:`,
      ...w.careers.map((c) => `    • ${c}`),
      `  First step: ${w.first_step}`,
    ].join("\n");
  });
  return [
    `CAREERS THAT FIT HOW YOU WORK`,
    `BOTTOM LINE: you don't need to have it all figured out — start with directions that match how you like to work, then use 'career_path' to see the ladder.`,
    ``,
    blocks.join("\n\n"),
    ``,
    `Pay ranges are rough California figures — verify current pay/demand with 'job_market' (pulled live). A degree isn't required for many of these; skills + a cheap cert often open the door faster.`,
  ].join("\n");
}

// ---- career_path: the ladder from A to B ----------------------------------

interface Path { from: string; to: string; transferable: string[]; bridge: string[]; timeline: string; pay: string }

export const PATHS: Record<string, Path> = {
  "support_to_cyber": {
    from: "IT / tech support", to: "cybersecurity",
    transferable: ["Troubleshooting & systems knowledge", "Ticketing/customer handling", "Networking basics you already touch"],
    bridge: ["Get CompTIA Security+ (the standard entry cert) — self-study, no degree needed.", "Build a home lab; learn a SIEM; do free labs (TryHackMe).", "Target an entry SOC Analyst / IT security role — support experience is a real advantage."],
    timeline: "~6-12 months of part-time study while working support.",
    pay: "~$50k support → ~$90k-$130k+ cyber in CA.",
  },
  "retail_to_manager": {
    from: "retail / customer service", to: "retail or operations management",
    transferable: ["Customer service under pressure", "Cash handling, scheduling, inventory", "Training newer staff (leadership proof)"],
    bridge: ["Ask NOW for keyholder/shift-lead duties — get leadership on your record.", "Track results (sales, shrink, team you trained).", "Apply to assistant manager, then store/district; or pivot to operations coordinator."],
    timeline: "~1-2 years, faster if you grab lead duties early.",
    pay: "~$35k associate → ~$55k-$80k+ manager in CA.",
  },
  "cna_to_rn": {
    from: "entry healthcare / CNA", to: "Registered Nurse (RN)",
    transferable: ["Patient care experience", "Comfort in clinical settings", "Reliability under pressure"],
    bridge: ["CNA (weeks) → LVN (~1 yr) → RN (ADN ~2 yr) — ladder in stages, earning at each rung.", "Community-college nursing programs are cheap; look for employer tuition help.", "Watch for bridge programs (LVN-to-RN)."],
    timeline: "~3-4 years total, but earning and climbing the whole way.",
    pay: "~$40k CNA → RN often $110k-$150k+ in CA (among the best ROI paths in the state).",
  },
  "retail_to_tech": {
    from: "retail / customer service", to: "tech (help desk → IT)",
    transferable: ["Customer service & communication", "Problem-solving with people", "Reliability, showing up"],
    bridge: ["Get CompTIA A+ (entry IT cert) — self-study.", "Target IT help desk / desktop support as the on-ramp.", "From there ladder to sysadmin, cloud, cyber (see support_to_cyber)."],
    timeline: "~3-9 months to first help-desk role.",
    pay: "~$35k retail → ~$45k-$60k help desk → $90k+ as you specialize.",
  },
  "admin_to_pm": {
    from: "administrative / office", to: "project coordinator → project manager",
    transferable: ["Scheduling, coordination, follow-through", "Communication across teams", "Documentation & detail"],
    bridge: ["Volunteer to coordinate a project at your current job.", "Get CAPM (entry) then PMP (needs experience hours).", "Move to project coordinator, then PM."],
    timeline: "~1-3 years.",
    pay: "~$45k admin → ~$70k coordinator → $100k-$130k+ PM in CA.",
  },
};

export function careerPath(from?: string, to?: string): string {
  if (!from && !to) {
    return (
      `CAREER PATHS — from where you are to somewhere better. Common ladders:\n\n` +
      Object.values(PATHS).map((p) => `▸ ${p.from} → ${p.to}`).join("\n") +
      `\n\nCall career_path with your 'from' and 'to' (e.g. from="tech support", to="cybersecurity"). Don't see yours? Tell me both and research can map it live.`
    );
  }
  const fromQ = (from ?? "").toLowerCase();
  const toQ = (to ?? "").toLowerCase();
  const words = (s: string) => [...new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3))];
  // Score the FROM side against the caller's from, and the TO side against the
  // caller's to, separately — so "retail → tech" isn't hijacked by a ladder
  // that merely also starts at retail. De-duped words so "retail" can't count twice.
  let best: Path | undefined;
  let bestScore = 0;
  for (const p of Object.values(PATHS)) {
    const fromScore = words(p.from).filter((w) => fromQ.includes(w)).length;
    const toScore = words(p.to).filter((w) => toQ.includes(w)).length;
    // Weight the destination higher — the caller cares most about where they're going.
    const score = fromScore + toScore * 2;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  if (!best || bestScore === 0) {
    return `I don't have a baked ladder for "${from ?? "?"}" → "${to ?? "?"}". Tell me both and have research pull the bridge (typical certs, entry roles, pay) — the method still applies: find your transferable skills, close the smallest gap (usually a cheap cert, not a degree), target the bridge role.`;
  }
  return [
    `PATH: ${best.from.toUpperCase()} → ${best.to.toUpperCase()}`,
    `BOTTOM LINE: you already have transferable skills — close ONE small gap (usually a cheap cert, not a degree) and target the bridge role.`,
    ``,
    `Skills you already have that count:`,
    ...best.transferable.map((x) => `  • ${x}`),
    ``,
    `The bridge (do these):`,
    ...best.bridge.map((x, i) => `  ${i + 1}. ${x}`),
    ``,
    `Timeline: ${best.timeline}`,
    `Pay jump: ${best.pay}`,
    ``,
    `Rough CA pay — verify current figures/demand with 'job_market'. The 'easy job' that dead-ends is the trap; this ladder actually climbs.`,
  ].join("\n");
}
