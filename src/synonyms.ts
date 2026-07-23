// Deterministic "semantic-lite" layer: a curated concept map that lets natural
// phrasing reach the canonical tag an asset actually carries. "cops"/"custody"
// → police, "stressed"/"overwhelmed" → anxiety, "leasing" → rent. This is a
// hand-built thesaurus, NOT a model — it stays offline, deterministic, and
// testable (the whole system's design principle), unlike embedding matching
// which would add a model dependency and break routing determinism.
//
// Each canonical MUST be a real tag on the asset that should win, or the
// mapping matches nothing. Surface forms are stored in already-stemmed form
// where the plural stemmer would produce it (cops→cop), plus raw where it
// won't (freezing).
//
// TWO levels, because meaning does not live in single words. A word map alone
// hits a wall the paraphrase set makes visible: the word that carries the
// meaning is often ambiguous on its own and only safe in context.
// "screening" is a job filter to jobhunt and a mammogram to healthguide;
// "country" is geography; "offer" is any proposal. Mapping those single tokens
// buys one paraphrase and pays for it with noise on every neighbouring domain.
// So single words that are safe alone go in CONCEPTS, and meaning that only
// exists as a unit goes in PHRASES ("automated screening" → ats, "another
// country" → abroad). Phrases are what makes this a semantic layer rather than
// a second pile of keywords: they encode a concept the words don't carry
// separately.

const CONCEPTS: Record<string, string[]> = {
  // lawguide 'police'
  police: ["cop", "officer", "detained", "custody", "arrested"],
  // lawguide 'sued'
  sued: ["sue", "suing"],
  // homebuyer 'rent'
  rent: ["renting", "leasing", "lease", "leased"],
  // polymath 'crash'
  crash: ["freeze", "freezing", "frozen", "hang", "hanging", "lockup", "unresponsive"],
  // healthguide 'anxiety'
  anxiety: ["anxious", "stressed", "overwhelmed", "panic"],
  // nestegg 'crypto'
  crypto: ["coin", "bitcoin"],
  // polymath 'sql' — "turn my database into a report". Unambiguously technical,
  // no cross-domain collision (unlike "screening", which health also uses).
  sql: ["database"],
  // gitforge 'commit' — the stemmer folds plurals only, so the past tense of
  // the single most common git verb never reaches the tag.
  commit: ["committed", "committing"],
  // lawguide 'legal' — the adverb is how people actually ask ("can they
  // legally do this"), and the plural-only stemmer never folds -ly.
  legal: ["legally", "lawful", "lawfully", "illegal", "illegally"],
  // overseer 'log' — same plural-only stemmer gap on the past tense.
  log: ["logged", "logging"],
  // lawguide 'tax' — the stemmer only strips a trailing "s", so "taxes" becomes
  // "taxe" and never reaches the tag. "do I owe taxes on this settlement" fell
  // through to research because of one letter.
  tax: ["taxe", "taxation"],
};

// Multi-word concepts. The KEY is the phrase as the query says it, in
// stemmed-token form joined by single spaces (see phraseGrams); the VALUE is
// the canonical tag it should reach. Length 2-4 tokens — long enough to
// disambiguate, short enough to survive rewording.
//
// The test for adding one: would mapping the single carrying word instead pull
// this asset into unrelated questions? If yes, it belongs here. Each entry is
// grouped by the asset it feeds so an operator can see, per asset, what natural
// phrasing the tags themselves do not cover.
const PHRASES: Record<string, string> = {
  // → lawguide. A tenant dispute is described by the person, never by the tag:
  // nobody types "landlord" when they mean the guy who runs their building.
  "apartment manager": "landlord",
  "property manager": "landlord",
  "building manager": "landlord",
  "security deposit": "landlord",

  // → jobhunt. "offer" and "screening" are both far too common alone.
  "an offer": "negotiate",
  "the offer": "negotiate",
  "job offer": "negotiate",
  "ask for more money": "negotiate",
  "more money": "salary",
  "automated screening": "ats",
  "screening filter": "ats",
  "applicant tracking": "ats",
  "resume screening": "ats",

  // → education. "test"/"final"/"material" are all ordinary English words; only
  // the academic phrasing around them means school.
  "prepare for a test": "exam",
  "study for a test": "exam",
  "practice test": "exam",
  "big test": "exam",
  "before final": "exam",
  "for final": "exam",
  "during final": "exam",
  "final week": "exam",
  "the material": "coursework",

  // → communication. Reading a person, stated the way people state it.
  "really thinking": "nonverbal",
  "read people": "nonverbal",
  "reading people": "nonverbal",
  "someone is lying": "deception",
  "if someone is lying": "deception",
  // what is NOT said is the whole subject of nonverbal reading
  "saying out loud": "nonverbal",
  "said out loud": "nonverbal",
  "not saying": "nonverbal",
  // addressing a room, without the word "public speaking" ever appearing
  "give a talk": "publicspeaking",
  "giving a talk": "publicspeaking",
  "in front of people": "publicspeaking",
  "in front of a crowd": "publicspeaking",
  "in front of an audience": "publicspeaking",

  // → polymath. A machine that stops responding, in the words people use for
  // it. CONCEPTS already carries the closed form 'lockup'; the two-word verb
  // is how it is actually typed.
  "lock up": "crash",
  "locking up": "crash",
  "freeze up": "crash",
  "freezing up": "crash",

  // → government. "country"/"move" alone are geography and logistics.
  "another country": "abroad",
  "move to another country": "relocate",
  "move abroad": "relocate",
  "live abroad": "relocate",
  "work permit": "workpermit",

  // → aiforge. The user-facing name for what an embedding index does.
  "similarity search": "embedding",
  "semantic search": "embedding",
  "nearest neighbor": "embedding",
};

