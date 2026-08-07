import type { AssetConfig } from "./types.js";
import { expandConceptsWithConsumed, stem } from "./synonyms.js";

export interface AssetMatch {
  name: string;
  score: number;
  matchedTags: string[];
  // True when the score rests on a tag or the asset's own name — deliberate
  // routing signal — rather than on description prose alone.
  anchored: boolean;
}

// Pure grammatical glue — filtered out so two unrelated objectives that both
// happen to contain "the"/"for"/"with" don't score a spurious match. Verbs
// like "find"/"run"/"search" are deliberately NOT here since they can be
// meaningful tags (e.g. an asset tagged "search").
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "by", "at", "from", "is", "are", "was", "were", "be", "been", "being",
  "it", "its", "this", "that", "these", "those", "as", "if", "then", "than",
  "so", "not", "no", "i", "you", "he", "she", "we", "they", "them",
  "my", "your", "our", "their",
  // Question/auxiliary words: pure grammar, never a meaningful tag match. Left
  // out originally, they leaked in and scored spurious DESCRIPTION hits (e.g.
  // "what's the tallest building" matched overseer's description on "what").
  "what", "how", "why", "who", "when", "where", "which", "whom", "whose",
  "do", "does", "did", "can", "could", "should", "would", "will", "am",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// The conservative plural fold ("migraines"/"stocks"/"cops" -> singular) now
// lives in synonyms.ts and is imported, so a canonical concept and an asset tag
// are folded by the SAME function. They were folded by different paths before:
// tags went through this stemmer while synonyms.ts added canonical forms raw,
// so any canon ending in "s" silently failed to match its own tag — the idiom
// for "react hook" fired correctly and still matched nothing, because the tag
// `reactjs` had been folded to `reactj`.

// The registry carries 67 closed-compound tags — blackhole, bodylanguage,
// custominstructions, responsesapi, mergeconflict, workvisa — that tokenize()
// can never produce, because it splits the query on every non-alphanumeric.
// "why do black holes form" yields [black, hole] and could not match
// "blackhole" no matter how the thresholds were tuned; two of the three
// long-standing golden misses were this, not a routing ceiling.
//
// Joining adjacent tokens closes it without a lookup table, so it scales with
// the language instead of with the asset count — the alternative was one
// synonym entry per compound, forever. Joins run over RAW tokens so a compound
// split by a stopword still forms, and the >= 6 floor keeps short accidental
// pairs from colliding with real short tags.
function compoundJoins(rawTokens: string[]): string[] {
  const joins: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    for (const n of [2, 3]) {
      if (i + n > rawTokens.length) break;
      const joined = rawTokens.slice(i, i + n).join("");
      if (joined.length >= 6) joins.push(stem(joined));
    }
  }
  return joins;
}

// Length >= 2 drops apostrophe fragments ("what's" -> "s", "case's" -> "s")
// that were being counted as matches; 2 is the floor so real short tags like
// "ai"/"bi" still route.
function contentTokens(text: string): string[] {
  return tokenize(text)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map(stem);
}

// Tags are the deliberate routing signal an operator supplied, so a tag hit
// counts for more than an incidental word match in the free-text name or
// description.
const TAG_WEIGHT = 3;
const NAME_WEIGHT = 2;
const DESCRIPTION_WEIGHT = 1;

// Each distinct description word counts ONCE. Counting with repetition meant a
// 249-word description scored on how often it repeated a common word — that
// measures length, not relevance, and it dragged unrelated questions onto the
// wordiest asset. AGENTS.md warns authors about this; the parser should not
// depend on every author remembering. The other half of the rule — prose can
// corroborate a match but never create one — is enforced in selectAssets,
// where it does not disturb any score.

