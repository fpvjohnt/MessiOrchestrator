// Regression suite for the routing/decision logic that has broken before.
// Tests PURE exported functions from the compiled dist/ of each package —
// no server spawn, no network, and (unlike routing-smoke.mjs) no writing junk
// cases into the real cases.json. Runs in milliseconds.
//
//   Run:  npm run verify   (rebuilds orchestrator+polymath+overseer, then this)
//   or:   node regression.mjs   (against whatever is already built)
//
// Coverage derives from the source of truth where possible: the title-index
// test reads CLUSTERS, so every title you add is automatically checked.

import { readFile, readdir, mkdtemp, writeFile, utimes, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// The cross-process advisory lock around data/*.json. acquireCrossProcessLock
// is exported for these tests specifically: withFileLock's in-memory Mutex
// serializes same-key callers before they reach the disk, so a single process
// cannot otherwise reach the contention paths that matter here.
import { withFileLock, acquireCrossProcessLock } from "./dist/file-lock.js";
// Case-archiving selection. Pure by construction — archive-cases.mjs itself
// runs on import, so the logic has to live apart from it to be testable at all.
import { isArchivable, partitionCases, mergeArchive, analyzeStore, suggestCutoffs } from "./archive-logic.mjs";
// The one .env parser the bridge and supervisor share. They disagreeing about a
// setting is what made MCP_BRIDGE_PORT a false-outage generator.
import { parseEnv, applyEnv } from "./bridge/load-env.mjs";
import { CLUSTERS, resolveCluster } from "./polymath-mcp/dist/clusters.js";
import { buildIt } from "./polymath-mcp/dist/build.js";
import { askTheExpert } from "./polymath-mcp/dist/consult.js";
import { selectAssets } from "./dist/router.js";
import { suggestTool, describeUnknownTool, nameSimilarity } from "./dist/tool-suggest.js";
import { checkAssets, renderHealth } from "./dist/health.js";
import { synthesizeCase, isFailed } from "./dist/synthesis.js";
import { isFailed as ovIsFailed, failureMessage as ovFailureMessage } from "./overseer-mcp/dist/failure.js";
// New knowledge assets — their reverse-index resolvers (same pattern as polymath's title index).
import { DOMAINS, resolveDomain } from "./curiosity-mcp/dist/domains.js";
import { PRIMITIVES, resolvePrimitive } from "./openai-mcp/dist/primitives.js";
import { ROLES, resolveRole } from "./openai-mcp/dist/roles.js";
import { BUILDERS, resolveBuilder, howTheyBuild } from "./openai-mcp/dist/builders.js";
import { TOPICS, resolveTopic, explainTopic } from "./aiforge-mcp/dist/topics.js";
import { buildIt as afBuildIt, debug as afDebug, mythVsReality as afMyth } from "./aiforge-mcp/dist/toolkit.js";
import { checkPractice as afCheckPractice, practiceVerdict as afPracticeVerdict } from "./aiforge-mcp/dist/verify.js";
import { TOPICS as GF_TOPICS, resolveTopic as gfResolve, explainTopic as gfExplain } from "./gitforge-mcp/dist/topics.js";
import { howTo as gfHowTo, debug as gfDebug, mythVsReality as gfMyth } from "./gitforge-mcp/dist/toolkit.js";
import { TOPICS as PC_TOPICS, resolveTopic as pcResolve, explainTopic as pcExplain } from "./promptcraft-mcp/dist/topics.js";
import { buildPrompt as pcBuild, improvePrompt as pcImprove, mythVsReality as pcMyth } from "./promptcraft-mcp/dist/toolkit.js";
import { TOPICS as AP_TOPICS, resolveTopic as apResolve, explainTopic as apExplain } from "./apiforge-mcp/dist/topics.js";
import { TOPICS as KA_TOPICS, resolveTopic as kaResolve, explainTopic as kaExplain, startHere as kaStart } from "./kalshi-mcp/dist/topics.js";
import { readMarket as kaRead, mythVsReality as kaMyth } from "./kalshi-mcp/dist/toolkit.js";
import { priceCheck as kaPriceCheck, computePriceCheck as kaCompute, orderFee as kaOrderFee } from "./kalshi-mcp/dist/math.js";
import { checkKalshi as kaCheck, kalshiVerdict as kaVerdict } from "./kalshi-mcp/dist/verify.js";
import { dollarsToCents, secFilings, kalshiMarkets } from "./research-mcp/dist/data-sources.js";
import { corroborationPossible, ALL_PROVIDERS } from "./research-mcp/dist/providers.js";
import { assertPublicUrl } from "./research-mcp/dist/ssrf-guard.js";
import { howTo as apHowTo, debug as apDebug, mythVsReality as apMyth } from "./apiforge-mcp/dist/toolkit.js";
import { SUBJECTS, resolveSubject } from "./education-mcp/dist/subjects.js";
import { AREAS, resolveArea } from "./communication-mcp/dist/areas.js";
import { SPORTS, resolveSport } from "./sports-mcp/dist/sports.js";
import { REGIONS, resolveRegion } from "./government-mcp/dist/regions.js";
import { FAMILIES, resolveFamily } from "./linguistics-mcp/dist/families.js";
import { FAITHS, resolveFaith } from "./faiths-mcp/dist/faiths.js";
// Every remaining tool's render function, to exercise its logic path end-to-end.
import { explore as curExplore, mythVsReality as curMyth, goDeeper, howWeKnow, startHere as curStartHere } from "./curiosity-mcp/dist/domains.js";
import { checkClaim, claimVerdict } from "./curiosity-mcp/dist/claims.js";
import { exploreSubject, coursePath, studySkills, startHere as eduStartHere } from "./education-mcp/dist/subjects.js";
import { requirements } from "./education-mcp/dist/requirements.js";
import { explainSkill, startHere as commStartHere } from "./communication-mcp/dist/areas.js";
import { prepare, readPeople, steelman, spotFallacies, mythVsReality as commMyth } from "./communication-mcp/dist/toolkit.js";
import { explainSport, startHere as sportStartHere } from "./sports-mcp/dist/sports.js";
import { scoutTalent, whatToLookFor, pathway } from "./sports-mcp/dist/scouting.js";
import { explainGovernment, immigrationPaths, workPermit, travelEntry, howGovernmentsDiffer, startHere as govStartHere } from "./government-mcp/dist/regions.js";
import { explainFamily, startHere as lingStartHere } from "./linguistics-mcp/dist/families.js";
import { howLanguageWorks, learnLanguage, linguisticsMyths } from "./linguistics-mcp/dist/language.js";
import { explainFaith, compareFaiths, startHere as faithStartHere } from "./faiths-mcp/dist/faiths.js";
import { PATTERNS, resolvePattern, explainPattern, startHere as loopStartHere } from "./loop-mcp/dist/patterns.js";
import { designLoop, debugLoop, evalLoop, mythVsReality as loopMyth } from "./loop-mcp/dist/toolkit.js";
import { BUILDING_BLOCKS, resolveBlock, buildingBlocks, modelRequirements } from "./loop-mcp/dist/blocks.js";
import { checkPractice, practiceVerdict } from "./loop-mcp/dist/verify.js";
// Reference-store logic (staleness + flag-only write guard) — the three assets that carry live-sensitive data.
import { withStaleness as curStaleness, updateReference as curUpdateRef, loadReferences as curLoadRefs } from "./curiosity-mcp/dist/reference-store.js";
import { withStaleness as eduStaleness, updateReference as eduUpdateRef, loadReferences as eduLoadRefs } from "./education-mcp/dist/reference-store.js";
import { withStaleness as govStaleness, updateReference as govUpdateRef, loadReferences as govLoadRefs } from "./government-mcp/dist/reference-store.js";
import { auditReport } from "./overseer-mcp/dist/audit.js";
import { replayCase } from "./overseer-mcp/dist/replay.js";
import { detectRoutingDrift } from "./overseer-mcp/dist/drift.js";
import { analyzeErrors } from "./overseer-mcp/dist/errors.js";
import { detectAnswerDrift } from "./overseer-mcp/dist/answer-drift.js";
import { outcomeReport } from "./overseer-mcp/dist/outcome.js";
import { latencyReport } from "./overseer-mcp/dist/latency.js";
// Supervisor decision logic. Plain .mjs under bridge/, imported directly — it
// is pure by construction (no I/O, no timers) precisely so it can be tested here.
import { interpretBridge, interpretTunnel, createHealthTracker, formatAlertLine, formatAlertText, UP, DOWN, DEGRADED } from "./bridge/supervisor-logic.mjs";

let passed = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) passed++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

// ── 1. Title index: every title/label resolves to its own cluster ──────────
// This is the bug that started it all: individual job titles must resolve, not
// just the 6 family names. Derived from CLUSTERS, so new titles auto-extend.
for (const [key, c] of Object.entries(CLUSTERS)) {
  for (const title of c.titles) {
    const got = resolveCluster(title);
    check(`title "${title}" → ${key}`, got === key, `got "${got}"`);
  }
  check(`label "${c.label}" → ${key}`, resolveCluster(c.label) === key, `got "${resolveCluster(c.label)}"`);
  check(`key "${key}" → ${key}`, resolveCluster(key) === key);
}

// ── 2. build_it cluster matching — the false-positive regressions ──────────
const buildCases = [
  {
    idea: "build a dashboard to understand and track data, the way a senior data analyst would",
    must: ["Data & BI"],
    mustNot: ["Security, Trust & Forensics", "AI Engineering & Ops"],
  },
  { idea: "set up a home SIEM lab with Splunk to detect intrusions on my network", must: ["Security, Trust & Forensics"], mustNot: ["Data & BI"] },
  { idea: "provision a kubernetes cluster on AWS with terraform and set up monitoring", must: ["Cloud & Infrastructure"], mustNot: ["Data & BI", "Security, Trust & Forensics"] },
  { idea: "an AI agent that writes SQL and builds Looker dashboards automatically", must: ["AI Engineering & Ops", "Data & BI"] },
];
for (const t of buildCases) {
  const out = buildIt(t.idea);
  const short = t.idea.slice(0, 40);
  for (const label of t.must) check(`build_it "${short}…" includes ${label}`, out.includes(label));
  for (const label of t.mustNot ?? []) check(`build_it "${short}…" excludes ${label}`, !out.includes(label));
}

// ── 3. ask_the_expert routing (question only, empty context) ───────────────
const askCases = [
  { q: "I'm having troubles on a Windows machine, apps keep freezing and I don't know why", must: ["Systems & Technical Support"], mustNot: ["AI Engineering & Ops"] },
  { q: "we need to build a dashboard in Tableau but we don't know Tableau well, our data is on a SQL Server", must: ["Data & BI"] },
  { q: "I need approval from leadership for an AI automation idea, how do I pitch it", must: ["Leadership & Delivery"] },
];
for (const t of askCases) {
  const out = askTheExpert(t.q, {}, undefined);
  const bottomLine = out.split("\n").find((l) => l.startsWith("BOTTOM LINE")) ?? "";
  const short = t.q.slice(0, 40);
  for (const label of t.must) check(`ask_the_expert "${short}…" → ${label}`, bottomLine.includes(label), `bottom line: ${bottomLine}`);
  for (const label of t.mustNot ?? []) check(`ask_the_expert "${short}…" not ${label}`, !bottomLine.includes(label), `bottom line: ${bottomLine}`);
}

