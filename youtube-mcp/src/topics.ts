// Topic taxonomy for youtube_analyze_topics. Deterministic, offline, no keys.
//
// This answers "what are they watching the most" by clustering the titles, tags
// and descriptions of a fetched result set. It is keyword matching, not
// classification, and the tool says so in its output — a video titled "I tried
// the WORST budget GPU" lands in tech_review because of "gpu", which is right,
// while an ironic or metaphorical title will land wrong and nothing here can
// tell. The honest framing is: this measures the VOCABULARY of a result set, and
// vocabulary is strong evidence about subject matter but is not the subject
// matter itself.
//
// AGENTS.md: no key may appear in two entries (regression asserts it), and the
// reverse index resolves longest-key-first so "car review" beats "review".

export interface TopicEntry {
  label: string;
  keys: string[];
  /** What a viewer of this cluster is usually there to get — the "what matters" read. */
  viewerIntent: string;
}

export const TOPICS: Record<string, TopicEntry> = {
  gaming: {
    label: "Gaming",
    keys: [
      "gameplay", "walkthrough", "speedrun", "lets play", "letsplay", "fortnite", "minecraft",
      "roblox", "valorant", "esports", "playthrough", "boss fight", "no commentary",
      "patch notes", "loadout", "ranked grind",
    ],
    viewerIntent: "Vicarious play and mastery — they want to watch someone good, or learn to get good, at a specific title. Loyalty attaches to the game as much as to the creator, so a game's decline takes the audience with it.",
  },
  tutorial_howto: {
    label: "Tutorial / how-to",
    keys: ["tutorial", "how to", "howto", "step by step", "beginners guide", "explained simply", "walk you through", "for dummies", "crash course"],
    viewerIntent: "A specific unfinished task. They arrived from search with a problem and will leave the moment it is solved — retention is capped by usefulness, and that is fine.",
  },
  tech_review: {
    label: "Tech review / comparison",
    keys: ["unboxing", "review", "benchmark", "teardown", "hands on", "vs", "versus", "gpu", "cpu", "laptop", "iphone", "android phone", "worth it in"],
    viewerIntent: "A purchase decision they have not made yet. High commercial intent, low tolerance for padding, and they will scrub straight to the verdict.",
  },
  ai_software: {
    label: "AI / software engineering",
    keys: ["machine learning", "llm", "neural network", "coding", "programming", "python", "javascript", "devops", "prompt engineering", "api integration", "open source", "self hosted", "agentic"],
    viewerIntent: "Capability they can apply this week. They are evaluating whether your approach is real, and the comment section is where they check each other's claims.",
  },
  finance_money: {
    label: "Money / investing",
    keys: ["investing", "stocks", "crypto", "bitcoin", "portfolio", "dividend", "budgeting", "retirement", "index fund", "side hustle", "net worth", "recession"],
    viewerIntent: "Anxiety and aspiration in the same breath. Trust is the product; a single wrong confident call costs more than ten cautious ones.",
  },
  fitness_health: {
    label: "Fitness / health",
    keys: ["workout", "gym", "fitness", "diet", "nutrition", "weight loss", "calisthenics", "hypertrophy", "mobility routine", "meal prep"],
    viewerIntent: "A body outcome on a timeline. They want proof it worked for someone like them, which is why before/after framing outperforms instruction.",
  },
  beauty_fashion: {
    label: "Beauty / fashion",
    keys: ["makeup", "skincare", "haul", "outfit", "grwm", "get ready with me", "hairstyle", "nail art", "capsule wardrobe"],
    viewerIntent: "Identity assembly plus a shopping list. Parasocial closeness drives conversion more than expertise does.",
  },
  food_cooking: {
    label: "Food / cooking",
    keys: ["recipe", "cooking", "baking", "mukbang", "restaurant", "kitchen", "taste test", "street food"],
    viewerIntent: "Either to cook it tonight or to watch it and not cook at all — two audiences on one video, and they want opposite pacing.",
  },
  music: {
    label: "Music",
    // The original key set covered POP/RELEASE vocabulary only ("official
    // video", "remix", "lyrics") and matched almost nothing in instrumental
    // music. Measured 2026-08-05 on a real "piano instrumental composition"
    // scan: 16 of 18 videos matched NO cluster, and the 2 that did matched on
    // incidental words ("lyrics" from a tag, "how to" from a title) rather than
    // subject matter. Titles like "500 Most Famous Beautiful Piano Melodies",
    // "Relaxing Piano Instrumental", "Hans Zimmer Iconic Soundtracks" and
    // "Piano Solo" have no overlap with release vocabulary at all.
    //
    // The tool reported the 16/18 unmatched residue honestly, which is what
    // made the gap visible — but an 89% miss rate makes the cluster shares
    // meaningless, so the honest reporting was carrying the whole design.
    keys: [
      "official video", "official audio", "cover of", "remix", "lyrics", "full album",
      "live concert", "guitar solo", "piano tutorial",
      // instrumental / composition vocabulary
      "instrumental", "piano solo", "piano melodies", "relaxing piano", "piano music",
      "soundtrack", "backing track", "sheet music", "nocturne", "orchestral",
      "symphony", "composer", "chord progression", "improvisation",
    ],
    viewerIntent: "Repeat listening. Watch time comes from replays and background play, so discovery metrics badly understate value — and for instrumental work especially, the video is often never looked at.",
  },
  education_academic: {
    label: "Education / academic",
    keys: ["lecture", "exam", "homework", "revision", "study with me", "past paper", "thesis", "semester"],
    viewerIntent: "A graded deadline. Highly seasonal — demand spikes to exam calendars, not to your upload schedule.",
  },
  kids_family: {
    label: "Kids / family",
    keys: ["nursery rhyme", "toddler", "cartoon for kids", "toy review", "bedtime story", "kids songs"],
    viewerIntent: "A parent buying twenty quiet minutes. Legally distinct territory: made-for-kids status disables personalised ads and comments.",
  },
  vlog_lifestyle: {
    label: "Vlog / lifestyle",
    keys: ["vlog", "day in my life", "morning routine", "apartment tour", "moving to", "week in my life"],
    viewerIntent: "Company and continuity. They are subscribing to a person, so consistency beats production value and a format change reads as abandonment.",
  },
  true_crime: {
    label: "True crime",
    keys: ["true crime", "unsolved", "cold case", "disappearance of", "the murder of", "case files"],
    viewerIntent: "Narrative resolution and safety rehearsal. Enormous watch time, real ethical exposure, and demonetisation risk on the exact details that drive retention.",
  },
  reaction_commentary: {
    label: "Reaction / commentary",
    keys: ["reaction", "reacting to", "commentary", "tier list", "ranking every", "drama explained", "responds to"],
    viewerIntent: "A take to agree or argue with. Cheap to produce, structurally dependent on someone else's work, and the copyright exposure is real.",
  },
  sports: {
    label: "Sports",
    keys: ["highlights", "match day", "full game", "boxing", "ufc", "formula 1", "post game"],
    viewerIntent: "Event-locked and perishable. Value collapses within days, and rights-holder takedowns are the main operational risk.",
  },
  cars_auto: {
    label: "Cars / automotive",
    keys: ["car review", "engine swap", "restoration project", "detailing", "test drive", "first drive", "project car"],
    viewerIntent: "Ownership fantasy or a repair they are mid-way through — two very different videos, and the comments will tell you which showed up.",
  },
  home_diy: {
    label: "Home / DIY",
    keys: ["diy", "renovation", "woodworking", "plumbing", "gardening", "home improvement", "workshop build"],
    viewerIntent: "A half-finished job and a hardware-store trip pending. They will pause constantly, so step clarity beats narrative.",
  },
  faith_spiritual: {
    label: "Faith / spiritual",
    keys: ["sermon", "worship", "bible study", "prayer", "guided meditation", "devotional"],
    viewerIntent: "Practice and belonging rather than information. Community depth matters far more than reach.",
  },
  asmr_relax: {
    label: "ASMR / sleep / ambience",
    keys: ["asmr", "whisper", "rain sounds", "lofi", "sleep sounds", "ambience", "white noise"],
    viewerIntent: "A physiological effect, usually at night with the screen off. Enormous average view duration, near-zero engagement, and both are correct.",
  },
  comedy_entertainment: {
    label: "Comedy / entertainment",
    keys: ["sketch", "stand up", "prank", "parody", "try not to laugh", "impressions"],
    viewerIntent: "A mood change in under a minute. Shareability is the whole metric; retention curves look broken and it does not matter.",
  },
  news_politics: {
    label: "News / politics",
    keys: ["breaking news", "election", "geopolitics", "press conference", "policy explained", "what happened in"],
    viewerIntent: "Orientation during uncertainty. Perishable, advertiser-sensitive, and the cohort that shows up is unusually likely to be checking you against another source.",
  },
};

