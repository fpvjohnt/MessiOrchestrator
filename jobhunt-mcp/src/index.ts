#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as refStore from "./reference-store.js";
import * as profileStore from "./profile-store.js";
import * as coach from "./coach.js";
import * as perspectives from "./perspectives.js";
import * as career from "./career.js";
import * as money from "./money.js";
import * as vetting from "./vetting.js";

const server = new McpServer({ name: "jobhunt", version: "0.1.0" });

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
// Profile.
// ---------------------------------------------------------------------------

server.registerTool(
  "set_candidate_profile",
  {
    title: "Set Your Profile",
    description: "Save your background once (experience, skills, education, certs, last job, target role, location, salary needed, work style) so the coaching personalizes. Only provided fields change.",
    inputSchema: {
      current_role: z.string().max(200).optional(),
      target_role: z.string().max(200).optional(),
      years_experience: z.number().finite().min(0).max(70).optional(),
      education: z.string().max(200).optional(),
      certifications: z.array(z.string().max(100)).max(30).optional(),
      skills: z.array(z.string().max(100)).max(50).optional(),
      last_job: z.string().max(300).optional(),
      achievements: z.array(z.string().max(300)).max(30).optional(),
      location: z.string().max(100).optional(),
      salary_needed: z.number().finite().min(0).max(10_000_000).optional(),
      work_style: z.array(z.string().max(50)).max(10).optional(),
    },
  },
  async (patch) => {
    try {
      const p = await profileStore.updateProfile(patch, now());
      return textResult(`Profile saved:\n${JSON.stringify(p, null, 2)}`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_profile",
  { title: "Get Your Profile", description: "Show your saved candidate profile.", inputSchema: {} },
  async () => {
    const p = await profileStore.getProfile();
    return textResult(Object.keys(p).length ? JSON.stringify(p, null, 2) : "No profile yet — use set_candidate_profile.");
  }
);

// ---------------------------------------------------------------------------
// Career discovery + pathways.
// ---------------------------------------------------------------------------

server.registerTool(
  "career_match",
  {
    title: "What Job Fits Me",
    description:
      "For 'I don't know what job is good for me': give how you like to work (hands_on, analytical, creative, " +
      "helping, leading, organizing) and get fitting California careers + first steps. Omit 'styles' for the list. " +
      "Grounded in the RIASEC/O*NET career-fit framework.",
    inputSchema: { styles: z.array(lookupKey).max(6).optional() },
  },
  async ({ styles }) => textResult(career.careerMatch(styles))
);

server.registerTool(
  "career_path",
  {
    title: "Path From A to B",
    description:
      "The ladder from where you are to where you want (e.g. from='tech support', to='cybersecurity'): the " +
      "transferable skills you already have, the cheapest bridge (usually a cert, not a degree), timeline, and " +
      "pay jump. Omit both for common CA ladders.",
    inputSchema: { from: z.string().max(120).optional(), to: z.string().max(120).optional() },
  },
  async ({ from, to }) => textResult(career.careerPath(from, to))
);

// ---------------------------------------------------------------------------
// The funnel, ATS, resume, interview + the diagnostic.
// ---------------------------------------------------------------------------

server.registerTool(
  "the_funnel",
  { title: "The Hiring Funnel", description: "The gates your resume passes through (ATS robot → recruiter → hiring manager → interview → offer → onboarding) and where people get stuck.", inputSchema: {} },
  async () => textResult(coach.theFunnel())
);

server.registerTool(
  "beat_the_ats",
  { title: "Beat the ATS Robot", description: "How resume-scanning software works and how to get past it (keywords, ATS-safe formatting, tailoring).", inputSchema: {} },
  async () => textResult(coach.beatTheAts())
);

server.registerTool(
  "resume_tips",
  { title: "Resume Tips", description: "How to write a resume that gets interviews: achievement bullets with numbers, tailoring, no-experience tactics.", inputSchema: {} },
  async () => textResult(coach.resumeTips())
);

server.registerTool(
  "interview_prep",
  { title: "Interview Prep", description: "How to prepare: STAR stories, proving fit, questions to ask, follow-up.", inputSchema: {} },
  async () => textResult(coach.interviewPrep())
);

server.registerTool(
  "find_hiring_manager",
  { title: "Find the Hiring Manager", description: "How to find the real hiring manager and references on LinkedIn, skip the portal, and use referrals. Leans on research for live lookups.", inputSchema: {} },
  async () => textResult(coach.findHiringManager())
);

server.registerTool(
  "diagnose",
  {
    title: "Why Am I Stuck?",
    description:
      "The diagnostic: tell it how far you get (no_responses, no_interviews, no_offers, low_pay, no_direction) " +
      "and it names the broken gate and the fixes. Omit 'symptom' for the list.",
    inputSchema: { symptom: lookupKey.optional() },
  },
  async ({ symptom }) => textResult(coach.diagnose(symptom))
);

// ---------------------------------------------------------------------------
// Vet the company/job before applying + skill-to-posting match.
// ---------------------------------------------------------------------------

server.registerTool(
  "vet_company",
  {
    title: "Vet a Company Before Applying",
    description:
      "Before you apply/accept: the checklist + authoritative sources to find out if a job is real (ghost-job " +
      "check vs the company's own careers page), what it's really like to work there (Glassdoor/Indeed/Blind), " +
      "if it's truly remote, and whether you can move up or get stuck — plus questions to ask them. Research " +
      "runs the searches.",
    inputSchema: {
      company: z.string().trim().min(1).max(120),
      role: z.string().max(120).optional(),
    },
  },
  async ({ company, role }) => {
    try {
      return textResult(vetting.vetCompany(company, role));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "match_job",
  {
    title: "Match Your Skills to a Posting",
    description:
      "How well you fit a specific job posting: pass the posting's required skills/keywords (and optionally " +
      "your skills; defaults to your saved profile). Returns a match %, what you have to mirror, the gaps, " +
      "and tailoring advice.",
    // The description says "the posting's required skills" and "your skills",
    // so callers wrote {posting_skills, candidate_skills} — twice, both hard
    // failures. The parameters are `required` and `have`. Accept the words the
    // description itself puts in the caller's head.
    inputSchema: {
      required: z.array(z.string().max(120)).min(1).max(50).optional().describe("The skills/keywords the posting asks for."),
      posting_skills: z.array(z.string().max(120)).min(1).max(50).optional(),
      have: z.array(z.string().max(120)).max(80).optional().describe("Your skills; defaults to your profile."),
      candidate_skills: z.array(z.string().max(120)).max(80).optional(),
    },
  },
  async ({ required, posting_skills, have, candidate_skills }) => {
    try {
      const wanted = required ?? posting_skills;
      if (!wanted || wanted.length === 0) {
        return { ...textResult(`BOTTOM LINE: no posting skills given — pass "required" as a list of the skills/keywords the job posting asks for.`), isError: true };
      }
      const skills = have ?? candidate_skills ?? (await profileStore.getProfile()).skills ?? [];
      return textResult(vetting.matchJob(wanted, skills));
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Insider lens + traps.
// ---------------------------------------------------------------------------

server.registerTool(
  "how_they_think",
  {
    title: "How They Think",
    description: "The insider read on who decides your fate — recruiter, hiring_manager, ats_robot, hr, references. Their motive, the clash, your move. Omit 'role' for the summary.",
    inputSchema: { role: lookupKey.optional() },
  },
  async ({ role }) => textResult(perspectives.howTheyThink(role))
);

server.registerTool(
  "red_flag",
  {
    title: "Job-Search Traps",
    description: "The trap playbook: generic resume, ATS-breaking format, applying online-only, lowballing yourself, no follow-up, job scams. Omit for the summary.",
    inputSchema: { issue: lookupKey.optional() },
  },
  async ({ issue }) => textResult(perspectives.redFlag(issue))
);

// ---------------------------------------------------------------------------
// Money.
// ---------------------------------------------------------------------------

server.registerTool(
  "negotiate_salary",
  { title: "Negotiate Your Salary", description: "How to negotiate pay without losing the offer — scripts, anchoring, the whole package, and why lowballing yourself is the costlier mistake.", inputSchema: {} },
  async () => textResult(money.negotiateSalary())
);

server.registerTool(
  "living_wage",
  { title: "California Living Wage", description: "What you actually need to earn to live in your California area — and why to target jobs that clear it. Ties to the homebuyer/nestegg tools. Research pulls the current figure.", inputSchema: { area: z.string().max(100).optional() } },
  async ({ area }) => textResult(money.livingWage(area))
);

server.registerTool(
  "job_market",
  { title: "Job Market (CA)", description: "Higher-paying vs lower-paying, in-demand California fields, and the authoritative sources (BLS/O*NET/CA EDD) for research to pull live pay + outlook.", inputSchema: {} },
  async () => textResult(money.jobMarket())
);

// ---------------------------------------------------------------------------
// Reference + verify loop.
// ---------------------------------------------------------------------------

server.registerTool(
  "get_reference",
  {
    title: "Get Reference Data",
    description: "Live-sensitive figures (CA living wage, pay by field) with source, as-of date, staleness, and the authoritative verify_url research fetches. Omit 'key' for all.",
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
    description: "Job hunting and stuck or lost? The first moves, in plain words.",
    inputSchema: {},
  },
  async () =>
    textResult(
      [
        `BOTTOM LINE: figure out (1) what job fits you, (2) why you're getting stuck, and (3) whether it pays a California living wage. Most job-search pain is ONE fixable gate.`,
        ``,
        `Your first moves:`,
        `  1. Don't know what to aim for? → 'career_match' (how you like to work) and 'career_path' (the ladder up).`,
        `  2. Applying but stuck? → 'diagnose' with how far you get (no_responses / no_interviews / no_offers / low_pay).`,
        `  3. Check the money → 'living_wage' for your area and 'job_market' for what pays. Save your details with 'set_candidate_profile' so it all personalizes.`,
        ``,
        `Honest note: this is coaching with real (research-verified) data — it makes you far more effective and tells you the real reason you're stuck. It can't hand you a job, and it won't promise one.`,
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
  console.error("Fatal error starting jobhunt MCP server:", err);
  process.exit(1);
});
