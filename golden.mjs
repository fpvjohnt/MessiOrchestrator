// Routing-accuracy harness — the first CORRECTNESS measurement of the system
// (regression.mjs proves consistency; this proves rightness against a labeled
// key). Reports accuracy at the production thresholds, lists every miss and
// noise case honestly, then sweeps the thresholds to check whether the
// hand-picked defaults (floor 3, secondaryRatio 0.6) are actually optimal.
//
//   Run:  npm run golden   (after build:all)

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { selectAssets, DEFAULT_THRESHOLDS } from "./dist/router.js";
import { GOLDEN } from "./golden-set.mjs";
import { warnIfStaleBuild } from "./build-freshness.mjs";

// Standalone `npm run golden` has no build step — warn if dist is behind src.
await warnIfStaleBuild(fileURLToPath(new URL(".", import.meta.url)));

const registry = JSON.parse(await readFile(new URL("./data/registry.json", import.meta.url), "utf-8"));

// Score one threshold setting against the whole golden set.
function score(thresholds) {
  let primaryHits = 0;
  let cleanHits = 0; // right asset AND no extra noise assets
  let rank1Hits = 0; // right asset ranked FIRST — assigned[0] is the de-facto owner
  const misses = [];
  const noisy = [];
  const rankErrors = [];
  const extrasByAsset = new Map();
  for (const t of GOLDEN) {
    const { assigned } = selectAssets(t.q, registry, thresholds);
    const ok = new Set([...t.expect, ...(t.alsoOk ?? [])]);
    const primary = t.expect[0];
    const hit = assigned.includes(primary);
    const extras = assigned.filter((a) => !ok.has(a));
    if (hit) primaryHits++;
    if (hit && extras.length === 0) cleanHits++;
    if (assigned[0] === primary) rank1Hits++;
    else if (hit) rankErrors.push({ q: t.q, expect: primary, got: assigned });
    if (!hit) misses.push({ q: t.q, expect: t.expect, got: assigned, note: t.note });
    else if (extras.length) noisy.push({ q: t.q, expect: t.expect, extras });
    for (const e of extras) extrasByAsset.set(e, (extrasByAsset.get(e) ?? 0) + 1);
  }
  return {
    primaryHits, cleanHits, rank1Hits, total: GOLDEN.length,
    misses, noisy, rankErrors,
    extrasByAsset: [...extrasByAsset.entries()].sort((a, b) => b[1] - a[1]),
  };
}

const base = score(DEFAULT_THRESHOLDS);
const pct = (n) => `${((n / base.total) * 100).toFixed(0)}%`;

console.log(`ROUTING ACCURACY — ${GOLDEN.length} labeled questions, production thresholds (floor ${DEFAULT_THRESHOLDS.floor}, ratio ${DEFAULT_THRESHOLDS.secondaryRatio})`);
console.log(`  Primary hit (right asset assigned):        ${base.primaryHits}/${base.total}  ${pct(base.primaryHits)}`);
console.log(`  Clean hit (right asset, no noise assets):  ${base.cleanHits}/${base.total}  ${pct(base.cleanHits)}`);
console.log(`  Rank-1  (right asset ranked FIRST):        ${base.rank1Hits}/${base.total}  ${pct(base.rank1Hits)}`);

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
// This sweep used to rank cells by primary-hit ALONE, and printed a bare
// "worth considering a threshold change" recommendation. It was steering the
// wrong way: floor 3 / ratio 0.3 wins on primary by exactly 1 hit while
// costing 17 clean-hits (57/96 vs 74/96). A caveat was printed underneath, but
// a caveat never beats a bold conclusion. It now optimises the metric actually
// wanted — clean-hit — and refuses any cell that regresses primary-hit, so a
// config can never be recommended by trading away correct routing for tidiness.
console.log(`\nTHRESHOLD SWEEP (primary / clean — selecting on CLEAN, never below baseline primary):`);
const floors = [1, 2, 3, 4, 5];
const ratios = [0.3, 0.4, 0.5, 0.6, 0.7];
let best = null;
const rows = [];
for (const floor of floors) {
  const cells = [];
  for (const secondaryRatio of ratios) {
    const s = score({ floor, secondaryRatio });
    cells.push(`${s.primaryHits}/${s.cleanHits}`);
    const eligible = s.primaryHits >= base.primaryHits;
    if (eligible && (!best || s.cleanHits > best.cleanHits)) {
      best = { primaryHits: s.primaryHits, cleanHits: s.cleanHits, floor, secondaryRatio };
    }
  }
  rows.push(`  floor ${floor} | ${ratios.map((r, i) => `r${r}:${cells[i].padStart(6)}`).join("  ")}`);
}
console.log(rows.join("\n"));

