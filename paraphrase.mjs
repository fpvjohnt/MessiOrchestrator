// Paraphrase robustness harness — measures how well routing survives natural
// rephrasing (the Researcher's #2). Distinguishes two failure severities:
//   HARD miss  → routed to the WRONG specialist (actively misleading)
//   SOFT miss  → fell through to research/none (not answered by the right
//                expert, but research can still help — a safe-ish landing)
// The base question is checked too; if a base doesn't route right, it's noted
// so we don't blame the paraphrases for a mislabeled base.
//
//   Run:  npm run paraphrase   (after build:all)

import { readFile } from "node:fs/promises";
import { selectAssets } from "./dist/router.js";
import { PARAPHRASES } from "./paraphrase-set.mjs";

const registry = JSON.parse(await readFile(new URL("./data/registry.json", import.meta.url), "utf-8"));
const fallbacks = new Set(registry.filter((a) => a.fallback).map((a) => a.name));

function classify(assigned, expect) {
  const primary = expect[0];
  if (assigned.includes(primary)) return "hit";
  // A miss that landed only on fallback assets (or nowhere) is soft.
  const nonFallback = assigned.filter((a) => !fallbacks.has(a));
  return nonFallback.length === 0 ? "soft" : "hard";
}

let hits = 0, soft = 0, hard = 0, totalVariants = 0;
const brittle = []; // bases whose paraphrases weren't all hits
const baseMisroutes = [];

for (const p of PARAPHRASES) {
  // Sanity: does the base itself route right?
  const baseAssigned = selectAssets(p.base, registry).assigned;
  if (!baseAssigned.includes(p.expect[0])) baseMisroutes.push({ base: p.base, expect: p.expect, got: baseAssigned });

  const results = p.variants.map((v) => {
    const assigned = selectAssets(v, registry).assigned;
    const verdict = classify(assigned, p.expect);
    totalVariants++;
    if (verdict === "hit") hits++;
    else if (verdict === "soft") soft++;
    else hard++;
    return { v, assigned, verdict };
  });
  const misses = results.filter((r) => r.verdict !== "hit");
  if (misses.length) brittle.push({ base: p.base, expect: p.expect, misses });
}

const pct = (n) => `${((n / totalVariants) * 100).toFixed(0)}%`;
console.log(`PARAPHRASE ROBUSTNESS — ${PARAPHRASES.length} intents, ${totalVariants} natural rephrasings`);
console.log(`  Still routed correctly:  ${hits}/${totalVariants}  ${pct(hits)}`);
console.log(`  Soft miss (→ research/none, safe-ish):  ${soft}  ${pct(soft)}`);
console.log(`  HARD miss (→ wrong specialist):         ${hard}  ${pct(hard)}`);

if (baseMisroutes.length) {
  console.log(`\n⚠ base questions that don't route right (fix the label/tags, not the paraphrases):`);
  for (const b of baseMisroutes) console.log(`   "${b.base}" want ${JSON.stringify(b.expect)} got ${JSON.stringify(b.got)}`);
}

if (hard) {
  console.log(`\nHARD MISSES — rephrasings sent to the WRONG specialist (most important):`);
  for (const b of brittle) {
    for (const m of b.misses.filter((m) => m.verdict === "hard")) {
      console.log(`  ✗ "${m.v}"`);
      console.log(`      want ${JSON.stringify(b.expect)}  got ${JSON.stringify(m.assigned)}`);
    }
  }
}

console.log(`\nSOFT MISSES — rephrasings that fell through to research (the keyword was dropped):`);
let anySoft = false;
for (const b of brittle) {
  for (const m of b.misses.filter((m) => m.verdict === "soft")) {
    anySoft = true;
    console.log(`  ~ "${m.v}"  (intent: ${b.expect[0]})`);
  }
}
if (!anySoft) console.log("  (none)");

console.log(`\nRead: HARD misses are the priority — they actively mislead. SOFT misses degrade to research, which is the designed safety net. The pattern in the misses (dropped keyword → no tag hit) is the keyword matcher's ceiling; closing it means either targeted vocab/synonyms or semantic matching.`);

// This harness does NOT gate on perfect routing (keyword matching can't reach
// 100% on free paraphrase, and soft misses land safely on research). It DOES
// gate on the safety property: a natural rephrasing should almost never be sent
// to the WRONG specialist. Hard misses spiking = a generic-word magnet crept
// back into some asset's tags.
const HARD_MAX = 3;
if (hard > HARD_MAX) {
  console.log(`\nFAIL: ${hard} hard misses (wrong specialist) exceeds the safety budget of ${HARD_MAX}. A tag is over-matching.`);
  process.exit(1);
}
console.log(`\nSafety OK: ${hard} hard miss(es) ≤ budget ${HARD_MAX}. Failures degrade safely to research.`);
