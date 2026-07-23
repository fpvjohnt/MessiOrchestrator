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
const tagOwners = new Map();
for (const a of registry) {
  if (a.status !== "active") continue;
  for (const t of a.tags || []) {
    if (!tagOwners.has(t)) tagOwners.set(t, []);
    tagOwners.get(t).push(a.name);
  }
}
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
