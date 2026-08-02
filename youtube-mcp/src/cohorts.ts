// Age/gender/device cohort interpretation — the "so what does this MEAN" layer.
//
// DESIGN NOTE, and it is the whole point of this file's shape:
//
// The obvious version of this map is a lookup from "age18-24" to "they like gaming
// and short-form comedy." That version is a stereotype generator. It would emit
// the same confident sentence whether the channel is a woodworking channel or a
// K-pop channel, and the caller cannot tell the difference between a claim
// derived from the user's data and a claim hardcoded by whoever wrote the file.
// AGENTS.md's rule against baking moving facts into a map applies with force
// here: audience behaviour is not only moving, it is channel-specific.
//
// So each cohort entry holds NO assertions about what the cohort watches. It
// holds: the signals worth checking, the questions the number should provoke, and
// the failure mode specific to reading that cohort. The tool combines these with
// the user's ACTUAL measured percentages. The scaffold asks; only the data
// answers.
//
// Everything here is deterministic and offline — no network, no keys.

export interface CohortEntry {
  label: string;
  keys: string[];
  /** What this cohort's presence should make you go look at, in the real numbers. */
  checkSignals: string[];
  /** The specific way people misread this cohort. */
  misreadRisk: string;
}

export const AGE_COHORTS: Record<string, CohortEntry> = {
  "age13-17": {
    label: "13–17 (minors)",
    keys: ["13-17", "13", "teen", "teens", "teenager", "teenagers", "minor", "minors", "under18", "highschool"],
    checkSignals: [
      "Made-for-kids / COPPA status on your videos — this cohort's presence changes your legal and monetisation position, not just your content plan.",
      "Whether personalised ads are disabled on your catalogue (they are, on made-for-kids content), which decouples RPM from this audience entirely.",
      "Share of watch time from MOBILE and TV vs desktop — a school-schedule audience shows sharp weekday-evening and weekend peaks.",
      "Comment sentiment vs view velocity: this cohort drives velocity far more than it drives comment volume.",
    ],
    misreadRisk:
      "Under-18s are the MOST undercounted cohort in the age split, because the split only sees logged-in viewers and many are watching signed-out or on a shared family account. A small age13-17 number is not evidence they are absent.",
  },
  "age18-24": {
    label: "18–24",
    keys: ["18-24", "18", "young adult", "youngadult", "college", "genz", "gen z", "students"],
    checkSignals: [
      "Shorts vs long-form split — check watch time, not view count; a Shorts view and a 20-minute view are not comparable units.",
      "Traffic source mix: heavy Browse/Shorts-feed share means the algorithm is choosing you, not the viewer, and that share can vanish overnight.",
      "Average view duration as a PERCENTAGE, not in seconds, so it is comparable across your catalogue.",
      "Subscriber-vs-non-subscriber watch time, since a discovery-driven cohort converts to subscription at a very different rate.",
    ],
    misreadRisk:
      "This is usually the largest logged-in cohort, which makes it look dominant even where it is not — logged-in share and true audience share are different quantities and the API only reports the first.",
  },
  "age25-34": {
    label: "25–34",
    keys: ["25-34", "25", "millennial", "millennials", "earlycareer"],
    checkSignals: [
      "Whether watch time concentrates in problem-solving formats (how-to, review, comparison) — check retention on the first 30 seconds specifically.",
      "Search traffic share vs Browse share. Search-led demand is durable and repeatable; Browse-led is rented.",
      "Desktop share — a meaningful desktop percentage in this cohort usually means work-context or research viewing, which changes ideal video length.",
      "Returning-viewer rate, which matters more than raw reach for this cohort's monetisation value.",
    ],
    misreadRisk:
      "High RPM in this band tempts creators to chase it with content the existing audience did not come for. Check whether the cohort is growing because of a specific video before restructuring the channel around it.",
  },
  "age35-44": {
    label: "35–44",
    keys: ["35-44", "35", "midcareer", "parents"],
    checkSignals: [
      "TV-device share — this is where living-room viewing starts to matter, and TV viewing rewards longer, less edit-dense formats.",
      "Watch time by daypart, since this cohort's availability is shaped by work and childcare rather than school.",
      "Whether the topics drawing this cohort are durable (finance, home, health, career) and therefore worth evergreen investment.",
    ],
    misreadRisk:
      "Engagement rate (likes/comments per view) drops with age in most catalogues. Reading that as weaker interest rather than a different commenting culture leads people to abandon their most valuable cohort.",
  },
  "age45-54": {
    label: "45–54",
    keys: ["45-54", "45"],
    checkSignals: [
      "TV and tablet share, which typically exceed this cohort's mobile share.",
      "Whether external/suggested traffic is carrying these views, which indicates reach beyond your subscriber core.",
      "Retention on long-form specifically — this cohort tolerates and often prefers length.",
    ],
    misreadRisk:
      "Small percentages here are frequently dismissed as noise when they represent the highest-watch-time-per-viewer segment of the channel. Weight by watch time before deciding a cohort is marginal.",
  },
  "age55-64": {
    label: "55–64",
    keys: ["55-64", "55"],
    checkSignals: [
      "TV-device share and average view duration together — high on both means the living room is your real venue.",
      "Whether views arrive from YouTube search or from off-platform links, which says whether YouTube or something else is your distribution.",
    ],
    misreadRisk:
      "This cohort is the most likely to watch signed-out or on a shared TV profile, so the logged-in-only age split understates it more than any band except 13–17.",
  },
  "age65-": {
    label: "65 and over",
    keys: ["65", "65-", "65+", "seniors", "retired", "retirees"],
    checkSignals: [
      "TV share, session length, and whether autoplay is doing the work rather than deliberate selection.",
      "Accessibility signals: caption usage and playback speed if available, since these shape whether the content is actually consumable.",
    ],
    misreadRisk:
      "Often the smallest reported band and the most under-measured. Do not conclude absence from a low number in a logged-in-only sample.",
  },
};

