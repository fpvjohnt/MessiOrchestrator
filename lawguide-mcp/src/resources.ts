// Legal help directory. A baked FLOOR of the big authoritative CA + county
// resources (so it always has real answers offline), plus the exact search
// queries the research asset should run to pull current local orgs. The model
// then verifies/enriches live. Not an endorsement — starting points.

interface CountyResources {
  county: string;
  public_defender: string;
  legal_aid: string;
  self_help: string;
  law_library: string;
}

const STATEWIDE = [
  `STATEWIDE (California):`,
  `  • Find free/low-cost help by problem + county: https://lawhelpca.org`,
  `  • Court self-help (forms, how-to, small claims, traffic): https://selfhelp.courts.ca.gov`,
  `  • State Bar — verify a lawyer & Lawyer Referral Service: https://www.calbar.ca.gov`,
  `  • Immigration nonprofits (avoid notarios): https://www.immigrationadvocates.org/nonprofit/legaldirectory/`,
  `  • IRS free help: Taxpayer Advocate Service https://www.taxpayeradvocate.irs.gov + Low-Income Taxpayer Clinics https://www.taxpayeradvocate.irs.gov/litc`,
];

const COUNTIES: Record<string, CountyResources> = {
  riverside: {
    county: "Riverside County",
    public_defender: "Riverside County Public Defender — https://www.rivcopd.org (free criminal defense if you can't afford one)",
    legal_aid: "Inland Counties Legal Services (ICLS) — https://www.inlandlegal.org (free civil legal aid; housing, benefits, consumer)",
    self_help: "Riverside Superior Court Self-Help Center — https://www.riverside.courts.ca.gov/SelfHelp/self-help.php",
    law_library: "Riverside County Law Library — https://www.lawlibrary.us",
  },
  "los angeles": {
    county: "Los Angeles County",
    public_defender: "LA County Public Defender — https://pubdef.lacounty.gov",
    legal_aid: "Legal Aid Foundation of LA (LAFLA) https://lafla.org · Neighborhood Legal Services LA https://www.nlsla.org · Bet Tzedek https://www.bettzedek.org",
    self_help: "LA Superior Court Self-Help — https://www.lacourt.org/selfhelp",
    law_library: "LA Law Library — https://www.lalawlibrary.org",
  },
  "san diego": {
    county: "San Diego County",
    public_defender: "San Diego County Public Defender — https://www.sandiegocounty.gov/public_defender.html",
    legal_aid: "Legal Aid Society of San Diego — https://www.lassd.org",
    self_help: "San Diego Superior Court Self-Help — https://www.sdcourt.ca.gov/sdcourt/selfhelp",
    law_library: "San Diego Law Library — https://www.sandiegolawlibrary.org",
  },
};

const CITY_TO_COUNTY: Record<string, string> = {
  murrieta: "riverside", temecula: "riverside", menifee: "riverside", wildomar: "riverside",
  "canyon lake": "riverside", "lake elsinore": "riverside", riverside: "riverside", "moreno valley": "riverside", corona: "riverside", hemet: "riverside",
  "san pedro": "los angeles", "long beach": "los angeles", "los angeles": "los angeles",
  "san diego": "san diego", "chula vista": "san diego",
};

// Strip newlines/quotes so user text can't forge fake resource lines or extra
// research queries when echoed into the output.
const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export function findLegalResources(rawNeed: string, rawArea?: string): string {
  const need = clean(rawNeed);
  const area = rawArea ? clean(rawArea) : undefined;
  const key = (area ?? "").toLowerCase().trim();
  const bareKey = key.replace(/\s*county\s*/i, "").trim();
  const countyKey = Object.hasOwn(COUNTIES, bareKey)
    ? bareKey
    : Object.hasOwn(CITY_TO_COUNTY, key)
    ? CITY_TO_COUNTY[key]
    : undefined;
  const county = countyKey && Object.hasOwn(COUNTIES, countyKey) ? COUNTIES[countyKey] : undefined;

  const local = county
    ? [
        ``,
        `LOCAL (${county.county}):`,
        `  • Public defender ... ${county.public_defender}`,
        `  • Legal aid ......... ${county.legal_aid}`,
        `  • Court self-help ... ${county.self_help}`,
        `  • Law library ....... ${county.law_library}`,
      ]
    : area
    ? [``, `(No baked list for "${area}" — the statewide links above cover all CA counties, and research will pull local orgs below.)`]
    : [``, `(Tell me your county — Riverside, Los Angeles, San Diego... — for the exact local offices.)`];

  const areaLabel = county?.county ?? area ?? "your county California";
  const research = [
    ``,
    `HAVE RESEARCH PULL CURRENT LOCAL HELP (queries):`,
    `  • "free legal aid ${need} ${areaLabel}"`,
    `  • "${areaLabel} ${need} pro bono clinic"`,
    `  • "${areaLabel} self-help center ${need}"`,
    /immigration|notario|visa|green card|deport|ice/i.test(need)
      ? `  • "DOJ accredited immigration nonprofit ${areaLabel}" (NEVER a notario)`
      : `  • "${areaLabel} lawyer referral ${need}"`,
  ];

  return [
    `LEGAL HELP FOR: ${need}`,
    `BOTTOM LINE: start with the statewide finders, then your county's free options. Much of this is free if you qualify.`,
    ``,
    ...STATEWIDE,
    ...local,
    ...research,
    ``,
    `These are starting points, not endorsements. Verify anyone before paying — check the State Bar (calbar.ca.gov) that a "lawyer" is actually licensed. ⚠️ For immigration, only licensed attorneys or DOJ-accredited reps — notarios are not lawyers.`,
  ].join("\n");
}