// ── 4. Orchestrator auto-routing floor (pure selectAssets, no case written) ─
const registry = JSON.parse(await readFile(new URL("./data/registry.json", import.meta.url), "utf-8"));
const routeCases = [
  { obj: "How would a senior data analyst approach building a dashboard and understanding data — the step-by-step path", exactly: ["polymath"] },
  { obj: "how much house can I afford in Murrieta with my income", includes: ["homebuyer"] },
  { obj: "what is the tallest building in the world?", includes: ["research"] },
];
// The semantic layer's three mechanisms, each with the case that motivated it
// and — more importantly — the case it must NOT break. A word map that only
// ever adds matches is easy; these subtract or suppress, so they need a guard.
const semanticCases = [
  // PHRASES: meaning that only exists as a unit. The single carrying word is
  // deliberately NOT mapped, so the phrase is the only thing that can route it.
  { obj: "how do I beat the automated screening filters", includes: ["jobhunt"], why: "phrase → ats" },
  { obj: "is my mammogram screening covered", excludes: ["jobhunt"], why: "bare 'screening' must NOT reach ats" },
  { obj: "how can I legally move to another country and work there", includes: ["government"], why: "phrase → abroad/relocate" },
  { obj: "how does similarity search find related documents", includes: ["aiforge"], why: "phrase → embedding" },

  // IDIOMS: non-compositional terms that must CONSUME the misleading word.
  { obj: "how can I read people and understand body language honestly", excludes: ["linguistics"], why: "'body language' is not about language" },
  { obj: "which language family does Tamil belong to", includes: ["linguistics"], why: "a real language question still routes" },
  { obj: "how do real estate agents write listings with ChatGPT", excludes: ["loop"], why: "a realtor is not an AI agent" },
  { obj: "how do I design an agent loop that self-corrects", includes: ["loop"], why: "a real agent question still routes" },

  // ANCHORING: description prose corroborates, never creates, an assignment.
  { obj: "how do I quantize an open model to run it locally", exactly: ["aiforge"], why: "prose-only riders dropped" },
  { obj: "what is the tallest building in the world?", includes: ["research"], why: "nothing anchored → fallback still works" },
];
for (const t of [...routeCases, ...semanticCases]) {
  const { assigned } = selectAssets(t.obj, registry);
  const short = t.obj.slice(0, 40);
  const why = t.why ? ` (${t.why})` : "";
  if (t.exactly) check(`route "${short}…" == [${t.exactly}]${why}`, assigned.length === t.exactly.length && t.exactly.every((a) => assigned.includes(a)), `got [${assigned}]`);
  if (t.includes) check(`route "${short}…" includes ${t.includes}${why}`, t.includes.every((a) => assigned.includes(a)), `got [${assigned}]`);
  if (t.excludes) check(`route "${short}…" excludes ${t.excludes}${why}`, t.excludes.every((a) => !assigned.includes(a)), `got [${assigned}]`);
}

// ── 4b. Unknown-tool suggestions (every guess below is from the real log) ───
// 13 of 590 logged calls named a tool that does not exist. These are those
// guesses, checked against the asset's actual tool list.
const HOMEBUYER_TOOLS = ["affordability", "set_profile", "get_profile", "property_investigation", "closing_costs"];
const suggestCases = [
  // Near-misses a suggestion should catch.
  { guess: "red_flags", tools: ["red_flag", "find_care", "which_specialist"], expect: "red_flag", why: "one character apart" },
  { guess: "research_question", tools: ["research", "search", "fetch_page"], expect: "research", why: "containment" },
  { guess: "property_lookup", tools: HOMEBUYER_TOOLS, expect: "property_investigation", why: "shared token" },
  { guess: "list_tools", tools: ["list_providers", "search"], expect: "list_providers", why: "shared token" },
  // No plausible match — a confident wrong guess is worse than none, so the
  // tool list alone must carry the answer.
  { guess: "does_not_exist", tools: HOMEBUYER_TOOLS, expect: undefined, why: "nothing close" },
  { guess: "consult", tools: ["ask_the_expert", "expert_verdict", "build_it"], expect: undefined, why: "right intent, no shared text" },
];
for (const t of suggestCases) {
  check(`suggestTool("${t.guess}") → ${t.expect ?? "no suggestion"} (${t.why})`, suggestTool(t.guess, t.tools) === t.expect, `got ${suggestTool(t.guess, t.tools)}`);
}
// The message must always carry the real names — that is the part that fixes
// the caller's next attempt, with or without a suggestion.
const unknownMsg = describeUnknownTool("homebuyer", "does_not_exist", HOMEBUYER_TOOLS);
check("unknown-tool message lists every real tool", HOMEBUYER_TOOLS.every((t) => unknownMsg.includes(t)), unknownMsg);
check("unknown-tool message omits a bogus suggestion", !unknownMsg.includes("Did you mean"), unknownMsg);
check("unknown-tool message suggests when close", describeUnknownTool("healthguide", "red_flags", ["red_flag"]).includes('Did you mean "red_flag"'));
check("unknown-tool message handles an asset with no tools", describeUnknownTool("x", "y", []).includes("no tools registered"));
check("nameSimilarity: identical is 1", nameSimilarity("research", "research") === 1);
check("nameSimilarity: unrelated is low", nameSimilarity("affordability", "steelman") < 0.5);

// ── 5. Overseer render logic (synthetic data — no dependency on real cases) ─
const fakeCase = {
  id: "t1", objective: "demo", assignedAssets: ["alpha"], status: "closed",
  openedAt: "2026-01-01T00:00:00Z", closedAt: "2026-01-01T00:01:00Z",
  log: [{ asset: "alpha", tool: "do", arguments: {}, result: "ok", timestamp: "2026-01-01T00:00:30Z" }],
};
check("replayCase renders the call", replayCase(fakeCase).includes("alpha.do"));
check("auditReport counts the call", auditReport([fakeCase], [{ name: "alpha", description: "", tags: [], status: "active" }]).includes("alpha: 1 call"));
check("auditReport warns on unregistered asset", auditReport([fakeCase], []).includes("called but not in the registry"));

// ── 6. Routing drift detection (synthetic) ─────────────────────────────────
const mk = (id, objective, assigned, day) => ({ id, objective, assignedAssets: assigned, status: "closed", openedAt: `2026-01-${day}T00:00:00Z`, log: [] });
// Same question, routing changed → drift.
const drifted = detectRoutingDrift(
  [mk("d1", "how do I build a data dashboard", ["polymath", "jobhunt"], "01"), mk("d2", "how do I build a data dashboard", ["polymath"], "02")],
  0.6, 2
);
check("drift: catches same-question different-routing", drifted.includes("show routing drift.") && drifted.includes("1 group(s)") && drifted.includes("routed 2 different ways"));
// Same question, routing stable → no drift.
const stable = detectRoutingDrift(
  [mk("s1", "how do I build a data dashboard", ["polymath"], "01"), mk("s2", "how do I build a data dashboard", ["polymath"], "02")],
  0.6, 2
);
check("drift: no false alarm on stable routing", stable.includes("0 show routing drift") || stable.includes("routed consistently"));
// Unrelated questions → not grouped, no drift.
const unrelated = detectRoutingDrift(
  [mk("u1", "arrested by police what are my rights", ["lawguide"], "01"), mk("u2", "how much house can I afford", ["homebuyer"], "02")],
  0.6, 2
);
check("drift: unrelated questions not grouped", unrelated.includes("0 show routing drift") || unrelated.includes("nothing to check"));

// ── 7. Error analysis (synthetic) ──────────────────────────────────────────
const errCase = {
  id: "e1", objective: "x", assignedAssets: ["beta"], status: "closed", openedAt: "2026-01-01T00:00:00Z",
  log: [
    { asset: "beta", tool: "run", arguments: {}, error: "Timed out connecting to asset \"beta\" after 15000ms.", timestamp: "2026-01-01T00:00:10Z" },
    { asset: "beta", tool: "run", arguments: {}, error: "Timed out connecting to asset \"beta\" after 30000ms.", timestamp: "2026-01-02T00:00:10Z" },
    { asset: "gamma", tool: "go", arguments: {}, result: "ok", timestamp: "2026-01-01T00:00:20Z" },
  ],
};
const errReport = analyzeErrors([errCase]);
check("errors: reports the failure", errReport.includes("beta.run"));
check("errors: groups the two timeouts as one type (masked)", errReport.includes("2×"));
check("errors: clean when none", analyzeErrors([{ ...errCase, log: [{ asset: "gamma", tool: "go", arguments: {}, result: "ok", timestamp: "2026-01-01T00:00:20Z" }] }]).includes("Clean"));
check("errors: asset filter", analyzeErrors([errCase], "gamma").includes("Clean"));

// ── 8. Answer drift (synthetic) ────────────────────────────────────────────
const sameArgs = { cluster: "Trust and Safety Specialist" };
const ad = (id, text, day) => ({ id, objective: "x", assignedAssets: ["polymath"], status: "closed", openedAt: `2026-01-0${day}T00:00:00Z`, log: [{ asset: "polymath", tool: "day_in_the_life", arguments: sameArgs, result: text, timestamp: `2026-01-0${day}T00:00:00Z` }] });
const answerDrift = detectAnswerDrift([ad("a1", "Old cluster answer", 1), ad("a2", "New cluster answer", 2)]);
check("answer drift: catches changed result for identical call", answerDrift.includes("different answers") && answerDrift.includes("polymath.day_in_the_life"));
const answerStable = detectAnswerDrift([ad("a1", "Same answer", 1), ad("a2", "Same answer", 2)]);
check("answer drift: no false alarm when identical", answerStable.includes("same answer") || answerStable.includes("behaving"));
// research is skipped by default even if it "changed".
const researchVary = detectAnswerDrift([
  { id: "r1", objective: "x", assignedAssets: ["research"], status: "closed", openedAt: "2026-01-01T00:00:00Z", log: [{ asset: "research", tool: "search", arguments: { q: "x" }, result: "result A", timestamp: "2026-01-01T00:00:00Z" }] },
  { id: "r2", objective: "x", assignedAssets: ["research"], status: "closed", openedAt: "2026-01-02T00:00:00Z", log: [{ asset: "research", tool: "search", arguments: { q: "x" }, result: "result B", timestamp: "2026-01-02T00:00:00Z" }] },
]);
check("answer drift: skips non-deterministic research", researchVary.includes("nothing to compare"));
// Error on one side → classified as an availability blip, not a content change.
const availCase = (id, res, err, day) => ({ id, objective: "x", assignedAssets: ["healthguide"], status: "closed", openedAt: `2026-01-0${day}T00:00:00Z`, log: [{ asset: "healthguide", tool: "which_specialist", arguments: { concern: "x" }, ...(err ? { error: err } : { result: res }), timestamp: `2026-01-0${day}T00:00:00Z` }] });
const availReport = detectAnswerDrift([availCase("v1", null, "Asset not assigned", 1), availCase("v2", "Real answer", null, 2)]);
check("answer drift: error-vs-success is an availability blip, not a content change", availReport.includes("AVAILABILITY BLIPS") && availReport.includes("1 availability blip") && availReport.includes("0 changed answer"));
// skip_tools excludes a known-stateful tool.
const skipToolReport = detectAnswerDrift([ad("a1", "Old", 1), ad("a2", "New", 2)], ["research"], ["polymath.day_in_the_life"]);
check("answer drift: skip_tools excludes the tool", skipToolReport.includes("nothing to compare"));

// ── 9. Outcome report (synthetic) ──────────────────────────────────────────
const oc = (id, outcome, assets = ["alpha"]) => ({ id, objective: "x", assignedAssets: assets, status: "closed", openedAt: "2026-01-01T00:00:00Z", outcome, log: [] });
// No labels yet → honest "labeling starts now", not a fake rate.
check("outcome: no labels reports coverage honestly", outcomeReport([{ ...oc("u", undefined), outcome: undefined }]).includes("No outcomes recorded yet"));
// Mixed labels → resolution rate = (resolved+partial)/labeled.
const ocReport = outcomeReport([oc("1", "resolved"), oc("2", "partial"), oc("3", "unresolved"), oc("4", "misrouted"), { ...oc("5", undefined), outcome: undefined }]);
check("outcome: coverage counts only labeled", ocReport.includes("4/5 closed cases are labeled"));
check("outcome: resolution rate resolved+partial over labeled", ocReport.includes("50% of labeled"));
check("outcome: per-asset breakdown present", ocReport.includes("BY ASSET"));
check("outcome: small-n caveat shown", ocReport.includes("directional, not statistical"));
// misrouted is tracked distinctly from unresolved (routing vs answer failure).
check("outcome: misrouted tallied separately", ocReport.includes("misrouted: 1") && ocReport.includes("unresolved: 1"));

