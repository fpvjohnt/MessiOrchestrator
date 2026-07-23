import type { AssetConfig } from "./types.js";
import { expandConcepts, stem } from "./synonyms.js";

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
  const objectiveTokens = expandConcepts(contentTokens(objective), sequence);
  for (const joined of compoundJoins(tokenize(objective))) objectiveTokens.add(joined);
  const candidates = assets.filter((a) => a.status === "active");

  const scored: AssetMatch[] = candidates.map((asset) => {
    const matchedTags = new Set<string>();
    let score = 0;
    let nameHits = 0;

    for (const token of contentTokens(asset.name)) {
      if (objectiveTokens.has(token)) {
        score += NAME_WEIGHT;
        nameHits++;
      }
    }
    const descriptionHits = new Set<string>();
    for (const token of contentTokens(asset.description)) {
      if (objectiveTokens.has(token)) descriptionHits.add(token);
    }
    score += descriptionHits.size * DESCRIPTION_WEIGHT;
    for (const tag of asset.tags) {
      for (const token of contentTokens(tag)) {
        if (objectiveTokens.has(token)) {
          score += TAG_WEIGHT;
          matchedTags.add(token);
        }
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
    const verifiers = fallbackAssets(assets)
      .map((a) => a.name)
      .filter((name) => !specialists.includes(name));
    if (verifiers.length > 0 && needsFreshFacts(objective)) {
      return {
        assigned: [...specialists, ...verifiers],
        rationale: `${rationale}; + ${verifiers.join(", ")} (objective asks about current/verifiable facts — the specialists are offline and deterministic)`,
      };
    }
    return { assigned: specialists, rationale };
  }
  // No keyword match. A plain-language question ("what is X?") often shares no
  // literal tokens with any asset's tags — so fall back to any asset marked as
  // a first-line responder (e.g. research), the intended "search first, then
  // correlate" entry point.
  const fallbacks = fallbackAssets(assets);
  if (fallbacks.length > 0) {
    const assigned = fallbacks.map((a) => a.name);
    const why = looksLikeQuestion(objective) ? "objective is a question" : "no keyword match";
    return { assigned, rationale: `${why} — routed to fallback asset(s): ${assigned.join(", ")}` };
  }
  return { assigned: [], rationale: "no tag/description overlap and no fallback asset registered — no assets auto-assigned" };
}
