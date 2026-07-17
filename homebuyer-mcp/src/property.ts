// Property investigation: given an address, produce the exact checklist AND the
// authoritative public-record sources to verify it — so the research asset (or
// the user) can fetch the truth from the COUNTY, not a listing site that lies or
// blocks bots. Deterministic + offline; it hands out where to look, it doesn't
// fetch. Bottom-line-first.

interface CountySources {
  county: string;
  assessor: string; // owner of record, assessed value, parcel/APN
  tax: string; // real tax bill incl. Mello-Roos/special assessments
  recorder: string; // deeds, liens, sale history
  permits: Record<string, string>; // city -> building/permit portal ("_default" = unincorporated)
}

const SOS_LLC = "https://bizfileonline.sos.ca.gov/search/business"; // is the owner an LLC/company?
const FEMA_FLOOD = "https://msc.fema.gov/portal/home"; // flood zone
const CALFIRE_FHSZ = "https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones"; // wildfire zone

const COUNTIES: Record<string, CountySources> = {
  riverside: {
    county: "Riverside County",
    assessor: "https://www.asrclkrec.com/ (Riverside County Assessor-Clerk-Recorder — property/owner search)",
    tax: "https://ca-riverside-ttc.publicaccessnow.com/ (Riverside County Treasurer-Tax Collector — real tax bill incl. Mello-Roos/CFD & special assessments)",
    recorder: "https://www.asrclkrec.com/ (grantor/grantee & recorded documents — sale history, liens)",
    permits: {
      murrieta: "https://www.murrietaca.gov/ (Building & Safety — permit history)",
      temecula: "https://temeculaca.gov/ (Community Development / permits)",
      menifee: "https://www.cityofmenifee.us/ (Building & Safety)",
      wildomar: "https://www.cityofwildomar.org/ (Building & Safety)",
      "canyon lake": "https://www.cityofcanyonlake.com/ (Building & Safety)",
      "lake elsinore": "https://www.lake-elsinore.org/ (Building & Safety)",
      _default: "https://rctlma.org/ (Riverside County TLMA / Building & Safety — for unincorporated areas)",
    },
  },
  "los angeles": {
    county: "Los Angeles County",
    assessor: "https://portal.assessor.lacounty.gov/ (LA County Assessor — parcel/owner search)",
    tax: "https://ttc.lacounty.gov/ (LA County Treasurer-Tax Collector — property tax bill)",
    recorder: "https://www.lavote.gov/home/records/property-document-recording (LA County Registrar-Recorder)",
    permits: {
      _default: "Search '[city] building & safety permit search' — e.g. LA City: https://www.ladbs.org/ ; Long Beach: https://www.longbeach.gov/lbds/",
    },
  },
  "san diego": {
    county: "San Diego County",
    assessor: "https://www.sdarcc.gov/ (SD County Assessor/Recorder/County Clerk — property search)",
    tax: "https://www.sdttc.com/ (SD County Treasurer-Tax Collector — tax bill)",
    recorder: "https://www.sdarcc.gov/content/arcc/home/divisions/recorder-county-clerk.html (recorded documents)",
    permits: {
      _default: "Search '[city] building permit search' — e.g. City of San Diego: https://www.sandiego.gov/development-services",
    },
  },
};

const CITY_TO_COUNTY: Record<string, string> = {
  murrieta: "riverside", temecula: "riverside", menifee: "riverside", wildomar: "riverside",
  "canyon lake": "riverside", "lake elsinore": "riverside", riverside: "riverside",
  "moreno valley": "riverside", corona: "riverside", hemet: "riverside", perris: "riverside",
  "san pedro": "los angeles", "long beach": "los angeles", "los angeles": "los angeles", torrance: "los angeles",
  "san diego": "san diego", "chula vista": "san diego", oceanside: "san diego", escondido: "san diego",
};

function resolveCounty(county?: string, city?: string): CountySources | null {
  if (county) {
    const key = county.toLowerCase().replace(/\s*county\s*/i, "").trim();
    if (COUNTIES[key]) return COUNTIES[key];
  }
  if (city) {
    const c = CITY_TO_COUNTY[city.toLowerCase().trim()];
    if (c && COUNTIES[c]) return COUNTIES[c];
  }
  return null;
}

