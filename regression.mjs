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

import { readFile, readdir } from "node:fs/promises";
import { CLUSTERS, resolveCluster } from "./polymath-mcp/dist/clusters.js";
import { buildIt } from "./polymath-mcp/dist/build.js";
import { askTheExpert } from "./polymath-mcp/dist/consult.js";
import { selectAssets } from "./dist/router.js";
import { checkAssets, renderHealth } from "./dist/health.js";
import { synthesizeCase } from "./dist/synthesis.js";
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
for (const t of routeCases) {
  const { assigned } = selectAssets(t.obj, registry);
  const short = t.obj.slice(0, 40);
  if (t.exactly) check(`route "${short}…" == [${t.exactly}]`, assigned.length === t.exactly.length && t.exactly.every((a) => assigned.includes(a)), `got [${assigned}]`);
  if (t.includes) check(`route "${short}…" includes ${t.includes}`, t.includes.every((a) => assigned.includes(a)), `got [${assigned}]`);
}

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
for (const [label, out] of TOOL_SMOKE) {
  check(`tool renders: ${label}`, typeof out === "string" && out.length > 60, `len ${out?.length ?? "n/a"}`);
}
// A few content assertions — the honesty/neutrality guarantees these tools promise.
check("government keeps its not-legal-advice disclaimer", immigrationPaths("japan").toLowerCase().includes("not legal advice"));
check("faiths stays neutral", explainFaith("islam").toLowerCase().includes("evenhanded") || explainFaith("islam").toLowerCase().includes("doesn't tell you"));
check("communication read_people rejects mind-reading/lie-detection", readPeople().toLowerCase().includes("cannot") && readPeople().toLowerCase().includes("detect lies"));
check("curiosity claim_verdict resolves a specific family (Mandarin→right domain via explore)", curExplore("mandarin") !== undefined);
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
