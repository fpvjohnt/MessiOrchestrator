// Requirements are the live-sensitive, place-specific part of education — they
// vary by state, school, and program and change over time. So this explains the
// STRUCTURE (which is stable) and hands the specifics to research to verify,
// rather than stating a number that's wrong for the user's school.

const LEVELS: Record<string, { label: string; body: string[]; verify: string[] }> = {
  high_school: {
    label: "High school diploma",
    body: [
      "A diploma is earned by credits across required areas — typically English (4 yrs), math (3-4), science (2-3), social studies (3), plus PE/health, arts, and electives.",
      "Most US states require ~22-26 total credits; the exact number and mix are set by your STATE and sometimes district.",
      "Honors/AP/IB and dual-enrollment classes can earn college credit or weighted GPA while still in high school.",
    ],
    verify: ['"[your state] high school graduation credit requirements" site:.gov', '"[your district] graduation requirements"'],
  },
  college: {
    label: "College / university degree",
    body: [
      "A bachelor's degree ≈ 120 semester credit hours, usually split into: general education (broad required courses), your major, and electives.",
      "An associate degree ≈ 60 credit hours (often 2 years, common at community colleges and transferable to a 4-year).",
      "'General education' (gen-ed) is the required breadth — writing, math, science, humanities, social science — before/alongside your major.",
    ],
    verify: ['"[school name] degree requirements [major]"', '"[school name] general education requirements"'],
  },
  admissions: {
    label: "Getting in (admissions)",
    body: [
      "Typical inputs: GPA, course rigor (did you take the harder classes), test scores (SAT/ACT — now optional at many schools), essays, activities, and recommendations.",
      "Community colleges are usually open-enrollment (a diploma/GED gets you in) and are the cheapest on-ramp to a bachelor's via transfer.",
    ],
    verify: ['"[school name] admission requirements"', '"[school name] test optional [year]"'],
  },
};

export function requirements(level?: string): string {
  const keys = Object.keys(LEVELS);
  if (!level) {
    return [
      `EDUCATION REQUIREMENTS — the stable structure (specifics vary by place, so verify yours):`,
      ``,
      ...keys.map((k) => `▸ ${LEVELS[k].label} (ask: requirements "${k}")`),
      ``,
      `Requirements change by state/school/year — for YOUR exact numbers, have research run the verify queries each level lists.`,
    ].join("\n");
  }
  const norm = level.toLowerCase().replace(/[\s-]+/g, "_");
  const key = keys.find((k) => k === norm || k.includes(norm) || norm.includes(k));
  if (!key) return `Levels: ${keys.join(", ")}.`;
  const l = LEVELS[key];
  return [
    `${l.label.toUpperCase()}`,
    ...l.body.map((b) => `  • ${b}`),
    ``,
    `VERIFY YOUR SPECIFICS (rules differ by place and change) — have research run:`,
    ...l.verify.map((v) => `  • ${v}`),
  ].join("\n");
}