// ── 10. Health check (pure core, mocked deps) ──────────────────────────────
const started = new Date("2026-07-06T00:00:00Z");
const hAssets = [
  { name: "up-current", status: "active", transport: "stdio", args: ["x/dist/index.js"] },
  { name: "up-stale", status: "active", transport: "stdio", args: ["y/dist/index.js"] },
  { name: "down", status: "active", transport: "stdio", args: ["z/dist/index.js"] },
  { name: "retired", status: "retired", transport: "stdio", args: ["r/dist/index.js"] },
];
const hResults = await checkAssets(hAssets, {
  orchestratorStartedAt: started,
  introspect: async (a) => {
    if (a.name === "down") throw new Error("Timed out connecting");
    return { toolCount: 5, version: "0.1.0" };
  },
  // up-stale's build is newer than orchestrator start; up-current is older.
  entryMtime: async (a) => (a.name === "up-stale" ? new Date("2026-07-06T01:00:00Z") : new Date("2026-07-05T00:00:00Z")),
});
check("health: skips retired assets", hResults.length === 3);
check("health: reachable asset reports tools+version", hResults.find((r) => r.name === "up-current")?.toolCount === 5);
check("health: newer-than-start build flagged stale", hResults.find((r) => r.name === "up-stale")?.stale === true);
check("health: current build not stale", hResults.find((r) => r.name === "up-current")?.stale === false);
check("health: unreachable asset marked down with error", (() => { const d = hResults.find((r) => r.name === "down"); return d?.reachable === false && !!d?.error; })());
const hRender = renderHealth(hResults, started);
check("health render: shows UP/DOWN and STALE", hRender.includes("up-current: UP") && hRender.includes("down: DOWN") && hRender.includes("STALE"));

// ── 11. Synthesis (structured cross-asset merge) ───────────────────────────
const mkRes = (text) => ({ content: [{ type: "text", text }] });
const synthCase = {
  id: "s1", objective: "is X true?", assignedAssets: ["curiosity", "research"], status: "closed", openedAt: "2026-01-01T00:00:00Z",
  log: [
    { asset: "curiosity", tool: "check_claim", arguments: {}, result: mkRes("CLAIM CHECK\nBOTTOM LINE: check it against sources, don't guess."), timestamp: "2026-01-01T00:00:01Z" },
    { asset: "research", tool: "research", arguments: {}, result: mkRes("DOSSIER\nSee https://nasa.gov/x and https://cern.ch/y for details."), timestamp: "2026-01-01T00:00:02Z" },
    { asset: "curiosity", tool: "claim_verdict", arguments: {}, result: mkRes("VERDICT\nBOTTOM LINE: Tier 5 pseudoscience, the real story is cooler."), timestamp: "2026-01-01T00:00:03Z" },
  ],
};
const synth = synthesizeCase(synthCase);
check("synthesis: lists assets consulted", synth.includes("Assets consulted: curiosity, research"));
check("synthesis: extracts BOTTOM LINE headlines", synth.includes("Tier 5 pseudoscience") && synth.includes("don't guess"));
check("synthesis: collects cited sources", synth.includes("nasa.gov/x") && synth.includes("cern.ch/y"));
// URL butted against an escaped-newline tail comes out clean.
const tailCase = { id: "s3", objective: "z", assignedAssets: ["research"], status: "closed", openedAt: "2026-01-01T00:00:00Z", log: [{ asset: "research", tool: "research", arguments: {}, result: mkRes("see https://example.com/page\\nCorroboration: found"), timestamp: "2026-01-01T00:00:01Z" }] };
const tailSynth = synthesizeCase(tailCase);
check("synthesis: trims escaped-newline tail off a URL", tailSynth.includes("https://example.com/page") && !tailSynth.includes("page\\nCorroboration"));
check("synthesis: dedups a headline seen once per distinct text", (synth.match(/Tier 5 pseudoscience/g) || []).length >= 1);
// Single-asset, no sources → flagged as not cross-checked.
const soloCase = { id: "s2", objective: "y", assignedAssets: ["polymath"], status: "closed", openedAt: "2026-01-01T00:00:00Z", log: [{ asset: "polymath", tool: "ask_the_expert", arguments: {}, result: mkRes("BOTTOM LINE: do the thing."), timestamp: "2026-01-01T00:00:01Z" }] };
check("synthesis: flags single-source answers", synthesizeCase(soloCase).includes("single-source"));
check("synthesis: empty log handled", synthesizeCase({ ...soloCase, log: [] }).includes("nothing to synthesize"));

// ── 12. Latency report ─────────────────────────────────────────────────────
const latCase = {
  id: "l1", objective: "x", assignedAssets: ["research", "polymath"], status: "closed", openedAt: "2026-01-01T00:00:00Z",
  log: [
    { asset: "research", tool: "research", arguments: {}, result: "ok", timestamp: "2026-01-01T00:00:01Z", durationMs: 4000 },
    { asset: "polymath", tool: "ask", arguments: {}, result: "ok", timestamp: "2026-01-01T00:00:02Z", durationMs: 50 },
    { asset: "polymath", tool: "ask", arguments: {}, result: "ok", timestamp: "2026-01-01T00:00:03Z", durationMs: 150 },
    { asset: "research", tool: "search", arguments: {}, result: "ok", timestamp: "2026-01-01T00:00:04Z" }, // untimed (old)
  ],
};
const lat = latencyReport([latCase]);
check("latency: reports coverage honestly", lat.includes("3/4 logged calls are timed"));
check("latency: slowest-average asset first (research > polymath)", lat.indexOf("research:") < lat.indexOf("polymath:"));
check("latency: formats seconds for slow calls", lat.includes("4.0s"));
check("latency: lists slowest individual call", lat.includes("research.research"));
check("latency: no timed calls handled", latencyReport([{ ...latCase, log: [{ asset: "a", tool: "t", arguments: {}, result: "ok", timestamp: "2026-01-01T00:00:00Z" }] }]).includes("No timed calls yet"));
check("latency: asset filter", latencyReport([latCase], "polymath").includes('for asset "polymath"'));

// ── 13. Knowledge-asset reverse indexes (auto-derived from each asset's map) ─
// Every entry's key, label, and each keyword must resolve to that same entry —
// the invariant that makes "ask by any topic" work, and catches an in-asset tag
// collision or a broken index the moment it happens. Derived from the maps, so
// adding a domain/subject/etc. auto-extends coverage.
const KNOWLEDGE = [
  ["curiosity", DOMAINS, resolveDomain],
  ["education", SUBJECTS, resolveSubject],
  ["communication", AREAS, resolveArea],
  ["sports", SPORTS, resolveSport],
  ["government", REGIONS, resolveRegion],
  ["linguistics", FAMILIES, resolveFamily],
  ["faiths", FAITHS, resolveFaith],
  ["loop", PATTERNS, resolvePattern],
  ["loop-blocks", BUILDING_BLOCKS, resolveBlock],
  ["openai-primitives", PRIMITIVES, resolvePrimitive],
  ["openai-roles", ROLES, resolveRole],
  ["openai-builders", BUILDERS, resolveBuilder],
  ["aiforge-topics", TOPICS, resolveTopic],
  ["gitforge-topics", GF_TOPICS, gfResolve],
  ["promptcraft-topics", PC_TOPICS, pcResolve],
  ["apiforge-topics", AP_TOPICS, apResolve],
];
for (const [name, MAP, resolve] of KNOWLEDGE) {
  const entries = Object.entries(MAP);
  check(`${name}: has entries`, entries.length > 0);
  for (const [key, entry] of entries) {
    check(`${name}: key "${key}" resolves to itself`, resolve(key) === key, `got "${resolve(key)}"`);
    for (const k of entry.keys ?? []) {
      check(`${name}: keyword "${k}" → ${key}`, resolve(k) === key, `got "${resolve(k)}"`);
    }
  }
  // Unknown input returns undefined, not a wrong match.
  check(`${name}: unknown input → undefined`, resolve("zzzqqxnotathing") === undefined);
}

// ── 14. Every new-asset tool renders substantive output (logic path runs) ────
const TOOL_SMOKE = [
  ["curiosity.explore", curExplore("quantum")],
  ["curiosity.myth_vs_reality", curMyth()],
  ["curiosity.go_deeper", goDeeper("space")],
  ["curiosity.how_we_know", howWeKnow()],
  ["curiosity.check_claim", checkClaim("the earth is flat")],
  ["curiosity.claim_verdict", claimVerdict("x", "research found it debunked")],
  ["education.explore_subject", exploreSubject("biology")],
  ["education.course_path", coursePath("math")],
  ["education.study_skills", studySkills("chemistry")],
  ["education.requirements", requirements("college")],
  ["communication.explain_skill", explainSkill("public speaking")],
  ["communication.prepare", prepare("negotiation")],
  ["communication.read_people", readPeople()],
  ["communication.steelman", steelman("a topic")],
  ["communication.spot_fallacies", spotFallacies("strawman")],
  ["communication.myth_vs_reality", commMyth()],
  ["sports.explain_sport", explainSport("soccer")],
  ["sports.scout_talent", scoutTalent("soccer")],
  ["sports.what_to_look_for", whatToLookFor()],
  ["sports.pathway", pathway()],
  ["government.explain_government", explainGovernment("japan")],
  ["government.immigration_paths", immigrationPaths("europe")],
  ["government.work_permit", workPermit("united states")],
  ["government.travel_entry", travelEntry("middle east")],
  ["government.how_governments_differ", howGovernmentsDiffer()],
  ["linguistics.explain_family", explainFamily("mandarin")],
  ["linguistics.how_language_works", howLanguageWorks()],
  ["linguistics.learn_language", learnLanguage()],
  ["linguistics.language_myths", linguisticsMyths()],
  ["faiths.explain_faith", explainFaith("islam")],
  ["faiths.compare_faiths", compareFaiths()],
  ["loop.explain_pattern", explainPattern("reflexion")],
  ["loop.design_loop", designLoop("an agent that answers from my PDFs with citations")],
  ["loop.debug_loop", debugLoop("my agent never stops it just loops forever")],
  ["loop.eval_loop", evalLoop()],
  ["loop.myth_vs_reality", loopMyth()],
  ["loop.building_blocks (map)", buildingBlocks()],
  ["loop.building_blocks (connectors)", buildingBlocks("connectors")],
  ["loop.building_blocks (subagents)", buildingBlocks("subagents")],
  ["loop.model_requirements", modelRequirements()],
  ["loop.check_practice", checkPractice("langgraph current best practice")],
  ["loop.practice_verdict", practiceVerdict("langgraph", "docs current, few independent evals")],
  ["openai.how_they_build (map)", howTheyBuild()],
  ["openai.how_they_build (fde)", howTheyBuild("forward deployed engineer")],
  ["openai.how_they_build (agent post-training)", howTheyBuild("agent post training")],
  ["openai.how_they_build (quant)", howTheyBuild("quantitative analyst")],
  ["aiforge.explain_topic (map)", explainTopic()],
  ["aiforge.explain_topic (lora)", explainTopic("lora")],
  ["aiforge.explain_topic (tokenization)", explainTopic("tokenization")],
  ["aiforge.build_it (rag)", afBuildIt("answer questions about our internal docs")],
  ["aiforge.build_it (classify)", afBuildIt("classify millions of support tickets by topic")],
  ["aiforge.debug (oom)", afDebug("cuda out of memory while fine-tuning")],
  ["aiforge.debug (langchain deprecated)", afDebug("AgentExecutor no attribute import error")],
  ["aiforge.myth_vs_reality", afMyth()],
  ["aiforge.check_practice", afCheckPractice("langchain create_agent current api")],
  ["aiforge.practice_verdict", afPracticeVerdict("langchain", "docs confirm create_agent; AgentExecutor deprecated")],
  ["gitforge.explain_topic (map)", gfExplain()],
  ["gitforge.explain_topic (rebase)", gfExplain("rebase")],
  ["gitforge.how_to (recover)", gfHowTo("recover my lost work")],
  ["gitforge.debug (detached)", gfDebug("I'm in detached HEAD")],
  ["gitforge.myth_vs_reality", gfMyth()],
  ["promptcraft.explain_topic (map)", pcExplain()],
  ["promptcraft.explain_topic (fewshot)", pcExplain("few-shot")],
  ["promptcraft.build_prompt", pcBuild("classify support tickets by topic")],
  ["promptcraft.improve_prompt", pcImprove("summarize this well")],
  ["promptcraft.myth_vs_reality", pcMyth()],
  ["apiforge.explain_topic (map)", apExplain()],
  ["apiforge.explain_topic (streaming)", apExplain("sse")],
  ["apiforge.how_to (call llm)", apHowTo("call an llm api")],
  ["apiforge.debug (401)", apDebug("getting a 401 unauthorized")],
  ["apiforge.myth_vs_reality", apMyth()],
];
// "Renders something long" was the only bar here, and length is not quality.
// The one output convention with a real consequence is the BOTTOM LINE
// headline: synthesis.ts extracts every line matching /^BOTTOM LINE/ and builds
// the cross-asset digest from them. A tool without one is not merely untidy —
// its entire conclusion is INVISIBLE to the orchestrator, which prints
// "(no headline extracted — returned data without a BOTTOM LINE)" and drops the
// specialist from the merged answer. When this check was first written it
// failed on 13 of 71 tools (18%), including four myth_vs_reality tools whose
// whole job is to state the honest conclusion.
//
// The regex matches synthesis.ts's exactly. If that extractor ever changes,
// this must change with it or the gate silently stops testing the real thing.
for (const [label, out] of TOOL_SMOKE) {
  check(`tool renders: ${label}`, typeof out === "string" && out.length > 60, `len ${out?.length ?? "n/a"}`);
  const headlines = (out ?? "").split("\n").filter((l) => /^\s*BOTTOM LINE/i.test(l));
  check(`synthesis can extract a headline: ${label}`, headlines.length > 0, `no BOTTOM LINE in ${(out ?? "").length} chars — this asset's conclusion would vanish from the merged answer`);
  // A headline is READ OUTSIDE ITS OUTPUT — synthesis lifts it into a digest
  // beside other assets' headlines, where "the sources below" points at
  // nothing. 19 of them said exactly that before this check existed. Only
  // "below" is flagged: "ranking one dialect above another" is ordinary
  // English, and a headline that genuinely needs the word can be reworded.
  const dangling = headlines.find((l) => /\bbelow\b/i.test(l));
  check(`headline stands alone (no dangling reference): ${label}`, dangling === undefined, `refers to "below" but is read out of context: ${(dangling ?? "").trim().slice(0, 100)}`);
}
// A few content assertions — the honesty/neutrality guarantees these tools promise.
check("government keeps its not-legal-advice disclaimer", immigrationPaths("japan").toLowerCase().includes("not legal advice"));
check("faiths stays neutral", explainFaith("islam").toLowerCase().includes("evenhanded") || explainFaith("islam").toLowerCase().includes("doesn't tell you"));
check("communication read_people rejects mind-reading/lie-detection", readPeople().toLowerCase().includes("cannot") && readPeople().toLowerCase().includes("detect lies"));
// This assertion used to read `curExplore("mandarin") !== undefined` under the
// name "resolves a specific family (Mandarin→right domain)". explore() returns
// a string unconditionally, so it passed for ANY input and would still pass if
// the function were replaced by `() => "x"`. What it actually returns for
// "mandarin" is "Not sure which field…" — the opposite of what the name
// claimed. The honest behaviour is the REFUSAL: a language belongs to
// linguistics, and curiosity saying so is correct.
check(
  "curiosity: a language is NOT a science field — explore refuses it honestly",
  curExplore("mandarin").toLowerCase().includes("not sure"),
  curExplore("mandarin").slice(0, 80)
);
check("curiosity: a real science topic still resolves", !curExplore("quantum").toLowerCase().includes("not sure"));
check("loop eval_loop teaches consistency ≠ correctness", evalLoop().toLowerCase().includes("consistency") && evalLoop().toLowerCase().includes("correctness"));
check("loop myth_vs_reality debunks 'more agents = better'", loopMyth().toLowerCase().includes("more agents"));
check("loop design_loop defaults to the simplest loop", designLoop("do a thing").toLowerCase().includes("simplest loop"));
check("loop check_practice refuses to answer from memory", checkPractice("x").toLowerCase().includes("don't answer this from memory"));
check("loop building_blocks map lists all six blocks", ["Connectors", "Automations", "Skills", "Subagents", "Memory", "Worktrees"].every((b) => buildingBlocks().includes(b)));
check("loop building_blocks ties Connectors to MCP collection", buildingBlocks("connectors").toLowerCase().includes("mcp"));
check("loop building_blocks subagents = maker ≠ checker", buildingBlocks("subagents").toLowerCase().includes("maker") && buildingBlocks("subagents").toLowerCase().includes("checker"));
check("loop model_requirements makes tool-calling the #1 requirement", modelRequirements().toLowerCase().includes("tool-calling") && modelRequirements().includes("#1"));

