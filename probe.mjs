// OUT-OF-SET COLLISION GATE.
//
// AGENTS.md's rule — "any tag added in one domain's sense will collide with
// another domain's sense of the same word, and nothing in the harness will say
// so; when a tag is genuinely needed, hand-write probe queries using that word
// in the NEIGHBOURING domains' senses and check they don't collide" — was tribal
// knowledge run by hand. This makes it a gate.
//
// Each probe names an objective, the asset that MUST be assigned (its true
// domain sense), and/or an asset that must NOT ride along (the collision being
// guarded against). Golden/paraphrase are self-authored and cannot see these;
// this corpus is exactly the neighbouring-domain senses of shared words. Add a
// probe here every time a vocab change touches a word another domain also uses.
//
//   Run:  npm run probe
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { selectAssets } from "./dist/router.js";
import { warnIfStaleBuild } from "./build-freshness.mjs";

await warnIfStaleBuild(fileURLToPath(new URL(".", import.meta.url)));
const registry = JSON.parse(await readFile(new URL("./data/registry.json", import.meta.url), "utf-8"));

// { q, want?, mustNot? } — want must be assigned; mustNot must NOT be assigned.
const PROBES = [
  // ── psychology probes ──────────────────────────────────────────────────────
  // Every word below is one psychology WANTS but another asset already owns in
  // a different sense. The bare tag was either never claimed or claimed and
  // measured out; these lock that decision in so a later "just add the tag"
  // shows up as a failure instead of a silent misroute.
  //
  // SAFETY-CRITICAL: personal mental health must never reach the field
  // explainer. healthguide runs a non-suppressible 911/988 override first.
  { q: "I think I might be depressed and I don't know what to do", want: "healthguide", mustNot: "psychology" },
  { q: "I feel anxious all the time and it is affecting my work", want: "healthguide", mustNot: "psychology" },
  { q: "how do I find a therapist my insurance covers", want: "healthguide", mustNot: "psychology" },
  // the same subjects asked ABOUT THE FIELD stay with psychology
  { q: "what does the research say about how CBT works", want: "psychology" },
  { q: "explain classical and operant conditioning", want: "psychology" },
  // 'attention' is aiforge's (attention mechanism), 'memory' is loop's (agent memory)
  { q: "how does the attention mechanism work in a transformer", want: "aiforge", mustNot: "psychology" },
  { q: "how should I design memory for my AI agent", want: "loop", mustNot: "psychology" },
  // body language: communication owns the PRACTICE, psychology owns the SCIENCE
  { q: "how do I read body language in a negotiation", want: "communication", mustNot: "psychology" },
  { q: "how do I make my presentation more persuasive", want: "communication", mustNot: "psychology" },
  { q: "what is kinesics and how is it studied", want: "psychology", mustNot: "communication" },
  // studying the SUBJECT is education, not the field asset
  { q: "how should I study for my psychology exam", want: "education" },
  // curiosity's minds_science is BIOGRAPHY of scientists, not cognition
  { q: "what did Einstein actually discover", want: "curiosity", mustNot: "psychology" },

  // 'contract': kalshi event contract vs lawguide legal contract
  { q: "is a contract trading at 90 cents nearly free money", want: "kalshi", mustNot: "lawguide" },
  { q: "how do I get out of a contract early", want: "lawguide", mustNot: "kalshi" },
  { q: "is this employment contract legally binding", want: "lawguide", mustNot: "kalshi" },
  { q: "can I sue for breach of contract", want: "lawguide" },
  // 'trading': kalshi markets vs nestegg equities
  { q: "how do stocks trading at a discount work for my portfolio", want: "nestegg", mustNot: "kalshi" },
  { q: "is options trading a good idea for my retirement", want: "nestegg", mustNot: "kalshi" },
  // 'asset': overseer (the orchestrator's own assets) vs nestegg/lawguide (wealth)
  { q: "which asset has logged the most errors this week", want: "overseer" },
  { q: "what assets should I own in retirement", want: "nestegg", mustNot: "overseer" },
  { q: "how do I protect my assets from a lawsuit", want: "lawguide", mustNot: "overseer" },
  // 'loop': the loop asset (agentic) vs an ordinary programming loop
  { q: "how do I write a for loop in python", mustNot: "loop" },
  // 'cents' / 'odds' senses that AGENTS.md records as collision-prone
  { q: "how many cents on the dollar will this debt settle for", mustNot: "kalshi" },
  // 'posting' / 'profile': jobhunt hiring frame vs other senses of the words
  { q: "score this Analytics Engineer posting against my resume profile", want: "jobhunt" },
  { q: "how do I go about posting bail for a friend", want: "lawguide", mustNot: "jobhunt" },
  { q: "what asset allocation fits my risk profile in retirement", want: "nestegg", mustNot: "jobhunt" },
  // elevenlabs voice asset — routes on voice/tts/speech, not on generic 'audio'
  // in an unrelated sense
  { q: "convert this paragraph to speech with a natural voice", want: "elevenlabs" },
  { q: "transcribe this audio recording into text", want: "elevenlabs" },
  // docingest routes on document/pdf/attachment/extract, not generic 'file' senses
  { q: "extract the tables from this pdf attachment", want: "docingest" },
  { q: "pull the text out of this scanned document and its attachments", want: "docingest" },
  // ghmonitor routes on github/ci/workflow/deployment, not generic build senses
  { q: "did my github actions workflow pass or fail after the last push", want: "ghmonitor" },
  { q: "summarize the failing ci pipeline and the deployment status", want: "ghmonitor" },
  { q: "what broke after my last push", want: "ghmonitor" },
  // gitforge (GitHub how-to) must still own SETUP intent, not ghmonitor
  { q: "how do I set up a github actions workflow for ci", want: "gitforge", mustNot: "ghmonitor" },
  // docsearch = query the indexed corpus (search intent)
  { q: "search my documents for american express apr", want: "docsearch" },
  { q: "find spreadsheets mentioning projected revenue", want: "docsearch" },
  { q: "show me similar deployment failures from before", want: "docsearch" },
  // claim-check: research rides along as the independent checker, specialist leads
  { q: "is it true that eating carrots improves your night vision", want: "research" },
  { q: "debunk the myth that we only use ten percent of our brain", want: "research" },
  // Stemmed/sense collisions surfaced by the 2026-07-24 routing review.
  { q: "index this pdf so I can search it later", want: "docsearch", mustNot: "nestegg" }, // index != index fund
  { q: "why did the deployment fail in ci", want: "ghmonitor", mustNot: "polymath" }, // CI deploy != infra deployment
  { q: "compare cd rates versus a high yield savings account", want: "nestegg", mustNot: "ghmonitor" }, // CD = certificate of deposit
  { q: "did my ci build pass", want: "ghmonitor" }, // present-tense reachability
  { q: "are my pull request checks passing", want: "ghmonitor" },
  { q: "monitor errors across my assets", want: "overseer", mustNot: "ghmonitor" }, // own-assets sense
  // browser automation (Playwright) — interactive web flows, not a single fetch
  { q: "browse this website and fill out the form for me", want: "browser" },
  { q: "automate the browser to click through the checkout", want: "browser" },
  { q: "take a screenshot of this webpage", want: "browser" },

  // ── youtube probes ─────────────────────────────────────────────────────────
  // youtube's natural vocabulary is almost entirely spoken for. Every mustNot
  // below is a word this asset WANTED and did not claim; every one was checked
  // against the registry tag->owner map before shipping rather than after.
  //
  // SAFETY-CRITICAL: "viral" is the single most tempting tag for a video-metrics
  // asset and the most dangerous. A symptom question must reach healthguide,
  // which runs the non-suppressible 911/988 override. This probe is the reason
  // `viral` is untagged on youtube AND why `symptom` gained the specific symptom
  // nouns in src/synonyms.ts — before that fix this query fell through to the
  // research fallback and healthguide never saw it at all.
  { q: "is my cough viral or bacterial", want: "healthguide", mustNot: "youtube" },
  { q: "how long does a viral infection with a fever last", want: "healthguide", mustNot: "youtube" },
  // but the video sense must still land on youtube
  { q: "why did my youtube video go viral and can I repeat it", want: "youtube" },

  // 'audience' is communication's (persuasion), which is the word youtube most
  // wanted for viewer demographics.
  { q: "how do I read my audience during a presentation", want: "communication", mustNot: "youtube" },
  { q: "how do I keep an audience engaged while public speaking", want: "communication", mustNot: "youtube" },
  // the demographics sense stays with youtube
  { q: "what age group and gender watch my channel", want: "youtube", mustNot: "communication" },

  // 'analytics' and 'platform' are both polymath's
  { q: "what analytics platform should I use for our data warehouse", want: "polymath", mustNot: "youtube" },
  // 'upload' is docingest's
  { q: "how do I upload a document so the AI can read it", want: "docingest", mustNot: "youtube" },
  // 'views' left untagged — the religious-opinion sense
  { q: "what are Buddhist views on suffering", want: "faiths", mustNot: "youtube" },
  // 'growth' and 'shorts' left untagged — nestegg owns both senses
  { q: "what is the compound growth on 500 dollars a month", want: "nestegg", mustNot: "youtube" },
  { q: "should I be shorting a stock right now", mustNot: "youtube" },
  // 'transcript' left untagged — the academic sense is education's
  { q: "how do I request my college transcript", want: "education", mustNot: "youtube" },
  // but captions stay with youtube
  { q: "get me the captions for this youtube video", want: "youtube", mustNot: "education" },
  // bare 'engagement' left untagged — three unrelated senses share the word
  { q: "how do I improve employee engagement on my team", want: "jobhunt", mustNot: "youtube" },
  // 'creator' left untagged — the theological sense
  { q: "who do Muslims believe is the creator of the universe", want: "faiths", mustNot: "youtube" },
  // 'video'/'videos' ARE claimed, so guard the neighbouring senses explicitly
  { q: "how do I set up a video call for my team standup", mustNot: "youtube" },
];

