// Explain a routing decision: which assets were chosen, and the near-misses
// with a one-word reason each lost. This is the neighbouring-domain collision
// probe AGENTS.md tells you to run by hand — as one command. Read-only, and it
// lives in the dev/CLI layer so it adds ZERO tokens to the orchestrator surface.
//
//   Run:  npm run explain -- "is a contract trading at 90 cents free money"
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { explainRouting } from "./dist/router.js";
import { warnIfStaleBuild } from "./build-freshness.mjs";

await warnIfStaleBuild(fileURLToPath(new URL(".", import.meta.url)));

const registry = JSON.parse(await readFile(new URL("./data/registry.json", import.meta.url), "utf-8"));
const objective = process.argv.slice(2).join(" ").trim();
if (!objective) {
  console.error('Usage: npm run explain -- "<objective>"');
  process.exit(2);
}

const e = explainRouting(objective, registry);
console.log(`\nOBJECTIVE: ${e.objective}`);
console.log(`ASSIGNED:  [${e.assigned.join(", ")}]${e.verifierAdded ? "  (+verifier eligible)" : ""}`);
console.log(`WHY:       ${e.rationale}\n`);
console.log(`TOP CANDIDATES (winners + near-misses):`);
for (const c of e.candidates) {
  const mark = c.verdict === "assigned" ? "*" : " ";
  const tags = c.matchedTags.length ? `tags: ${c.matchedTags.join(", ")}` : "";
  console.log(`  ${mark} ${c.name.padEnd(12)} score ${String(c.score).padStart(3)}  ${c.verdict.padEnd(22)} ${tags}`);
}
console.log("");