// The asset side of scoring is STATIC between calls — only the query changes —
// yet matchAssets used to re-tokenize every asset's name, description, and all
// ~34 tags on every single route (~780 contentTokens() calls per call for 22
// assets). This memoizes that per-asset token index, keyed on a signature of
// exactly the fields that are scored, so an edited description or tag naturally
// gets a new key and a fresh index. Purity is preserved: the cache is a
// function of the asset's own content, nothing else.
interface AssetTokenIndex {
  nameTokens: string[]; // dupes preserved — each hit adds NAME_WEIGHT, as before
  descTokens: string[]; // distinct — description scores once per unique token
  tagTokens: string[]; // flattened across tags, dupes preserved (per-occurrence score)
}
const assetIndexCache = new Map<string, AssetTokenIndex>();

function indexAsset(asset: AssetConfig): AssetTokenIndex {
  const sig = `${asset.name}\u0000${asset.description}\u0000${asset.tags.join("\u0001")}`;
  const hit = assetIndexCache.get(sig);
  if (hit) return hit;
  const idx: AssetTokenIndex = {
    nameTokens: contentTokens(asset.name),
    descTokens: [...new Set(contentTokens(asset.description))],
    tagTokens: asset.tags.flatMap((t) => contentTokens(t)),
  };
  assetIndexCache.set(sig, idx);
  return idx;
}

/**
 * Scores active assets against an objective by overlapping tokens between
 * the objective text and each asset's name/description/tags. Tag matches
 * are surfaced separately so callers can explain why an asset was picked.
 */