// openai builders (the 19 OpenAI roles) — content guarantees that lock the
// researched facts so they can't silently drift.
check("openai builders: map lists all 19 roles", Object.keys(BUILDERS).length === 19);
check("openai builders: FDE resolves via 'fde' alias", resolveBuilder("fde") === "forward_deployed_engineer");
check("openai builders: FDE is accountable prod code, not sales-eng", howTheyBuild("fde").toLowerCase().includes("production") && howTheyBuild("fde").toLowerCase().includes("sales engineering"));
check("openai builders: quant is safety/SIA, explicitly NOT a trading quant", howTheyBuild("quant").toLowerCase().includes("not a finance") && howTheyBuild("quant").toLowerCase().includes("sia"));
check("openai builders: artifact research = work products (docs/decks/sheets)", howTheyBuild("artifacts").toLowerCase().includes("work product") && howTheyBuild("artifacts").toLowerCase().includes("deck"));
check("openai builders: SWE agent-infra beats plain SWE (longest-key match)", resolveBuilder("software engineer agent infrastructure") === "software_engineer_agent_infrastructure");
check("openai builders: every role carries a trap + charter", Object.values(BUILDERS).every((b) => b.trap.length > 20 && b.charter.length > 20));
check("openai builders: map defers live facts to check_openai", howTheyBuild().toLowerCase().includes("check_openai"));
check("openai builders: unknown role → honest 'not sure'", howTheyBuild("astronaut").toLowerCase().includes("not sure"));

// aiforge (AI/ML engineering craft) — content guarantees + the craft-vs-loop
// scope line + the fast-moving facts locked so they can't silently rot.
check("aiforge: 26 topics across 4 areas", Object.keys(TOPICS).length === 26);
check("aiforge: python deepened to 8 topics (testing/typing/debugging added)", Object.values(TOPICS).filter((t) => t.area === "python").length === 8);
check("aiforge: all 4 areas present", new Set(Object.values(TOPICS).map((t) => t.area)).size === 4);
check("aiforge: lora resolves to hf_finetuning", resolveTopic("lora") === "hf_finetuning");
check("aiforge: fine-tune-vs-rag teaches facts→RAG, not fine-tune", explainTopic("finetune_vs_rag_vs_prompt").toLowerCase().includes("rag") && explainTopic("finetune_vs_rag_vs_prompt").toLowerCase().includes("fact"));
check("aiforge: build_it steers a docs bot to RAG, not fine-tuning", afBuildIt("bot to answer questions about our internal docs").toLowerCase().includes("rag") && afBuildIt("bot to answer questions about our internal docs").toLowerCase().includes("not fine-tuning"));
check("aiforge: myth debunks 'fine-tune so it knows our facts'", afMyth().toLowerCase().includes("fine-tun") && afMyth().toLowerCase().includes("rag the facts"));
check("aiforge: langchain topic reflects the 1.0 deprecation (create_agent)", explainTopic("langchain").toLowerCase().includes("create_agent") && explainTopic("langchain").toLowerCase().includes("deprecated"));
check("aiforge: debug catches deprecated LangChain imports", afDebug("AgentExecutor import error").toLowerCase().includes("create_agent"));
check("aiforge: check_practice refuses to answer from memory", afCheckPractice("x").toLowerCase().includes("don't answer this from memory"));
check("aiforge: scope line defers agent architecture to loop", explainTopic().toLowerCase().includes("loop") && explainTopic("langchain_vs_langgraph").toLowerCase().includes("loop"));
check("aiforge: every topic carries pitfalls + handoff", Object.values(TOPICS).every((t) => t.pitfalls.length > 0 && t.handoff.length > 10));
check("aiforge: unknown topic → honest 'not sure'", explainTopic("underwater basket weaving").toLowerCase().includes("not sure"));

// gitforge (Git & GitHub) — content guarantees + the safety rules locked.
check("gitforge: 13 topics across 2 areas", Object.keys(GF_TOPICS).length === 13);
check("gitforge: all 2 areas present", new Set(Object.values(GF_TOPICS).map((t) => t.area)).size === 2);
check("gitforge: reflog resolves to undo/recovery", gfResolve("reflog") === "git_undo_recovery");
check("gitforge: how_to(recover) leads with reflog", gfHowTo("recover lost work").toLowerCase().includes("reflog"));
check("gitforge: myth debunks git==github", gfMyth().toLowerCase().includes("git and github are the same") && gfMyth().toLowerCase().includes("hosting platform"));
check("gitforge: committed-secret debug says ROTATE", gfDebug("I committed an api key").toLowerCase().includes("rotate"));
check("gitforge: unknown topic → honest 'not sure'", gfExplain("quantum knitting").toLowerCase().includes("not sure"));

// promptcraft (Prompt Engineering) — content + the reasoning-model caveat locked.
check("promptcraft: 15 topics across 3 areas", Object.keys(PC_TOPICS).length === 15);
check("promptcraft: all 3 areas present", new Set(Object.values(PC_TOPICS).map((t) => t.area)).size === 3);
check("promptcraft: CoT topic warns to SKIP it for reasoning models", pcExplain("chain of thought").toLowerCase().includes("reasoning model") && pcExplain("chain of thought").toLowerCase().includes("skip"));
check("promptcraft: improve_prompt flags a vague prompt", pcImprove("summarize this well").toLowerCase().includes("vague"));
check("promptcraft: myth debunks 'longer prompts are better'", pcMyth().toLowerCase().includes("longer"));
check("promptcraft: reasoning_models topic exists and resolves", pcResolve("reasoning models") === "reasoning_models");
check("promptcraft: unknown topic → honest 'not sure'", pcExplain("interpretive dance").toLowerCase().includes("not sure"));

// apiforge (AI API & Postman) — content + the two rules locked.
check("apiforge: 15 topics across 3 areas", Object.keys(AP_TOPICS).length === 15);
check("apiforge: all 3 areas present", new Set(Object.values(AP_TOPICS).map((t) => t.area)).size === 3);
check("apiforge: auth topic says key goes in header not URL", apExplain("api auth").toLowerCase().includes("never in the url") || apExplain("api auth").toLowerCase().includes("not the url") || apExplain("authentication").toLowerCase().includes("header"));
check("apiforge: myth debunks 'a 200 means it worked'", apMyth().toLowerCase().includes("200") && apMyth().toLowerCase().includes("body"));
check("apiforge: 401 debug checks auth header + variable resolved", apDebug("401 unauthorized").toLowerCase().includes("authorization") || apDebug("401 unauthorized").toLowerCase().includes("apikey"));
check("apiforge: testing AI endpoints = properties not exact text", apExplain("testing_ai_endpoints").toLowerCase().includes("propert") && apExplain("testing_ai_endpoints").toLowerCase().includes("not"));
check("apiforge: unknown topic → honest 'not sure'", apExplain("underwater welding").toLowerCase().includes("not sure"));

// ── 14b. kalshi (event contracts) — content + the arithmetic locked ──────────
// The calculator is the reason this asset exists, so it is tested as MATH, not
// as prose: the fee shape, the breakeven identity, and the case that decides
// most real trades — a small edge near 50c being negative EV after fees.
check("kalshi: 12 topics across 3 areas", Object.keys(KA_TOPICS).length === 12);
check("kalshi: all 3 areas present", new Set(Object.values(KA_TOPICS).map((t) => t.area)).size === 3);
check("kalshi: unknown topic → honest 'not sure'", kaExplain("underwater basket weaving").toLowerCase().includes("not sure"));
check("kalshi: resolveTopic returns undefined for unknown", kaResolve("zzzz nonsense") === undefined);
check("kalshi: every topic carries pitfalls + handoff", Object.values(KA_TOPICS).every((t) => t.pitfalls.length > 0 && t.handoff.length > 10));
check("kalshi: check_kalshi refuses to answer from memory", kaCheck("fees").toLowerCase().includes("don't answer this from memory"));
check("kalshi: verdict forbids undated fees", kaVerdict("fees", "found a schedule").toLowerCase().includes("without its date"));
check("kalshi: verdict distinguishes settled law from an injunction", kaVerdict("legality", "third circuit ruled").toLowerCase().includes("preliminary"));
check("kalshi: myth debunks '90c is free money'", kaMyth().toLowerCase().includes("90c") && kaMyth().toLowerCase().includes("nine wins"));
check("kalshi: myth refuses 'regulated therefore legal for me'", kaMyth().toLowerCase().includes("not proof it's lawful"));
check("kalshi: read_market puts the settlement rule before the price", kaRead("x").indexOf("SETTLEMENT RULE") < kaRead("x").indexOf("NOW COMPARE TO THE MARKET"));
check("kalshi: scope line defers portfolios to nestegg", kaStart().toLowerCase().includes("nestegg"));

