// World regions: how each is governed, and the practical path to move there —
// immigrate, work, and visit. HIGH-STAKES + FAST-CHANGING, so every entry ends
// pointing at official sources + research, and serious cases at a licensed
// immigration lawyer. General information, never legal advice.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export interface Region {
  label: string;
  keys: string[];
  government: string;
  immigration: string;
  work: string;
  travel: string;
  official: string; // where to verify
}

export const REGIONS: Record<string, Region> = {
  united_states: {
    label: "United States",
    keys: ["us", "usa", "unitedstates", "america", "american"],
    government: "Federal constitutional republic: power split across three branches (executive/President, legislative/Congress, judicial/Supreme Court) and between the federal government and 50 states. Written Constitution is supreme law.",
    immigration: "Two broad routes: family-based (sponsored by a US-citizen/resident relative) and employment-based (sponsored by an employer). A green card = lawful permanent residence; citizenship (naturalization) usually comes ~5 years after. Quotas and multi-year backlogs are the norm.",
    work: "You generally need employer sponsorship: H-1B (specialty/skilled, capped by annual lottery), L-1 (intra-company transfer), O-1 (extraordinary ability), plus student (F-1/OPT) and treaty options. You can't just show up and work legally.",
    travel: "Visa Waiver Program (ESTA) for many countries — up to 90 days, no work. Others need a B-1/B-2 visitor visa. A visa lets you REQUEST entry; the officer at the border decides.",
    official: "uscis.gov (immigration), travel.state.gov (visas)",
  },
  europe: {
    label: "Europe (EU + UK)",
    keys: ["europe", "eu", "europeanunion", "uk", "unitedkingdom", "britain", "schengen", "germany", "france", "spain", "italy"],
    government: "The EU is a union of member states (each its own parliamentary democracy) sharing some laws, a single market, and free movement for EU citizens. The UK left the EU (Brexit) and now sets its own rules. Most are parliamentary systems with a PM.",
    immigration: "Rules are PER COUNTRY. Common paths: skilled-work permits, the EU Blue Card (high-skilled), family reunification, study, and (some countries) digital-nomad or golden visas. Long-term residence after ~5 years, then possible citizenship.",
    work: "Non-EU citizens need a work/residence permit tied to a job or skill — the EU Blue Card is the flagship for high earners. The UK uses a points-based Skilled Worker visa needing employer sponsorship.",
    travel: "Schengen Area: many non-EU visitors get 90 days within any 180-day period, no visa, no work (this 90/180 rule catches a lot of people). The UK is separate with its own visitor rules.",
    official: "immigration.europa.eu, each country's interior ministry, gov.uk (UK)",
  },
  middle_east: {
    label: "Middle East",
    keys: ["middleeast", "gulf", "uae", "dubai", "saudi", "saudiarabia", "qatar", "israel", "kuwait", "bahrain", "oman"],
    government: "Very mixed: absolute and constitutional monarchies (Saudi Arabia, UAE, Qatar, Jordan, Oman), a parliamentary democracy (Israel), and republics. Several Gulf states blend royal rule with modern bureaucracies; law often blends civil codes with Islamic (Sharia) principles.",
    immigration: "Gulf states run mostly on TEMPORARY, employer-tied residency, historically the 'kafala' (sponsorship) system — your legal status is linked to your employer. Permanent residence/citizenship is rare and hard for foreigners (some new long-term 'golden visas', e.g. UAE).",
    work: "Almost always employer-sponsored: the company arranges your work + residence permit, and leaving/changing jobs can be restricted (reforms are loosening kafala in some states). Read the contract carefully.",
    travel: "Varies widely — UAE/Qatar offer easy visas-on-arrival or e-visas for many nationalities; Saudi Arabia opened tourist e-visas recently. Dress, alcohol, and conduct rules differ sharply by country.",
    official: "each country's ministry of interior / embassy",
  },
  japan: {
    label: "Japan",
    keys: ["japan", "japanese", "tokyo", "nippon"],
    government: "Constitutional monarchy with a parliamentary democracy: a symbolic Emperor, a Prime Minister and the Diet (parliament) that actually govern. Strong central bureaucracy.",
    immigration: "Status-of-residence system: you get a residence status matched to your activity (work, study, family, etc.). Permanent residence is possible after ~10 years (less on some fast tracks like the Highly Skilled Professional points system). Citizenship is possible but requires giving up your other nationality.",
    work: "You need a work-eligible status of residence, usually tied to a job offer and matched to a category (engineer/specialist, instructor, etc.). A university degree or equivalent experience is often required. The Highly Skilled Professional visa rewards points for education/income/skills.",
    travel: "Short-term visa exemptions for many countries (often 90 days), tourism only, no work. Longer stays need the right residence status arranged in advance.",
    official: "isa.go.jp (Immigration Services Agency), mofa.go.jp (visas)",
  },
  russia: {
    label: "Russia",
    keys: ["russia", "russian", "moscow"],
    government: "Federal semi-presidential republic on paper — a strong presidency, a Federal Assembly (parliament), and a constitution — but in practice power is highly centralized in the executive. Note: current geopolitics (sanctions, travel advisories) heavily affect anything practical here.",
    immigration: "Path is typically: visa → temporary residence permit (RVP, quota-limited) → permanent residence permit (VNZh) → possible citizenship. Bureaucratic and document-heavy.",
    work: "Foreigners generally need a work permit or patent plus an employer; quotas apply for many categories. Highly qualified specialist (HQS) status is a faster employer-sponsored route.",
    travel: "Most nationalities need a visa arranged in advance (invitation often required); e-visas exist for some. Check current government travel advisories first — conditions and sanctions change fast.",
    official: "мвд.рф / MVD (interior ministry); your own country's travel advisory FIRST",
  },
  south_america: {
    label: "South America",
    keys: ["southamerica", "latinamerica", "brazil", "argentina", "chile", "colombia", "peru", "uruguay"],
    government: "Mostly presidential republics (Brazil, Argentina, Chile, Colombia, Peru...) with elected presidents and congresses and written constitutions. Democratic, though institutional stability varies by country.",
    immigration: "Generally more accessible than the US/Europe. Common paths: rentista/pensioner (proof of steady income), investor, work, family, and the Mercosur agreement (which lets citizens of member states get residence in each other's countries relatively easily). Naturalization often after 2-4 years.",
    work: "A local job or the right residence category; several countries offer digital-nomad visas. Mercosur nationals have an easier work path across member states.",
    travel: "Many countries are visa-free or visa-on-arrival for tourists (often 90 days) for a lot of nationalities. Some charge a 'reciprocity' fee matching what your country charges theirs.",
    official: "each country's migration agency (e.g. Brazil's Polícia Federal, Argentina's Migraciones)",
  },
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "").replace(/[^a-z0-9]/g, "");
}

