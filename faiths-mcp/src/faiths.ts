// The world's major faiths, described from the outside, evenhandedly and with
// respect. Bottom-line first. This asset EXPLAINS traditions — it never
// proselytizes, ranks them, or tells anyone what's 'true'.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export interface Faith {
  label: string;
  keys: string[];
  origin: string;
  core_belief: string;
  practices: string;
  texts: string;
  branches: string;
}

export const FAITHS: Record<string, Faith> = {
  christianity: {
    label: "Christianity",
    keys: ["christianity", "christian", "christ", "jesus", "catholic", "protestant", "orthodox", "bible", "gospel", "church"],
    origin: "1st century CE in the Roman province of Judea, from the life and teachings of Jesus of Nazareth. Grew out of Judaism.",
    core_belief: "One God; Jesus is the Son of God whose death and resurrection offer salvation; love of God and neighbor is central.",
    practices: "Prayer, worship (often Sunday), baptism, communion/Eucharist, reading scripture, and holidays like Christmas and Easter.",
    texts: "The Bible — the Old Testament (shared roots with Judaism) and the New Testament (the Gospels and letters).",
    branches: "Catholic, Eastern Orthodox, and Protestant (itself thousands of denominations). The world's largest religion.",
  },
  islam: {
    label: "Islam",
    keys: ["islam", "muslim", "muhammad", "quran", "koran", "allah", "mosque", "sunni", "shia", "ramadan"],
    origin: "7th century CE in Arabia, from the revelations Muslims believe the Prophet Muhammad received from God (Allah).",
    core_belief: "Strict monotheism — one God, Allah; Muhammad is the final prophet in a line including Abraham, Moses, and Jesus. Submission to God is the meaning of 'Islam'.",
    practices: "The Five Pillars: faith (shahada), prayer five times daily (salat), charity (zakat), fasting in Ramadan (sawm), and pilgrimage to Mecca (hajj).",
    texts: "The Quran (God's word as revealed to Muhammad) and the Hadith (accounts of the Prophet's sayings and life).",
    branches: "Sunni (the large majority) and Shia, plus Sufism (its mystical tradition). The world's second-largest religion.",
  },
  judaism: {
    label: "Judaism (incl. Kabbalah)",
    keys: ["judaism", "jewish", "jew", "torah", "synagogue", "kabbalah", "rabbi", "hebrew", "yahweh", "talmud"],
    origin: "Over 3,000 years old, from the ancient Israelites and the covenant they believe God made with Abraham and Moses. The oldest of the Abrahamic faiths.",
    core_belief: "One God who made a covenant with the Jewish people; living rightly through the commandments (mitzvot) matters more than doctrine about the afterlife.",
    practices: "Sabbath (Shabbat) from Friday to Saturday, dietary laws (kosher), prayer, and festivals like Passover, Yom Kippur, and Hanukkah.",
    texts: "The Torah (first five books) and the wider Tanakh, plus the Talmud (centuries of rabbinic discussion). KABBALAH is Judaism's mystical tradition — an esoteric reading of the divine, God's hidden nature, and creation (the Zohar is its central text).",
    branches: "Orthodox, Conservative, and Reform, among others. Small in number but hugely influential.",
  },
  buddhism: {
    label: "Buddhism",
    keys: ["buddhism", "buddhist", "buddha", "dharma", "nirvana", "meditation", "zen", "karma", "enlightenment"],
    origin: "5th-6th century BCE in India, from Siddhartha Gautama (the Buddha, 'the awakened one') and his path out of suffering.",
    core_belief: "The Four Noble Truths: life involves suffering, suffering comes from craving, it can end, and the Eightfold Path is the way. Often no creator-god; the goal is awakening (nirvana), freedom from the cycle of rebirth.",
    practices: "Meditation, mindfulness, ethical living, and following the Eightfold Path. Monasticism is central in many forms.",
    texts: "Many, by tradition — the Pali Canon (Theravada), Mahayana sutras, and others.",
    branches: "Theravada (Southeast Asia), Mahayana (East Asia, incl. Zen and Pure Land), and Vajrayana (Tibetan).",
  },
  hinduism: {
    label: "Hinduism",
    keys: ["hinduism", "hindu", "vishnu", "shiva", "krishna", "vedas", "yoga", "moksha", "reincarnation", "brahman"],
    origin: "The world's oldest major living religion — no single founder; it grew over 4,000+ years on the Indian subcontinent.",
    core_belief: "A vast, diverse tradition. Common threads: one ultimate reality (Brahman) behind many gods; karma (actions have consequences) and reincarnation; the goal of moksha (liberation from the cycle of rebirth).",
    practices: "Worship (puja) at home and temple, festivals (Diwali, Holi), yoga and meditation, pilgrimage, and dharma (living according to one's duty).",
    texts: "The Vedas and Upanishads (ancient), plus the beloved epics — the Bhagavad Gita, Ramayana, and Mahabharata.",
    branches: "Many traditions (Vaishnavism, Shaivism, Shaktism...) centered on different aspects of the divine. Third-largest religion.",
  },
  sikhism_others: {
    label: "Sikhism & Other Traditions",
    keys: ["sikhism", "sikh", "guru", "taoism", "tao", "shinto", "jainism", "bahai", "confucianism", "paganism", "atheism", "agnostic"],
    what: "",
    origin: "A range: Sikhism (15th-century Punjab, from Guru Nanak), plus Taoism and Confucianism (China), Shinto (Japan), Jainism (India), Bahá'í, and modern secular worldviews.",
    core_belief: "Sikhism: one God, equality of all people, honest work and service, taught by ten Gurus. The others vary widely — Taoism (living in harmony with the Tao/the Way), Confucianism (ethics and social harmony, more philosophy than religion), Shinto (kami/spirits in nature), Jainism (radical non-violence). Atheism/agnosticism: no belief, or 'we can't know'.",
    practices: "Sikhism: prayer, the gurdwara, the communal free kitchen (langar), the five articles of faith. Others have their own rites, meditation, ancestor veneration, or none.",
    texts: "Sikhism: the Guru Granth Sahib. Taoism: the Tao Te Ching. Confucianism: the Analects. Shinto: no single scripture.",
    branches: "Each is its own tradition; some (Confucianism, Taoism) blend with each other and with Buddhism in practice.",
  } as unknown as Faith,
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "").replace(/[^a-z0-9]/g, "");
}

