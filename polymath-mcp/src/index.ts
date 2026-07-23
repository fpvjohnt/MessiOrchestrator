#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as refStore from "./reference-store.js";
import * as clusters from "./clusters.js";
import * as build from "./build.js";
import * as levelup from "./levelup.js";
import * as regional from "./regional.js";
import * as consult from "./consult.js";
import * as foundations from "./foundations.js";
import * as contextStore from "./context-store.js";

const server = new McpServer({ name: "polymath", version: "0.1.0" });

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
const lookupKey = z.string().max(100);

// ---------------------------------------------------------------------------
// Domain map.
// ---------------------------------------------------------------------------

server.registerTool(
  "day_in_the_life",
  {
    title: "Day in the Life of a Practice",
    description:
      "What a technical practice family actually does day-to-day, its core tools, and its ladder. " +
      "Clusters: ai_engineering_ops, data_bi, cloud_infra, security_trust_forensics, systems_support, " +
      "leadership_delivery, ai_safety_frontier, design_frontend, hardware_silicon, ml_modeling_science. " +
      "Omit 'cluster' for the full map.",
    inputSchema: { cluster: lookupKey.optional() },
  },
  async ({ cluster }) => {
    try {
      return textResult(clusters.dayInTheLife(cluster));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Consult loop — ask ANY question, get the right expert's playbook, verify
// specifics via research, fold findings back. The core of the MCP.
// ---------------------------------------------------------------------------

server.registerTool(
  "ask_the_expert",
  {
    title: "Ask the Expert",
    description:
      "THE front door: ask ANY technical question — troubleshooting (a frozen Windows machine), a work " +
      "problem (a Tableau dashboard on SQL Server), an improvement, a pitch to leadership — and get how " +
      "the RIGHT specialist would handle it: their method step-by-step, the questions they'd ask you " +
      "first, their tools, and the research queries to verify current specifics. Uses your saved " +
      "set_context. Have research run the queries, then call expert_verdict with what it finds.",
    // The cap was 500 and it was the single biggest source of failed calls in
    // the real case log: 7 rejections at 507, 533, 585, 622, 814, 866 and 1923
    // characters, while successful calls topped out at exactly 498 — callers
    // write to the limit and past it. A question is free text describing a
    // real situation; 500 characters is roughly four sentences, which is not
    // how anyone describes a problem worth asking about. Rejecting it outright
    // dead-ends the whole consult loop rather than answering a slightly long
    // question. Sized from the observed maximum with headroom. Keep this in
    // step with expert_verdict's question cap — step 2 takes the SAME string,
    // so a tighter cap there would break every long question this one accepts.
    inputSchema: {
      question: z.string().min(1).max(4000),
      expert: lookupKey.optional().describe("Force a specific job title or cluster if auto-routing guesses wrong."),
    },
  },
  async ({ question, expert }) => {
    try {
      const ctx = await contextStore.getContext();
      return textResult(consult.askTheExpert(question, ctx, expert));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "expert_verdict",
  {
    title: "Expert Verdict",
    description:
      "Step 2 of the consult loop: after research runs the queries from ask_the_expert, pass what it " +
      "found to get the final playbook — findings folded into the expert's method, the first concrete " +
      "move, and the follow-up loop.",
    inputSchema: {
      question: z.string().min(1).max(4000).describe("The same question passed to ask_the_expert."),
      findings: z.string().min(1).max(2000).describe("What research found when it verified the specifics."),
      expert: lookupKey.optional().describe("Same expert/cluster hint as before, if one was used."),
    },
  },
  async ({ question, findings, expert }) => {
    try {
      const ctx = await contextStore.getContext();
      return textResult(consult.expertVerdict(question, findings, ctx, expert));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "set_context",
  {
    title: "Set Work Context",
    description:
      "Save your situation once (role, work stack, home stack, constraints, goals) so every consult " +
      "personalizes instead of answering generically. Only provided fields change.",
    inputSchema: {
      current_role: z.string().max(200).optional().describe('e.g. "Senior Systems Analyst at Nordstrom"'),
      work_stack: z.array(z.string().max(100)).max(30).optional().describe("Tools/systems at work."),
      home_stack: z.array(z.string().max(100)).max(30).optional().describe("Home lab / personal projects."),
      constraints: z.array(z.string().max(200)).max(20).optional().describe('e.g. "no admin rights on work laptop"'),
      goals: z.array(z.string().max(200)).max(20).optional(),
    },
  },
  async (patch) => {
    try {
      const saved = await contextStore.updateContext(patch, now());
      const lines = contextStore.contextLines(saved);
      return textResult(
        `Context saved. Every ask_the_expert call now uses:\n${lines.map((l) => `  ${l}`).join("\n") || "  (empty)"}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_context",
  {
    title: "Get Work Context",
    description: "Show the saved work context that consults personalize against.",
    inputSchema: {},
  },
  async () => {
    try {
      const ctx = await contextStore.getContext();
      const lines = contextStore.contextLines(ctx);
      return textResult(
        lines.length
          ? `Saved context (updated ${ctx.updated_at ?? "unknown"}):\n${lines.map((l) => `  ${l}`).join("\n")}`
          : "No context saved yet. Run set_context with your role, stacks, and constraints."
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "foundations",
  {
    title: "Foundations — The Science & Math Underneath",
    description:
      "The SCIENCES and MATH the practice families rest on — the 'why it works' under day_in_the_life's " +
      "'how it's done'. Omit 'topic' for the full map. Pass a science (electromagnetism, quantum & " +
      "semiconductor physics, solid-state, materials science, computer science, computational science, " +
      "data science, cognitive/neuroscience), a math topic (calculus/diffeq, linear algebra, probability " +
      "& statistics, discrete math/boolean logic, numerical analysis, optimization, Fourier/signal " +
      "processing, information theory), OR a cluster/job title to see what that family is built on.",
    inputSchema: { topic: lookupKey.optional() },
  },
  async ({ topic }) => {
    try {
      return textResult(foundations.foundations(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Build a project — two-step loop with research (plan+sources -> finalize).
// ---------------------------------------------------------------------------

server.registerTool(
  "build_it",
  {
    title: "Build a Project — Plan",
    description:
      "Given a project idea (home or work), maps it to the relevant practice cluster(s), the likely stack, " +
      "and the EXACT research queries to verify the current best-practice tools (tools drift fast — never " +
      "guess). Have research run those, then call finalize_build with what it finds.",
    inputSchema: {
      idea: z.string().min(1).max(2000),
      cluster_hint: lookupKey.optional().describe("Force a cluster if auto-detection guesses wrong."),
    },
  },
  async ({ idea, cluster_hint }) => {
    try {
      return textResult(build.buildIt(idea, cluster_hint));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "finalize_build",
  {
    title: "Build a Project — Finalize",
    description:
      "After research verifies the current stack for a 'build_it' plan, call this with what it found to get " +
      "the actual architecture, the smallest first step, and the risks to watch.",
    inputSchema: {
      idea: z.string().min(1).max(2000),
      findings: z.string().min(1).max(2000).describe("What research found when it verified the stack."),
    },
  },
  async ({ idea, findings }) => {
    try {
      return textResult(build.finalizeBuild(idea, findings));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Level up.
// ---------------------------------------------------------------------------

server.registerTool(
  "level_up",
  {
    title: "Level Up",
    description:
      "Given your current role and a target role/skill, the real gap, the ladder, how to close it without " +
      "faking anything, and the research queries to verify what's actually in demand right now.",
    inputSchema: {
      current_role: z.string().min(1).max(500),
      target_role: z.string().min(1).max(500),
    },
  },
  async ({ current_role, target_role }) => {
    try {
      return textResult(levelup.levelUp(current_role, target_role));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Regional / global layer (light v1).
// ---------------------------------------------------------------------------

server.registerTool(
  "how_its_done",
  {
    title: "How It's Done, By Region",
    description:
      "How a practice cluster's regs/culture differ by region (US, United Kingdom, France, Canada, Mexico, " +
      "South America, Japan) — plus the live queries for current pay/hiring norms in that region. Omit " +
      "'region' for the cluster alone.",
    inputSchema: { cluster: lookupKey.optional(), region: lookupKey.optional() },
  },
  async ({ cluster, region }) => {
    try {
      return textResult(regional.howItsDone(cluster, region));
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
    description: "Live-sensitive current-stack figures per cluster with source, as-of date, staleness, and the verify_url research fetches. Omit 'key' for all.",
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
    description: "Not sure where to begin across all these technical domains? The first moves.",
    inputSchema: {},
  },
  async () =>
    textResult(
      [
        `BOTTOM LINE: your ~90 job titles are really 10 practice families, and the front door is one question.`,
        ``,
        `  • ANY question — troubleshooting, work problem, improvement, pitch → 'ask_the_expert <question>', then 'expert_verdict' once research verifies the specifics. Save your situation once with 'set_context' so answers personalize.`,
        `  • Building a project (home or work) → 'build_it <idea>', then 'finalize_build' once research verifies the stack.`,
        `  • Moving up toward a target role → 'level_up <current> <target>'.`,
        `  • Understanding a domain → 'day_in_the_life <cluster>'.`,
        `  • The science/math UNDER a domain → 'foundations <topic-or-cluster>'.`,
        `  • Working across a region/country → 'how_its_done <cluster> <region>'.`,
        ``,
        `Everything current (stacks, certs, pay, regs) routes through research to verify — nothing here is guessed and left unchecked.`,
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
  console.error("Fatal error starting polymath MCP server:", err);
  process.exit(1);
});
