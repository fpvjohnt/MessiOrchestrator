// The operational framework of Loop Engineering: the SIX BUILDING BLOCKS you
// have to have in place to turn "manual prompting" into a real autonomous loop
// — Connectors, Automations, Skills, Subagents, Memory, Worktrees — plus the
// special MODEL REQUIREMENTS that make a loop practical instead of an expensive
// experiment. This is the "how do I actually stand one up" layer that sits over
// the loop PATTERNS (patterns.ts = the shape; blocks.ts = the infrastructure).
// Same reverse-index shape so "ask by any name" works and regression auto-covers.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export interface Block {
  label: string;
  keys: string[];
  what: string;
  why: string;
  how: string[];        // concrete implementation, mapped to Claude Code / MCP reality
  ready_when: string;   // the readiness check for this block
}

export const BUILDING_BLOCKS: Record<string, Block> = {
  connectors: {
    label: "Connectors (your MCP collection)",
    keys: ["connector", "connectors", "mcp", "plugin", "plugins", "integration", "integrations", "api", "apis", "database", "github"],
    what: "The wiring that lets the loop TOUCH real tools — GitHub, databases, staging APIs, your files — instead of just reasoning over static text.",
    why: "A loop that can only see static files can suggest a fix but never make one. Connectors are what move the agent from 'here's what you should do' to actually doing it AND verifying the result. This is the block that makes the loop real.",
    how: [
      "An MCP server (or a collection of them) exposing each tool the loop needs, with tight schemas and validated arguments.",
      "Read AND write access where the loop must act (open a PR, run a query, hit a staging endpoint) — not just read.",
      "A way to verify the outcome through the same connector (re-read the file, re-run the test, check the API response).",
    ],
    ready_when: "The agent can execute a change and confirm it worked, entirely through tools — no human copy-pasting.",
  },
  automations: {
    label: "Automations (the heartbeat)",
    keys: ["automation", "automations", "trigger", "triggers", "cron", "schedule", "scheduled", "heartbeat", "hook", "hooks", "webhook", "event", "onchange"],
    what: "Whatever STARTS the loop without a human typing a prompt — a trigger on an event, a file change, or a schedule.",
    why: "Manual prompting isn't a loop; it's a conversation. The heartbeat is what makes it autonomous: the loop wakes itself up when there's work.",
    how: [
      "Event triggers: a new ticket/issue appears, a PR opens, a file changes (hooks/webhooks).",
      "Schedules: run on a cron / daily cadence (a scheduled agent or a /loop interval).",
      "A clear STOP/enter condition so the heartbeat doesn't fire on nothing or fire forever.",
    ],
    ready_when: "The loop runs on its own when its trigger fires, with no one kicking it off by hand.",
  },
  skills: {
    label: "Skills (project knowledge, not re-prompting)",
    keys: ["skill", "skills", "knowledgefile", "projectknowledge", "buildsteps", "ruleset", "constraint", "constraints", "playbook", "claudemd", "instruction", "instructions"],
    what: "Reusable files that carry project-specific knowledge — architectural rules, build/test steps, and the hard constraints (things the agent must NEVER do) — so you don't paste the same context into every prompt.",
    why: "Re-explaining your project every run is expensive and drifts. Skills make the loop's knowledge durable and consistent, and they're where you encode the guardrails.",
    how: [
      "A project-instructions file (CLAUDE.md-style) with architecture, conventions, and build/verify commands.",
      "Named skill files for repeatable procedures (how you deploy, how you review, how you test).",
      "An explicit 'never do this' section — the constraints that stay true across every run.",
    ],
    ready_when: "A fresh run behaves correctly from the skill files alone, without you re-supplying context.",
  },
  subagents: {
    label: "Subagents (maker ≠ checker)",
    keys: ["subagent", "subagents", "maker", "checker", "reviewer", "critic", "explorer", "exploration", "delegation", "roles", "reviewagent"],
    what: "Separate agents for separate jobs — exploration, implementation, testing, fact-checking — so the agent that DID the work is not the one that judges it.",
    why: "A maker grading its own work rubber-stamps it (the reflexion trap: self-review without independence). An independent checker is how quality actually holds up. Different roles also keep each agent's context focused.",
    how: [
      "A 'maker' subagent that implements, and a separate 'checker' subagent that reviews/tests/fact-checks its output.",
      "Distinct roles: explore → implement → test → verify, each a focused subagent.",
      "Give the checker the acceptance criteria, not the maker's reasoning, so it judges the result independently.",
    ],
    ready_when: "Nothing the maker produces ships without an independent subagent signing off.",
  },
  memory: {
    label: "Memory (continuity across runs)",
    keys: ["memory", "persistence", "persistent", "journal", "log", "logs", "history", "recall", "longterm", "statestore"],
    what: "A persistent place the loop writes what it's tried, what failed, and what's left — so run #2 knows what run #1 already did.",
    why: "Without memory, every run starts from zero and repeats the same dead ends. Memory is what lets a loop make PROGRESS over time instead of spinning.",
    how: [
      "A durable store outside the context window: project logs, GitHub issues, a database, or a memory/ directory.",
      "Record attempts + outcomes ('tried X, failed because Y'), not just the final answer.",
      "A 'what's still open' list the next run reads first, so it picks up where the last left off.",
    ],
    ready_when: "A second run reads the first run's memory and doesn't repeat its mistakes.",
  },
  worktrees: {
    label: "Worktrees (clean workspace per agent)",
    keys: ["worktree", "worktrees", "workspace", "workspaces", "isolation", "sandbox", "branch", "parallelism", "clone", "checkout"],
    what: "A separate, clean workspace for each agent working at the same time — so parallel agents don't collide or overwrite each other's changes.",
    why: "The moment more than one agent edits the repo at once, a shared workspace means corruption and lost work. Worktrees give each its own copy to work in safely.",
    how: [
      "A git worktree (or equivalent isolated checkout) per concurrent agent.",
      "Merge/integrate deliberately at the end; discard the worktree if the agent's change is abandoned.",
      "Only pay this cost when agents actually run in PARALLEL and mutate files — a single sequential loop doesn't need it.",
    ],
    ready_when: "Multiple agents can run at once without stepping on each other's files.",
  },
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "").replace(/[^a-z0-9]/g, "");
}

