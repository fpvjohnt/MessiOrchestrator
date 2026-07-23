// check_claim / claim_verdict: the same two-step research loop as healthguide's
// check_the_science. NEVER answers from memory — a science/history claim is
// exactly where a confident-sounding falsehood ("aliens built it", "free energy
// exists") spreads. Hands out authoritative sources + the pseudoscience red
// flags; research fetches; claim_verdict grades it honestly.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "Peer-reviewed literature — Nature, Science, PNAS (search via Google Scholar / PubMed) — the closest thing to a source of truth",
  "NASA (space) — https://science.nasa.gov  ·  ESA — https://www.esa.int",
  "CERN (particle physics) — https://home.cern",
  "USGS (earth/geology) — https://www.usgs.gov  ·  NOAA (climate/ocean) — https://www.noaa.gov",
  "Smithsonian & university archaeology/history departments (.edu) — for the human past",
  "Scientific consensus statements & review articles (they summarize ALL the evidence, not one study)",
];

const RED_FLAGS = [
  "SUPPRESSION conspiracy — 'they don't want you to know', 'it was covered up'. Real science is published to be attacked; that's how it gets stronger.",
  "Breaks a settled law (thermodynamics, relativity) with no extraordinary evidence — 'free energy', 'faster than light' claims almost always do.",
  "Cherry-picked anomalies — 'how do you explain THIS one thing?' while ignoring the mountain of ordinary evidence that fits the normal explanation.",
  "Erases the real people — 'ancient aliens' framing that credits outsiders for what documented human cultures demonstrably built.",
  "One lone maverick vs the entire field, with no reproducible data — genius is real, but so is being wrong.",
  "It's selling something — a book, a documentary series, a supplement, a 'course'.",
];

export function checkClaim(rawClaim: string): string {
  const claim = clean(rawClaim);
  return [
    `CLAIM CHECK — "${claim}"`,
    `BOTTOM LINE: don't answer this from memory. Have research check it against the real scientific bodies this tool names, then call claim_verdict with what it finds.`,
    ``,
    `CHECK THESE SOURCES:`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • "${claim}" scientific consensus evidence`,
    `  • "${claim}" peer reviewed study OR review`,
    `  • "${claim}" debunked OR skeptic OR explained`,
    ``,
    `PSEUDOSCIENCE RED FLAGS to watch for in what comes back:`,
    ...RED_FLAGS.map((r) => `  - ${r}`),
    ``,
    `Once research reports back, call claim_verdict(claim, findings) for the graded, honest answer.`,
  ].join("\n");
}

export function claimVerdict(rawClaim: string, findings: string): string {
  const claim = clean(rawClaim);
  const notes = clean(findings);
  return [
    `CLAIM VERDICT — "${claim}"`,
    `BOTTOM LINE: grade the evidence tier honestly from what research found — don't round up, and don't sneer either. Curiosity + honesty.`,
    ``,
    `Findings reported: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `Evidence tiers, strongest to weakest:`,
    `  1. Established scientific consensus — multiple independent lines of evidence agree. As solid as it gets.`,
    `  2. Well-supported by peer-reviewed evidence, with some open questions at the edges.`,
    `  3. A live hypothesis under active research — plausible, not settled. Honest to say "we don't know yet".`,
    `  4. Fringe / minority claim with weak or non-reproducible evidence.`,
    `  5. Pseudoscience — contradicts established evidence, relies on conspiracy framing, or makes no testable prediction. Not credible.`,
    ``,
    `Two honest endings that aren't "true" or "false":`,
    `  • "Genuinely open" — a real unanswered question (dark matter, what's inside a black hole). Wonder is the correct response.`,
    `  • "The real story is cooler" — often the debunked myth hides a true fact that's more interesting (how the pyramids WERE built; what Tesla DID invent).`,
    ``,
    `This grades the evidence, not the person asking — being curious about a wild claim is exactly right; the check is just how you find out.`,
  ].join("\n");
}