let pass = 0;
const failures = [];
for (const p of PROBES) {
  const assigned = selectAssets(p.q, registry).assigned;
  const wantOk = !p.want || assigned.includes(p.want);
  const mustNotOk = !p.mustNot || !assigned.includes(p.mustNot);
  if (wantOk && mustNotOk) {
    pass++;
  } else {
    const why = [];
    if (!wantOk) why.push(`missing want=${p.want}`);
    if (!mustNotOk) why.push(`collided on mustNot=${p.mustNot}`);
    failures.push(`  ✗ [${assigned.join(", ")}]  ${why.join("; ")}\n      :: ${p.q}`);
  }
}

console.log(`\nOUT-OF-SET COLLISION PROBES — ${pass}/${PROBES.length} passed`);
if (failures.length) {
  console.log(failures.join("\n"));
}

// Informational: tags shared across >=2 assets. Overlap is often legitimate
// (research/overseer share operational words), so this is a report, not a gate —
// it tells you WHERE to add a probe when you next touch one of these words.
//
// STEM before comparing: the router folds "deployments"->"deployment" and
// "stocks"->"stock" before matching, so two assets whose RAW tags differ
// ("deployment" vs "deployments") still collide in the router's view. Comparing
// raw strings hid exactly that class (routing review, 2026-07-24). Mirror the
// router's conservative plural fold here.
const stem = (w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const tagOwners = new Map();
for (const a of registry) {
  if (a.status !== "active") continue;
  for (const raw of a.tags || []) {
    const t = stem(raw);
    if (!tagOwners.has(t)) tagOwners.set(t, new Set());
    tagOwners.get(t).add(a.name);
  }
}
for (const [t, owners] of tagOwners) tagOwners.set(t, [...owners]);
const shared = [...tagOwners.entries()].filter(([, owners]) => owners.length >= 2).sort((a, b) => b[1].length - a[1].length);
if (shared.length) {
  console.log(`\nSHARED TAGS (informational — ${shared.length} tags in >=2 assets; probe these when touched):`);
  for (const [tag, owners] of shared.slice(0, 15)) console.log(`  ${tag}: ${owners.join(", ")}`);
  if (shared.length > 15) console.log(`  … and ${shared.length - 15} more.`);
}

console.log("");
if (failures.length) {
  console.log(`PROBE GATE FAILED: ${failures.length} out-of-set collision(s).`);
  process.exit(1);
}
console.log(`Probe gate OK: no out-of-set collisions in ${PROBES.length} neighbouring-domain probes.`);
