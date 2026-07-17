// The patterns of agentic loop engineering — the shapes an AI agent's control
// loop can take. Each: what it is, when to reach for it, its anatomy (the parts
// you actually build), how it fails, and the first move. Plain words,
// bottom-line first. Same reverse-index shape as communication's areas.ts so
// "ask by any name" works and the regression harness auto-covers it.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export interface Pattern {
  label: string;
  keys: string[];
  what: string;
  when: string;
  anatomy: string[];
  failure_modes: string[];
  build_it: string[];
}

export const PATTERNS: Record<string, Pattern> = {
  basic_agent_loop: {
    label: "The Basic Agent Loop",
    keys: ["agentloop", "coreloop", "whileloop", "observeact", "thinkact", "agenticloop", "loop", "agentic", "controlloop", "perceiveact"],
    what: "The heart of every agent: a while-loop of observe → decide → act → observe the result → repeat, until a stop condition is met.",
    when: "The default. Start here for any single-agent task before reaching for anything fancier. Most 'agent' work is just this loop done carefully.",
    anatomy: [
      "STATE — what the agent knows so far (the running transcript / scratchpad).",
      "A MODEL CALL that, given the state, chooses the next action (usually a tool call or a final answer).",
      "AN ACTUATOR that runs the chosen tool and captures its result.",
      "A STOP CONDITION — final answer produced, max steps hit, or a budget/timeout exceeded. THIS is the part people forget.",
      "The loop body: append the action + result to state, call the model again.",
    ],
    failure_modes: [
      "No stop condition → it runs forever or until it burns the budget. Always cap steps AND wall-clock/tokens.",
      "State grows unbounded → you blow the context window around step 15 (see the memory_state pattern).",
      "Silent tool errors fed back as if they succeeded → the agent hallucinates on top of a failure.",
    ],
    build_it: [
      "Write the stop condition FIRST, before the loop. Max steps + budget are non-negotiable.",
      "Log every (thought, action, result) tuple — you cannot debug a loop you can't replay.",
      "Feed tool ERRORS back into the loop as observations; don't swallow them.",
    ],
  },
  react: {
    label: "ReAct (Reason + Act)",
    keys: ["react", "reasonact", "reasoning", "thoughtaction", "scratchpad", "chainofthought", "thinkaloud", "reasonandact"],
    what: "The agent interleaves a written 'thought' with each action: reason about what to do, take one action, read the result, reason again. The thinking is on the page, not hidden.",
    when: "When the task needs multi-step reasoning with tools and you want the model's plan to be inspectable and self-correcting mid-run. The workhorse pattern for tool-using agents.",
    anatomy: [
      "A prompt format that asks for Thought → Action → Observation, one cycle at a time.",
      "A parser that pulls the Action (tool + args) out of the model's output.",
      "The observation (tool result) appended back so the next Thought sees it.",
      "A final-answer sentinel the model emits when it's done reasoning.",
    ],
    failure_modes: [
      "The model 'reasons' its way in circles, re-deciding the same thing — cap steps and detect repeats.",
      "Brittle output parsing — free-text Thought/Action breaks; prefer structured/tool-call APIs when available.",
      "Reasoning that rationalizes a wrong action instead of checking it — thought ≠ verification.",
    ],
    build_it: [
      "Use the provider's native tool-calling (structured) instead of parsing free text where you can — far fewer parse failures.",
      "Keep the tool set SMALL and well-described; ReAct degrades fast with 20+ vague tools.",
      "Add a repeat-detector: same action + args twice in a row is a stuck signal.",
    ],
  },
  plan_execute: {
    label: "Plan-and-Execute",
    keys: ["planexecute", "planner", "planning", "plandothen", "taskdecomposition", "decompose", "plannerexecutor", "planfirst"],
    what: "Split the work: a PLANNER breaks the goal into a list of steps up front, then an EXECUTOR carries them out one by one (re-planning if reality diverges).",
    when: "Longer, multi-step tasks where a plan up front beats deciding step-by-step — and where you want to show/approve the plan before spending money running it.",
    anatomy: [
      "A planner call that outputs an ordered list of concrete sub-tasks.",
      "An executor loop that runs each sub-task (often a basic_agent_loop per step).",
      "A re-plan trigger — when a step fails or the world changed, go back to the planner with what you learned.",
      "A place to surface the plan to a human before execution (optional but powerful).",
    ],
    failure_modes: [
      "A rigid plan that ignores what execution discovers — without a re-plan path it marches off a cliff confidently.",
      "Over-decomposition: 30 trivial steps cost more and drift more than 4 real ones.",
      "Planner and executor disagree on what a step means — keep sub-tasks concrete and self-contained.",
    ],
    build_it: [
      "Make each sub-task standalone: it should carry enough context to run without the planner's head.",
      "Always allow re-planning; a plan is a hypothesis, not a script.",
      "Cap the number of steps the planner may emit — it curbs runaway decomposition.",
    ],
  },
  reflexion: {
    label: "Reflexion / Self-Correction",
    keys: ["reflexion", "reflection", "selfcritique", "selfcorrect", "selfcorrection", "critique", "retry", "selfheal", "selfrefine", "critic"],
    what: "After acting, the agent critiques its OWN output against the goal, then retries with the critique in hand. A feedback loop the agent runs on itself.",
    when: "When output quality matters and a first draft is often wrong-but-fixable (code that must pass tests, an answer that must satisfy a rubric). Add it AFTER a plain loop works — not before.",
    anatomy: [
      "A generate step (the attempt).",
      "An evaluate step — ideally a GROUND-TRUTH check (tests pass? schema valid? tool succeeded?), not just the model grading itself.",
      "A reflection that turns the failure into concrete guidance for the next try.",
      "A retry budget — reflection helps for 1-2 rounds, then plateaus or degrades.",
    ],
    failure_modes: [
      "Self-grading with no external signal → the model confidently declares its wrong answer correct. Reflection needs a real check to push against.",
      "Infinite 'improve' loops that never converge — cap retries and require the check to actually pass.",
      "Reflection that rewrites the working parts and breaks them — diff, don't regenerate wholesale.",
    ],
    build_it: [
      "Anchor the evaluate step to something OBJECTIVE wherever possible (unit tests, a validator, a tool exit code).",
      "Cap retries at 2-3; measure whether each round actually helps before adding more.",
      "Feed the SPECIFIC failure back ('test X failed with Y'), not a vague 'try harder'.",
    ],
  },
  tool_use: {
    label: "The Tool-Use Loop",
    keys: ["tooluse", "toolcall", "toolcalling", "functioncall", "functioncalling", "tools", "toolschema", "apicall", "functiontools"],
    what: "The mechanics of letting a model call real functions: describe the tools, let the model pick one with arguments, run it, feed the result back, repeat.",
    when: "Any time the agent must touch the outside world — search, fetch, query a DB, hit an API. This is the plumbing under ReAct and most agent loops.",
    anatomy: [
      "TOOL SCHEMAS — name, description, typed args. The description is a prompt; write it for the model.",
      "The model's tool-call output (structured), validated against the schema.",
      "Execution with real error handling, timeouts, and size caps on results.",
      "The result (or the error) returned to the model as the next observation.",
    ],
    failure_modes: [
      "Vague tool descriptions → the model picks the wrong tool or bad args. Descriptions are the #1 lever.",
      "Unvalidated args → you pass model-hallucinated garbage into a real system (SSRF, injection, oversized input).",
      "Dumping a 200KB tool result back into context → instant window blowout. Cap and summarize results.",
      "Too many tools → selection accuracy falls off a cliff past ~10-15 vaguely-scoped tools.",
    ],
    build_it: [
      "Treat every tool description as prompt engineering — iterate on it like copy.",
      "VALIDATE and sanitize every argument before executing (this system's SSRF guard + size caps are exactly this).",
      "Cap result size and return errors as structured observations the model can react to.",
    ],
  },
  rag_loop: {
    label: "RAG / Retrieval Loop",
    keys: ["rag", "retrieval", "retrievalaugmented", "grounding", "vectorsearch", "knowledgebase", "semanticsearch", "retrieve", "groundtruth"],
    what: "Ground the model in real documents: retrieve relevant context, put it in the prompt, generate an answer anchored to it — and optionally re-retrieve if the first pull was thin.",
    when: "When answers must come from YOUR data / current facts the model doesn't reliably know, and you need citations and lower hallucination.",
    anatomy: [
      "An index (vector store, keyword search, or both — hybrid usually wins).",
      "A retrieve step: turn the question into a query, pull top-k chunks.",
      "A grounding prompt that says 'answer ONLY from this context; if it's not here, say so'.",
      "Optional agentic re-retrieval: if the context is insufficient, reformulate and search again.",
    ],
    failure_modes: [
      "Retrieval quality IS the ceiling — garbage chunks in, hallucinated answer out. Most 'RAG doesn't work' is a retrieval problem, not a model problem.",
      "Chunking that splits the answer across two chunks so neither is retrieved.",
      "The model ignoring the context and answering from its own memory anyway — pin it hard and check for citations.",
    ],
    build_it: [
      "Measure retrieval SEPARATELY (is the right chunk in the top-k?) before blaming the generator.",
      "Try hybrid (keyword + vector) and re-ranking before anything exotic.",
      "Force citations and verify the answer is actually supported (this system's research verify-loop is exactly this discipline).",
    ],
  },
  multi_agent: {
    label: "Multi-Agent Orchestration",
    keys: ["multiagent", "orchestration", "orchestrator", "handoff", "subagent", "subagents", "crew", "swarm", "delegation", "supervisor", "router", "routing"],
    what: "One coordinator routes a task to specialist agents and correlates their results — the specialists don't call each other. (This very system is a multi-agent orchestrator.)",
    when: "When the work genuinely spans distinct specialties, OR when parallel fan-out saves real wall-clock. NOT as a default — a single well-built loop beats a committee for most tasks.",
    anatomy: [
      "A ROUTER that decides which specialist(s) a request goes to (keyword, embedding, or model-chosen).",
      "Specialist agents with clear, non-overlapping scopes and their own tools.",
      "A coordinator that collects results and SYNTHESIZES (correlates), rather than just concatenating them.",
      "A shared record of what happened (a 'case') for observability and debugging.",
    ],
    failure_modes: [
      "More agents = more failure surface, latency, and cost. Committees drift and contradict; most tasks don't need one.",
      "Overlapping scopes → two agents fight over the same request (routing noise). Keep scopes crisp.",
      "Concatenating instead of correlating — five answers stapled together isn't synthesis.",
      "No observability → when it misbehaves you can't tell WHICH agent or the router was wrong.",
    ],
    build_it: [
      "Justify every added agent. Default to one loop; split only when scopes are truly distinct or you need parallelism.",
      "Measure routing accuracy with a labeled golden set, and make routing FAIL SAFE (fall back to a generalist) — the discipline this whole system runs on.",
      "Give the coordinator a real synthesis step and a replayable log of each agent's call.",
    ],
  },
  evaluator_optimizer: {
    label: "Evaluator-Optimizer (Generator + Judge)",
    keys: ["evaluatoroptimizer", "generatorcritic", "llmjudge", "judge", "scorer", "optimizer", "generatejudge", "llmasjudge", "besteofn"],
    what: "A generator proposes; a separate evaluator scores or critiques; the best is kept or the loop refines. Includes best-of-N sampling and tournament selection.",
    when: "When there's a measurable notion of 'better' and you can afford extra calls to get quality up — drafting, code, structured extraction, ranking options.",
    anatomy: [
      "A generator (often sampled N times for diversity).",
      "An evaluator with an explicit rubric — ideally grounded in an objective check, else a well-prompted LLM judge.",
      "A selection/refine step: pick the winner, or feed the critique back to regenerate.",
    ],
    failure_modes: [
      "LLM-as-judge is biased: it favors longer answers, its own style, and the first option shown. Position and verbosity bias are real.",
      "Judge and generator being the same model rubber-stamping each other.",
      "Optimizing to the rubric's letter, not the goal (reward hacking).",
    ],
    build_it: [
      "Prefer an objective evaluator (tests, validators, metrics) over an LLM judge whenever one exists.",
      "If using an LLM judge: randomize option order, control for length, and spot-check it against human labels.",
      "Use a diverse generator (vary temperature/prompt) so the judge has real choices, not near-duplicates.",
    ],
  },
  human_in_the_loop: {
    label: "Human-in-the-Loop & Guardrails",
    keys: ["humanintheloop", "hitl", "approval", "checkpoint", "interrupt", "escalation", "oversight", "guardrail", "guardrails", "safety", "confirm"],
    what: "The agent pauses for human approval at high-stakes steps, and hard guardrails constrain what it can do at all — so a wrong decision is caught before it acts, not after.",
    when: "Any action that's costly, irreversible, or outward-facing (sending, paying, deleting, publishing). The higher the stakes, the more the human belongs IN the loop.",
    anatomy: [
      "CLASSIFY actions by reversibility/stakes; only gate the ones that need it (don't gate reading a file).",
      "An interrupt/approval point that surfaces WHAT the agent wants to do and WHY, and waits.",
      "Hard guardrails: allow-lists, spend caps, scope limits, validators — enforced in code, not just asked-for in the prompt.",
      "An escalation path when the agent is uncertain or stuck.",
    ],
    failure_modes: [
      "Guardrails living only in the prompt — a prompt is a suggestion; a real limit is enforced in code.",
      "Approving everything (alert fatigue) or nothing (rubber-stamp) — gate the RIGHT things or humans stop reading.",
      "No 'the agent isn't sure' path, so it guesses on high-stakes calls instead of asking.",
    ],
    build_it: [
      "Enforce limits in code (allow-lists, caps, SSRF/size guards), and use the prompt for judgment on top.",
      "Gate by stakes: irreversible/outward-facing actions pause; reversible ones flow.",
      "Make the approval request legible — a human should decide in seconds.",
    ],
  },
  memory_state: {
    label: "Memory & State Management",
    keys: ["memory", "state", "context", "contextwindow", "statemanagement", "longtermmemory", "summarization", "conversationhistory", "shorttermmemory", "compaction"],
    what: "How the loop remembers: what's kept in the prompt (short-term), what's stored and retrieved later (long-term), and how you stop the context window from overflowing.",
    when: "Any loop that runs more than a few steps or spans sessions. The thing that silently kills long-running agents.",
    anatomy: [
      "Short-term: the working transcript in the context window (finite — this is the constraint).",
      "Long-term: an external store (files, DB, vector index) written to and retrieved from across turns/sessions.",
      "A compaction strategy: summarize or drop old turns before you hit the window limit.",
      "A rule for WHAT is worth remembering vs. what's noise (durable facts, not every observation).",
    ],
    failure_modes: [
      "Unbounded transcript → the loop dies mid-task when the window fills around some step you didn't anticipate.",
      "Summarizing away the one detail the next step needed.",
      "Storing everything → retrieval gets noisy and long-term memory becomes a junk drawer.",
    ],
    build_it: [
      "Budget the context window explicitly and compact BEFORE you hit the wall, not after it errors.",
      "Separate durable facts (worth persisting) from transient observations (safe to drop).",
      "When you summarize, keep IDs, numbers, and open threads verbatim — that's what later steps need.",
    ],
  },
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "").replace(/[^a-z0-9]/g, "");
}