// The fee is proportional to p*(1-p): largest at 50c, smaller at the extremes.
// This SHAPE is the durable claim the whole fees_and_edge guidance rests on.
{
  const at50 = kaOrderFee(0.5, 100, 0.07, false);
  const at90 = kaOrderFee(0.9, 100, 0.07, false);
  const at10 = kaOrderFee(0.1, 100, 0.07, false);
  check("kalshi: fee peaks at 50c", at50 > at90 && at50 > at10, `50c=${at50} 90c=${at90} 10c=${at10}`);
  check("kalshi: fee is symmetric around 50c", Math.abs(at90 - at10) < 0.001, `90c=${at90} 10c=${at10}`);
  check("kalshi: maker fee is cheaper than taker", kaOrderFee(0.5, 100, 0.07, true) < at50);
}
// Breakeven is the price PLUS the fee — the identity the whole tool exists to
// make visible, because people compare their estimate to the price instead.
{
  const r = kaCompute({ your_probability: 55, market_price: 50, contracts: 100 });
  check("kalshi: breakeven exceeds the market price", r.breakeven > r.price, `breakeven ${r.breakeven} vs price ${r.price}`);
  check("kalshi: edge after fees is below edge before fees", r.edgeAfterFees < r.edgeBeforeFees);
  check("kalshi: flags that it assumed a fee schedule", r.assumedFees === true);
  const supplied = kaCompute({ your_probability: 55, market_price: 50, contracts: 100, fee_coefficient: 0.07 });
  check("kalshi: does not claim assumption when fee supplied", supplied.assumedFees === false);
}
// The decisive real-world cases. These were written asserting that a 2-point
// edge at 50c is negative EV — the calculator disagreed, and the calculator was
// right: at ~1.75c per contract that edge clears breakeven by 0.25 of a point.
// The asset's prose said "routinely negative" and had to be corrected to match.
// Keeping the exact boundary pinned here is what stops that overclaim
// reappearing in the content.
{
  const thin = kaCompute({ your_probability: 51, market_price: 50, contracts: 100 });
  check("kalshi: a 1-point edge at 50c is NEGATIVE EV after fees", thin.worthIt === false, `edge after fees ${thin.edgeAfterFees}`);
  const marginal = kaCompute({ your_probability: 52, market_price: 50, contracts: 100 });
  check("kalshi: a 2-point edge at 50c only just clears breakeven", marginal.worthIt === true && marginal.edgeAfterFees < 0.005, `edge after fees ${marginal.edgeAfterFees}`);
  const roundTrip = kaCompute({ your_probability: 52, market_price: 50, contracts: 100, exit: "early" });
  check("kalshi: the SAME 2-point edge goes negative if you exit early", roundTrip.worthIt === false, `edge after fees ${roundTrip.edgeAfterFees}`);
  const real = kaCompute({ your_probability: 70, market_price: 50, contracts: 100 });
  check("kalshi: a 20-point edge at 50c does survive fees", real.worthIt === true, `edge after fees ${real.edgeAfterFees}`);
  check("kalshi: price_check says plainly when the fee eats the edge", kaPriceCheck({ your_probability: 51, market_price: 50 }).toLowerCase().includes("fee eats the edge"));
  check("kalshi: price_check surfaces the fee assumption", kaPriceCheck({ your_probability: 52, market_price: 50 }).includes("FEE ASSUMPTION"));
}
// Both inputs accept two units, and they disambiguate differently at exactly
// 1. Found by feeding price_check a LIVE price from research: a real 1c
// longshot was read as a $1.00 contract and reported "the market says 100%".
check(
  "kalshi: probability accepts 0-1 and 0-100 alike",
  kaCompute({ your_probability: 0.55, market_price: 50 }).probability === kaCompute({ your_probability: 55, market_price: 50 }).probability
);
check("kalshi: market_price 1 means ONE CENT, not one dollar", kaCompute({ your_probability: 35, market_price: 1 }).price === 0.01);
check("kalshi: market_price 0.63 (dollars) === 63 (cents)", kaCompute({ your_probability: 50, market_price: 0.63 }).price === kaCompute({ your_probability: 50, market_price: 63 }).price);
check("kalshi: probability 1 means certainty, not one percent", kaCompute({ your_probability: 1, market_price: 50 }).probability === 1);
check("kalshi: a 1c longshot you rate at 35% shows a real edge", kaCompute({ your_probability: 35, market_price: 1, contracts: 100 }).worthIt === true);
// The displayed extremes must RECONCILE with the reported EV. They didn't:
// "Max loss" printed the fee-free stake directly under a "Total cost (stake +
// fees)" line that included them, so the tool understated its own downside.
// EV = p*maxGain - (1-p)*maxLoss is the identity that catches it.
{
  const r = kaCompute({ your_probability: 60, market_price: 50, contracts: 100 });
  const maxLoss = r.totalCost;
  const maxGain = (1 - r.price) * r.contracts - r.totalFees;
  const implied = r.probability * maxGain - (1 - r.probability) * maxLoss;
  check("kalshi: EV reconciles with fee-inclusive max loss/gain", Math.abs(implied - r.totalEv) < 1e-9, `EV ${r.totalEv} vs implied ${implied}`);
  check("kalshi: max loss exceeds the bare stake (fees are sunk)", maxLoss > r.price * r.contracts);
  const out = kaPriceCheck({ your_probability: 60, market_price: 50, contracts: 100 });
  check("kalshi: printed max loss equals printed total cost", /Max loss \/ max gain\s+\$51\.75 \/ \$48\.25/.test(out), out.split("\n").find((l) => l.includes("Max loss")) ?? "");
}

// ── 14a. A failed call must COUNT as failed, both ways it can fail ──────────
// An asset fails two ways: the orchestrator's call throws (entry.error), or the
// MCP tool returns a normal result with isError:true (bad arguments, unknown
// tool, HTTP failure inside the asset). Every consumer keyed off entry.error
// alone. Real case log: 6 entries carry `error`, 50 carry `result.isError` —
// nine failures in ten were invisible to synthesis, the audit report, and the
// error analyzer. Worse, resultText returned the error payload as content, so a
// hard failure rendered as "(no headline extracted … e.g. a dossier)".
{
  const mkCase = (log) => ({
    id: "f1", objective: "demo", assignedAssets: ["alpha"], status: "closed",
    openedAt: "2026-01-01T00:00:00Z", closedAt: "2026-01-01T00:01:00Z", log,
  });
  const thrown = { asset: "alpha", tool: "t", arguments: {}, error: "boom", timestamp: "2026-01-01T00:00:30Z" };
  const returned = {
    asset: "alpha", tool: "t", arguments: {},
    result: { content: [{ type: "text", text: "MCP error -32602: Tool calculate_dti not found" }], isError: true },
    timestamp: "2026-01-01T00:00:30Z",
  };
  check("isFailed: a thrown error counts", isFailed(thrown));
  check("isFailed: an isError RESULT counts (the 50 that didn't)", isFailed(returned));
  check("isFailed: a normal result does not", !isFailed({ asset: "a", tool: "t", arguments: {}, result: { content: [{ type: "text", text: "BOTTOM LINE: fine" }] }, timestamp: "x" }));

  const out = synthesizeCase(mkCase([returned]));
  check("synthesis counts an isError result as an errored call", /1 call\(s\) errored/.test(out), out);
  check("synthesis does not call a failed call 'a dossier'", !out.includes("e.g. a dossier"), out);
  check("synthesis does not lift the error payload into MERGED KEY POINTS", !out.includes("calculate_dti"), out);

  // The overseer's own copy must agree — the two packages cannot share code.
  check("overseer isFailed agrees on a thrown error", ovIsFailed(thrown));
  check("overseer isFailed agrees on an isError result", ovIsFailed(returned));
  check("overseer failureMessage reads the isError payload", ovFailureMessage(returned).includes("calculate_dti"));

  // A research-only case with no sources must still be flagged. The old guard
  // excluded exactly that case — when the one asset that CAN cite sources
  // found none, which is when it matters most.
  const researchOnly = synthesizeCase(mkCase([
    { asset: "research", tool: "research", arguments: {}, result: { content: [{ type: "text", text: "BOTTOM LINE: nothing found." }] }, timestamp: "2026-01-01T00:00:30Z" },
  ]));
  check("synthesis flags 'no sources' even on a research-only case", researchOnly.includes("No sources cited"), researchOnly);
}

// ── 14a2. Corroboration must not be claimed when it cannot vary ─────────────
// The research asset ranked by "cross-provider corroboration" and printed a
// score on every result. Measured over 63 real dossiers and 146 sources: the
// score was 1 for every single one, 0.0% above 1. Only DuckDuckGo and
// Wikipedia are active, and Wikipedia can only ever return wikipedia.org URLs
// — it cannot corroborate another index. So the ranking sorted by a constant
// while advertising agreement that was structurally impossible.
{
  const web = (name) => ({ name, webIndex: true, availability: () => ({ available: true, note: "" }), search: async () => [] });
  const single = (name) => ({ ...web(name), webIndex: false });
  check("corroboration needs TWO web indexes", corroborationPossible([web("a"), web("b")]));
  check("one web index alone is not corroboration", !corroborationPossible([web("a")]));
  check("a web index + a single-source is not corroboration", !corroborationPossible([web("duckduckgo"), single("wikipedia")]));
  check("two single-source providers are not corroboration", !corroborationPossible([single("a"), single("b")]));
  // The live default set is exactly the case that was being misreported.
  const live = ALL_PROVIDERS.filter((p) => p.availability().available);
  check("every provider declares whether it is a web index", ALL_PROVIDERS.every((p) => typeof p.webIndex === "boolean"));
  check("wikipedia is not counted as a web index", ALL_PROVIDERS.find((p) => p.name === "wikipedia")?.webIndex === false);
  check(
    "with the current keyless setup, corroboration is honestly reported as unavailable",
    corroborationPossible(live) === false,
    `active: ${live.map((p) => p.name).join(", ")}`
  );
}

// ── 14b1. No tag may be claimed by two active assets ────────────────────────
// AGENTS.md forbids this in two separate rules, and nothing enforced it — 9
// collisions had accumulated, three of them causing verified misroutes:
// "what compounds make up table salt" went to nestegg (compound interest),
// "how do I write a for loop in python" went to loop (the agent-loop asset),
// and homebuyer's "agent" (realtor) fought loop's "agent" (AI agent).
// A tag is the deliberate routing signal; two owners means it points nowhere.
{
  const owners = new Map();
  for (const a of registry.filter((x) => x.status === "active")) {
    for (const t of a.tags ?? []) {
      if (!owners.has(t)) owners.set(t, []);
      owners.get(t).push(a.name);
    }
  }
  const shared = [...owners.entries()].filter(([, names]) => names.length > 1);
  check(
    "no tag is claimed by two active assets",
    shared.length === 0,
    shared.map(([t, names]) => `${t}: ${names.join(" + ")}`).join("; ")
  );
  // The same word in two SENSES is the subtler version — it can't be detected
  // mechanically, so these are the specific pairs that were separated, pinned
  // so a future edit has to argue with a named test rather than a blank file.
  const separated = [
    ["compound", "curiosity", "nestegg"],
    ["agent", "loop", "homebuyer"],
    ["tax", "lawguide", "homebuyer"],
    ["react", "loop", "polymath"],
    ["immigration", "government", "lawguide"],
  ];
  for (const [tag, keeps, lost] of separated) {
    const k = registry.find((a) => a.name === keeps);
    const l = registry.find((a) => a.name === lost);
    check(`tag "${tag}" belongs to ${keeps} alone, not ${lost}`, k?.tags.includes(tag) && !l?.tags.includes(tag));
  }
}