export function propertyInvestigation(address: string, county?: string, city?: string): string {
  const src = resolveCounty(county, city);
  const head = [
    `PROPERTY INVESTIGATION — ${address}`,
    ``,
    `BOTTOM LINE: verify the listing against COUNTY records below. If a number differs from the listing, that gap is your leverage. Listing sites can be wrong or blocked — the county is the truth.`,
    ``,
  ];

  const sources = src
    ? [
        `AUTHORITATIVE SOURCES (${src.county}):`,
        `  • Owner + assessed value ... ${src.assessor}`,
        `  • REAL tax bill (Mello-Roos!) ${src.tax}`,
        `  • Sale history / liens ..... ${src.recorder}`,
        `  • Permits .................. ${(city && src.permits[city.toLowerCase().trim()]) || src.permits._default}`,
        `  • Owner an LLC/company? .... ${SOS_LLC}`,
        `  • Flood zone ............... ${FEMA_FLOOD}`,
        `  • Wildfire zone ............ ${CALFIRE_FHSZ}`,
      ]
    : [
        `COUNTY NOT RECOGNIZED — tell me the city/county and I'll pin exact links. General path:`,
        `  • Search "[county] assessor property search" → owner + assessed value`,
        `  • Search "[county] treasurer tax collector" → real tax bill incl. special assessments`,
        `  • Search "[city] building permit search" → permit history`,
        `  • Owner an LLC? ${SOS_LLC}   • Flood: ${FEMA_FLOOD}   • Fire: ${CALFIRE_FHSZ}`,
      ];

  const checklist = [
    ``,
    `WHAT TO VERIFY (and what a mismatch means):`,
    `  1. Owner of record — matches the seller? Person vs LLC (investor flip = different negotiation).`,
    `  2. Assessed value & last sale price/date — a recent cheap purchase + big markup = flip; ask what was actually done.`,
    `  3. REAL tax bill — does it include Mello-Roos/CFD or special assessments the listing left out? (Adds $100–400+/mo.)`,
    `  4. Permits — do beds/baths/additions/ADU/pool match permitted work? Unpermitted = loan/insurance/resale risk.`,
    `  5. HOA — listing dues vs reality; get the HOA's reserve study + assessments from the seller (not online).`,
    `  6. Square footage — county record vs listing. Inflated sqft is common.`,
    `  7. Flood / wildfire zone — affects insurability (and in CA, whether you can insure it at all).`,
    ``,
    `NEGOTIATION LEVERAGE TO GATHER: days on market, price-cut history, why they're selling, and anything above that doesn't match the listing. Run 'how_they_think seller' and 'red_flag <issue>' for specifics.`,
    ``,
    `Hand me the address + city and I'll have the research asset pull what's public, then give you a straight brief. For HOA reserves, permits pulled in person, and anything blocked online, I'll tell you the exact office to call.`,
  ];

  return [...head, ...sources, ...checklist].join("\n");
}

export function photoChecklist(): string {
  return [
    `PHOTO CHECKLIST — take these on-site and send them; I'll flag issues + give you questions to ask.`,
    ``,
    `BOTTOM LINE: the electrical panel label, under the sinks, the roof, and any wall/floor cracks tell me the most.`,
    ``,
    `  • ELECTRICAL PANEL — the brand label inside the door (a Zinsco or Federal Pacific panel = insurance/fire problem).`,
    `  • UNDER SINKS (kitchen + baths) — leaks, water stains, mold, past repairs.`,
    `  • CEILINGS & walls — brown stains (roof/plumbing leaks), cracks (settling).`,
    `  • FLOORS — sloping or uneven (foundation), soft spots.`,
    `  • ROOF — from the ground: missing/curling shingles, sag, patchwork.`,
    `  • FOUNDATION / exterior walls — stair-step cracks, gaps, grading sloping toward the house.`,
    `  • WATER HEATER & HVAC — the age/date sticker (near end of life = a bill coming).`,
    `  • WINDOWS — fogging between panes (failed seals), single-pane (cost + noise).`,
    `  • YARD/DRAINAGE — pooling, retaining walls, slope behind the house (fire/erosion).`,
    `  • ANYTHING that looks newly painted/covered — sometimes hides a problem; photograph it and ask why.`,
    ``,
    `Also snap the listing sheet and the MLS photos so I can compare what they SHOW vs what you SEE.`,
  ].join("\n");
}
