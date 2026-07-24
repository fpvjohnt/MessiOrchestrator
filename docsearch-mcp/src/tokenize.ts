// Tokenization tuned for BOTH exact lexical matching (names, IDs, error codes,
// file names, code symbols) and the vector space (sub-word overlap).
//
// The lexical tokenizer keeps identifier-ish tokens intact — "TS2345",
// "src/router.ts", "AmericanExpress", "get_user" — so a search for an error
// code or a filename lands exactly, while ALSO emitting their split parts so a
// looser query still matches. That dual emission is what lets "American Express"
// find "AmericanExpress" and "router.ts" find "src/router.ts".

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are",
  "was", "were", "be", "it", "this", "that", "as", "at", "by", "from", "my", "our",
]);

export function lexTokens(text: string): string[] {
  const out: string[] = [];
  const lower = text.toLowerCase();
  // 1. Identifier-ish runs kept whole: words with digits, dots, slashes, dashes,
  //    underscores (filenames, error codes, symbols, versions).
  for (const m of lower.matchAll(/[a-z0-9]+(?:[._/\-][a-z0-9]+)+/g)) out.push(m[0]);
  // 2. Plain alphanumeric words.
  for (const m of lower.matchAll(/[a-z0-9]{2,}/g)) if (!STOP.has(m[0])) out.push(m[0]);
  return out;
}

// Vector features: word unigrams + character 3-grams. The char-grams give
// morphological/typo/paraphrase overlap ("renewal" ~ "renewals" ~ "renew")
// beyond exact word match, which is what makes the dense vector "semantic-ish"
// without a neural model.
export function vecFeatures(text: string): string[] {
  const feats: string[] = [];
  const words = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  for (const w of words) {
    if (!STOP.has(w)) feats.push(`w:${w}`);
    const p = `#${w}#`;
    for (let i = 0; i + 3 <= p.length; i++) feats.push(`g:${p.slice(i, i + 3)}`);
  }
  return feats;
}

export function termFreq(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  return tf;
}
