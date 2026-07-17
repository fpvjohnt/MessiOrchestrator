import { fuzzyFind, displayKey } from "./match.js";
import { CLUSTERS, resolveCluster } from "./clusters.js";

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

// Light v1: stable-ish regional facts (data-privacy regime, general remote
// culture) + a live-verify hook, since salaries/stacks/hiring norms drift.
// Deep per-country coverage is v1.5 — this exists now so it's not bolted on later.

interface Region {
  privacy_law: string;
  remote_culture: string;
}

export const REGIONS: Record<string, Region> = {
  united_states: { privacy_law: "Patchwork — CCPA/CPRA (California) + sector laws (HIPAA, GLBA); no single federal law.", remote_culture: "Remote-common in tech, but 2026 has a strong RTO push at large companies; startups skew remote-friendly." },
  united_kingdom: { privacy_law: "UK GDPR (post-Brexit version of EU GDPR) — strong individual data rights.", remote_culture: "Hybrid is the norm in most corporates; remote-first still common in tech/startups." },
  france: { privacy_law: "EU GDPR, enforced by CNIL — strict on consent and data minimization.", remote_culture: "Legally protected 'right to disconnect'; 35-hour work-week culture shapes expectations even in tech." },
  canada: { privacy_law: "PIPEDA federally, plus provincial laws (e.g. Quebec's Law 25, GDPR-like).", remote_culture: "Similar to the US — remote common in tech, RTO push less aggressive." },
  mexico: { privacy_law: "Federal data protection law (LFPDPPP, 2010); its 2025 revision moved closer to GDPR-style rules, with historically lighter enforcement than the EU.", remote_culture: "Growing tech/nearshore hub for US companies; remote and hybrid both common, strong overlap with US time zones (attractive for US-remote roles)." },
  south_america: { privacy_law: "Brazil's LGPD is the big one (GDPR-modeled, strong enforcement); other countries vary widely.", remote_culture: "Major nearshore/remote talent hub for US/EU companies, especially Brazil and Argentina; strong overlap with US time zones." },
  japan: { privacy_law: "APPI (Act on Protection of Personal Information) — GDPR-adequate but distinct consent/notification rules.", remote_culture: "Historically office-first and hierarchical; remote adoption slower than US/EU but growing, especially at tech-forward firms." },
};

export function howItsDone(cluster?: string, region?: string): string {
  if (!cluster) {
    return `Give a cluster (${Object.keys(CLUSTERS).join(", ")}) and optionally a region (${Object.keys(REGIONS).join(", ")}) and I'll show what's stable (regs/culture) vs what to verify live (stack/pay/hiring norms).`;
  }
  // resolveCluster recognizes specific job titles too (e.g. "Digital Forensics
  // Examiner"), not just the 8 cluster names — same as day_in_the_life.
  const clusterKey = resolveCluster(cluster);
  if (!clusterKey) return `Don't know "${clean(cluster)}". I have: ${Object.keys(CLUSTERS).join(", ")}. Ask by cluster name or a specific job title.`;
  const c = CLUSTERS[clusterKey];

  if (!region) {
    return [
      `${c.label} — general (no region given)`,
      `BOTTOM LINE: ${c.what}`,
      `Core tools: ${c.core_tools.join(", ")}`,
      ``,
      `Add a region (${Object.keys(REGIONS).join(", ")}) for local regs/culture + live pay/hiring queries.`,
    ].join("\n");
  }
  const foundRegion = fuzzyFind(REGIONS, region);
  if (!foundRegion) return `Don't know region "${clean(region)}". I have: ${Object.keys(REGIONS).join(", ")}.`;
  const r = foundRegion.value;

  return [
    `${c.label} in ${displayKey(foundRegion.key)}`,
    `BOTTOM LINE: same core discipline everywhere (${c.what.split(" — ")[0]}...), but the rules and culture around it differ.`,
    ``,
    `Data-privacy regime: ${r.privacy_law}`,
    `Remote/work culture: ${r.remote_culture}`,
    ``,
    `VERIFY LIVE (pay, hiring norms, and preferred stack drift fast) — have research check:`,
    `  • "${c.label.toLowerCase()} salary ${foundRegion.key.replace(/_/g, " ")} 2026"`,
    `  • "${c.label.toLowerCase()} hiring trends ${foundRegion.key.replace(/_/g, " ")} 2026"`,
  ].join("\n");
}
