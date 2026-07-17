import { CLUSTERS, resolveCluster } from "./clusters.js";

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export function levelUp(rawCurrent: string, rawTarget: string): string {
  const current = clean(rawCurrent);
  const target = clean(rawTarget);
  // resolveCluster checks specific job titles first (exact, then substring
  // only for >=3 char inputs) — it does NOT fall back to generic ladder words
  // like "senior"/"engineer" that would misroute almost anything.
  const curKey = resolveCluster(current);
  const tgtKey = resolveCluster(target);

  const targetKey = tgtKey ?? curKey;
  if (!targetKey) {
    return `LEVEL UP: ${current} → ${target}\n\nCouldn't map "${target}" to a known cluster. Tell me which of these it's closest to: ${Object.keys(CLUSTERS).join(", ")}.`;
  }
  const targetCluster = CLUSTERS[targetKey];
  const sameCluster = curKey !== undefined && curKey === tgtKey;

  const ladderNote = sameCluster
    ? `Same practice family (${targetCluster.label}) — this is a straight climb up its own ladder: ${targetCluster.ladder.join(" → ")}.`
    : curKey === undefined
    ? `Couldn't place your CURRENT role in a cluster (I only matched the target) — treat this as a full skill build, not a promotion.`
    : `This crosses INTO ${targetCluster.label} from a different practice family — expect to pick up its core tools from scratch, not just get promoted.`;

  return [
    `LEVEL UP: ${current} → ${target}`,
    `BOTTOM LINE: ${ladderNote}`,
    ``,
    `Target domain: ${targetCluster.label}`,
    `Core tools to have real (defensible) experience with: ${targetCluster.core_tools.join(", ")}`,
    `The ladder: ${targetCluster.ladder.join(" → ")}`,
    ``,
    `How to close the gap without faking it:`,
    `  1. Build one real project in this domain (see 'build_it') — a demonstrable artifact beats a certification alone.`,
    `  2. Take on this work INSIDE your current job first if you can — internal proof is the cheapest, most credible path up.`,
    `  3. Get one recognized cert if the field uses them (verify which ones actually matter right now — hand this to research).`,
    `  4. Document what you built (the way you already do — 127 pages isn't overkill, it's proof of work).`,
    ``,
    `VERIFY CURRENT DEMAND — have research check what's actually in-demand for "${target}" right now (titles/certs/tools drift fast):`,
    `  • "${target}" required skills 2026 job postings`,
    `  • "${target}" certifications that actually matter 2026`,
  ].join("\n");
}
