// The world's major language families — grouped by shared ancestry — plus where
// they're spoken and a distinctive trait. Bottom-line first, plain words.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export interface Family {
  label: string;
  keys: string[];
  what: string;
  where: string;
  examples: string[];
  trait: string;
}

export const FAMILIES: Record<string, Family> = {
  indo_european: {
    label: "Indo-European",
    keys: ["indoeuropean", "english", "spanish", "portuguese", "french", "german", "russian", "hindi", "persian", "italian", "greek", "latin"],
    what: "The biggest family by speakers — everything from English to Hindi descends from one prehistoric ancestor (Proto-Indo-European).",
    where: "Most of Europe, the Americas (via colonization), Iran, and northern India.",
    examples: ["English", "Spanish", "Portuguese", "Russian", "Hindi/Urdu", "French", "German", "Persian (Farsi)"],
    trait: "Related words show up across it — 'mother' / 'madre' / 'mater' / 'Mutter' / 'mata' all trace to the same root.",
  },
  sino_tibetan: {
    label: "Sino-Tibetan",
    keys: ["sinotibetan", "chinese", "mandarin", "cantonese", "tibetan", "burmese"],
    what: "The family of Chinese languages plus Tibetan and Burmese — second-largest by speakers.",
    where: "China, Taiwan, Tibet, Myanmar, and Chinese communities worldwide.",
    examples: ["Mandarin Chinese", "Cantonese", "Tibetan", "Burmese"],
    trait: "Most are TONAL — the pitch you say a syllable with changes its meaning entirely (ma can mean mother, hemp, horse, or scold in Mandarin).",
  },
  afroasiatic: {
    label: "Afro-Asiatic",
    keys: ["afroasiatic", "arabic", "hebrew", "amharic", "hausa", "semitic"],
    what: "Includes the Semitic languages (Arabic, Hebrew) plus many across North and East Africa.",
    where: "North Africa, the Middle East, the Horn of Africa.",
    examples: ["Arabic", "Hebrew", "Amharic", "Hausa"],
    trait: "Semitic languages build words from three-consonant ROOTS — Arabic k-t-b gives kitab (book), kataba (he wrote), maktab (office).",
  },
  niger_congo: {
    label: "Niger-Congo",
    keys: ["nigercongo", "swahili", "yoruba", "zulu", "bantu", "igbo"],
    what: "The largest family in Africa by number of languages — includes the huge Bantu branch.",
    where: "Most of sub-Saharan Africa.",
    examples: ["Swahili", "Yoruba", "Zulu", "Igbo"],
    trait: "Many use NOUN CLASSES — nouns fall into a dozen-plus categories (people, plants, tools...) that ripple agreement through the whole sentence.",
  },
  austronesian: {
    label: "Austronesian",
    keys: ["austronesian", "malay", "indonesian", "tagalog", "filipino", "hawaiian", "maori"],
    what: "One of the most geographically spread families — from Madagascar to Hawaii to New Zealand.",
    where: "Southeast Asian islands, the Pacific, Madagascar.",
    examples: ["Malay/Indonesian", "Tagalog (Filipino)", "Hawaiian", "Māori"],
    trait: "Spread by seafaring — the same family reached islands thousands of miles apart across open ocean.",
  },
  dravidian: {
    label: "Dravidian",
    keys: ["dravidian", "tamil", "telugu", "kannada", "malayalam"],
    what: "The languages of southern India — older in the region than the Indo-European languages of the north.",
    where: "Southern India and Sri Lanka.",
    examples: ["Tamil", "Telugu", "Kannada", "Malayalam"],
    trait: "Tamil is one of the oldest continuously-used languages on Earth, with a literature over 2,000 years old.",
  },
  isolates_others: {
    label: "Japonic, Koreanic & Isolates",
    keys: ["japanese", "japonic", "korean", "koreanic", "basque", "isolate", "turkic", "uralic", "finnish", "hungarian"],
    what: "Small families and 'isolates' — languages with no proven relatives (like Basque), plus Japanese, Korean, and the Turkic/Uralic families.",
    where: "Japan, Korea, a pocket of Spain/France (Basque), Central Asia, Finland/Hungary.",
    examples: ["Japanese", "Korean", "Basque (an isolate)", "Turkish", "Finnish", "Hungarian"],
    trait: "Basque has no known relatives at all — it was spoken in Europe before Indo-European arrived and simply survived.",
  },
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "").replace(/[^a-z0-9]/g, "");
}

const FAMILY_INDEX: Record<string, string> = {};
for (const [key, f] of Object.entries(FAMILIES)) {
  FAMILY_INDEX[normalize(key)] = key;
  FAMILY_INDEX[normalize(f.label)] = key;
  for (const k of f.keys) FAMILY_INDEX[normalize(k)] = key;
}

export function resolveFamily(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(FAMILY_INDEX, norm)) return FAMILY_INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(FAMILY_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

export function explainFamily(input?: string): string {
  if (!input) {
    return (
      `THE WORLD'S LANGUAGE FAMILIES — languages grouped by shared ancestry:\n\n` +
      Object.values(FAMILIES).map((f) => `▸ ${f.label}: ${f.what}`).join("\n") +
      `\n\nName a family or any language ("Mandarin", "Arabic", "Swahili", "Japanese") and I'll place it. For how language itself works use how_language_works; to learn one use learn_language.`
    );
  }
  const key = resolveFamily(input);
  if (!key) return `Not sure where "${clean(input)}" fits. Families: ${Object.values(FAMILIES).map((f) => f.label).join(", ")}.`;
  const f = FAMILIES[key];
  return [
    `${f.label}${normalize(input) !== normalize(key) ? ` (that's where "${clean(input)}" belongs)` : ""}`,
    `BOTTOM LINE: ${f.what}`,
    ``,
    `Spoken across: ${f.where}`,
    `Examples: ${f.examples.join(", ")}`,
    `A distinctive trait: ${f.trait}`,
    ``,
    `For current speaker counts and the status of a specific language, ask research — those shift over time.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is the world's languages and how they work — where they come from, the machinery inside them, and how to actually learn one.`,
    ``,
    `  • Where a language comes from → 'explain_family <language>' (or no arg for the map).`,
    `  • How language itself works → 'how_language_works'.`,
    `  • How to learn a language → 'learn_language'.  Common myths → 'language_myths'.`,
    ``,
    `Current speaker counts and endangered-language status shift over time — ask research for those. (The education asset covers world-language CLASSES; this asset is the linguistics.)`,
  ].join("\n");
}