// Non-compositional terms: phrases whose meaning is NOT the sum of their words.
// "body language" is not about language, and a "real estate agent" is not an AI
// agent — but the bare tokens 'language' and 'agent' are real tags on
// linguistics and loop, so both assets get pulled into questions that have
// nothing to do with them. Every idiom here was a measured golden-set noise
// case, not a hypothetical.
//
// Unlike PHRASES, which ADD a concept, these also CONSUME the misleading part:
// once the phrase is recognised, the token that lied about the topic is
// removed. This is the one place the layer subtracts, and it is deliberately
// narrow — consume only a word that is genuinely not the subject when the
// phrase is present.
const IDIOMS: Record<string, { canon?: string; consume: string[] }> = {
  // communication owns this via the 'bodylanguage' compound; linguistics only
  // matched because the phrase contains the word 'language'.
  "body language": { canon: "nonverbal", consume: ["language"] },
  // a realtor, not an agentic AI loop.
  "real estate agent": { canon: "realtor", consume: ["agent"] },
  "real estate broker": { canon: "realtor", consume: ["broker"] },
  // a named vendor product, not the generic subject of API engineering — the
  // bare 'api' tag pulled apiforge into every OpenAI-platform question.
  "response api": { canon: "responsesapi", consume: ["api"] },
  // the department a bot answers for, not polymath's 'support' specialty.
  "customer support": { consume: ["support"] },
  "customer service": { consume: ["support", "service"] },
  // A programming loop, not the agentic-AI 'loop' asset. `loop` is loop's tag
  // per AGENTS.md, so ordinary code questions ("how do I write a for loop in
  // python") were landing on the agent-architecture specialist.
  "for loop": { consume: ["loop"] },
  "while loop": { consume: ["loop"] },
  "nested loop": { consume: ["loop"] },
  "infinite loop": { consume: ["loop"] },
  // React.js, not the ReAct agent pattern — two different things one letter of
  // capitalisation apart, which tokenizing destroys. loop keeps the bare
  // `react` tag (its ReAct pattern is almost always written "ReAct pattern" or
  // "ReAct agent"); the front-end senses are named explicitly here.
  "react hook": { canon: "reactjs", consume: ["react"] },
  "react component": { canon: "reactjs", consume: ["react"] },
  "react app": { canon: "reactjs", consume: ["react"] },
  "react state": { canon: "reactjs", consume: ["react"] },
};

/**
 * The plural fold, shared with router.ts. It lives HERE, not there, because
 * both the query tokens and this file's canonical forms have to go through the
 * identical transform or they silently fail to meet.
 *
 * That is not hypothetical: the canon `reactjs` was added to the query set
 * unstemmed while the asset's `reactjs` TAG was stemmed to `reactj`, so an
 * idiom that fired perfectly still matched nothing. Any canon ending in "s"
 * had the same latent bug. Stemming canons at load closes the whole class.
 *
 * Only a trailing "s" on words >3 chars, never "ss" (address, access).
 */
export function stem(w: string): string {
  return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}

const SURFACE_TO_CANON = new Map<string, string>();
for (const [canon, surfaces] of Object.entries(CONCEPTS)) {
  for (const s of surfaces) SURFACE_TO_CANON.set(s, canon);
}

const PHRASE_MAX_LEN = Math.max(
  ...[...Object.keys(PHRASES), ...Object.keys(IDIOMS)].map((p) => p.split(" ").length)
);

/** Every 2..PHRASE_MAX_LEN token window of the query, as space-joined strings.
 * Built over the FULL token sequence including stopwords — "an offer" and
 * "move to another country" only exist with their glue words intact. */
function phraseGrams(sequence: string[]): string[] {
  const grams: string[] = [];
  for (let i = 0; i < sequence.length; i++) {
    for (let n = 2; n <= PHRASE_MAX_LEN; n++) {
      if (i + n > sequence.length) break;
      grams.push(sequence.slice(i, i + n).join(" "));
    }
  }
  return grams;
}

/**
 * Expand a query's tokens with the canonical concept for any colloquial
 * surface form present. Query-side only: asset tags are already canonical.
 *
 * @param tokens    content tokens (stopwords dropped, stemmed) — the scoring set
 * @param sequence  the full stemmed token sequence *including* stopwords, in
 *                  order. Phrase lookup needs it; omit it and only the
 *                  single-word map applies.
 */
export function expandConcepts(tokens: Iterable<string>, sequence: string[] = []): Set<string> {
  const out = new Set(tokens);
  for (const t of tokens) {
    const canon = SURFACE_TO_CANON.get(t);
    if (canon) out.add(stem(canon));
  }
  const grams = phraseGrams(sequence);
  for (const gram of grams) {
    const canon = PHRASES[gram];
    if (canon) out.add(stem(canon));
  }
  // Idioms last: a consumed token must not survive because some other rule
  // added it back.
  for (const gram of grams) {
    const idiom = IDIOMS[gram];
    if (!idiom) continue;
    if (idiom.canon) out.add(stem(idiom.canon));
    for (const token of idiom.consume) out.delete(token);
  }
  return out;
}