const BLOCK_INDEX: Record<string, string> = {};
for (const [key, b] of Object.entries(BUILDING_BLOCKS)) {
  BLOCK_INDEX[normalize(key)] = key;
  BLOCK_INDEX[normalize(b.label)] = key;
  for (const k of b.keys) BLOCK_INDEX[normalize(k)] = key;
}

export function resolveBlock(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(BLOCK_INDEX, norm)) return BLOCK_INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(BLOCK_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

export function buildingBlocks(block?: string): string {
  if (!block) {
    return [
      `THE SIX BUILDING BLOCKS OF AN AUTONOMOUS LOOP — the shift from manual prompting to a self-running feedback cycle. Use this as a READINESS CHECKLIST: which do you already have?`,
      `BOTTOM LINE: an MCP collection gives you exactly one of the six blocks. A loop is autonomous only when the other five are in place too — until then you are the heartbeat, the memory, and the reviewer.`,
      ``,
      ...Object.values(BUILDING_BLOCKS).map((b) => `▸ ${b.label}: ${b.what}`),
      ``,
      `Block #1 (Connectors) is the one an MCP collection GIVES you — if you've built MCP servers, that block is done. A loop becomes truly autonomous only when the other five are in place too: a heartbeat to start it (Automations), durable project knowledge (Skills), an independent reviewer (Subagents), continuity across runs (Memory), and safe parallel workspaces (Worktrees).`,
      ``,
      `Name one block for how to build it and when it's 'ready', or use design_loop for a specific task. The model side of the equation → model_requirements.`,
    ].join("\n");
  }
  const key = resolveBlock(block);
  if (!key) return `Not sure which block "${clean(block)}" is. The six: ${Object.values(BUILDING_BLOCKS).map((b) => b.label).join(", ")}.`;
  const b = BUILDING_BLOCKS[key];
  return [
    `${b.label}${normalize(block) !== normalize(key) ? ` (from "${clean(block)}")` : ""}`,
    `BOTTOM LINE: ${b.what}`,
    ``,
    `Why the loop needs it: ${b.why}`,
    ``,
    `How to put it in place:`,
    ...b.how.map((h) => `  • ${h}`),
    ``,
    `Ready when: ${b.ready_when}`,
  ].join("\n");
}

export function modelRequirements(): string {
  return [
    `MODEL REQUIREMENTS FOR A PRACTICAL LOOP — what the model itself must do well, or the loop is an expensive experiment instead of a working system.`,
    `BOTTOM LINE: loops multiply everything. Every retry, self-correction, and verification step is another set of tokens and another tool call — so the model's cost, reliability, and concurrency matter far more in a loop than in a one-shot prompt.`,
    ``,
    `▸ CHEAP TOKENS + LARGE CONTEXT WINDOW — loops burn tokens fast (every retry and verify step adds to the bill), and a long-running loop's transcript + tool results need room. Expensive tokens or a small window make an otherwise-good loop impractical. (Pair this with the memory_state pattern and compaction.)`,
    `▸ ROBUST TOOL-CALLING + STRUCTURED (JSON) OUTPUT — the loop lives or dies on the model reliably calling YOUR connectors with valid arguments and returning parseable structured data. Flaky tool-calling turns into the 'invents tool calls' and 'thrashing' failures (see debug_loop). This is the #1 model capability for a loop.`,
    `▸ HIGH CONCURRENCY — to run multiple subagents (maker/checker) or parallel tasks at once, the model/provider has to handle concurrent calls. Without it, the maker≠checker and parallel-worktree blocks fall back to slow sequential work.`,
    ``,
    `The honest read: a smarter model with weak tool-calling is a WORSE loop engine than a slightly-less-smart model that calls tools reliably and cheaply. In a loop, reliability and cost beat raw intelligence — verify current model tool-use benchmarks and pricing with check_practice before committing.`,
  ].join("\n");
}