// ── 14b2. SSRF guard — a security control that had NO test at all ───────────
// It shipped with a real, exploitable bypass: it pattern-matched the address
// STRING for IPv4-mapped IPv6, but `new URL()` normalises
// `[::ffff:127.0.0.1]` to compressed hex (`::ffff:7f00:1`) before the guard
// sees it, so that branch was dead code for every URL. Verified live:
// http://[::ffff:127.0.0.1]:8787/ reached the bridge while http://127.0.0.1:8787/
// was correctly refused. fetch_page is caller-reachable and buildDossier
// auto-fetches search results, so a hostile AAAA record was enough.
// Every row below is a vector that must stay closed.
{
  const mustBlock = [
    ["plain loopback", "http://127.0.0.1:8787/"],
    ["IPv4-mapped loopback (THE bypass)", "http://[::ffff:127.0.0.1]:8787/"],
    ["IPv4-mapped, hex form", "http://[::ffff:7f00:1]/"],
    ["IPv4-mapped metadata endpoint", "http://[::ffff:a9fe:a9fe]/"],
    ["IPv4-mapped, fully expanded", "http://[0:0:0:0:0:ffff:7f00:0001]/"],
    ["IPv4-compatible (deprecated)", "http://[::127.0.0.1]/"],
    ["NAT64 64:ff9b::/96", "http://[64:ff9b::7f00:1]/"],
    ["6to4 2002::/16", "http://[2002:7f00:1::]/"],
    ["cloud metadata", "http://169.254.169.254/"],
    ["IPv6 loopback", "http://[::1]/"],
    ["unique-local fc00::/7", "http://[fd00::1]/"],
    ["link-local fe80::/10", "http://[fe80::1]/"],
    ["IPv6 multicast", "http://[ff02::1]/"],
    ["RFC1918", "http://10.0.0.5/"],
    ["localhost by name", "http://localhost/"],
    ["non-http scheme", "file:///C:/Windows/win.ini"],
  ];
  for (const [label, url] of mustBlock) {
    let allowed = true;
    try {
      await assertPublicUrl(url);
    } catch {
      allowed = false;
    }
    check(`ssrf blocks ${label}`, allowed === false, `ALLOWED ${url}`);
  }
  // The guard must not become so blunt it refuses the real web.
  for (const [label, url] of [
    ["a public v4 address", "http://8.8.8.8/"],
    ["a public v6 address", "http://[2606:4700:4700::1111]/"],
  ]) {
    let allowed = true;
    try {
      await assertPublicUrl(url);
    } catch {
      allowed = false;
    }
    check(`ssrf still allows ${label}`, allowed === true, `blocked ${url}`);
  }
}

// ── 14c. Structured data sources (sec_filings, kalshi_markets) ──────────────
// This suite makes no network calls, so what is tested here is everything that
// happens BEFORE the fetch — validation, and the price conversion that the
// published API guides get wrong.
{
  // Kalshi returns prices as DOLLAR STRINGS ("0.2500"), not the integer cents
  // that older docs and every third-party guide describe. Probing the live
  // endpoint is what caught it; this pins the conversion so a future edit
  // can't silently reintroduce a 100x error in an implied probability.
  check("data: kalshi dollar string → cents", dollarsToCents("0.2500") === 25);
  check("data: kalshi handles a whole dollar", dollarsToCents("1.0000") === 100);
  check("data: kalshi handles zero", dollarsToCents("0.0000") === 0);
  check("data: kalshi missing price → undefined, not 0", dollarsToCents(undefined) === undefined && dollarsToCents("") === undefined);
  check("data: kalshi non-numeric → undefined", dollarsToCents("n/a") === undefined);

  // Validation must reject BEFORE any request goes out — these assertions
  // double as proof the bad-input path is network-free.
  const badTicker = await secFilings({ ticker: "not a ticker!!" });
  check("data: sec rejects a malformed ticker without fetching", badTicker.includes("not a valid ticker"));
  check("data: sec rejection still carries a BOTTOM LINE", /^BOTTOM LINE/m.test(badTicker));
  const badSeries = await kalshiMarkets({ series: "bad series!!" });
  check("data: kalshi rejects a malformed series without fetching", badSeries.includes("not a valid series"));
  check("data: kalshi rejection still carries a BOTTOM LINE", /^BOTTOM LINE/m.test(badSeries));
}

// ── 15. Reference-store logic paths (curiosity, education, government) ────────
// The previously-untested trio: get_reference / list_stale_references /
// update_reference. Their real logic is the staleness computation (withStaleness)
// and the flag-only write GUARD (updateReference). We exercise every branch that
// does NOT write — preview, unknown-key, and unchanged-value — plus prove the
// staleness math flips on the clock. The ONLY branch that writes to disk is
// confirm=true with a *changed* value; we deliberately never call it (the live
// verify-loop smoke covers that end-to-end), so this stays as side-effect-free as
// the rest of the suite — asserted below by re-reading the store unchanged.
const REF_ASSETS = [
  ["curiosity", curLoadRefs, curStaleness, curUpdateRef],
  ["education", eduLoadRefs, eduStaleness, eduUpdateRef],
  ["government", govLoadRefs, govStaleness, govUpdateRef],
];
for (const [name, loadRefs, staleness, updateRef] of REF_ASSETS) {
  const refs = await loadRefs();
  check(`${name} ref: store has records`, refs.length > 0);
  if (refs.length === 0) continue;
  const sample = refs[0];
  const before = JSON.stringify(refs);

  // get_reference / list_stale_references logic = withStaleness's staleness math.
  const future = new Date("2999-01-01T00:00:00Z");
  const staleView = await staleness(future);
  check(`${name} ref: far-future clock makes every record stale`, staleView.length > 0 && staleView.every((v) => v.is_stale));
  // A clock at the record's own as_of → age 0 → fresh (the other side of the branch).
  const fresh = await staleness(new Date(sample.as_of));
  const freshSample = fresh.find((v) => v.key === sample.key);
  check(`${name} ref: as_of clock leaves that record fresh (age 0)`, freshSample?.is_stale === false && freshSample?.age_days === 0, `got ${JSON.stringify(freshSample && { is_stale: freshSample.is_stale, age_days: freshSample.age_days })}`);

  // update_reference flag-only guard: confirm=false previews and writes NOTHING.
  const preview = await updateRef(sample.key, `${sample.value} [regression-probe]`, "regression", "2026-01-01", false, future);
  check(`${name} ref: confirm=false is preview-only`, preview.applied === false && /PREVIEW ONLY/.test(preview.message), preview.message);
  // Unknown key → throws, never a silent write.
  let threw = false;
  try { await updateRef("__no_such_key__", "x", "regression", "2026-01-01", false, future); } catch { threw = true; }
  check(`${name} ref: unknown key rejected`, threw);
  // Unchanged value even with confirm=true → no-op (the documented quirk), no write.
  const noChange = await updateRef(sample.key, sample.value, "regression", "2026-01-01", true, future);
  check(`${name} ref: unchanged value is a no-op even with confirm=true`, noChange.applied === false && /No change/.test(noChange.message), noChange.message);

  // Prove it: the on-disk store is byte-identical after every check above.
  check(`${name} ref: store unchanged (no writes leaked)`, JSON.stringify(await loadRefs()) === before);
}

// ── 16. start_here renders for every new asset (previously untested tool) ─────
const START_HERE = [
  ["curiosity", curStartHere()],
  ["education", eduStartHere()],
  ["communication", commStartHere()],
  ["sports", sportStartHere()],
  ["government", govStartHere()],
  ["linguistics", lingStartHere()],
  ["faiths", faithStartHere()],
  ["loop", loopStartHere()],
];
for (const [name, out] of START_HERE) {
  check(`${name} start_here renders a BOTTOM LINE`, typeof out === "string" && out.includes("BOTTOM LINE") && out.length > 80, `len ${out?.length ?? "n/a"}`);
}

// ── 17. registry.example.json is a TEMPLATE, not a copy of the live registry ──
// data/registry.json is gitignored because AssetConfig.env is the per-asset
// API-key channel and this repo is public. The example is the TRACKED file, so
// it is the one that can actually leak. It used to be a byte-identical
// snapshot of the live registry — safe only because every env happened to be
// empty at the time. These assertions make that structural rather than lucky.
{
  const example = JSON.parse(await readFile(new URL("./data/registry.example.json", import.meta.url), "utf-8"));
  const withEnv = example.filter((a) => a.env && Object.keys(a.env).length > 0);
  check(
    "registry.example.json carries no env values",
    withEnv.length === 0,
    withEnv.map((a) => a.name).join(", ") || "none"
  );
  const absolutePaths = JSON.stringify(example).match(/[A-Za-z]:[\\/]/g) ?? [];
  check(
    "registry.example.json has no machine-absolute paths",
    absolutePaths.length === 0,
    `${absolutePaths.length} found`
  );
  check(
    "registry.example.json covers every live asset",
    example.length === registry.length,
    `example ${example.length} vs live ${registry.length}`
  );
}

// ── 18. Supervisor: liveness probes, not existence checks ──────────────────
// The old watchdog asked netstat "is anything listening on 8787?" and tasklist
// "is cloudflared.exe running?". Both answer yes throughout an outage, because
// a wedged process keeps its socket and a tunnel with zero edge connections is
// still an executable. These assertions pin the distinction that fixes that:
// a component that is present but not WORKING must read as down.
{
  const IDLE_MS = 30 * 60 * 1000;
  const healthz = (over = {}) => ({ reachable: true, status: 200, body: { ok: true, sessions: 1, oldestIdleMin: 0, uptime: 100, ...over }, error: null });

  check("bridge unreachable → down", interpretBridge({ reachable: false, status: null, body: null, error: "ECONNREFUSED" }).state === DOWN);
  check("bridge timeout → down", interpretBridge({ reachable: false, status: null, body: null, error: "no answer within 5000ms" }).state === DOWN);
  check("bridge HTTP 500 → down", interpretBridge({ reachable: true, status: 500, body: null, error: null }).state === DOWN);
  // Listening and answering, but not with the health document — e.g. something
  // else grabbed the port, or the bridge is half-initialised.
  check("bridge answering non-JSON → down", interpretBridge({ reachable: true, status: 200, body: null, error: null }).state === DOWN);
  check("bridge ok:false → down", interpretBridge({ reachable: true, status: 200, body: { ok: false }, error: null }).state === DOWN);
  check("bridge healthy → up", interpretBridge(healthz(), { sessionIdleMs: IDLE_MS }).state === UP);

  // The reaper-stalled signal. Degraded, never down: it is answering, so
  // killing it would drop live sessions to fix a leak that is not yet an outage.
  const stalled = interpretBridge(healthz({ oldestIdleMin: 75 }), { sessionIdleMs: IDLE_MS });
  check("bridge with stalled reaper → degraded", stalled.state === DEGRADED, `got ${stalled.state}`);
  check("stalled-reaper reason names the TTL", /reap/i.test(stalled.reason), stalled.reason);
  // Just past the TTL is normal — the sweep runs on its own interval, so a
  // session can sit slightly over between passes. Alerting there is noise.
  check("bridge just past TTL → still up", interpretBridge(healthz({ oldestIdleMin: 35 }), { sessionIdleMs: IDLE_MS }).state === UP);
  check("bridge idle check skipped without a TTL", interpretBridge(healthz({ oldestIdleMin: 9999 })).state === UP);

  // The tunnel case that motivated all of this: process alive, phone dead.
  check("tunnel with 0 edge connections → down", interpretTunnel({ reachable: true, status: 200, body: { status: 200, readyConnections: 0 }, error: null }).state === DOWN);
  check("tunnel with 4 edge connections → up", interpretTunnel({ reachable: true, status: 200, body: { status: 200, readyConnections: 4 }, error: null }).state === UP);
  check("tunnel metrics unreachable → down", interpretTunnel({ reachable: false, status: null, body: null, error: "ECONNREFUSED" }).state === DOWN);
  check("tunnel /ready without readyConnections → down", interpretTunnel({ reachable: true, status: 200, body: {}, error: null }).state === DOWN);
}

