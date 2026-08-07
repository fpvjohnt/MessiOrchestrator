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
//
// STRUCTURE: the per-case decision (label-vs-proxy) is exported as a pure
// function, expectedForCase(), so regression.mjs can exercise the REAL logic
// instead of asserting literals against themselves. The file self-executes only
// when run directly (npm run caselog); importing it has no side effects.

import { readFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { selectAssets } from "./dist/router.js";
import { warnIfStaleBuild } from "./build-freshness.mjs";

// Smoke/probe objectives written BY this system's own tests, not by a user.
// Explicit and printed, so the filter can be audited rather than trusted.
export const PROBE = /^(concurrent probe|latency demo|warm |smoke|test case|probe\b|demo\b|ping\b)/i;

// The operator's own DEV/SMOKE runs that slipped past PROBE and were being
// graded as real traffic — 13 of them, and two injected label garbage (an
// "end-to-end verification of all assets" case makes expected = all 7 assets).
// Each pattern is anchored/narrow so it cannot swallow real questions that merely
// contain a word like "probe" or "test": verified against the 4 genuine-traffic
// objectives that do ("red team ... probe our model", "how do I test an AI API
// endpoint in Postman", "Map the end-to-end FLOW ...", "Verify the current
// command ...") — none match. Add a pattern here only with the same discipline.
export const DEV_TEST =
  /^(error|latency|abuse|load|stress|concurrency) (probe|storm|test)\b|^live test\b|^final smoke test\b|^test (title|index)\b|\bend-to-end (verification|test)\b|\btest case$|^post-reboot check\b/i;

/**
 * Decide what a single case should be graded against. PURE — no I/O, no router.
 * Returns either { objective, expected, source } or { skip } with a reason, so
 * the label-vs-proxy precedence is testable directly.
 *
 * GROUND TRUTH when the operator supplied it at close time (shouldHaveRouted) —
 * a real label written against a real objective by someone who saw the answer.
 * It beats the proxy in both directions: it can name an asset that was never
 * called (the router missed it AND the operator couldn't work around it), which
 * the "used" proxy structurally cannot.
 *
 * Otherwise the PROXY: assets that produced at least one call that did not fail.
 * A failed call is not evidence the router chose well.
 */
// CURRENT MEASURED BASELINE plus a small margin (ceilings) or minus one
// (floors), not targets and not aspirations. The job of these numbers is to
// fail when a change makes real-traffic routing WORSE than it is right now.
// Move them only in the stricter direction unless the instrument itself was
// wrong — as it was; see realTrafficGate() for the noise rewrite.
export const COVERAGE_FLOOR = 0.65;

// The OLD single `noise` metric was a broken instrument, and it is worth being
// precise about how. It counted "assigned but never tasked" over EVERY assigned
// asset — including assets the case never OFFERED to the router. But task_asset
// refuses a call to an unassigned asset, so an asset that was not offered COULD
// NOT have been tasked no matter how good the routing was. Measured on the live
// log, 21.7% of all assignments fell in that impossible-to-score bucket, so the
// 46% the gate reported was almost half arithmetic that no routing change could
// ever move. It also drifted with plain log growth (46.3 -> 46.0 -> 46.1 across
// a week of no relevant change), which is the signature of a metric measuring
// the corpus rather than the router.
//
// Two honest numbers replace it:
//
//   SCOREABLE noise — of the assignments the case ACTUALLY OFFERED (so
//   task_asset would have permitted them), the fraction that went unused. This
//   is the real "did the router over-assign" question. Measured 31.6% today.
//
//   UNTASKABLE share — the fraction of all assignments that were never offered.
//   This is mostly structural (a newly-tagged asset assigned to old cases that
//   predate it), so it is NOT a quality signal on its own — but a change that
//   suddenly over-assigns brand-new territory WILL push it up, which is the one
//   thing the scoreable metric alone is blind to. It is a tripwire, not a
//   grade. Measured 21.7% today.
//
// Both ceilings sit a few points above today's measurement: tight enough that a
// real regression trips, loose enough that ordinary log growth does not.
export const SCOREABLE_NOISE_CEILING = 0.36; // measured 31.6%
export const UNTASKABLE_SHARE_CEILING = 0.27; // measured 21.7%

/**
 * The real-traffic gate decision, as a pure function so every branch — the
 * zero-case skip especially — is TESTABLE rather than asserted by hand.
 * Returns { status: "skipped" | "ok" | "failed", problems: string[] }.
 *
 * WHY "skipped" exists, and why it is not cosmetic. `data/cases.json` is
 * gitignored — the orchestrator writes it as you use it — so a FRESH CLONE has
 * no case log at all. Scoring 0/0 -> 0 tripped the coverage floor and exited 1.
 * That is a lie: an absent log means "nothing to measure", not "routing got
 * worse". And it was not harmless — `npm run check` chains stages with &&, so a
 * caselog exit(1) SILENTLY SKIPPED `npm run probe`, the out-of-set collision
 * gate. The stage order is now probe-before-caselog for the same reason: an
 * advisory real-traffic measurement must never suppress a correctness gate.
 */
export function realTrafficGate({ caseCount, coverage, scoreableNoise, untaskableShare }) {
  if (!caseCount) return { status: "skipped", problems: [] };
  const pct = (n) => `${(n * 100).toFixed(0)}%`;
  const problems = [];
  if (coverage < COVERAGE_FLOOR) problems.push(`coverage ${pct(coverage)} < ${pct(COVERAGE_FLOOR)}`);
  if (scoreableNoise > SCOREABLE_NOISE_CEILING) {
    problems.push(`scoreable-noise ${pct(scoreableNoise)} > ${pct(SCOREABLE_NOISE_CEILING)}`);
  }
  if (untaskableShare > UNTASKABLE_SHARE_CEILING) {
    problems.push(`untaskable-share ${pct(untaskableShare)} > ${pct(UNTASKABLE_SHARE_CEILING)}`);
  }
  return { status: problems.length ? "failed" : "ok", problems };
}

export function expectedForCase(c) {
  const objective = (c.objective ?? "").trim();
  if (!objective) return { skip: "no-objective" };
  if (PROBE.test(objective) || DEV_TEST.test(objective)) return { skip: "probe" };

  // `offered` = the assets this case actually assigned at the time, i.e. the
  // ones task_asset would have permitted a call to. It is what separates
  // scoreable noise from the impossible-to-score kind; see the ceiling notes.
  const offered = Array.isArray(c.assignedAssets) ? c.assignedAssets : [];

  if (Array.isArray(c.shouldHaveRouted) && c.shouldHaveRouted.length) {
    return { objective, expected: c.shouldHaveRouted, source: "label", offered };
  }

  const used = new Set();
  for (const e of c.log ?? []) {
    if (!e.asset) continue;
    if (e.error) continue;
    if (e.result && typeof e.result === "object" && e.result.isError) continue;
    used.add(e.asset);
  }
  if (used.size === 0) return { skip: "empty" };
  return { objective, expected: [...used], source: "proxy", offered };
}

async function loadCases(name) {
  try {
    const raw = JSON.parse(await readFile(new URL(`./data/${name}`, import.meta.url), "utf-8"));
    return Array.isArray(raw) ? raw : raw.cases ?? [];
  } catch {
    return [];
  }
}

async function main() {
  // Standalone `npm run caselog` has no build step — warn if dist is behind src.
  await warnIfStaleBuild(fileURLToPath(new URL(".", import.meta.url)));
  // data/registry.json is gitignored on the same grounds as cases.json — it is
  // recreated from registry.example.json by `npm run setup`. So on the very
  // fresh clone this file's SKIPPED branch was written for, this read threw an
  // unhandled ENOENT and exited 1 BEFORE the branch could run. The fix did not
  // survive the situation it was written for. Name the cause instead.
  let registry;
  try {
    registry = JSON.parse(await readFile(new URL("./data/registry.json", import.meta.url), "utf-8"));
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
    console.log(`\nREAL-TRAFFIC ROUTING — skipped: data/registry.json does not exist.`);
    console.log(`It is gitignored and recreated from data/registry.example.json.`);
    console.log(`Run 'npm run setup' first, then re-run this.`);
    return;
  }
  const all = [...(await loadCases("cases.json")), ...(await loadCases("cases-archive.json"))];

  const cases = [];
  let skippedProbe = 0;
  let skippedEmpty = 0;
  for (const c of all) {
    const r = expectedForCase(c);
    if (r.skip === "probe") { skippedProbe++; continue; }
    if (r.skip === "empty") { skippedEmpty++; continue; }
    if (r.skip) continue; // no-objective
    cases.push(r);
  }

  // Nothing to score. Report it as SKIPPED and exit 0 — see realTrafficGate()
  // for why scoring 0 here used to suppress the collision gate entirely.
  if (cases.length === 0) {
    console.log(`\nREAL-TRAFFIC ROUTING — no scoreable cases in the local case log.`);
    console.log(`  Excluded: ${skippedProbe} probe/smoke objective(s), ${skippedEmpty} case(s) with no successful call.`);
    console.log(``);
    // These two are NOT the same situation and must not print the same words.
    // An empty log is a fresh clone; a log full of cases whose every call
    // FAILED is a total outage — and the first version of this branch reported
    // the outage as "a fresh clone has nothing to measure yet" and exited 0,
    // turning the loudest possible signal into a green gate. Over half the live
    // corpus already lands in `skippedEmpty`, so this is not a corner case.
    if (all.length > 0 && skippedEmpty > 0) {
      console.log(`NOT a fresh clone: ${all.length} case(s) exist but NONE has a successful`);
      console.log(`asset call, so there is no ground truth to score against. That usually`);
      console.log(`means the assets were failing, not that routing is fine. Investigate`);
      console.log(`before trusting a green suite — check 'npm run health'.`);
      process.exit(1);
    }
    console.log(`SKIPPED, not failed. data/cases.json is gitignored — the orchestrator`);
    console.log(`writes it as you use it — so a fresh clone has nothing to measure yet.`);
    console.log(`Open a few cases and re-run to get a real-traffic number.`);
    return;
  }

  let fullyCovered = 0;
  let predictedTotal = 0;
  let predictedUnused = 0; // legacy: unused over ALL predicted (kept for the printout only)
  let offeredPredicted = 0; // predicted AND offered to the case — the scoreable denominator
  let offeredUnused = 0; // …of those, the ones that went unused: scoreable noise
  let untaskable = 0; // predicted but never offered — could not have been tasked
  const misses = [];

  let labelled = 0;
  for (const c of cases) {
    if (c.source === "label") labelled++;
    const predicted = selectAssets(c.objective, registry).assigned;
    const missing = c.expected.filter((a) => !predicted.includes(a));
    predictedTotal += predicted.length;
    for (const a of predicted) {
      const used = c.expected.includes(a);
      if (!used) predictedUnused++;
      if (c.offered.includes(a)) {
        offeredPredicted++;
        if (!used) offeredUnused++;
      } else {
        untaskable++;
      }
    }
    if (missing.length === 0) fullyCovered++;
    else misses.push({ objective: c.objective, expected: c.expected, predicted, missing, source: c.source });
  }

  const coverage = cases.length ? fullyCovered / cases.length : 0;
  const scoreableNoise = offeredPredicted ? offeredUnused / offeredPredicted : 0;
  const untaskableShare = predictedTotal ? untaskable / predictedTotal : 0;

  const pct = (n) => `${(n * 100).toFixed(0)}%`;
  console.log(`\nREAL-TRAFFIC ROUTING — ${cases.length} cases from the live case log`);
  console.log(`  Excluded: ${skippedProbe} probe/smoke objective(s), ${skippedEmpty} case(s) with no successful call.`);
  console.log(``);
  console.log(`  Coverage (expected assets that were assigned):     ${fullyCovered}/${cases.length}  ${pct(coverage)}`);
  console.log(`  Scoreable noise (offered but unused):              ${offeredUnused}/${offeredPredicted}  ${pct(scoreableNoise)}  (ceiling ${pct(SCOREABLE_NOISE_CEILING)})`);
  console.log(`  Untaskable share (predicted, never offered):       ${untaskable}/${predictedTotal}  ${pct(untaskableShare)}  (ceiling ${pct(UNTASKABLE_SHARE_CEILING)})`);
  console.log(`  [for reference, the old confounded noise number:   ${predictedUnused}/${predictedTotal}  ${pct(predictedTotal ? predictedUnused / predictedTotal : 0)}]`);
  console.log(``);
  console.log(
    labelled > 0
      ? `  Labels: ${labelled} case(s) use operator GROUND TRUTH (shouldHaveRouted); the rest use the "assets used" proxy. Every close_case with should_have_routed_to strengthens this number.`
      : `  Labels: 0 cases carry operator ground truth yet. Pass should_have_routed_to on close_case when routing is wrong — a handful of real labels is worth more than a hundred self-authored golden entries.`
  );

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
      console.log(`      expected ${JSON.stringify(m.expected)}  predicted ${JSON.stringify(m.predicted)}  MISSING ${JSON.stringify(m.missing)}`);
    }
    if (misses.length > 12) console.log(`  … and ${misses.length - 12} more.`);
  }

  console.log(``);
  console.log(`CAVEAT: task_asset refuses calls to unassigned assets, so an asset the`);
  console.log(`router never picked could not have been used. Coverage here is biased`);
  console.log(`TOWARD the router — read it as an optimistic ceiling, not a grade.`);

  // The floors live next to realTrafficGate(), which owns the decision. The
  // honest coverage number is much lower than the golden set's — that gap is
  // the finding, not a bug in this file: golden questions are short and
  // self-authored, real objectives are long and messy.
  const verdict = realTrafficGate({ caseCount: cases.length, coverage, scoreableNoise, untaskableShare });

  console.log(``);
  if (verdict.status === "failed") {
    console.log(`REAL-TRAFFIC GATE FAILED: ${verdict.problems.join(" | ")}`);
    process.exit(1);
  }
  console.log(
    `Real-traffic gate OK: coverage ${pct(coverage)} >= ${pct(COVERAGE_FLOOR)} | ` +
      `scoreable-noise ${pct(scoreableNoise)} <= ${pct(SCOREABLE_NOISE_CEILING)} | ` +
      `untaskable-share ${pct(untaskableShare)} <= ${pct(UNTASKABLE_SHARE_CEILING)}.`
  );
}

// Self-execute only when run directly (node caselog-eval.mjs). Importing the
// module for its pure exports — as regression.mjs does — must NOT run main,
// print, or call process.exit.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
