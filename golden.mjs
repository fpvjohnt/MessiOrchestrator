// Routing-accuracy harness — the first CORRECTNESS measurement of the system
// (regression.mjs proves consistency; this proves rightness against a labeled
// key). Reports accuracy at the production thresholds, lists every miss and
// noise case honestly, then sweeps the thresholds to check whether the
// hand-picked defaults (floor 3, secondaryRatio 0.5) are actually optimal.
//
//   Run:  npm run golden   (after build:all)

import { readFile } from "node:fs/promises";
import { selectAssets, DEFAULT_THRESHOLDS } from "./dist/router.js";
import { GOLDEN } from "./golden-set.mjs";

const registry = JSON.parse(await readFile(new URL("./data/registry.json", import.meta.url), "utf-8"));

// Score one threshold setting against the whole golden set.
function score(thresholds) {
  let primaryHits = 0;
  let cleanHits = 0; // right asset AND no extra noise assets
  const misses = [];
  const noisy = [];
  for (const t of GOLDEN) {
    const { assigned } = selectAssets(t.q, registry, thresholds);
    const ok = new Set([...t.expect, ...(t.alsoOk ?? [])]);
    const primary = t.expect[0];
    const hit = assigned.includes(primary);
    const extras = assigned.filter((a) => !ok.has(a));
    if (hit) primaryHits++;
    if (hit && extras.length === 0) cleanHits++;
    if (!hit) misses.push({ q: t.q, expect: t.expect, got: assigned, note: t.note });
    else if (extras.length) noisy.push({ q: t.q, expect: t.expect, extras });
  }
  return { primaryHits, cleanHits, total: GOLDEN.length, misses, noisy };
}

const base = score(DEFAULT_THRESHOLDS);
const pct = (n) => `${((n / base.total) * 100).toFixed(0)}%`;

console.log(`ROUTING ACCURACY — ${GOLDEN.length} labeled questions, production thresholds (floor ${DEFAULT_THRESHOLDS.floor}, ratio ${DEFAULT_THRESHOLDS.secondaryRatio})`);
console.log(`  Primary hit (right asset assigned):        ${base.primaryHits}/${base.total}  ${pct(base.primaryHits)}`);
console.log(`  Clean hit (right asset, no noise assets):  ${base.cleanHits}/${base.total}  ${pct(base.cleanHits)}`);

if (base.misses.length) {
  console.log(`\nMISSES — expected asset was NOT assigned (the dangerous ones):`);
  for (const m of base.misses) {
    console.log(`  ✗ "${m.q}"`);
    console.log(`      want ${JSON.stringify(m.expect)}  got ${JSON.stringify(m.got)}${m.note ? `   (${m.note})` : ""}`);
  }
}
if (base.noisy.length) {
  console.log(`\nNOISE — right asset assigned, but extra assets rode along:`);
  for (const n of base.noisy) console.log(`  ~ "${n.q}"  extra: ${JSON.stringify(n.extras)}`);
}

// ── Threshold sweep: are the eyeballed defaults actually best? ──────────────
console.log(`\nTHRESHOLD SWEEP (primary-hit % — higher is better; noise not penalized here):`);
const floors = [1, 2, 3, 4, 5];
const ratios = [0.3, 0.4, 0.5, 0.6, 0.7];
let best = { primaryHits: -1 };
const rows = [];
for (const floor of floors) {
  const cells = [];
  for (const secondaryRatio of ratios) {
    const s = score({ floor, secondaryRatio });
    cells.push(`${((s.primaryHits / s.total) * 100).toFixed(0)}%`);
    if (s.primaryHits > best.primaryHits) best = { primaryHits: s.primaryHits, floor, secondaryRatio };
  }
  rows.push(`  floor ${floor} | ${ratios.map((r, i) => `r${r}:${cells[i].padStart(4)}`).join("  ")}`);
}
console.log(rows.join("\n"));
// Compare by SCORE, not coordinates: if the defaults tie the sweep best, they
// are optimal even though the grid reports a different (floor,ratio) for the tie.
const beatsDefault = best.primaryHits > base.primaryHits;
console.log(`\n  Best primary-hit in sweep: ${best.primaryHits}/${base.total} (floor ${best.floor}, ratio ${best.secondaryRatio}).`);
console.log(beatsDefault
  ? `  → beats the defaults (${base.primaryHits}/${base.total}). Worth considering a threshold change.`
  : `  → the current defaults (floor ${DEFAULT_THRESHOLDS.floor}, ratio ${DEFAULT_THRESHOLDS.secondaryRatio}) tie the best — no threshold change warranted. The lever is tags/vocab, not thresholds.`);
console.log(`\nNote: primary-hit ignores noise; a lower floor can raise hits while adding noise assets. Read alongside the clean-hit number and the MISS list — accuracy is a conversation, not one number.`);

// Baseline gate — turns this measurement into a regression guard. A future tag
// or threshold change that drops routing below this fails loudly. Headroom
// below the current 39/40 for honest label churn as the set grows.
const BASELINE_MIN = 48; // ~89% of the 54-question full-system set
if (base.primaryHits < BASELINE_MIN) {
  console.log(`\nFAIL: routing accuracy ${base.primaryHits}/${base.total} fell below baseline ${BASELINE_MIN}/${base.total}.`);
  process.exit(1);
}
console.log(`\nBaseline OK: ${base.primaryHits}/${base.total} ≥ ${BASELINE_MIN}/${base.total}.`);