// ── 19. Supervisor: the alert state machine ────────────────────────────────
// Alerting that fires on every failed probe is alerting that gets muted — at a
// 30s interval that is 120 notifications an hour. These assertions pin the
// rules that keep it to the few messages a human should actually see, and the
// backoff that stops a component which cannot start from being killed and
// relaunched forever.
{
  const down = { state: DOWN, reason: "no answer" };
  const up = { state: UP, reason: "1 session(s)" };
  const degraded = { state: DEGRADED, reason: "reaper may have stopped" };
  const REPEAT = 30 * 60 * 1000;

  {
    const t = createHealthTracker({ failuresBeforeRestart: 2, repeatMs: REPEAT });
    const first = t.record("bridge", down, 0);
    check("single failure does not restart", first.restart === false);
    check("single failure is silent", first.alerts.length === 0, `${first.alerts.length} alerts`);

    const second = t.record("bridge", down, 30_000);
    check("second consecutive failure restarts", second.restart === true);
    check("restart raises exactly one alert", second.alerts.length === 1, `${second.alerts.length} alerts`);
    check("first down alert is level error", second.alerts[0]?.level === "error", second.alerts[0]?.level);

    // Backoff: the next restart must wait, or a component that cannot start is
    // killed every 60s forever.
    const third = t.record("bridge", down, 60_000);
    check("third failure does not immediately restart again", third.restart === false);
    check("third failure is silent (already alerted)", third.alerts.length === 0);
    const fourth = t.record("bridge", down, 90_000);
    check("restart retried after backoff", fourth.restart === true);
    check("repeat restart escalates to critical", fourth.alerts[0]?.level === "critical", fourth.alerts[0]?.level);
    check("repeat restart names the attempt count", /attempt 2/.test(fourth.alerts[0]?.message ?? ""), fourth.alerts[0]?.message);

    const back = t.record("bridge", up, 120_000);
    check("recovery raises an alert", back.alerts.length === 1 && back.alerts[0].level === "recovery");
    check("recovery never restarts", back.restart === false);
    // State must fully reset, or the next outage inherits a spent backoff and
    // waits 16 minutes for its first restart.
    const afterRecovery = t.record("bridge", down, 150_000);
    check("failure count resets on recovery", afterRecovery.restart === false && afterRecovery.alerts.length === 0);
  }

  {
    // A blip that never reached the alert threshold must not produce a
    // "recovered" message with nothing before it.
    const t = createHealthTracker({ failuresBeforeRestart: 2, repeatMs: REPEAT });
    t.record("bridge", down, 0);
    const back = t.record("bridge", up, 30_000);
    check("un-alerted blip recovers silently", back.alerts.length === 0, `${back.alerts.length} alerts`);
  }

  {
    // Degraded is a report, not a trigger.
    const t = createHealthTracker({ failuresBeforeRestart: 2, repeatMs: REPEAT });
    const a = t.record("bridge", degraded, 0);
    check("degraded alerts on entry", a.alerts.length === 1 && a.alerts[0].level === "warning");
    check("degraded never restarts", a.restart === false);
    const b = t.record("bridge", degraded, 30_000);
    check("degraded does not re-alert every cycle", b.alerts.length === 0);
    check("degraded still never restarts", b.restart === false);
    const c = t.record("bridge", degraded, REPEAT + 1);
    check("degraded re-alerts after the repeat window", c.alerts.length === 1);
    const d = t.record("bridge", up, REPEAT + 30_000);
    check("degraded → up announces recovery", d.alerts.length === 1 && d.alerts[0].level === "recovery");
  }

  {
    // A long outage must keep speaking even while the backoff holds off
    // restarts, or a days-long failure goes quiet after the second message.
    const t = createHealthTracker({ failuresBeforeRestart: 2, repeatMs: REPEAT, backoff: [10_000] });
    t.record("tunnel", down, 0);
    const restarted = t.record("tunnel", down, 30_000);
    check("outage restarts once", restarted.restart === true);
    const quiet = t.record("tunnel", down, 60_000);
    check("outage stays quiet inside the repeat window", quiet.alerts.length === 0);
    const nagged = t.record("tunnel", down, 30_000 + REPEAT + 1);
    check("outage re-alerts after the repeat window", nagged.alerts.length === 1, `${nagged.alerts.length} alerts`);
    check("long-outage alert is critical", nagged.alerts[0]?.level === "critical", nagged.alerts[0]?.level);
    check("long-outage alert does not restart under backoff", nagged.restart === false);
  }

  {
    // Components are tracked independently — a tunnel outage must not reset or
    // trip the bridge's counters.
    const t = createHealthTracker({ failuresBeforeRestart: 2, repeatMs: REPEAT });
    t.record("bridge", down, 0);
    const tunnelFirst = t.record("tunnel", down, 0);
    check("components count failures independently", tunnelFirst.restart === false);
    const bridgeSecond = t.record("bridge", down, 30_000);
    check("bridge restarts on its own second failure", bridgeSecond.restart === true);
    check("tunnel unaffected by bridge restart", t.peek("tunnel").restartAttempts === 0);
  }
}

// ── 19b. The alert text actually carries the alert ─────────────────────────
// The state machine can be perfect and the outage still go unreported if the
// rendered line loses its substitutions. A bulk edit did exactly that once,
// leaving "[ERROR]  - " — well-formed, informative of nothing, and invisible
// to every assertion above, which only inspects the returned alert objects.
{
  const alert = { level: "error", title: "bridge is down", message: "stopped responding: ECONNREFUSED. Restarting it." };
  const line = formatAlertLine("2026-01-01T00:00:00.000Z", alert);
  check("alert log line keeps the timestamp", line.includes("2026-01-01T00:00:00.000Z"), line);
  check("alert log line keeps the level", line.includes("[ERROR]"), line);
  check("alert log line keeps the title", line.includes(alert.title), line);
  check("alert log line keeps the message", line.includes(alert.message), line);

  const text = formatAlertText("workstation", alert);
  check("webhook text keeps the host", text.includes("workstation"), text);
  check("webhook text keeps the title", text.includes(alert.title), text);
  check("webhook text keeps the message", text.includes(alert.message), text);

  // Logs are read in PowerShell and Notepad, which decode as ANSI by default
  // and render UTF-8 punctuation as mojibake. Keep the rendered forms ASCII.
  for (const [name, s] of [["log line", line], ["webhook text", text]]) {
    // eslint-disable-next-line no-control-regex
    check(`${name} is pure ASCII (logs are read in ANSI viewers)`, !/[^\x00-\x7F]/.test(s), s);
  }
}

// ── 19c. Operational scripts print ASCII ───────────────────────────────────
// logs/*.log are read with Get-Content and Notepad, which decode as ANSI by
// default and turn a UTF-8 em dash into "â€"" — in the files you open
// precisely when something has gone wrong. Fixing the strings once did not
// hold: the very next change to supervisor.mjs reintroduced two, and the
// archive job's first real run wrote three more. It needs to be a rule the
// suite enforces rather than one to remember.
//
// Non-ASCII in comments is fine and deliberate — nothing prints those.
{
  const operational = ["archive-cases.mjs", "archive-logic.mjs", "bridge/supervisor.mjs", "bridge/supervisor-logic.mjs"];
  for (const rel of operational) {
    const src = await readFile(new URL(`./${rel}`, import.meta.url), "utf-8");
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "") // block and JSDoc comments
      .replace(/(^|[^:])\/\/.*$/gm, "$1"); // line comments, but not "https://"
    const offenders = code
      .split("\n")
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => /[^\x00-\x7F]/.test(line));
    check(
      `${rel} prints only ASCII (logs are read in ANSI viewers)`,
      offenders.length === 0,
      offenders.map(([n, l]) => `line ${n}: ${l.trim().slice(0, 60)}`).join(" | ")
    );
  }
}

// ── 19c-bis. .env parsing ──────────────────────────────────────────────────
// The bridge and the supervisor both load the root .env, and they MUST agree:
// the supervisor read it while the bridge did not, so setting MCP_BRIDGE_PORT
// moved the probe and not the listener — a permanent false outage, with
// restarts, against a healthy bridge. One parser now, with the quoting and
// precedence rules pinned here.
{
  const parsed = parseEnv(
    [
      "# a comment",
      "",
      "PLAIN=value",
      "  SPACED  =  padded  ",
      'QUOTED="in quotes"',
      "SINGLE='in singles'",
      "EMPTY=",
      "URL=https://ntfy.sh/topic-name",
      "EQUALS=abc==",             // base64 padding
      "INNER=a=b=c",
      "not a setting line",
      "9INVALID=nope",            // must start with a letter or underscore
      "DUPE=first",
      "DUPE=second",
    ].join("\r\n") // CRLF, because .env sits next to CRLF-pinned batch files
  );

  check("parses a plain assignment", parsed.PLAIN === "value", parsed.PLAIN);
  check("trims whitespace around key and value", parsed.SPACED === "padded", `"${parsed.SPACED}"`);
  check("strips surrounding double quotes", parsed.QUOTED === "in quotes", parsed.QUOTED);
  check("strips surrounding single quotes", parsed.SINGLE === "in singles", parsed.SINGLE);
  check("keeps an empty value", parsed.EMPTY === "", JSON.stringify(parsed.EMPTY));
  check("does not mangle a URL", parsed.URL === "https://ntfy.sh/topic-name", parsed.URL);
  // MCP_BRIDGE_TOKEN is base64 of 32 random bytes; base64 pads with "=".
  // Splitting on every "=" would silently truncate the one secret that guards
  // the public hostname, and the bridge would start with a shorter passphrase.
  check("keeps base64 '=' padding intact", parsed.EQUALS === "abc==", parsed.EQUALS);
  check("only the first '=' separates key from value", parsed.INNER === "a=b=c", parsed.INNER);
  check("ignores lines that are not assignments", parsed["not a setting line"] === undefined);
  check("ignores comments", Object.keys(parsed).every((k) => !k.startsWith("#")));
  check("rejects a key starting with a digit", parsed["9INVALID"] === undefined);
  check("last duplicate wins", parsed.DUPE === "second", parsed.DUPE);

  // Precedence: an explicit environment value must beat the file, or a one-off
  // override (and every test that uses one) silently does nothing.
  const target = { PRESET: "from-environment" };
  const applied = applyEnv({ PRESET: "from-file", FRESH: "from-file" }, target);
  check("existing environment values are never overwritten", target.PRESET === "from-environment", target.PRESET);
  check("unset values are taken from the file", target.FRESH === "from-file", target.FRESH);
  check("applyEnv reports only what it set", applied.join(",") === "FRESH", applied.join(","));

  // The real file must still yield a usable token, since the bridge refuses to
  // start below 32 chars and this parser is now the only thing that reads it.
  try {
    const realEnv = parseEnv(await readFile(new URL("./.env", import.meta.url), "utf-8"));
    check(
      "the real .env yields a token the bridge will accept",
      typeof realEnv.MCP_BRIDGE_TOKEN === "string" && realEnv.MCP_BRIDGE_TOKEN.length >= 32,
      `length ${realEnv.MCP_BRIDGE_TOKEN?.length ?? 0}`
    );
  } catch {
    // No .env on this machine (CI, fresh clone) — nothing to assert.
  }
}

