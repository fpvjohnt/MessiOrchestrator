#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BRANCHES, resolveBranch } from "./branches.js";
import { MYTHS, resolveMyth } from "./myths.js";
import { checkFinding, findingVerdict, howWeKnow } from "./evidence.js";

const server = new McpServer({ name: "psychology", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

// Sized from data/cases.json, not guessed (AGENTS.md: "do not set a length cap
// you have not measured"). Measured on 107 real cases: 83% of objectives exceed
// 120 chars, the longest topic argument actually passed was 256, and the longest
// objective on record is 927. Callers paste the whole objective in as the topic,
// which resolve() handles fine via loose contains-match.
const lookupKey = z.string().max(2000);
const freeText = z.string().max(2000);

// The one line this asset must never get wrong. healthguide owns personal
// mental health and carries a non-suppressible 911/988 override that runs
// before any of its own tools. A psychology EXPLAINER is the worst possible
// thing to hand someone describing their own symptoms, so every clinical
// surface here points away from itself rather than answering.
const CARE_BOUNDARY =
  `NOT CARE — this explains the field, not your situation. Anything about your own symptoms, ` +
  `medication, or safety belongs with the healthguide asset and a real clinician. If there is any ` +
  `risk to your safety right now, that is 988 (US, call or text) or 911 — not a reading list.`;

server.registerTool(
  "explain_topic",
  {
    title: "Explain a Psychology Topic",
    description:
      "THE FRONT DOOR: name any psychology topic — 'classical conditioning', 'attachment', 'Big Five', " +
      "'cognitive dissonance', 'why do we forget' — and get what the branch is, the ideas that actually " +
      "carry weight, what it looks like in ordinary life, and the caveat that keeps it honest. Branches: " +
      "cognitive, developmental, social, personality, learning & behaviour, clinical theory, biological, " +
      "and research methods. Omit 'topic' for the whole map.",
    inputSchema: { topic: lookupKey.optional() },
  },
  async ({ topic }) => {
    try {
      if (!topic) {
        return textResult(
          [
            `THE PSYCHOLOGY MAP — eight branches, pick one (or name any topic and I'll route it):`,
            `BOTTOM LINE: psychology is not one subject — these branches use different methods and have very different track records, and knowing which one a claim comes from tells you how much to trust it.`,
            ``,
            ...Object.values(BRANCHES).map((b) => `▸ ${b.label}: ${b.what}`),
            ``,
            `Ask with a branch name OR any specific thing — "why do habits stick", "is MBTI real", "how does CBT work".`,
            ``,
            CARE_BOUNDARY,
          ].join("\n")
        );
      }
      const key = resolveBranch(topic);
      if (!key) {
        return textResult(
          [
            `PSYCHOLOGY — "${topic}"`,
            `BOTTOM LINE: no branch matched that, so here is the map instead — pick the closest and ask again.`,
            ``,
            ...Object.values(BRANCHES).map((b) => `▸ ${b.label}: ${b.what}`),
            ``,
            `If it is a factual claim you want checked ("is it true that..."), use check_finding instead — that one refuses to answer from memory.`,
          ].join("\n")
        );
      }
      const b = BRANCHES[key];
      const clinical = key === "clinical_theory";
      return textResult(
        [
          `${b.label.toUpperCase()} — "${topic}"`,
          `BOTTOM LINE: ${b.what}`,
          ``,
          `KEY IDEAS:`,
          ...b.key_ideas.map((k) => `  • ${k}`),
          ``,
          `IN REAL LIFE:`,
          ...b.in_real_life.map((r) => `  • ${r}`),
          ``,
          `THE CAVEAT: ${b.caveat}`,
          ``,
          `GO DEEPER: ${b.deeper.join(" · ")}`,
          ``,
          clinical ? CARE_BOUNDARY : `For a specific factual claim, run check_finding — this field's most quotable results are often the ones that failed to replicate.`,
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "myth_vs_reality",
  {
    title: "Myth vs Reality",
    description:
      "The psychology folklore that is still repeated and does not hold up: learning styles, 10% of the brain, " +
      "left-brain/right-brain, the Stanford Prison Experiment, Milgram's '65%', social priming, power posing, " +
      "the Mozart effect, eyewitness confidence, personality types, 10,000 hours, the chemical-imbalance story, " +
      "repressed memories, subliminal advertising. Name one, or omit 'topic' for the full list. This tool exists " +
      "because in this field the most-repeated claims are disproportionately the failed ones.",
    inputSchema: { topic: lookupKey.optional() },
  },
  async ({ topic }) => {
    try {
      if (!topic) {
        return textResult(
          [
            `PSYCHOLOGY MYTHS — the ones still in circulation`,
            `BOTTOM LINE: every claim below is widely believed, frequently taught, and does not survive the evidence. Several are still in corporate training and teacher education right now.`,
            ``,
            ...Object.entries(MYTHS).map(([k, m]) => `▸ ${k.replace(/_/g, " ")} — "${m.claim}"`),
            ``,
            `Name any one for the reality. Related: how_we_know explains WHY so many of these survived.`,
          ].join("\n")
        );
      }
      const key = resolveMyth(topic);
      if (!key) {
        // Fall back to the branch-level myth rather than dead-ending.
        const bKey = resolveBranch(topic);
        if (bKey) {
          const b = BRANCHES[bKey];
          return textResult(
            [
              `MYTH VS REALITY — ${b.label}`,
              `BOTTOM LINE: no specific myth matched "${topic}", but here is the standing caveat for that branch.`,
              ``,
              `THE CAVEAT: ${b.caveat}`,
              ``,
              `Full myth list: call myth_vs_reality with no topic.`,
            ].join("\n")
          );
        }
        return textResult(
          [
            `MYTH VS REALITY — "${topic}"`,
            `BOTTOM LINE: that one is not in the myth list — if it is a factual claim you want tested, run check_finding, which grades it against replication evidence instead of guessing.`,
            ``,
            ...Object.entries(MYTHS).map(([k, m]) => `▸ ${k.replace(/_/g, " ")} — "${m.claim}"`),
          ].join("\n")
        );
      }
      const m = MYTHS[key];
      return textResult(
        [
          `MYTH VS REALITY — ${key.replace(/_/g, " ").toUpperCase()}`,
          `BOTTOM LINE: ${m.reality.split(/(?<=\.)\s/)[0]}`,
          ``,
          `THE CLAIM: ${m.claim}`,
          ``,
          `THE REALITY: ${m.reality}`,
          ``,
          `Branch: ${BRANCHES[m.branch]?.label ?? m.branch}. Use explain_topic for the wider context.`,
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "how_we_know",
  {
    title: "How Psychology Knows Anything",
    description:
      "The methods behind the claims: which designs support cause and which only support association, the five " +
      "questions that separate a solid finding from a shaky one, and a straight account of what the replication " +
      "crisis actually was and what fixed it. The antidote to 'studies show'.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(howWeKnow());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "check_finding",
  {
    title: "Check a Psychology Claim — Sources",
    description:
      "For ANY 'is this true?' psychology claim: returns the sources that settle it (preregistered multi-lab " +
      "replications first, then bias-corrected meta-analyses, then the original paper), the exact research " +
      "queries to run, and the red flags to watch for. NEVER answered from memory — in this field the most " +
      "famous results are disproportionately the ones that failed. Have research run the queries, then call " +
      "finding_verdict with what it found.",
    inputSchema: { claim: freeText },
  },
  async ({ claim }) => {
    try {
      return textResult(checkFinding(claim));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "finding_verdict",
  {
    title: "Finding Verdict",
    description:
      "Second half of the verify loop: pass what research found and get a COMMITTED grade — RETRACTED, FAILED " +
      "REPLICATION, WELL SUPPORTED, REPLICATED LIGHTLY, ASSOCIATION ONLY, SINGLE STUDY, or UNVERIFIED — plus the " +
      "signals it was graded on. Rounds DOWN: a negated mention ('failed to replicate') never counts as evidence " +
      "in favour, and 'it did not replicate' is reported as a real answer rather than smoothed over.",
    inputSchema: { claim: freeText, findings: freeText },
  },
  async ({ claim, findings }) => {
    try {
      return textResult(findingVerdict(claim, findings));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description:
      "What the psychology asset covers, the eight branches, how it differs from healthguide (your own mental " +
      "health), communication (persuading and reading people), and education (studying psychology as a school " +
      "subject) — and why it ships a verify loop.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(
        [
          `PSYCHOLOGY — start here`,
          `BOTTOM LINE: this asset explains the FIELD — how minds work, what the research actually supports, and which famous findings collapsed. It does not handle your own mental health; that is healthguide, deliberately.`,
          ``,
          `THE EIGHT BRANCHES:`,
          ...Object.values(BRANCHES).map((b) => `  ▸ ${b.label} — ${b.what}`),
          ``,
          `THE TOOLS:`,
          `  • explain_topic — the front door. Any topic, or omit for the map.`,
          `  • myth_vs_reality — the folklore that does not hold up (15 entries).`,
          `  • how_we_know — designs, the five questions, the replication crisis.`,
          `  • check_finding → finding_verdict — the verify loop for any "is this true?" claim.`,
          ``,
          `WHERE THIS ENDS AND ANOTHER ASSET BEGINS:`,
          `  • Your own symptoms, therapy, medication, crisis → healthguide (it runs a 911/988 override first).`,
          `  • Persuading, presenting, reading a room, difficult conversations → communication.`,
          `    (Body language splits on purpose: communication owns the PRACTICE — how to present, build`,
          `     rapport, read a room. This asset owns the SCIENCE — kinesics, proxemics, what actually`,
          `     replicates, and why cue dictionaries and lie-detection training do not work.)`,
          `  • Studying psychology as a school or university subject → education.`,
          `  • Einstein, Newton, the great scientific minds → curiosity (that is biography, not cognition).`,
          ``,
          `WHY THE VERIFY LOOP: psychology's most quotable results are disproportionately the ones that failed to`,
          `replicate — power posing, social priming, the Stanford Prison Experiment. On a factual claim this asset`,
          `refuses to answer from memory and routes to research instead.`,
          ``,
          CARE_BOUNDARY,
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