/** Longest-key-first index. Returns undefined for unknown input, never null. */
export function resolveTopic(input: string): TopicEntry | undefined {
  const q = String(input ?? "").trim().toLowerCase();
  if (!q) return undefined;
  if (TOPICS[q]) return TOPICS[q];
  for (const [id, e] of Object.entries(TOPICS)) {
    if (id === q || e.label.toLowerCase() === q) return e;
  }
  let best: TopicEntry | undefined;
  let bestLen = 0;
  for (const e of Object.values(TOPICS)) {
    for (const k of e.keys) {
      if ((k === q || q.includes(k)) && k.length > bestLen) {
        best = e;
        bestLen = k.length;
      }
    }
  }
  return best;
}

export interface TopicScore {
  id: string;
  label: string;
  /** How many items in the corpus matched this cluster. */
  hits: number;
  /** Share of matched items (not of the corpus — unmatched items are reported separately). */
  share: number;
  /** The keys that actually fired, so the caller can audit the classification. */
  matchedKeys: string[];
  viewerIntent: string;
}

export interface TopicDistribution {
  scored: TopicScore[];
  corpusSize: number;
  matchedCount: number;
  unmatchedCount: number;
  /** Titles nothing matched — the honest residue, and often the interesting part. */
  unmatchedSamples: string[];
}