const FAITH_INDEX: Record<string, string> = {};
for (const [key, f] of Object.entries(FAITHS)) {
  FAITH_INDEX[normalize(key)] = key;
  FAITH_INDEX[normalize(f.label)] = key;
  for (const k of f.keys) FAITH_INDEX[normalize(k)] = key;
}

export function resolveFaith(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(FAITH_INDEX, norm)) return FAITH_INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(FAITH_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

const NEUTRAL = "Described from the outside and evenhandedly — this explains what a tradition holds, it doesn't tell you what's true or ask you to believe anything.";

export function explainFaith(input?: string): string {
  if (!input) {
    return (
      `THE WORLD'S MAJOR FAITHS — what each actually believes and practices:\n\n` +
      Object.values(FAITHS).map((f) => `▸ ${f.label}: ${f.core_belief.split(".")[0]}.`).join("\n") +
      `\n\nName any faith ("Islam", "Kabbalah", "Zen", "Sikhism"). For what they share and differ on, use compare_faiths.\n${NEUTRAL}`
    );
  }
  const key = resolveFaith(input);
  if (!key) return `Not sure which tradition "${clean(input)}" is. Covered: ${Object.values(FAITHS).map((f) => f.label).join(", ")}.`;
  const f = FAITHS[key];
  return [
    `${f.label}${normalize(input) !== normalize(key) ? ` (from "${clean(input)}")` : ""}`,
    `BOTTOM LINE: ${f.core_belief}`,
    ``,
    `Origin: ${f.origin}`,
    `Practices: ${f.practices}`,
    `Texts: ${f.texts}`,
    `Branches: ${f.branches}`,
    ``,
    NEUTRAL,
  ].join("\n");
}

export function compareFaiths(): string {
  return [
    `HOW THE MAJOR FAITHS RELATE — the shared roots and the real differences`,
    ``,
    `THE ABRAHAMIC FAMILY (one God, shared roots): Judaism → Christianity → Islam all trace to Abraham and worship one God. Judaism is the oldest; Christianity grew from it (adding Jesus as divine); Islam sees itself as the final revelation in the same line. They share many figures (Abraham, Moses, Jesus is honored in Islam as a prophet) but differ on Jesus' nature and which scripture is final.`,
    ``,
    `THE DHARMIC FAMILY (India-born, karma & rebirth): Hinduism, Buddhism, Jainism, and Sikhism share the ideas of karma and a cycle of rebirth, with liberation (moksha/nirvana) as the goal. Buddhism grew as a reform within the Indian context; Sikhism blends devotional and monotheistic ideas.`,
    ``,
    `EAST ASIAN traditions (Taoism, Confucianism, Shinto) are often more about harmony, ethics, and nature than a single God, and people commonly follow more than one at once.`,
    ``,
    `THE BIG SHARED THREAD: nearly every tradition teaches some version of the Golden Rule — treat others as you'd want to be treated — and offers meaning, community, and a moral framework. Where they differ most: the nature of God (one, many, or none), what happens after death, and which texts and authorities are binding.`,
    ``,
    NEUTRAL,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this explains the world's faiths — what each actually believes and practices — evenhandedly and with respect.`,
    ``,
    `  • What a tradition believes → 'explain_faith <name>' (or no arg for the map).`,
    `  • How they relate, share, and differ → 'compare_faiths'.`,
    ``,
    `GROUND RULES: this describes faiths from the outside. It does NOT proselytize, rank them, tell you which is 'true', or give spiritual/religious direction — that's for you, your own study, and your community's teachers. For the history behind a tradition, the curiosity asset and research go deeper.`,
  ].join("\n");
}
