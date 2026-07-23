// Routing accuracy measured against REAL TRAFFIC, not against questions the
// author of the router also wrote.
//
// Why this exists: golden-set.mjs and paraphrase-set.mjs are both self-authored,
// and it shows. An ablation found that the entire PHRASES layer in synonyms.ts
// — 47 hand-written entries — changes ZERO routing decisions on real
// objectives while accounting for +11 on the paraphrase set. The number that
// looked like generalization was measuring the fix against its own test.
//
// The distributions are not the same either:
//     golden questions   median  9 words, max  14
//     real objectives    median 20 words, max 131
// Only ~11% of real traffic is as short as a typical golden question, so every
// threshold in router.ts was tuned on a score regime that barely occurs.
//
// Nobody wrote these objectives as test items and nobody picked the labels to
// make routing look good, which is the whole point.
//
// HONEST CAVEAT, stated in the output too: the label is "assets the operator
// actually called successfully", and task_asset REFUSES calls to unassigned
// assets. So an asset the router never assigned could not have been used, and
// coverage is biased toward the router. Treat it as an optimistic ceiling.

import { readFile } from "node:fs/promises";
import { selectAssets } from "./dist/router.js";

const registry = JSON.parse(await readFile(new URL("./data/registry.json", import.meta.url), "utf-8"));

async function loadCases(name) {
  try {
    const raw = JSON.parse(await readFile(new URL(`./data/${name}`, import.meta.url), "utf-8"));
    return Array.isArray(raw) ? raw : raw.cases ?? [];
  } catch {
    return [];
  }
}

// Smoke/probe objectives written BY this system's own tests, not by a user.
// Explicit and printed, so the filter can be audited rather than trusted.
const PROBE = /^(concurrent probe|latency demo|warm |smoke|test case|probe\b|demo\b|ping\b)/i;

const all = [...(await loadCases("cases.json")), ...(await loadCases("cases-archive.json"))];

const cases = [];
let skippedProbe = 0;
let skippedEmpty = 0;
for (const c of all) {
  const objective = (c.objective ?? "").trim();
  if (!objective) continue;
  if (PROBE.test(objective)) {
    skippedProbe++;
    continue;
  }
  // "Used" = the asset produced at least one call that did not fail. A failed
  // call is not evidence the router chose well.
  const used = new Set();
  for (const e of c.log ?? []) {
    if (!e.asset) continue;
    if (e.error) continue;
    if (e.result && typeof e.result === "object" && e.result.isError) continue;
    used.add(e.asset);
  }
  if (used.size === 0) {
    skippedEmpty++;
    continue;
  }
  cases.push({ objective, used: [...used] });
}

let fullyCovered = 0;
let predictedTotal = 0;
let predictedUnused = 0;
const misses = [];

for (const c of cases) {
  const predicted = selectAssets(c.objective, registry).assigned;
  const missing = c.used.filter((a) => !predicted.includes(a));
  const unused = predicted.filter((a) => !c.used.includes(a));
  predictedTotal += predicted.length;
  predictedUnused += unused.length;
  if (missing.length === 0) fullyCovered++;
  else misses.push({ objective: c.objective, used: c.used, predicted, missing });
}

const coverage = cases.length ? fullyCovered / cases.length : 0;
const noise = predictedTotal ? predictedUnused / predictedTotal : 0;

const pct = (n) => `${(n * 100).toFixed(0)}%`;
console.log(`\nREAL-TRAFFIC ROUTING — ${cases.length} cases from the live case log`);
console.log(`  Excluded: ${skippedProbe} probe/smoke objective(s), ${skippedEmpty} case(s) with no successful call.`);
console.log(``);
console.log(`  Coverage (every asset the operator used was assigned):  ${fullyCovered}/${cases.length}  ${pct(coverage)}`);
console.log(`  Noise    (assigned assets that were never called):      ${predictedUnused}/${predictedTotal}  ${pct(noise)}`);

// Which asset is most often missing tells you where to spend vocabulary.
const missingBy = {};
for (const m of misses) for (const a of m.missing) missingBy[a] = (missingBy[a] ?? 0) + 1;
const ranked = Object.entries(missingBy).sort((a, b) => b[1] - a[1]);
if (ranked.length) {
  console.log(``);
  console.log(`MOST-MISSED ASSETS (the actionable signal — where vocabulary is thin):`);
  console.log(`  ${ranked.map(([a, n]) => `${a}:${n}`).join("  ")}`);
}

if (misses.length) {
  console.log(``);
  console.log(`SAMPLE MISSES (objective truncated):`);
  for (const m of misses.slice(0, 12)) {
    console.log(`  ✗ "${m.objective.slice(0, 88)}${m.objective.length > 88 ? "…" : ""}"`);
    console.log(`      used ${JSON.stringify(m.used)}  predicted ${JSON.stringify(m.predicted)}  MISSING ${JSON.stringify(m.missing)}`);
  }
  if (misses.length > 12) console.log(`  … and ${misses.length - 12} more.`);
}

console.log(``);
console.log(`CAVEAT: task_asset refuses calls to unassigned assets, so an asset the`);
console.log(`router never picked could not have been used. Coverage here is biased`);
console.log(`TOWARD the router — read it as an optimistic ceiling, not a grade.`);

// These are the CURRENT MEASURED BASELINE minus a small margin, not a target
// and not an aspiration. Coverage is 71% today. Writing 85% here because it
// sounds better would make the gate a lie that fails on day one; writing 40%
// would make it useless. The job of these two numbers is to fail when a change
// makes real-traffic routing WORSE than it is right now.
//
// 71% is the honest number and it is much lower than the golden set's 99%.
// That gap is the finding, not a bug in this file: the golden questions are
// short and self-authored, real objectives are long and messy. Raise these
// floors when the real number moves, and never the other way round.
const COVERAGE_FLOOR = 0.65;
const NOISE_CEILING = 0.45;
const problems = [];
if (coverage < COVERAGE_FLOOR) problems.push(`coverage ${pct(coverage)} < ${pct(COVERAGE_FLOOR)}`);
if (noise > NOISE_CEILING) problems.push(`noise ${pct(noise)} > ${pct(NOISE_CEILING)}`);

console.log(``);
if (problems.length) {
  console.log(`REAL-TRAFFIC GATE FAILED: ${problems.join(" | ")}`);
  process.exit(1);
}
console.log(`Real-traffic gate OK: coverage ${pct(coverage)} >= ${pct(COVERAGE_FLOOR)} | noise ${pct(noise)} <= ${pct(NOISE_CEILING)}.`);