export function matchAssets(objective: string, assets: AssetConfig[]): AssetMatch[] {
  // Expand only the QUERY with concept synonyms (asset tags are already
  // canonical). "cops took me into custody" gains "police"; the asset's
  // 'police' tag then matches. The second argument is the full ordered
  // sequence WITH stopwords — multi-word concepts ("an offer", "move to
  // another country") only exist with their glue words in place, so they
  // cannot be recovered from the filtered content tokens.
  const sequence = tokenize(objective).map(stem);
  const { tokens: objectiveTokens, consumed } = expandConceptsWithConsumed(
    contentTokens(objective),
    sequence
  );
  // A compound join must never resurrect a token an idiom deliberately consumed.
  // The joins are computed HERE, after expandConcepts has already run its
  // subtraction, so without this filter the two rules fight and the join wins.
  // "Tesla's Q2 profit" is the case that exposed it: the idiom consumes `tesla`
  // (the CAR COMPANY is nestegg's, the INVENTOR is curiosity's), and then
  // "tesla"+"s" joins to "teslas", stems back to `tesla`, and curiosity scores
  // anyway. Every consume-idiom followed by a possessive had the same hole.
  for (const joined of compoundJoins(tokenize(objective))) {
    if (!consumed.has(joined)) objectiveTokens.add(joined);
  }
  const candidates = assets.filter((a) => a.status === "active");

  const scored: AssetMatch[] = candidates.map((asset) => {
    const idx = indexAsset(asset);
    const matchedTags = new Set<string>();
    let score = 0;
    let nameHits = 0;

    for (const token of idx.nameTokens) {
      if (objectiveTokens.has(token)) {
        score += NAME_WEIGHT;
        nameHits++;
      }
    }
    let descriptionHits = 0;
    for (const token of idx.descTokens) {
      if (objectiveTokens.has(token)) descriptionHits++;
    }
    score += descriptionHits * DESCRIPTION_WEIGHT;
    for (const token of idx.tagTokens) {
      if (objectiveTokens.has(token)) {
        score += TAG_WEIGHT;
        matchedTags.add(token);
      }
    }

    return {
      name: asset.name,
      score,
      matchedTags: [...matchedTags],
      anchored: matchedTags.size > 0 || nameHits > 0,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

// Interrogatives / question shapes. A plain-language question ("what is X",
// "how do I Y") often shares no literal tokens with any asset's tags, so we
// detect the intent itself and let fallback assets field it.
const QUESTION_LEADERS = new Set([
  "what", "why", "how", "who", "when", "where", "which", "whom", "whose",
  "is", "are", "was", "were", "do", "does", "did", "can", "could", "should",
  "would", "will", "explain", "find", "research", "tell", "describe", "compare",
]);

export function looksLikeQuestion(objective: string): boolean {
  const trimmed = objective.trim();
  if (trimmed.endsWith("?")) return true;
  const first = tokenize(trimmed)[0];
  return first !== undefined && QUESTION_LEADERS.has(first);
}

export function fallbackAssets(assets: AssetConfig[]): AssetConfig[] {
  return assets.filter((a) => a.status === "active" && a.fallback);
}

// Words that mean "this answer has a shelf life". Every asset in this system is
// deterministic and offline by design, so on these questions the specialist is
// the LEAST reliable source in the building — it is answering from a map
// someone wrote months ago. Deliberately narrow: a verb like "compare" or
// "explain" does not belong here, because it says nothing about freshness.
// Each exclusion below was a measured false positive, not caution:
//   "change"/"changed" — caught "did the routing change over time", an
//        overseer question about this system's OWN case log. Nothing to verify
//        on the web.
//   "rate" (singular)  — caught "how do I handle rate limiting", a technique.
//        The plural "rates" stays: that is how prices are asked about
//        ("what are mortgage rates right now").
//   "version"/"release" — would catch "version control" (gitforge).
//   "check"/"still"    — too generic to mean freshness on their own.
const FRESHNESS_SIGNALS = new Set([
  "current", "currently", "latest", "newest", "today", "now", "recent", "recently",
  "verify", "up-to-date", "updated",
  "price", "prices", "pricing", "cost", "costs", "rates", "news",
  "deprecated",
  "2024", "2025", "2026", "2027",
]);

// Explicit requests to go and look something up. The real case log is full of
// objectives that literally begin "Research property at…" or "Look up…" and
// still did not get the research asset, because a NAME match scores 2 against a
// floor of 3 — the one asset being asked for by name was the one filtered out.
// 25 of the 40 real-traffic misses were a missing `research`, by far the
// largest single cause.
const LOOKUP_SIGNALS = new Set([
  "research", "investigate", "sources", "source", "cite", "citations",
  "lookup", "docs", "documentation", "official",
]);

// Two-word asks that no single token captures.
const LOOKUP_PHRASES = ["look up", "find out", "dig into", "look into", "search for"];

/**
 * Should a live-lookup asset accompany the specialists? True when the objective
 * either asks about something that MOVES (a price, a version, a deprecation) or
 * explicitly asks for something to be looked up. Matched on RAW tokens (not the
 * stemmed content set) so the words mean what they say.
 */
export function needsFreshFacts(objective: string): boolean {
  const tokens = tokenize(objective);
  for (const token of tokens) {
    if (FRESHNESS_SIGNALS.has(token) || LOOKUP_SIGNALS.has(token)) return true;
  }
  const joined = tokens.join(" ");
  return LOOKUP_PHRASES.some((p) => joined.includes(p));
}

// Objective-SHAPE signals for the live-lookup verifier, complementary to the
// keyword signals above. The largest real-traffic miss class is LONG, messy
// objectives that plainly need looking up — "Vet Sekai (Series A startup) as a
// customer", "Evaluate John's fit against three LinkedIn postings" — but carry
// no freshness/lookup KEYWORD, so needsFreshFacts never fired on them.
//
// Gated on LENGTH first, and that is the whole safety argument: golden
// questions top out at 14 words, so requiring >= 15 means this can only ever
// fire on long real objectives and CANNOT add a verifier to a golden question —
// clean-hit is protected by construction, not by luck. Within a long objective,
// any one shape signal is enough. Like needsFreshFacts, this only ever ADDS a
// fallback verifier alongside the chosen specialists; it can never displace one
// or change which specialist is primary.
// Imperative lead verbs that mean "go find things out about the thing named
// next" — the shape of a diligence/evaluation objective.
const RESEARCH_LEAD_VERBS = new Set([
  "vet", "evaluate", "assess", "analyze", "analyse", "appraise",
  "audit", "diligence", "scrutinize", "profile",
]);
// A bare host like "sekai.com" or a full URL — a named thing to go look at.
const URL_LIKE = /https?:\/\/|www\.|\b[a-z0-9][a-z0-9-]*\.(com|org|net|io|gov|ai|co|dev|app)\b/i;
// A run of two or more Capitalised words — "Series A", "John Tapia", "LinkedIn
// postings", "Sekai Inc". Named entities are the thing that has to be looked up,
// and a long objective that names several of them is almost always a research
// job. Only meaningful because of the >= 15-word gate: over short questions this
// would fire on ordinary sentence-initial capitals; over a long objective a
// multi-word proper-noun run is a real signal.
const PROPER_NOUN_RUN = /\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)+/;

export function needsResearchShape(objective: string): boolean {
  const words = objective.trim().split(/\s+/);
  if (words.length < 15) return false; // golden max is 14 — never touches it
  const first = (words[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (RESEARCH_LEAD_VERBS.has(first)) return true;
  if (URL_LIKE.test(objective)) return true;
  if (/\bagainst\b/i.test(objective)) return true; // "score / evaluate X against Y"
  if (PROPER_NOUN_RUN.test(objective)) return true;
  return false;
}

// A CLAIM-CHECK objective — "is it true", "actually backed by science", "debunk"
// — is the textbook maker-can't-verify-itself case: the specialist that owns the
// domain (healthguide, curiosity) answers from a fixed map, so an INDEPENDENT
// checker belongs alongside it. Same design as the golden VERIFIER label on
// rent-vs-buy / deprecation / pricing. Narrow phrases only, matched on the
// stopword-preserving token stream, so a passing mention of "true" can't fire it.
// Only ADDS the fallback verifier; never displaces a specialist.
const CLAIM_CHECK_PHRASES = [
  "is it true", "is it safe", "is it real", "is this true", "is that true",
  "actually true", "really true", "actually backed", "backed by science",
  "backed by evidence", "fact check", "debunk", "a myth", "any truth to",
  "is there any truth", "scientifically proven",
];

export function needsClaimCheck(objective: string): boolean {
  const joined = tokenize(objective).join(" ");
  return CLAIM_CHECK_PHRASES.some((p) => joined.includes(p));
}

// "Word this message for me" — the largest real-traffic miss class after
// research, and structurally the SAME problem the research verifier solved.
//
// 12 of 41 caselog misses were one shape: draft/reply/reword a message to a
// real-estate agent. The synonym layer now reaches communication's `rapport`
// tag on these, but that only scores 4 against homebuyer's 10, so the
// secondaryRatio bar (0.6 x 10 = 6) dropped it every time. Vocabulary alone
// cannot fix it: the CONTENT of these objectives is genuinely real estate, so
// homebuyer SHOULD lead. The wording specialist has to ride along past the
// ratio bar, which is exactly what fallbackAssets does for research.
//
// Deliberately NOT modelled as a fallback asset: fallbacks also fire on the
// "nothing matched at all" branch, and communication is not a sane catch-all.
// Co-assignment is the narrower mechanism — it only ever ADDS, and only when
// the objective literally asks for something to be written or reworded.
const WORDING_ASSET = "communication";

// Verbs that mean "produce or fix the wording", not "decide the substance".
// `interpret` is deliberately absent: reading a reply is analysis, and it was
// the one case in the 12 where communication was arguably the wrong label.
const WORDING_VERBS = new Set([
  "draft", "rewrite", "reword", "compose", "respond", "reply", "phrase", "rephrase",
  // "word" as a verb ("help me word a message to my boss") — the objective that
  // exposed the gap. It fell through to research with no wording help at all.
  // Safe in lead position too: an imperative "word this better" is a wording
  // task and nothing else.
  "word",
]);

// Verbs that mean "produce the wording" ONLY when a message noun is present.
// `write` and `send` cannot join WORDING_VERBS above, because that set also
// fires on lead position alone — and "write me a SQL query" or "send the
// request" would then pull the communication specialist onto engineering work.
// Paired with an explicit message noun they are unambiguous ("write an email").
const WORDING_VERBS_NEEDING_NOUN = new Set(["write", "send"]);

// The thing being worded, split by how much weight each noun can carry ALONE.
//
// STRONG nouns can open an objective and settle its intent by themselves —
// "Message to the buyer's agent: …" is unambiguously a thing to be written.
// WEAK nouns cannot: `voice`, `tone` and `text` are ordinary words that appear
// all over an engineering case log, and treating them as lead nouns fired this
// predicate on "what voice options does the text to speech api support" — a
// false positive caught by probe.mjs before it shipped, which is the reason the
// two tiers exist. Weak nouns count only when a wording VERB is also present.
// `response` was STRONG and should never have been: it is an HTTP response to
// half this registry and openai's own tag besides, so it made "write a function
// that returns the response body" and "send the response back to the client" into
// wording tasks. It is the most overloaded word here. Demoted to WEAK, where it
// still works with a real wording verb ("reply to his response") but cannot
// carry an objective on its own.
const STRONG_MESSAGE_NOUNS = new Set([
  "message", "reply", "email", "note", "letter",
]);
const WEAK_MESSAGE_NOUNS = new Set(["text", "voice", "tone", "wording", "response"]);
const MESSAGE_NOUNS = new Set([...STRONG_MESSAGE_NOUNS, ...WEAK_MESSAGE_NOUNS]);

/**
 * Should the communication specialist ride along? True when the objective names
 * a thing to be written AND either asks for it to be written/reworded, or leads
 * with the message itself ("Final message to the buyer's agent: …").
 *
 * Requiring BOTH halves is what keeps it narrow: "text" and "voice" and "note"
 * are ordinary words, and every one of them appears in unrelated objectives —
 * but "draft a text", "rewrite the message" and a message-led objective are not
 * ambiguous. Only ever ADDS; it can never displace a specialist or change which
 * one leads.
 */
export function needsWordingHelp(objective: string): boolean {
  const tokens = tokenize(objective);
  const hasVerb = tokens.some((t) => WORDING_VERBS.has(t));
  // Verb + object: "draft a text", "rewrite the message in his own voice".
  // / are ordinary engineering verbs, so they need a STRONG noun —
  // "write an email" is a wording task, "write text to a file" and "write a unit
  // test for the voice cloning endpoint" are not. Only the real wording verbs
  // (draft/reword/rephrase/word/…) may be satisfied by a WEAK noun.
  const hasNounOnlyVerb = tokens.some((t) => WORDING_VERBS_NEEDING_NOUN.has(t));
  if (hasVerb && tokens.some((t) => MESSAGE_NOUNS.has(t))) return true;
  if (hasNounOnlyVerb && tokens.some((t) => STRONG_MESSAGE_NOUNS.has(t))) return true;
  const lead = tokens.slice(0, 3);
  // A wording verb in imperative position makes the WHOLE objective a wording
  // task, even with no noun for it to act on — "Help John respond professionally
  // to his agent" names no message but is entirely about how to say it.
  if (lead.some((t) => WORDING_VERBS.has(t))) return true;
  // "Final message to the buyer's agent…" — no verb, a strong noun leads instead.
  return lead.some((t) => STRONG_MESSAGE_NOUNS.has(t));
}

export interface AssetSelection {
  assigned: string[];
  rationale: string;
}

export interface RoutingThresholds {
  // Minimum score to be considered at all. A tag hit scores 3, so the default
  // of 3 means "at least one deliberate tag match"; a stray description word
  // (1-2) is filtered out.
  floor: number;
  // A secondary asset joins only if its score is at least this fraction of the
  // top match's — 0.6 means "at least three-fifths as strong as the leader".
  secondaryRatio: number;
}

// 0.5 was set when the registry was much smaller and was never defended in
// code or docs; at 21 assets it let a half-strength match ride along on most
// questions. Tightening to 0.6 costs no primary hits and no paraphrase
// accuracy, and buys back a large share of the noise. Note this raises the bar
// — AGENTS.md forbids LOWERING a threshold to make routing look better.
// 0.7 was measured too: it buys 3 more clean-hits (90 vs 87) at no cost to
// primary-hit, and golden.mjs's sweep therefore recommends it. It also turns
// one paraphrase HARD miss into two — a rephrasing routed to the wrong
// specialist. A harmless extra asset is not worth a confidently wrong one, so
// 0.6 stands. This is the tradeoff the sweep cannot see; see the caveat it
// prints alongside its recommendation.
export const DEFAULT_THRESHOLDS: RoutingThresholds = { floor: 3, secondaryRatio: 0.6 };

/**
 * The full auto-routing decision for an objective, as a pure function so it
 * can be unit-tested without opening (and writing) a real case. Encapsulates
 * the confidence floor, the "competitive secondary" rule, and the fallback to
 * first-line responders. index.ts's open_case handler is a thin wrapper on
 * this. Thresholds are injectable so the golden-set harness can sweep them;
 * the defaults are the production values.
 */
export function selectAssets(
  objective: string,
  assets: AssetConfig[],
  thresholds: RoutingThresholds = DEFAULT_THRESHOLDS
): AssetSelection {
  const scored = matchAssets(objective, assets).filter((m) => m.score >= thresholds.floor);
  // Description prose corroborates a match; it must not create one. A
  // long description alone used to clear the floor — "how do I quantize an
  // open model to run it locally" pulled in openai on prose overlap with no
  // tag hit at all — which made routing a function of how much an author
  // wrote, not of what they claimed. So once ANY asset matched on deliberate
  // signal (tag or name), prose-only candidates are dropped.
  //
  // Only "once any asset is anchored": if nothing anchored, the prose match is
  // the best evidence available and still beats falling through to research.
  //
  // Capping the description's contribution instead was tried and measured
  // WORSE (clean-hit 91% -> 89%): it lowers the leader's score too, which
  // lowers the secondaryRatio bar and lets MORE riders qualify. Filtering
  // candidates leaves every score — and therefore the bar — untouched.
  const anchored = scored.filter((m) => m.anchored);
  const matches = anchored.length > 0 ? anchored : scored;
  const confident = matches.filter((m) => m.score >= matches[0].score * thresholds.secondaryRatio);
  if (confident.length > 0) {
    const specialists = confident.slice(0, 3).map((m) => m.name);
    const rationale = confident
      .slice(0, 3)
      .map((m) => `${m.name} (score ${m.score}${m.matchedTags.length ? `, tags: ${m.matchedTags.join(", ")}` : ""})`)
      .join("; ");

    // Fallback assets could ONLY ever fire when nothing matched, so `research`
    // — the asset the orchestrator's own instructions call "the independent
    // checker", in a protocol that says never let the maker verify itself —
    // was structurally unable to accompany a specialist. The case log shows the
    // operator working around that by hand: 42% of real cases used research
    // anyway, and most of the routing misses were "research alone was missing".
    //
    // It is NOT added to everything, which would just be noise. It joins only
    // when the objective asks about something that MOVES — a current price, the
    // latest version, whether a thing is still true — because that is exactly
    // when a deterministic offline specialist is most confidently out of date.
    // The wording specialist rides along on "draft/reword this message"
    // objectives. Same ADD-only contract as the verifiers below, and applied
    // before them so a drafting objective that ALSO needs fresh facts gets both.
    const coAssigned: string[] = [];
    if (
      needsWordingHelp(objective) &&
      !specialists.includes(WORDING_ASSET) &&
      assets.some((a) => a.name === WORDING_ASSET && a.status === "active")
    ) {
      coAssigned.push(WORDING_ASSET);
    }
    const withCo = [...specialists, ...coAssigned];
    const coWhy = coAssigned.length
      ? `; + ${coAssigned.join(", ")} (objective asks for a message to be written or reworded)`
      : "";

    const verifiers = fallbackAssets(assets)
      .map((a) => a.name)
      .filter((name) => !withCo.includes(name));
    if (
      verifiers.length > 0 &&
      (needsFreshFacts(objective) || needsResearchShape(objective) || needsClaimCheck(objective))
    ) {
      return {
        assigned: [...withCo, ...verifiers],
        rationale: `${rationale}${coWhy}; + ${verifiers.join(", ")} (objective asks about current/verifiable facts, is a long look-it-up objective, or asks whether a claim is true — the specialists are offline and deterministic)`,
      };
    }
    return { assigned: withCo, rationale: `${rationale}${coWhy}` };
  }
  // No keyword match. A plain-language question ("what is X?") often shares no
  // literal tokens with any asset's tags — so fall back to any asset marked as
  // a first-line responder (e.g. research), the intended "search first, then
  // correlate" entry point.
  const fallbacks = fallbackAssets(assets);
  if (fallbacks.length > 0) {
    const assigned = fallbacks.map((a) => a.name);
    // The wording rider used to live ONLY in the matched branch above, so a
    // purely-wording objective that matched no tag at all — "help me word a
    // message to my boss about a raise" — fell through to research alone and
    // the wording specialist never saw it. That is exactly backwards: the less
    // an objective looks like any specialist's domain, the more likely it is a
    // pure wording task. Same ADD-only contract as above; research still leads.
    if (
      needsWordingHelp(objective) &&
      !assigned.includes(WORDING_ASSET) &&
      assets.some((a) => a.name === WORDING_ASSET && a.status === "active")
    ) {
      assigned.push(WORDING_ASSET);
      return {
        assigned,
        rationale: `no keyword match — routed to fallback asset(s) plus ${WORDING_ASSET} (objective asks for a message to be written or reworded)`,
      };
    }
    const why = looksLikeQuestion(objective) ? "objective is a question" : "no keyword match";
    return { assigned, rationale: `${why} — routed to fallback asset(s): ${assigned.join(", ")}` };
  }
  return { assigned: [], rationale: "no tag/description overlap and no fallback asset registered — no assets auto-assigned" };
}

export type DropReason =
  | "assigned"
  | "below-floor" // score under the confidence floor (no deliberate signal)
  | "prose-only-unanchored" // matched on description prose only, dropped once anything anchored
  | "below-ratio" // anchored/floor-passing but under secondaryRatio of the leader
  | "beyond-top-3"; // qualified but past the 3-specialist cap

export interface RoutingExplanationRow {
  name: string;
  score: number;
  matchedTags: string[];
  anchored: boolean;
  verdict: DropReason;
}

export interface RoutingExplanation {
  objective: string;
  assigned: string[];
  rationale: string;
  verifierAdded: boolean; // research (or other fallback) rode along as a verifier
  candidates: RoutingExplanationRow[]; // top scorers, winners and near-misses, with why each lost
}

/**
 * Read-only companion to selectAssets: returns the SAME decision plus the
 * discarded near-misses and a one-word reason each lost (below-floor /
 * prose-only-unanchored / below-ratio / beyond-top-3). The data was always
 * computed and thrown away; surfacing it turns "why did this route here, and
 * what almost won?" — the neighbouring-domain collision probe AGENTS.md says to
 * run by hand — into one deterministic call. Changes no routing behavior.
 */
export function explainRouting(
  objective: string,
  assets: AssetConfig[],
  thresholds: RoutingThresholds = DEFAULT_THRESHOLDS,
  topN = 8
): RoutingExplanation {
  const decision = selectAssets(objective, assets, thresholds);
  const assigned = new Set(decision.assigned);

  const all = matchAssets(objective, assets);
  const floorPass = all.filter((m) => m.score >= thresholds.floor);
  const anchoredExists = floorPass.some((m) => m.anchored);
  const pool = anchoredExists ? floorPass.filter((m) => m.anchored) : floorPass;
  const leader = pool[0]?.score ?? 0;
  const ratioBar = leader * thresholds.secondaryRatio;

  const candidates: RoutingExplanationRow[] = all.slice(0, topN).map((m) => {
    let verdict: DropReason;
    if (assigned.has(m.name)) verdict = "assigned";
    else if (m.score < thresholds.floor) verdict = "below-floor";
    else if (anchoredExists && !m.anchored) verdict = "prose-only-unanchored";
    else if (m.score < ratioBar) verdict = "below-ratio";
    else verdict = "beyond-top-3";
    return { name: m.name, score: m.score, matchedTags: m.matchedTags, anchored: m.anchored, verdict };
  });

  return {
    objective,
    assigned: decision.assigned,
    rationale: decision.rationale,
    verifierAdded: needsFreshFacts(objective) || needsResearchShape(objective) || needsClaimCheck(objective),
    candidates,
  };
}