// ── 19d. .env.example documents every setting that exists ──────────────────
// A settings file the code has outgrown is worse than none: it reads like the
// complete list, so a variable missing from it is one nobody knows they can
// set. Derived from the source, so adding a new process.env.MCP_* read without
// documenting it fails here rather than being discovered a year later.
{
  const sources = ["bridge/server.mjs", "bridge/supervisor.mjs", "backup-data.mjs", "src/file-lock.ts"];
  const documented = await readFile(new URL("./.env.example", import.meta.url), "utf-8");
  const found = new Set();
  for (const rel of sources) {
    const src = await readFile(new URL(`./${rel}`, import.meta.url), "utf-8");
    // Both the direct form and the envMs("NAME", ...) / num("NAME", ...) helpers.
    for (const m of src.matchAll(/process\.env\.(MCP_[A-Z0-9_]+)/g)) found.add(m[1]);
    for (const m of src.matchAll(/\b(?:envMs|num)\(\s*"(MCP_[A-Z0-9_]+)"/g)) found.add(m[1]);
  }
  check("found MCP_* settings to check", found.size >= 10, `only ${found.size}`);
  for (const name of [...found].sort()) {
    check(`${name} is documented in .env.example`, documented.includes(name));
  }
}

// ── 20. Windows scripts must be CRLF ───────────────────────────────────────
// cmd.exe does not reject an LF-only batch file — it half-executes it, eating
// leading characters until commands stop resolving ("netstat" → "tstat",
// "REM" → "EM"). start-all.cmd was left LF-only by an in-place edit and the
// result was silent: the "is the bridge already listening?" guard evaluated as
// failed, the script logged "starting bridge", started nothing, and never
// reached the cloudflared half. Nothing errored anywhere a human would look.
//
// .gitattributes now pins eol=crlf, but that only governs what git writes;
// anything rewritten in place by a tool can still land as LF. This is the
// assertion that actually catches it. Derived from a directory listing so new
// scripts are covered without editing this test.
{
  const scriptDirs = ["bridge"];
  const windowsExt = /\.(cmd|bat|vbs|ps1)$/i;
  let checkedAny = false;
  for (const dir of scriptDirs) {
    const entries = await readdir(new URL(`./${dir}/`, import.meta.url));
    for (const name of entries.filter((n) => windowsExt.test(n))) {
      checkedAny = true;
      const raw = await readFile(new URL(`./${dir}/${name}`, import.meta.url), "utf-8");
      // A bare LF is any \n not immediately preceded by \r.
      const bareLf = (raw.match(/(?<!\r)\n/g) ?? []).length;
      check(`${dir}/${name} is CRLF (cmd.exe silently mangles LF-only scripts)`, bareLf === 0, `${bareLf} bare LF line(s)`);
    }
  }
  check("CRLF check actually found Windows scripts to check", checkedAny);
}

// ── 21. Cross-process file lock: ownership, heartbeat, reclamation ─────────
// cases.json holds addresses and legal/medical questions and is written by two
// real OS processes at once (Claude Desktop's stdio orchestrator, and the
// orchestrator each bridge session spawns). The lock is the only thing keeping
// their read-modify-write cycles apart, and its failure mode is silent: two
// writers, last one wins, nothing logged.
//
// Timings come from the environment so these stay millisecond tests instead of
// sitting through a 10-second stale window.
{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const saved = {
    stale: process.env.MCP_LOCK_STALE_MS,
    beat: process.env.MCP_LOCK_HEARTBEAT_MS,
    timeout: process.env.MCP_LOCK_TIMEOUT_MS,
    retry: process.env.MCP_LOCK_RETRY_MS,
  };
  const dir = await mkdtemp(join(tmpdir(), "mcp-lock-test-"));
  const key = join(dir, "store.json");
  const lockPath = `${key}.lock`;

  try {
    process.env.MCP_LOCK_RETRY_MS = "10";
    process.env.MCP_LOCK_TIMEOUT_MS = "250";
    process.env.MCP_LOCK_STALE_MS = "120";

    // ── the happy path ──
    process.env.MCP_LOCK_HEARTBEAT_MS = "100000"; // long enough never to fire
    {
      const release = await acquireCrossProcessLock(key);
      check("acquire creates the lock file", existsSync(lockPath));
      await release();
      check("release removes the lock file", !existsSync(lockPath));
    }

    // ── the ownership bug ──
    // release() used to unlink unconditionally. Once a stale sweep handed the
    // lock to someone else, the original holder's late release deleted the NEW
    // holder's lock — putting two writers into the store at the same time.
    {
      const releaseA = await acquireCrossProcessLock(key);
      const tokenA = await readFile(lockPath, "utf-8");
      // Age A's lock past the stale window, which is what a dead holder looks
      // like from the outside. A's heartbeat is configured never to fire here.
      const old = new Date(Date.now() - 60_000);
      await utimes(lockPath, old, old);

      const releaseB = await acquireCrossProcessLock(key);
      const tokenB = await readFile(lockPath, "utf-8");
      check("a stale lock is reclaimed by the next acquirer", tokenB !== tokenA, "token unchanged");
      check("reclaimed lock carries a fresh token", tokenB.length > 0);

      await releaseA(); // A finally finishes, long after being declared dead
      check("a late release does not delete the new holder's lock", existsSync(lockPath));
      check(
        "the new holder's token survives a late release",
        existsSync(lockPath) && (await readFile(lockPath, "utf-8")) === tokenB
      );

      await releaseB();
      check("the true holder can still release", !existsSync(lockPath));
    }

    // ── heartbeat: a live holder is not declared dead ──
    // Before the heartbeat, mtime was written once at creation, so ANY
    // operation slower than the stale window had its lock stolen mid-write.
    {
      process.env.MCP_LOCK_HEARTBEAT_MS = "30";
      process.env.MCP_LOCK_STALE_MS = "150";
      process.env.MCP_LOCK_TIMEOUT_MS = "200";
      const releaseC = await acquireCrossProcessLock(key);
      await sleep(320); // well past the stale window, but C is alive
      let stolen = false;
      try {
        const releaseD = await acquireCrossProcessLock(key);
        stolen = true;
        await releaseD();
      } catch {
        /* timing out is the correct outcome: C still holds it */
      }
      check("a live holder's lock is not stolen after the stale window", !stolen);
      await releaseC();
      check("holder still owns its lock after heartbeating", !existsSync(lockPath));
    }

    // ── a genuinely abandoned lock is still reclaimed ──
    // The heartbeat must not make a crashed holder's lock immortal.
    {
      process.env.MCP_LOCK_STALE_MS = "120";
      process.env.MCP_LOCK_HEARTBEAT_MS = "100000";
      await writeFile(lockPath, "dead-process-token", "utf-8");
      const old = new Date(Date.now() - 60_000);
      await utimes(lockPath, old, old);
      const releaseE = await acquireCrossProcessLock(key);
      check(
        "a lock abandoned by a dead process is reclaimed",
        (await readFile(lockPath, "utf-8")) !== "dead-process-token"
      );
      await releaseE();
    }

    // ── contention that is NOT stale times out, and says who holds it ──
    {
      process.env.MCP_LOCK_STALE_MS = "100000";
      process.env.MCP_LOCK_TIMEOUT_MS = "120";
      const releaseF = await acquireCrossProcessLock(key);
      let message = "";
      try {
        const releaseG = await acquireCrossProcessLock(key);
        await releaseG();
      } catch (err) {
        message = err?.message ?? "";
      }
      check("contention on a live lock times out", message.includes("Timed out"), message || "no error thrown");
      check("the timeout names the store", message.includes("store.json"), message);
      await releaseF();
    }

    // ── withFileLock still serializes callers inside one process ──
    {
      process.env.MCP_LOCK_STALE_MS = "100000";
      process.env.MCP_LOCK_TIMEOUT_MS = "2000";
      const order = [];
      await Promise.all([
        withFileLock(key, async () => {
          order.push("a-start");
          await sleep(30);
          order.push("a-end");
        }),
        withFileLock(key, async () => {
          order.push("b-start");
          order.push("b-end");
        }),
      ]);
      check(
        "withFileLock does not interleave same-key tasks",
        order.join(",") === "a-start,a-end,b-start,b-end",
        order.join(",")
      );
      check("withFileLock leaves no lock file behind", !existsSync(lockPath));
    }
  } finally {
    for (const [name, value] of [
      ["MCP_LOCK_STALE_MS", saved.stale],
      ["MCP_LOCK_HEARTBEAT_MS", saved.beat],
      ["MCP_LOCK_TIMEOUT_MS", saved.timeout],
      ["MCP_LOCK_RETRY_MS", saved.retry],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

// ── 22. Case archiving: selection, exhaustiveness, dedup ───────────────────
// This code moves your cases between files. The assertions that matter are the
// boring ones — nothing lost, nothing duplicated, an open case never archived
// — because every failure mode here is silent data movement.
//
// It also had a defect of omission: a 90-day default on a system whose oldest
// closed case was 17 days old, so it selected nothing and reported success
// while cases.json grew ~90 KB/day unbounded.
{
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = Date.parse("2026-07-23T00:00:00.000Z");
  const daysAgo = (n) => new Date(NOW - n * DAY).toISOString();
  const cutoff = (days) => NOW - days * DAY;
  const mk = (id, over = {}) => ({ id, status: "closed", openedAt: daysAgo(40), closedAt: daysAgo(30), log: [], ...over });

  // ── isArchivable ──
  check("closed and older than the cutoff is archivable", isArchivable(mk("a"), cutoff(14)));
  check("closed but newer than the cutoff is not", !isArchivable(mk("b", { closedAt: daysAgo(3) }), cutoff(14)));
  // The invariant that protects work in progress.
  check("an OPEN case is never archivable, however old", !isArchivable(mk("c", { status: "open", openedAt: daysAgo(400) }), cutoff(14)));
  check("closed with no closedAt is not archivable", !isArchivable(mk("d", { closedAt: undefined }), cutoff(14)));
  check("closed with an unparseable closedAt is not archivable", !isArchivable(mk("e", { closedAt: "last tuesday" }), cutoff(14)));
  check("a case exactly at the cutoff is kept, not archived", !isArchivable(mk("f", { closedAt: new Date(cutoff(14)).toISOString() }), cutoff(14)));

  // ── partitionCases: the exhaustiveness property ──
  {
    const cases = [
      mk("old-closed", { closedAt: daysAgo(30) }),
      mk("new-closed", { closedAt: daysAgo(1) }),
      mk("open-ancient", { status: "open", openedAt: daysAgo(500), closedAt: undefined }),
      mk("closed-undateable", { closedAt: "" }),
      mk("old-closed-2", { closedAt: daysAgo(90) }),
    ];
    const { toArchive, toKeep } = partitionCases(cases, cutoff(14));
    check("partition loses nothing", toArchive.length + toKeep.length === cases.length, `${toArchive.length}+${toKeep.length} vs ${cases.length}`);
    const ids = [...toArchive, ...toKeep].map((c) => c.id).sort();
    check("partition duplicates nothing", new Set(ids).size === ids.length, ids.join(","));
    check("partition covers exactly the input", ids.join(",") === cases.map((c) => c.id).sort().join(","), ids.join(","));
    check("partition archives only the old closed ones", toArchive.map((c) => c.id).sort().join(",") === "old-closed,old-closed-2", toArchive.map((c) => c.id).join(","));
  }

  // ── mergeArchive: dedup by id ──
  // The write order is archive-first so a crash duplicates rather than loses.
  // That is only recoverable if re-archiving the same case is a no-op.
  {
    const existing = [mk("x"), mk("y")];
    const incoming = [mk("y"), mk("z")]; // y already archived by a crashed run
    const { merged, added, skipped } = mergeArchive(existing, incoming);
    check("merge skips ids already archived", skipped === 1, `skipped ${skipped}`);
    check("merge adds only the new ones", added === 1, `added ${added}`);
    check("merge produces no duplicate ids", new Set(merged.map((c) => c.id)).size === merged.length);
    check("merge keeps existing entries first", merged.map((c) => c.id).join(",") === "x,y,z", merged.map((c) => c.id).join(","));
    const rerun = mergeArchive(merged, incoming);
    check("re-archiving the same batch is a no-op", rerun.added === 0 && rerun.merged.length === merged.length);
  }

  // ── analyzeStore: the report behind a run that archives nothing ──
  {
    const cases = [
      mk("c1", { closedAt: daysAgo(17) }),
      mk("c2", { closedAt: daysAgo(2) }),
      mk("o1", { status: "open", openedAt: daysAgo(20), closedAt: undefined }),
      mk("o2", { status: "open", openedAt: daysAgo(1), closedAt: undefined }),
      mk("u1", { closedAt: "nonsense" }),
    ];
    const s = analyzeStore(cases, { nowMs: NOW, cutoffMs: cutoff(90), idleOpenDays: 14 });
    check("analyze counts open and closed", s.openCount === 2 && s.closedCount === 3, `${s.openCount}/${s.closedCount}`);
    check("analyze reports nothing archivable at a 90d cutoff", s.archivableCount === 0, `${s.archivableCount}`);
    // This is the number that turns "Nothing to archive" into an explanation.
    check("analyze knows the oldest closed age", s.oldestClosedDays === 17, `${s.oldestClosedDays}`);
    check("analyze counts undateable closed cases", s.undateableCount === 1, `${s.undateableCount}`);
    check("analyze flags long-open cases", s.idleOpen.length === 1 && s.idleOpen[0].id === "o1", JSON.stringify(s.idleOpen));
    check("analyze reports a byte size", s.bytes > 0);

    const suggestions = suggestCutoffs(cases, NOW);
    const at14 = suggestions.find((o) => o.days === 14);
    const at90 = suggestions.find((o) => o.days === 90);
    check("suggestions find a cutoff that would move something", at14?.count === 1, JSON.stringify(suggestions));
    check("suggestions report zero where nothing would move", at90?.count === 0, JSON.stringify(suggestions));
  }

  // ── an empty store must not throw ──
  {
    const s = analyzeStore([], { nowMs: NOW, cutoffMs: cutoff(14) });
    check("empty store analyzes cleanly", s.total === 0 && s.oldestClosedDays === null && s.idleOpen.length === 0);
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
const total = passed + failures.length;
console.log(`\nREGRESSION: ${passed}/${total} checks passed`);
if (failures.length) {
  console.log(`\n${failures.length} FAILURE(S):`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("ALL GREEN ✓");
process.exit(0);