const REGION_INDEX: Record<string, string> = {};
for (const [key, r] of Object.entries(REGIONS)) {
  REGION_INDEX[normalize(key)] = key;
  REGION_INDEX[normalize(r.label)] = key;
  for (const k of r.keys) REGION_INDEX[normalize(k)] = key;
}

export function resolveRegion(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(REGION_INDEX, norm)) return REGION_INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(REGION_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

const DISCLAIMER =
  "This is general information, NOT legal advice — immigration rules change constantly and mistakes are costly. Verify current specifics at the official source below (have research fetch it), and for a real case use a licensed immigration lawyer.";

function regionField(region: string | undefined, field: "government" | "immigration" | "work" | "travel", heading: string): string {
  if (!region) {
    return (
      `${heading} — pick a region:\n\n` +
      Object.values(REGIONS).map((r) => `▸ ${r.label}`).join("\n") +
      `\n\nName a region or country (e.g. "Japan", "Dubai", "Brazil", "Schengen").`
    );
  }
  const key = resolveRegion(region);
  if (!key) return `Not sure which region "${clean(region)}" is. Covered: ${Object.values(REGIONS).map((r) => r.label).join(", ")}.`;
  const r = REGIONS[key];
  return [
    `${heading} — ${r.label}${normalize(region) !== normalize(key) ? ` (from "${clean(region)}")` : ""}`,
    `BOTTOM LINE: ${r[field]}`,
    ``,
    `Verify at: ${r.official}`,
    DISCLAIMER,
  ].join("\n");
}

export function explainGovernment(region?: string): string {
  if (!region) {
    return (
      `WORLD GOVERNMENTS — how each region is run (pick one):\n\n` +
      Object.values(REGIONS).map((r) => `▸ ${r.label}: ${r.government.split(":")[0]}.`).join("\n") +
      `\n\nAlso: immigration_paths (move there), work_permit (work there), travel_entry (visit).`
    );
  }
  return regionField(region, "government", "GOVERNMENT");
}
export const immigrationPaths = (region?: string) => regionField(region, "immigration", "IMMIGRATION / RESIDENCY");
export const workPermit = (region?: string) => regionField(region, "work", "WORK PERMIT");
export const travelEntry = (region?: string) => regionField(region, "travel", "TRAVEL / ENTRY VISA");

export function howGovernmentsDiffer(): string {
  return [
    `HOW GOVERNMENTS DIFFER — the main systems, in plain words`,
    `BOTTOM LINE: the label on a government tells you less than who actually holds power and whether they can be removed by a vote — several of these systems share a name and almost nothing else.`,
    ``,
    `▸ Republic — leaders elected, power limited by a constitution/laws (US, France, Brazil).`,
    `▸ Parliamentary democracy — voters elect a parliament, which picks a Prime Minister (UK, Japan, Germany).`,
    `▸ Constitutional monarchy — a king/emperor as symbol, elected government actually rules (Japan, UK, Jordan).`,
    `▸ Absolute monarchy — the monarch holds real power (Saudi Arabia, and parts of the Gulf).`,
    `▸ Semi-presidential — a president AND a prime minister share power (Russia on paper, France).`,
    `▸ Authoritarian/one-party — elections are limited or controlled; power is centralized regardless of the label on paper.`,
    ``,
    `The label on paper and how it works in practice can differ a lot — for how a specific country ACTUALLY operates today, have research pull current, credible sources.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is how governments work around the world, and the practical side of moving between them — immigrate, work, and travel.`,
    ``,
    `  • How a country is governed → 'explain_government <region>' (or 'how_governments_differ' for the systems).`,
    `  • Move there → 'immigration_paths <region>'.  Work there → 'work_permit <region>'.  Visit → 'travel_entry <region>'.`,
    ``,
    `Regions: United States, Europe (EU+UK), Middle East, Japan, Russia, South America.`,
    `IMPORTANT: general info only, not legal advice. Immigration rules change fast and mistakes are costly — verify current specifics via research + official sources, and use a licensed immigration lawyer for a real case. (The lawguide asset covers your legal RIGHTS and US situations.)`,
  ].join("\n");
}