/**
 * Cluster a corpus of text (titles + tags) into topics.
 *
 * Each item is assigned to AT MOST ONE cluster — its longest matching key — so
 * shares sum to 1 over matched items. Multi-assignment was the first version and
 * it produced shares summing to 180%, which reads as nonsense and hides the
 * unmatched residue.
 */
export function distribution(items: string[]): TopicDistribution {
  const tally = new Map<string, { hits: number; keys: Set<string> }>();
  const unmatched: string[] = [];

  for (const raw of items) {
    const text = String(raw ?? "").toLowerCase();
    if (!text.trim()) continue;
    let bestId: string | undefined;
    let bestKey = "";
    for (const [id, e] of Object.entries(TOPICS)) {
      for (const k of e.keys) {
        if (text.includes(k) && k.length > bestKey.length) {
          bestId = id;
          bestKey = k;
        }
      }
    }
    if (!bestId) {
      unmatched.push(raw);
      continue;
    }
    const cur = tally.get(bestId) ?? { hits: 0, keys: new Set<string>() };
    cur.hits += 1;
    cur.keys.add(bestKey);
    tally.set(bestId, cur);
  }

  const matchedCount = [...tally.values()].reduce((a, b) => a + b.hits, 0);
  const scored: TopicScore[] = [...tally.entries()]
    .map(([id, v]) => ({
      id,
      label: TOPICS[id].label,
      hits: v.hits,
      share: matchedCount ? v.hits / matchedCount : 0,
      matchedKeys: [...v.keys].sort(),
      viewerIntent: TOPICS[id].viewerIntent,
    }))
    .sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label));

  return {
    scored,
    corpusSize: items.length,
    matchedCount,
    unmatchedCount: unmatched.length,
    unmatchedSamples: unmatched.slice(0, 8),
  };
}
