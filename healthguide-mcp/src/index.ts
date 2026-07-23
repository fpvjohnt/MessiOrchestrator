#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as refStore from "./reference-store.js";
import { scanForEmergency, emergencyBanner, guardEmergency } from "./emergency.js";
import * as specialists from "./specialists.js";
import * as nutrition from "./nutrition.js";
import * as science from "./science.js";
import * as hope from "./hope.js";
import * as redflags from "./redflags.js";
import * as navigate from "./navigate.js";
import * as training from "./training.js";

const server = new McpServer({ name: "healthguide", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
function now(): Date {
  return new Date();
}
const lookupKey = z.string().max(200);

// ---------------------------------------------------------------------------
// The non-suppressible safety gate. Exposed directly, and every other
// free-text tool below routes through the same guardEmergency() check first.
// ---------------------------------------------------------------------------

server.registerTool(
  "emergency_check",
  {
    title: "Emergency Check",
    description:
      "Check whether symptoms described match red-flag emergency/crisis patterns (heart attack, stroke, " +
      "severe bleeding, suicidal thoughts, etc.) and get the immediate 911/988 guidance if so. Every other " +
      "tool in this server runs this check automatically on any free text it receives, before its own logic.",
    inputSchema: { symptoms: z.string().min(1).max(1000) },
  },
  async ({ symptoms }) => {
    try {
      const match = scanForEmergency(symptoms);
      if (match) return textResult(emergencyBanner(match));
      return textResult(
        `No red-flag emergency/crisis pattern detected in what you described. That does NOT mean nothing is wrong — it means this specific check didn't trigger. If you're worried, 'which_specialist' or 'root_cause_questions' are good next steps, or just call your doctor.`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Specialist routing + diagnostic-thinking questions.
// ---------------------------------------------------------------------------

server.registerTool(
  "which_specialist",
  {
    title: "Which Specialist",
    description:
      "Given a health concern (including relationship/family/marriage counseling needs), suggests which " +
      "type of specialist typically handles it and the urgency level. Never a diagnosis. Omit 'concern' " +
      "for the full list of specialist types covered.",
    inputSchema: { concern: lookupKey.optional() },
  },
  async ({ concern }) => {
    try {
      if (!concern) return textResult(specialists.listSpecialists());
      const guarded = guardEmergency<{ concern: string }>((a) => [a.concern], (a) => specialists.whichSpecialist(a.concern));
      return textResult(guarded({ concern }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "root_cause_questions",
  {
    title: "Root Cause Questions",
    description:
      "The SOCRATES clinical history-taking framework applied to your concern — the actual questions " +
      "doctors are trained to ask to narrow down a cause. Organizes your thinking; never diagnoses.",
    inputSchema: { concern: z.string().min(1).max(500) },
  },
  async ({ concern }) => {
    try {
      const guarded = guardEmergency<{ concern: string }>((a) => [a.concern], (a) => specialists.rootCauseQuestions(a.concern));
      return textResult(guarded({ concern }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Evidence-checking loop (research-first, two-step, multi-country).
// ---------------------------------------------------------------------------

server.registerTool(
  "check_the_science",
  {
    title: "Check the Science — Plan",
    description:
      "Given a health/nutrition/aging claim, returns the authoritative multi-country sources (NIH, Japan's " +
      "MHLW/NIHN, EFSA, Health Canada, WHO, Cochrane) and exact research queries to verify it, plus the " +
      "noise patterns to watch for. Never answers from memory. Have research run the queries, then call " +
      "science_verdict with what it finds.",
    inputSchema: { claim: z.string().min(1).max(500) },
  },
  async ({ claim }) => {
    try {
      const guarded = guardEmergency<{ claim: string }>((a) => [a.claim], (a) => science.checkTheScience(a.claim));
      return textResult(guarded({ claim }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "science_verdict",
  {
    title: "Check the Science — Verdict",
    description:
      "After research verifies a claim from check_the_science, call this with what it found for a graded, " +
      "honest evidence-tier verdict (strong/moderate/weak/none), noting cross-country agreement or disagreement.",
    inputSchema: { claim: z.string().min(1).max(500), findings: z.string().min(1).max(2000) },
  },
  async ({ claim, findings }) => {
    try {
      const guarded = guardEmergency<{ claim: string; findings: string }>(
        (a) => [a.claim, a.findings],
        (a) => science.scienceVerdict(a.claim, a.findings)
      );
      return textResult(guarded({ claim, findings }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Nutrition science.
// ---------------------------------------------------------------------------

server.registerTool(
  "explain_macronutrient",
  {
    title: "Explain a Macronutrient",
    description:
      "The real science of carbs, protein, and fat — what each does in the body, the aging-specific angle, " +
      "and the common myth about it. Stable biology; specific intake amounts route to get_reference. Omit " +
      "'type' for all three.",
    inputSchema: { type: lookupKey.optional() },
  },
  async ({ type }) => {
    try {
      if (!type) return textResult(nutrition.explainMacronutrient());
      const guarded = guardEmergency<{ type: string }>((a) => [a.type], (a) => nutrition.explainMacronutrient(a.type));
      return textResult(guarded({ type }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "explain_training_method",
  {
    title: "Explain a Training Method",
    description:
      "Exercise science for weight_training, calisthenics, and military_calisthenics — what each does, " +
      "recovery principles, and the common myth about it. Omit 'type' for all three. Not medical advice — " +
      "get medical clearance before starting intense new training after a long break or with a condition.",
    inputSchema: { type: lookupKey.optional() },
  },
  async ({ type }) => {
    try {
      if (!type) return textResult(training.explainTrainingMethod());
      const guarded = guardEmergency<{ type: string }>((a) => [a.type], (a) => training.explainTrainingMethod(a.type));
      return textResult(guarded({ type }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// The hope tool. Crisis-gated first, always.
// ---------------------------------------------------------------------------

server.registerTool(
  "find_next_step",
  {
    title: "Find the Next Step",
    description:
      "For when it feels like nothing has worked and you're close to giving up: a real, clinically-grounded " +
      "reminder that 'treatment-resistant' is not the end of the road — there are genuine next avenues. Not " +
      "crisis counseling (that's 988, checked first, always) — this is honest information to keep you from " +
      "concluding there's nothing left to try.",
    inputSchema: { situation: z.string().min(1).max(1000) },
  },
  async ({ situation }) => {
    try {
      const guarded = guardEmergency<{ situation: string }>((a) => [a.situation], (a) => hope.findNextStep(a.situation));
      return textResult(guarded({ situation }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Traps.
// ---------------------------------------------------------------------------

server.registerTool(
  "red_flag",
  {
    title: "Health Traps",
    description:
      "Common health misinformation/dangerous patterns: self-diagnosing online, stopping medication " +
      "abruptly, supplement interactions, STD-testing stigma, miracle-cure claims, skipping follow-up care. " +
      "Omit 'issue' for the summary.",
    inputSchema: { issue: lookupKey.optional() },
  },
  async ({ issue }) => {
    try {
      if (!issue) return textResult(redflags.redFlag());
      const guarded = guardEmergency<{ issue: string }>((a) => [a.issue], (a) => redflags.redFlag(a.issue));
      return textResult(guarded({ issue }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Care navigation.
// ---------------------------------------------------------------------------

server.registerTool(
  "find_care",
  {
    title: "Find Care",
    description:
      "Real care options matched to urgency (ER vs urgent care vs telehealth vs community clinic), " +
      "California county resources (Riverside/LA/San Diego baked in), and the permanent crisis/poison " +
      "control numbers. Research finds current local options.",
    inputSchema: { need: z.string().min(1).max(300), area: z.string().max(100).optional() },
  },
  async ({ need, area }) => {
    try {
      const guarded = guardEmergency<{ need: string; area?: string }>(
        (a) => [a.need, a.area],
        (a) => navigate.findCare(a.need, a.area)
      );
      return textResult(guarded({ need, area }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "navigate_care",
  {
    title: "Navigate Care",
    description: "Insurance denials/appeals, requesting medical records, prior authorization, inpatient registration paperwork.",
    inputSchema: { need: z.string().min(1).max(300) },
  },
  async ({ need }) => {
    try {
      const guarded = guardEmergency<{ need: string }>((a) => [a.need], (a) => navigate.navigateCare(a.need));
      return textResult(guarded({ need }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "prep_for_appointment",
  {
    title: "Prep for an Appointment",
    description: "What to track/bring before an appointment. Types: general, mental_health, specialist_followup.",
    inputSchema: { kind: lookupKey.optional() },
  },
  async ({ kind }) => {
    try {
      if (!kind) return textResult(navigate.prepForAppointment());
      const guarded = guardEmergency<{ kind: string }>((a) => [a.kind], (a) => navigate.prepForAppointment(a.kind));
      return textResult(guarded({ kind }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Reference + verification loop.
// ---------------------------------------------------------------------------

server.registerTool(
  "get_reference",
  {
    title: "Get Reference Data",
    description: "Live-sensitive figures (medical records deadline, insurance appeal deadline, protein intake guideline) with source, as-of date, staleness, and verify_url. Omit 'key' for all.",
    inputSchema: { key: lookupKey.optional() },
  },
  async ({ key }) => {
    try {
      const views = await refStore.withStaleness(now());
      const chosen = key ? views.filter((v) => v.key === key) : views;
      if (chosen.length === 0) return textResult(`No reference "${key}". Known: ${views.map((v) => v.key).join(", ")}`);
      const blocks = chosen.map((v) =>
        [
          `${v.key} — ${v.label}`,
          `  value: ${v.value}`,
          `  as of: ${v.as_of} (${v.age_days === Infinity ? "?" : v.age_days}d old${v.is_stale ? " — STALE, re-verify" : ""})`,
          `  confidence: ${v.confidence}`,
          `  source: ${v.source}`,
          `  verify_url: ${v.verify_url}`,
          v.notes ? `  notes: ${v.notes}` : null,
        ].filter(Boolean).join("\n")
      );
      return textResult(blocks.join("\n\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "list_stale_references",
  { title: "List Stale References", description: "Which stored figures are past their freshness window and should be re-verified via research.", inputSchema: {} },
  async () => {
    try {
      const stale = (await refStore.withStaleness(now())).filter((v) => v.is_stale);
      if (stale.length === 0) return textResult("All reference values are within their freshness window.");
      const lines = stale.map((v) => `- ${v.key} (${v.age_days === Infinity ? "unknown age" : `${v.age_days}d old`}, limit ${v.staleness_days}d) → verify at ${v.verify_url}`);
      return textResult(`STALE — re-verify via research:\n${lines.join("\n")}`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "update_reference",
  {
    title: "Update Reference (flag-only)",
    description: "Propose a new value after research verified it. FLAG-ONLY: without confirm=true it previews and writes nothing.",
    inputSchema: {
      key: lookupKey,
      value: z.string().min(1).max(500),
      source: z.string().min(1).max(500),
      as_of: z.string().optional(),
      confirm: z.boolean().default(false),
    },
  },
  async ({ key, value, source, as_of, confirm }) => {
    try {
      const asOf = as_of ?? now().toISOString().slice(0, 10);
      const parsed = new Date(asOf);
      if (Number.isNaN(parsed.getTime())) throw new Error(`as_of "${asOf}" is not a parseable date. Use YYYY-MM-DD.`);
      if (parsed.getTime() > now().getTime() + 86_400_000) throw new Error(`as_of "${asOf}" is in the future.`);
      const result = await refStore.updateReference(key, value, source, asOf, confirm, now());
      return textResult(result.message);
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Orientation.
// ---------------------------------------------------------------------------

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description: "Health question and don't know where to begin? The ground rules and first moves.",
    inputSchema: {},
  },
  async () =>
    textResult(
      [
        `BOTTOM LINE: this is health information and navigation — never a diagnosis, never a treatment plan, and never a replacement for a real doctor. If you're describing an emergency, say so plainly and 'emergency_check' (or any tool) will catch it first.`,
        ``,
        `Your first moves:`,
        `  1. Not sure who to see? 'which_specialist <concern>' (covers relationships/family/marriage too).`,
        `  2. Trying to pin down a cause? 'root_cause_questions <concern>'.`,
        `  3. Heard a claim online (diet, supplement, "cure")? 'check_the_science <claim>' — never take it at face value.`,
        `  4. Feel like nothing's worked and you're close to giving up? 'find_next_step <situation>' — you have not run out of options.`,
        `  5. Need care but don't know where? 'find_care <need> <area>'.`,
        ``,
        `Emergency numbers, always: 911 (emergency) · 988 (crisis, call or text) · 741741 (crisis text, text HOME) · 1-800-222-1222 (poison control).`,
      ].join("\n")
    )
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("close", () => process.exit(0));

  // Parent-death watchdog: if our parent (the orchestrator) dies WITHOUT cleanly
  // closing our stdin — a hard kill, crash, or abrupt reboot — the stdin-EOF
  // handlers above may never fire and we would linger as an orphan. Poll the
  // parent's liveness and self-terminate when it is gone, so residual process
  // trees can't pile up across reboots. unref() so this timer never keeps us alive.
  const __parentPid = process.ppid;
  setInterval(() => {
    try {
      process.kill(__parentPid, 0); // signal 0 = liveness probe; throws if gone
    } catch {
      process.exit(0);
    }
  }, 5000).unref();
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => process.exit(0));
}
main().catch((err) => {
  console.error("Fatal error starting healthguide MCP server:", err);
  process.exit(1);
});
