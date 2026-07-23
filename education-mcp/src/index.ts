#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as refStore from "./reference-store.js";
import { exploreSubject, coursePath, studySkills, startHere } from "./subjects.js";
import { requirements } from "./requirements.js";

const server = new McpServer({ name: "education", version: "0.1.0" });

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
const lookupKey = z.string().max(120);

server.registerTool(
  "explore_subject",
  {
    title: "Explore a Subject or Class",
    description:
      "The front door: name any school subject or class — 'calculus', 'chemistry', 'AP world history', 'welding', " +
      "'Spanish' — and get the subject it belongs to, the classes in it, why it matters, how to study it, and what " +
      "it connects to. Omit 'subject' for the full map. Subjects: mathematics, sciences, english_language_arts, " +
      "social_studies, world_languages, arts, computer_technology, career_technical, health_pe.",
    inputSchema: { subject: lookupKey.optional() },
  },
  async ({ subject }) => {
    try {
      return textResult(exploreSubject(subject));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "course_path",
  {
    title: "Course Ladder",
    description: "The usual order of classes within a subject — what to take before what (e.g. Algebra → Geometry → Trig → Pre-Calc → Calculus). Omit 'subject' for all ladders.",
    inputSchema: { subject: lookupKey.optional() },
  },
  async ({ subject }) => {
    try {
      return textResult(coursePath(subject));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "study_skills",
  {
    title: "How to Study",
    description: "How to actually learn — the universal evidence-based techniques (active recall, spaced repetition, teaching it) plus tips specific to a subject if you name one.",
    inputSchema: { subject: lookupKey.optional() },
  },
  async ({ subject }) => {
    try {
      return textResult(studySkills(subject));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "requirements",
  {
    title: "Graduation / Degree Requirements",
    description: "The stable STRUCTURE of what it takes to graduate or earn a degree (high_school, college, admissions) plus the exact research queries to verify YOUR school/state specifics (which vary and change). Omit 'level' for the overview.",
    inputSchema: { level: lookupKey.optional() },
  },
  async ({ level }) => {
    try {
      return textResult(requirements(level));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// --- Reference data + verify loop ---

server.registerTool(
  "get_reference",
  {
    title: "Get Reference Data",
    description: "Live-sensitive education figures (bachelor's credit hours, AP course count, SAT structure, HS credits to graduate) with source, as-of date, staleness, and the verify_url research fetches. Omit 'key' for all.",
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
  { title: "List Stale References", description: "Which stored education figures are past their freshness window and should be re-verified via research.", inputSchema: {} },
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

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description: "New here? What this covers and the first move.",
    inputSchema: {},
  },
  async () => textResult(startHere())
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
  console.error("Fatal error starting education MCP server:", err);
  process.exit(1);
});