const PATTERN_INDEX: Record<string, string> = {};
for (const [key, p] of Object.entries(PATTERNS)) {
  PATTERN_INDEX[normalize(key)] = key;
  PATTERN_INDEX[normalize(p.label)] = key;
  for (const k of p.keys) PATTERN_INDEX[normalize(k)] = key;
}

export function resolvePattern(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(PATTERN_INDEX, norm)) return PATTERN_INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(PATTERN_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

export function explainPattern(pattern?: string): string {
  if (!pattern) {
    return (
      `THE PATTERNS OF AGENTIC LOOP ENGINEERING — pick one, or describe your task and use design_loop:\n\n` +
      Object.values(PATTERNS).map((p) => `▸ ${p.label}: ${p.what}`).join("\n") +
      `\n\nTo pick an architecture for a specific task → design_loop. To fix a misbehaving loop → debug_loop. ` +
      `To measure whether it works → eval_loop. The folklore that'll burn you → myth_vs_reality.`
    );
  }
  const key = resolvePattern(pattern);
  if (!key) return `Not sure which pattern "${clean(pattern)}" is. Patterns: ${Object.values(PATTERNS).map((p) => p.label).join(", ")}.`;
  const p = PATTERNS[key];
  return [
    `${p.label}${normalize(pattern) !== normalize(key) ? ` (from "${clean(pattern)}")` : ""}`,
    `BOTTOM LINE: ${p.what}`,
    ``,
    `When to reach for it: ${p.when}`,
    ``,
    `Anatomy — the parts you actually build:`,
    ...p.anatomy.map((a) => `  • ${a}`),
    ``,
    `How it fails:`,
    ...p.failure_modes.map((f) => `  • ${f}`),
    ``,
    `Build it right:`,
    ...p.build_it.map((b) => `  • ${b}`),
    ``,
    `Fast-moving specifics (framework APIs, the newest technique) change monthly — verify current best practice with check_practice → practice_verdict.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is Loop Engineering — how to design, build, debug, and honestly evaluate agentic AI loops (the observe→think→act→reflect cycle and its patterns). The craft under every real agent, including the orchestrator you're talking to.`,
    ``,
    `  • The patterns (ReAct, plan-execute, reflexion, tool-use, RAG, multi-agent, evaluator-optimizer, human-in-the-loop, memory) → 'explain_pattern <name>' (or no name for the map).`,
    `  • "Here's what I want the agent to do" → 'design_loop <task>' — it picks the architecture, the parts, the first step, and the risks.`,
    `  • What it takes to make a loop AUTONOMOUS (the 6 building blocks: Connectors/MCP, Automations, Skills, Subagents, Memory, Worktrees) → 'building_blocks'.`,
    `  • What the MODEL itself must do well (cheap tokens, reliable tool-calling, concurrency) → 'model_requirements'.`,
    `  • A loop that runs forever / thrashes / drifts / blows up context → 'debug_loop <symptom>'.`,
    `  • "How do I know it actually works?" → 'eval_loop' (consistency ≠ correctness).`,
    `  • The folklore that burns people ("more agents = better") → 'myth_vs_reality'.`,
    `  • Current framework/technique specifics → 'check_practice' → 'practice_verdict' (verified via research, never from stale memory).`,
    ``,
    `The through-line: the hard part of an agent isn't the model — it's the loop around it. Two layers: the PATTERN (its shape — explain_pattern) and the INFRASTRUCTURE (what makes it autonomous — building_blocks). Stop conditions, evals, and guardrails are the engineering.`,
  ].join("\n");
}