export const DEVICE_NOTES: Record<string, CohortEntry> = {
  MOBILE: {
    label: "Mobile phone",
    keys: ["mobile", "phone", "smartphone", "ios", "android"],
    checkSignals: [
      "Thumbnail legibility at thumbnail size — most mobile impressions are tiny.",
      "Whether Shorts is inflating mobile share; separate Shorts from long-form before drawing any conclusion.",
      "First-3-second retention, which is harshest on mobile feeds.",
    ],
    misreadRisk: "Mobile dominance is the default for almost every channel, so it carries little signal on its own. The informative number is the share of every OTHER device.",
  },
  TV: {
    label: "Living-room TV",
    keys: ["tv", "television", "smarttv", "livingroom", "roku", "firetv", "appletv", "chromecast"],
    checkSignals: [
      "Average view duration on TV vs mobile — usually multiples higher, which means TV share understates its watch-time contribution badly.",
      "Whether on-screen text is readable from a sofa, and whether hard-cut editing pace suits a passive viewing posture.",
      "Session behaviour: TV viewers autoplay into the next video, so end screens and series structure pay off disproportionately.",
    ],
    misreadRisk: "TV is the fastest-growing surface for most catalogues and the one most often ignored because its VIEW share looks small next to mobile. Always re-rank devices by watch time, not views.",
  },
  DESKTOP: {
    label: "Desktop / laptop",
    keys: ["desktop", "laptop", "computer", "pc", "mac", "windows"],
    checkSignals: [
      "Search-traffic share, since desktop skews toward intentional, task-driven viewing.",
      "Whether these viewers are following along with something (code, recipe, repair) — if so, pacing and chapter markers matter more than retention tricks.",
    ],
    misreadRisk: "Low desktop share is normal and is not evidence that work-context viewing is unimportant; desktop viewers often convert to subscribers and buyers at higher rates than their share suggests.",
  },
  TABLET: {
    label: "Tablet",
    keys: ["tablet", "ipad"],
    checkSignals: ["Duration profile, which usually sits between mobile and TV.", "Household sharing, which corrupts the age/gender split for this device more than others."],
    misreadRisk: "Shared-household devices attribute one profile's demographics to several real people. Treat tablet-heavy demographic splits as the least reliable.",
  },
  GAME_CONSOLE: {
    label: "Game console",
    keys: ["console", "gameconsole", "playstation", "xbox", "ps5", "nintendo"],
    checkSignals: ["Whether the content is gaming-adjacent, and whether these sessions are long and passive."],
    misreadRisk: "Console viewing behaves like TV viewing, not like gaming engagement. Grouping it with 'gamers' misreads the surface as an interest.",
  },
};

/**
 * Reverse index: key -> entry. Per AGENTS.md, MUST return undefined for unknown
 * input (never null), and the longest matching key wins so "18-24" is not eaten
 * by a loose match on "18".
 */
function resolveIn(map: Record<string, CohortEntry>, input: string): CohortEntry | undefined {
  const q = String(input ?? "").trim().toLowerCase();
  if (!q) return undefined;

  if (map[input]) return map[input];
  for (const [id, entry] of Object.entries(map)) {
    if (id.toLowerCase() === q) return entry;
    if (entry.label.toLowerCase() === q) return entry;
  }
  let best: CohortEntry | undefined;
  let bestLen = 0;
  for (const entry of Object.values(map)) {
    for (const k of entry.keys) {
      const kl = k.toLowerCase();
      if ((kl === q || q.includes(kl)) && kl.length > bestLen) {
        best = entry;
        bestLen = kl.length;
      }
    }
  }
  return best;
}

export function resolveAgeCohort(input: string): CohortEntry | undefined {
  return resolveIn(AGE_COHORTS, input);
}

export function resolveDevice(input: string): CohortEntry | undefined {
  return resolveIn(DEVICE_NOTES, input);
}

/** The caveat that must accompany every age/gender number this server emits. */
export const LOGGED_IN_CAVEAT =
  "MEASUREMENT CAVEAT (from Google's own docs): the ageGroup and gender dimensions describe " +
  "LOGGED-IN viewers only — \"the age group of the logged-in users associated with the report data\". " +
  "Signed-out viewers are absent entirely. These percentages are shares of your signed-in audience, " +
  "NOT of your audience. Treat them as directional, never as a census, and never re-report them as " +
  "\"X% of my viewers are …\". gender has exactly three values (female, male, user_specified), so it " +
  "cannot describe viewers outside that scheme.";
