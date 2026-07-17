import { CLUSTERS, resolveCluster } from "./clusters.js";
import { matchClusters } from "./build.js";
import { matchFoundations, foundationLabel } from "./foundations.js";
import type { WorkContext } from "./context-store.js";
import { contextLines } from "./context-store.js";

// The consult loop: ask_the_expert takes ANY free-text question (troubleshoot,
// work problem, improvement, pitch) and answers the way the right specialist
// would — how they frame it, what they'd ask you first, their method in order,
// their tools, and the research queries for anything current. expert_verdict
// then folds what research found into the final playbook. Same two-step shape
// as build_it/finalize_build and healthguide's check_the_science/science_verdict.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export function askTheExpert(rawQuestion: string, ctx: WorkContext, expertHint?: string): string {
  const question = clean(rawQuestion);

  // Explicit hint (a title like "Tableau Developer" or a cluster name) wins;
  // otherwise route on the QUESTION ONLY. Saved context personalizes the
  // answer but must not pick the expert — a context full of AI/BI tools would
  // drag those experts into every question, even a frozen Windows box.
  const hinted = expertHint ? resolveCluster(expertHint) : undefined;
  const matched = hinted
    ? [hinted]
    : matchClusters(question).slice(0, 2).map((m) => m.key);

  if (matched.length === 0) {
    return [
      `ASK THE EXPERT — ${question}`,
      ``,
      `Couldn't confidently tell which specialist this belongs to. Two ways forward:`,
      `  • Re-ask with expert: set to a job title ("Tableau Developer", "Cyber Security Analyst") or a cluster (${Object.keys(CLUSTERS).join(", ")}).`,
      `  • Or add one concrete detail — the tool, the error, the system involved — and routing will usually catch it.`,
    ].join("\n");
  }

  const primary = CLUSTERS[matched[0]];
  const ctxBlock = contextLines(ctx);

  const sections = matched.map((key) => {
    const c = CLUSTERS[key];
    return [
      `▶ THE ${c.label.toUpperCase()} EXPERT would work it like this:`,
      ...c.method.map((step, i) => `  ${i + 1}. ${step}`),
      `  Their toolbox: ${c.core_tools.join(", ")}`,
    ].join("\n");
  });

  const questions = matched.flatMap((key) => CLUSTERS[key].diagnostic_questions);

  // Supplement, not a router: if the question clearly touches a science/math
  // foundation, point at it. This never changes WHICH expert answered.
  const foundHits = matchFoundations(question).slice(0, 2);
  const foundationLines = foundHits.length
    ? [
        ``,
        `UNDERNEATH: this leans on ${foundHits.map(foundationLabel).join(" + ")}. Run 'foundations ${foundHits[0].key}' for the science/math behind it.`,
      ]
    : [];

  return [
    `ASK THE EXPERT — ${question}`,
    `BOTTOM LINE: this is ${matched.map((k) => CLUSTERS[k].label).join(" + ")} territory. Here's how that expert would take it on.`,
    ``,
    ...(ctxBlock.length
      ? [`Using your saved context (set_context to change):`, ...ctxBlock.map((l) => `  ${l}`), ``]
      : [`No saved context — answers are generic. Run set_context once (role, stacks, constraints) and every consult personalizes.`, ``]),
    sections.join("\n\n"),
    ``,
    `BEFORE ACTING, the expert would ask YOU:`,
    ...questions.map((q) => `  • ${q}`),
    `(Answer what you can and re-ask with those details folded in — that's the back-and-forth.)`,
    ...foundationLines,
    ``,
    `VERIFY THE CURRENT SPECIFICS — have research run these, then call expert_verdict with what it finds:`,
    `  • "${question}" solution 2026`,
    `  • ${primary.label.toLowerCase()} best practice for "${question}" current`,
    ``,
    `Once research reports back, call expert_verdict(question, findings) for the final playbook.`,
  ].join("\n");
}

export function expertVerdict(rawQuestion: string, rawFindings: string, ctx: WorkContext, expertHint?: string): string {
  const question = clean(rawQuestion);
  const findings = clean(rawFindings);

  const hinted = expertHint ? resolveCluster(expertHint) : undefined;
  const matched = hinted ? [hinted] : matchClusters(question).slice(0, 2).map((m) => m.key);
  const c = matched.length ? CLUSTERS[matched[0]] : undefined;
  const ctxBlock = contextLines(ctx);

  return [
    `EXPERT VERDICT — ${question}`,
    `BOTTOM LINE: fold the verified findings into the ${c ? c.label : "expert"} method below, take the first step TODAY, and come back with what happened — that's how the back-and-forth converges on solved.`,
    ``,
    `What research verified: ${findings || "(nothing passed — hand this what research found)"}`,
    ...(ctxBlock.length ? [``, `Applied to your situation:`, ...ctxBlock.map((l) => `  ${l}`)] : []),
    ``,
    ...(c
      ? [
          `The playbook, with findings folded in:`,
          ...c.method.map((step, i) => `  ${i + 1}. ${step}`),
          ``,
          `First move: do step 1 with the specifics research just verified — smallest concrete action, today.`,
        ]
      : [`Couldn't map the question to one expert — re-run with expert: set to a title or cluster.`]),
    ``,
    `If this surfaced NEW questions (it usually does), ask_the_expert again with the new detail — each round gets more specific. If a stored figure looked stale along the way, flag it via update_reference.`,
  ].join("\n");
}