if (!best) {
  console.log(`\n  No swept cell matches the baseline primary-hit of ${base.primaryHits}/${base.total}. Defaults stand.`);
} else {
  const isDefault = best.floor === DEFAULT_THRESHOLDS.floor && best.secondaryRatio === DEFAULT_THRESHOLDS.secondaryRatio;
  const beatsDefault = best.cleanHits > base.cleanHits;
  console.log(`\n  Best clean-hit at no cost to primary: ${best.primaryHits}/${best.cleanHits} (floor ${best.floor}, ratio ${best.secondaryRatio}).`);
  console.log(isDefault || !beatsDefault
    ? `  → the current defaults (floor ${DEFAULT_THRESHOLDS.floor}, ratio ${DEFAULT_THRESHOLDS.secondaryRatio}) are the best cell — no threshold change warranted. The remaining lever is tags/vocab, not thresholds.`
    : `  → beats the defaults on clean-hit (${base.cleanHits}/${base.total}) without losing a primary hit.\n`
      + `     NOT ACTIONABLE ALONE: this sweep only sees the golden set. Tightening the ratio\n`
      + `     also drops secondaries that a REPHRASING needed, which shows up only as a\n`
      + `     paraphrase HARD miss (wrong specialist) — strictly worse than a harmless extra.\n`
      + `     Ratio 0.7 is exactly this case today: +3 clean, +1 hard miss. Run 'npm run\n`
      + `     paraphrase' on any candidate before adopting it.`);
}

if (base.extrasByAsset.length) {
  console.log(`\nNOISE BY OFFENDING ASSET (which asset keeps riding along — the actionable signal):`);
  console.log(`  ${base.extrasByAsset.map(([a, n]) => `${a}:${n}`).join("  ")}`);
}
console.log(`\nNote: thresholds trade these three off against each other. Read all three plus the MISS list — accuracy is a conversation, not one number.`);

// Baseline gate — turns this measurement into a regression guard. Expressed as
// PERCENTAGES, because the previous gate was an absolute 48 written when the
// set had 54 questions; the set grew to 96 and the gate silently became "50%
// is fine" — routing could have halved and this still printed OK. Percentages
// survive the set growing.
//
// Clean-hit and rank-1 are gated too. Without them, the two metrics this
// harness exists to protect could regress to zero without failing anything.
// Floors sit a few points under the measured values (100/98/96) to leave room
// for honest label churn, not enough to hide a real regression.
const GATES = [
  ["primary hit", base.primaryHits, 95],
  ["clean hit", base.cleanHits, 85],
  ["rank-1", base.rank1Hits, 88],
];
let failed = false;
for (const [label, hits, minPct] of GATES) {
  const actual = (hits / base.total) * 100;
  if (actual < minPct) {
    console.log(`\nFAIL: ${label} ${hits}/${base.total} (${actual.toFixed(0)}%) fell below the ${minPct}% floor.`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`\nGates OK: ${GATES.map(([l, h, m]) => `${l} ${((h / base.total) * 100).toFixed(0)}% ≥ ${m}%`).join(" | ")}.`);
