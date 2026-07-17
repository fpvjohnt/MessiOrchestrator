// The working tools of the OpenAI Platform Engineer: name the right primitive
// for a task (pick_primitive), diagnose an OpenAI-specific failure
// (debug_openai), audit whether a migration is actually worth it
// (migration_check), and the honesty backbone that debunks the platform
// folklore (myth_vs_reality). Deterministic, offline, BOTTOM-LINE first so the
// orchestrator's synthesis can extract the headline.

import { PRIMITIVES } from "./primitives.js";

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

// ── pick_primitive: task description → which layer to build on ───────────────
// A deterministic hint layer: scan the task for signals and name the primitive
// that fits, always anchored to the "own the loop vs. let the SDK run it" rule.
// It recommends, it doesn't decide — and it says out loud when the honest answer
// is "not on OpenAI" or "you don't need an LLM for this".
interface Signal {
  primitive: keyof typeof PRIMITIVES;
  cues: string[];
  because: string;
}

const SIGNALS: Signal[] = [
  { primitive: "codex", cues: ["codex", "agents.md", "agentsmd", "refactor", "migrate our code", "across the codebase", "legacy code", "modernize", "code review", "pull request", "pr review", "failing test", "fix the bug", "rename", "coding agent", "write the code", "in my repo", "our repo", "codebase"], because: "the work lives IN a repository — that's Codex's job (a tool you USE), not something to rebuild on the API (a thing you BUILD ON)" },
  { primitive: "agents_sdk", cues: ["multiple agent", "multi-agent", "multi agent", "specialist", "specialists", "handoff", "handoffs", "delegate", "route between", "approval", "approve", "human review", "sign off", "escalate", "guardrail", "guardrails", "voice agent", "run the loop for me", "sandbox"], because: "the workflow needs recurring orchestration, specialist handoffs, or built-in approvals — let the SDK's runner own the loop instead of rebuilding sessions, tracing and guardrails by hand" },
  { primitive: "realtime_voice", cues: ["voice", "speech", "talk", "spoken", "phone", "call center", "real-time audio", "realtime audio", "conversation out loud", "interrupt", "low latency audio"], because: "latency is the product — but prove the logic in text first; voice is a transport, not a fix" },
  { primitive: "embeddings_retrieval", cues: ["my document", "my documents", "our docs", "knowledge base", "knowledgebase", "corpus", "pdf", "pdfs", "wiki", "confluence", "cite", "citation", "citations", "search my", "answer from", "grounded", "rag"], because: "the answer must come from your corpus with citations — try hosted file search before building a vector pipeline" },
  { primitive: "finetune_or_not", cues: ["fine-tune", "finetune", "fine tune", "train a model", "train it on", "custom model", "distill", "teach the model", "our tone", "our style", "consistent format"], because: "you're reaching for training — check first whether prompting, few-shot, or retrieval already gets you there (they usually do)" },
  { primitive: "batch_and_cost", cues: ["cost", "cheaper", "expensive", "budget", "price", "pricing", "at scale", "millions of", "thousands of", "nightly", "overnight", "batch", "rate limit", "throughput", "too slow", "latency"], because: "the constraint is economics or throughput — model cost per call before building, and move deadline-free work to batch" },
  { primitive: "platform_tools", cues: ["web search", "browse", "look up online", "run code", "code interpreter", "computer use", "mcp", "connector", "connectors", "existing tools", "call our api", "internal system"], because: "you need tools — try the hosted ones (and remote MCP for what you already run) before writing custom functions" },
  { primitive: "chat_completions", cues: ["already have", "existing code", "we built", "currently using chat completions", "legacy", "should i migrate", "our current"], because: "you have working code — 'not deprecated' means there's no clock on you; migrate for a feature you want, not for fashion" },
];

// Signals that the honest answer isn't an OpenAI primitive at all.
const OFF_PLATFORM: Array<{ cues: string[]; verdict: string }> = [
  { cues: ["on-prem", "on prem", "onprem", "air gap", "air-gapped", "airgapped", "cannot leave", "can't leave", "data residency", "hipaa", "phi", "pii cannot", "no cloud", "self-host", "self host", "local model", "offline model"], verdict: "Data can't leave your environment → the honest answer may be NOT OpenAI. Check the compliance boundary before the architecture; a self-hosted model or an approved enterprise deployment is the conversation, not which API to call. If the data CAN go out under an enterprise agreement, come back and we'll pick the primitive." },
  { cues: ["route between", "multiple provider", "multi-provider", "multi provider", "fall back to claude", "claude and gpt", "gemini and", "vendor agnostic", "vendor-agnostic", "avoid lock-in", "avoid lock in", "switch providers"], verdict: "You want multi-provider routing → the Agents SDK's runner is the wrong seam (it's a single-vendor loop). Keep the loop in YOUR code (Responses API or a gateway layer) so the model is swappable. This is exactly where single-vendor convenience costs you." },
  { cues: ["deterministic", "exact same answer", "must be exact", "audit trail of the math", "sum the", "calculate the total", "lookup table", "simple lookup", "regex", "if statement"], verdict: "This may not need an LLM at all. If the task is deterministic (arithmetic, lookups, rule application), write the code — it's cheaper, faster, testable, and it can't hallucinate. Use the model for the fuzzy part only, if any. The best AI engineering decision is often not to use AI." },
];

export function pickPrimitive(rawTask: string): string {
  const task = clean(rawTask);
  const hay = task.toLowerCase();

  const offPlatform = OFF_PLATFORM.filter((o) => o.cues.some((c) => hay.includes(c)));
  const matched = SIGNALS.filter((s) => s.cues.some((c) => hay.includes(c)));

  const lines: string[] = [
    `PICK THE PRIMITIVE — "${task}"`,
  ];

  if (offPlatform.length) {
    lines.push(
      `BOTTOM LINE: before picking a layer — read this. The honest answer here might not be the one you came for.`,
      ``,
      `STOP AND CHECK FIRST:`,
      ...offPlatform.map((o) => `  ⚠ ${o.verdict}`),
      ``,
    );
  } else if (matched.some((s) => s.primitive === "codex")) {
    // Codex is a tool you USE, not a layer you build on — the "start with one
    // plain Responses call" advice is actively wrong here, so don't give it.
    lines.push(
      `BOTTOM LINE: this reads like work that lives IN a repo — so the answer is probably Codex (a tool you USE), not the API (a thing you BUILD ON). Don't rebuild a coding agent on the Responses API; that's weeks of work to lose to a CLI that already exists. Write AGENTS.md before you write clever prompts.`,
      ``,
    );
  } else {
    lines.push(
      `BOTTOM LINE: start with the Responses API and ONE plain call, no tools. It's the recommended primitive for anything new, and the simplest thing that could work is almost always where you should begin. Add a layer only when a real failure forces it.`,
      ``,
    );
  }

  if (matched.length === 0) {
    lines.push(
      `No strong signal for a specific layer in that description — which usually means the answer is the default:`,
      `  ▸ ${PRIMITIVES.responses_api.label} — one call, string input, no tools, no state. Prove it end-to-end on one real example.`,
      ``,
      `Tell me more and I'll get specific: Does it need YOUR documents? Take irreversible actions? Need several specialists? Run at volume? Must it sound a certain way? Is there a latency or cost budget?`,
    );
  } else {
    lines.push(`Signals in your task point at:`);
    for (const s of matched) {
      lines.push(`  ▸ ${PRIMITIVES[s.primitive].label} — because ${s.because}. ('explain_primitive ${String(s.primitive)}')`);
    }
    lines.push(
      ``,
      `THE LOOP QUESTION (answer this before writing code):`,
      `  • Do you want to own the loop — custom routing, branching, your own orchestration in your code? → Responses API.`,
      `  • Do you want the SDK to run the loop — sessions, tracing, guardrails, handoffs, resumable approvals out of the box? → Agents SDK.`,
      `That's OpenAI's own framing, and it decides more of your architecture than the model choice does.`,
      ``,
      `ORDER OF OPERATIONS:`,
      `  1. Write down the EXACT input, the EXACT output, and how you'd know an answer is WRONG. Vague goals produce vague agents.`,
      `  2. One end-to-end call, dumbest possible prompt, no machinery. Make it work before making it good.`,
      `  3. Add the matched layer(s) ONE at a time, only where step 2 demonstrably failed — and say what the failure was.`,
      `  4. Build a small eval set from real failures before you scale. You cannot improve what you don't measure.`,
      `  5. Log everything, and guardrail anything irreversible in CODE — not in a prompt asking the model nicely.`,
    );
  }

  lines.push(
    ``,
    `BUDGET QUESTIONS I'D ASK YOU BEFORE YOU BUILD:`,
    `  • What's the cost and latency budget per call — and per day at real volume, including retries?`,
    `  • Where does the data live, and is it allowed to leave? (Responses are stored by DEFAULT — 'store: false' is a deliberate choice.)`,
    `  • Who gets hurt if it's confidently wrong? That answer sets your guardrails, not your prompt.`,
    ``,
    `The vendor-neutral architecture question ("is this a ReAct loop or plan-and-execute? how do I eval it?") belongs to the 'loop' asset — ask it there. This asset covers how to build it on OpenAI.`,
    ``,
    `Current model IDs, parameter names, pricing and limits are NOT quoted from memory here — verify with check_openai → openai_verdict before committing.`,
  );
  return lines.join("\n");
}

// ── debug_openai: symptom → likely cause + fix, in order ─────────────────────
interface Symptom {
  label: string;
  cues: string[];
  causes: string[];
  fixes: string[];
}

const SYMPTOMS: Symptom[] = [
  {
    label: "Codex stops early / quits before finishing the work",
    cues: ["stops early", "stopped early", "quits", "gives up", "stops before", "doesn't finish", "didn't finish", "abruptly", "partial work", "only did part", "stops after planning", "just gives me a plan", "ends the turn"],
    causes: [
      "THE #1 CAUSE IF YOU BUILT YOUR OWN HARNESS on the API — your system prompt asks for an upfront PLAN, a preamble, or status updates during the rollout. OpenAI's prompting guide says this can make the model stop abruptly before the rollout completes. (This does NOT apply to /plan in the Codex app/CLI, which is a documented feature — different thing.)",
      "You carried over a prompt tuned for GPT-5-series or a third-party model. OpenAI's guidance is to start from their standard Codex-Max prompt, not to retrofit an old one.",
      "Missing autonomy/persistence prompting — the Codex prompt explicitly tells it to persist end-to-end and bias to action rather than stopping at analysis.",
      "It hit genuine ambiguity and bailed rather than assuming. Under-specified 'done when' does this.",
    ],
    fixes: [
      "REMOVE every instruction asking for a plan, preamble, or progress narration. This alone fixes most early-stop reports.",
      "Add autonomy/persistence language: it should gather context, implement, test, and refine within the turn, not stop at analysis or a partial fix.",
      "Say explicitly what DONE means (tests pass, behavior changed, bug fixed) so it has a terminal condition to drive at.",
      "Start from OpenAI's standard Codex prompt and make tactical additions, rather than porting your GPT-5-series prompt.",
    ],
  },
  {
    label: "Codex ignores our conventions / makes the same mistake repeatedly",
    cues: ["ignores our", "wrong conventions", "doesn't follow", "same mistake", "keeps doing", "wrong style", "wrong pattern", "agents.md", "agentsmd", "not reading", "won't follow our"],
    causes: [
      "No AGENTS.md, or one that's long and vague rather than short and accurate.",
      "The guidance is in a chat prompt you retype each time instead of in the durable file that's loaded automatically.",
      "In a monorepo, the nearest AGENTS.md to the edited file wins — a root-level rule can be overridden by a closer file you forgot about.",
      "AGENTS.md bloat: it's read into context every run, so a long file full of aspirational rules dilutes the ones that matter.",
    ],
    fixes: [
      "Put it in AGENTS.md, not the prompt. Repo layout, run/build/test/lint commands, conventions, do-not rules, and what DONE means.",
      "Keep it SHORT and accurate. Add a rule only after you've seen the mistake happen — guidance earned from real friction beats guidance imagined up front.",
      "In a monorepo, check for a nearer AGENTS.md overriding your root file. Closest wins; an explicit chat prompt overrides everything.",
      "When it repeats a mistake, ask it for a retrospective and fold the result into AGENTS.md. That's the loop that makes it improve.",
    ],
  },
  {
    label: "Migrated to Responses and my code broke",
    cues: ["migrated", "migration", "broke after", "used to work", "response_format", "responseformat", "choices is undefined", "no choices", "message is undefined", "output_text", "outputtext"],
    causes: [
      "The shapes genuinely differ — this is not a rename. Chat Completions returns `choices[].message`; Responses returns an `output` array of typed Items.",
      "Structured Outputs moved: `response_format` → `text.format`.",
      "The function-calling shape changed on BOTH the request (function config) and the response (function calls sent back).",
      "`n` (multiple parallel generations) is gone — Responses returns one generation.",
      "`output_text` is a Responses SDK helper; it doesn't exist on Chat Completions.",
    ],
    fixes: [
      "Read the official migration guide rather than pattern-matching — the differences are specific and enumerated.",
      "Stop indexing into `choices`. Walk the `output` array and handle Item TYPES (message, reasoning, function_call) as distinct things.",
      "Move `response_format` → `text.format` and re-check your schema against the Structured Outputs guide.",
      "Migrate ONE workflow end-to-end behind an eval before touching the rest.",
    ],
  },
  {
    label: "The agent loop never stops / thrashes tools / burns budget",
    cues: ["never stops", "infinite", "loops forever", "runs forever", "keeps calling", "thrash", "same tool over and over", "won't finish", "doesn't terminate", "burns budget", "expensive loop"],
    causes: [
      "If you're on the Responses API, YOU own the loop — and the stop condition is yours to write. There isn't one by default.",
      "Tool results feeding back ambiguously, so the model re-decides the same step.",
      "No max-steps and no budget cap.",
    ],
    fixes: [
      "Write the stop condition FIRST: max steps AND a token/wall-clock budget. Non-negotiable.",
      "Detect repeats — same tool, same args, twice in a row is a bug, not a strategy.",
      "If you don't want to own this, that's the actual signal to use the Agents SDK: its runner performs the tool loop and stops on completion or approval.",
      "The generic diagnosis lives in the 'loop' asset's debug_loop — this is a loop-engineering problem that happens to be on OpenAI.",
    ],
  },
  {
    label: "It blows the context window / gets dumber over a long run",
    cues: ["context window", "context length", "too long", "token limit", "maximum context", "gets dumber", "forgets", "degrades over", "long conversation", "long run"],
    causes: [
      "Unbounded state growth — every turn and every tool result appended forever.",
      "Uncapped tool results (a web page, a whole file) dumped straight into context.",
      "On Chat Completions you replay the entire message array every call, so growth is your problem by construction.",
    ],
    fixes: [
      "Cap and truncate EVERY tool result before it re-enters context. This is usually the whole fix.",
      "On Responses, use server-side state (`store: true`) with response chaining instead of hand-replaying history — but decide the data-residency question deliberately.",
      "Ask 'loop' for the memory/state pattern — summarize, window, or externalize; the strategy is vendor-neutral.",
    ],
  },
  {
    label: "Rate limits / 429s / it's too slow at volume",
    cues: ["429", "rate limit", "rate-limit", "throttl", "too slow", "timeout", "timing out", "at scale", "queue", "backlog", "throughput"],
    causes: [
      "Treating rate limits as an afterthought instead of an architecture constraint.",
      "Real-time calls for work that has no deadline.",
      "No backoff, so retries amplify the pile-up.",
      "Long-running work held open on an HTTP connection.",
    ],
    fixes: [
      "Exponential backoff with jitter, and a concurrency cap on your side. Retrying harder makes it worse.",
      "Move anything without a deadline to batch — cheaper AND it stops competing with your interactive traffic.",
      "Check your current tier's actual limits (verify via check_openai — don't assume).",
      "For genuinely long tasks, look for an async/webhook path rather than holding a connection open — verify what's currently offered before designing around it.",
    ],
  },
  {
    label: "The cost is way higher than I expected",
    cues: ["cost", "bill", "expensive", "burning money", "invoice", "cheaper", "price went up", "budget blown", "spend"],
    causes: [
      "Retries in an agent loop multiply cost — a 3-retry loop costs 3×, and nobody modeled it.",
      "Cache-hostile prompt structure: variable content (timestamp, user ID, session ID) at the FRONT invalidates the cached prefix every single call.",
      "Reasoning tokens unaccounted for in the budget.",
      "Audio priced per minute, not per token, on voice workloads.",
      "Stuffing full documents into context when retrieval would send a paragraph.",
    ],
    fixes: [
      "Restructure prompts: stable prefix FIRST, variable content LAST. Often the single biggest win, and it's free.",
      "Count reasoning tokens in your model of per-call cost.",
      "Move deadline-free work to batch.",
      "Retrieve instead of stuffing — see embeddings_retrieval.",
      "Get CURRENT pricing via check_openai. Never quote it from memory or a blog; it changes.",
    ],
  },
  {
    label: "Tool calls are unreliable / it invents tools or arguments",
    cues: ["invents", "hallucinate", "hallucinated tool", "made up", "wrong tool", "bad arguments", "invalid json", "schema", "won't call", "ignores the tool", "malformed"],
    causes: [
      "Loose or ambiguous tool schemas — overlapping descriptions, vague parameter names.",
      "Too many tools exposed at once; the model picks badly from a crowded menu.",
      "Parsing free text instead of using native structured tool-calling.",
      "Reasoning-model + tool-calling constraints that differ between Chat Completions and Responses.",
    ],
    fixes: [
      "Tighten schemas: one clear purpose per tool, unambiguous descriptions, validate args on YOUR side and feed validation errors back as observations.",
      "Expose only the tools THIS workflow needs — not your whole MCP collection. Fewer tools, better calls, and it's least-privilege too.",
      "Use native structured outputs / tool-calling rather than parsing prose.",
      "If you're using reasoning models with tools, verify the current supported combinations via check_openai — this specific constraint has moved.",
    ],
  },
  {
    label: "Prompt injection / it followed instructions from a document",
    cues: ["injection", "prompt injection", "followed instructions", "jailbreak", "malicious", "untrusted", "user content", "scraped", "exfiltrat", "leaked"],
    causes: [
      "Retrieved content (web search results, uploaded files, MCP tool output, user text) treated as instructions rather than data.",
      "Assuming built-in guardrails are a security boundary. They're a control layer, not a sandbox for your threat model.",
      "An agent with both untrusted input AND a powerful outward action (send, post, pay, delete) in the same loop.",
    ],
    fixes: [
      "Treat EVERY tool result and retrieved document as data, never as instructions. That's an architecture rule, not a prompt.",
      "Never let untrusted content select the destination of an outward action (recipient, URL, endpoint).",
      "Gate irreversible/outward actions behind human approval in CODE — the Agents SDK's approval flows exist for exactly this.",
      "Least-privilege the tools: an agent that can't send email can't be tricked into sending email.",
      "This one matters for your setup specifically — an MCP collection wired to production systems is a real blast radius. Scope credentials per asset.",
    ],
  },
];

export function debugOpenai(rawSymptom: string): string {
  const symptom = clean(rawSymptom);
  const hay = symptom.toLowerCase();
  const matched = SYMPTOMS.filter((s) => s.cues.some((c) => hay.includes(c)));

  const lines: string[] = [`DEBUG — "${symptom}"`];

  if (matched.length === 0) {
    lines.push(
      `BOTTOM LINE: no specific OpenAI failure signature matched that description — so start by locating the LAYER before guessing at fixes.`,
      ``,
      `Isolate it in this order:`,
      `  1. Does a single plain API call, no tools, no state, work at all? If no → it's auth, model ID, or request shape. If yes → the failure is in your machinery, not the platform.`,
      `  2. Log the RAW request and RAW response. Most "the model is dumb" reports turn out to be a malformed request or a swallowed tool error.`,
      `  3. Is it wrong, or wrong INCONSISTENTLY? Deterministic wrong = your code. Sometimes-wrong = a prompt/eval problem.`,
      `  4. Did it EVER work? If it broke without a code change, check model deprecation and API shape changes via check_openai.`,
      ``,
      `Known signatures I can diagnose: ${SYMPTOMS.map((s) => `"${s.label}"`).join("; ")}.`,
      `Re-ask with the actual error text or the symptom in more detail and I'll get specific.`,
    );
  } else {
    lines.push(
      `BOTTOM LINE: ${matched.length === 1 ? "this is a known signature" : "several signatures match — work them top to bottom"}. Most OpenAI "the model is broken" reports are request-shape, loop-engineering, or context problems — not the model.`,
      ``,
    );
    for (const s of matched) {
      lines.push(
        `▶ ${s.label.toUpperCase()}`,
        `  Likely causes:`,
        ...s.causes.map((c) => `    • ${c}`),
        `  The fix, in order:`,
        ...s.fixes.map((f) => `    ${s.fixes.indexOf(f) + 1}. ${f}`),
        ``,
      );
    }
  }

  lines.push(
    `Before you conclude "the platform changed": verify it with check_openai → openai_verdict. Deprecations and shape changes are real, but so is misremembering an API.`,
  );
  return lines.join("\n");
}

// ── migration_check: should you move off Chat Completions? ───────────────────
export function migrationCheck(rawContext?: string): string {
  const ctx = rawContext ? clean(rawContext) : "";
  return [
    `MIGRATION CHECK — Chat Completions → Responses API${ctx ? ` ("${ctx}")` : ""}`,
    `BOTTOM LINE: there is no deprecation clock on you. Chat Completions is still supported. Migrate because you want something Responses gives you — NOT because a blog post said the old API is dead. It isn't.`,
    ``,
    `WHAT'S ACTUALLY TRUE (per OpenAI's own docs):`,
    `  • Responses is the recommended primitive for NEW projects. That is not the same as "Chat Completions is deprecated" — it explicitly is not.`,
    `  • New features land on Responses first. That's the real long-term argument, and it's a genuine one.`,
    `  • Reasoning models have a richer experience on Responses, with improved tool usage.`,
    ``,
    `MIGRATE IF ANY OF THESE IS TRUE:`,
    `  • You're building an AGENT — Responses is an agentic loop by default (multiple tools inside one request) and you'd otherwise hand-roll that orchestration.`,
    `  • You want the built-in tools: web search, file search, computer use, code interpreter, remote MCP. (Remote MCP is the one that matters most for your stack — your existing MCP servers plug in.)`,
    `  • You want server-side conversation state instead of replaying the full message array every turn.`,
    `  • You're using reasoning models with tools.`,
    `  • Cache utilization / cost is a live problem for you.`,
    ``,
    `DON'T MIGRATE IF:`,
    `  • Your code works, meets its budget, and you want none of the above. "Working" is not a bug. Spend the time on evals instead.`,
    `  • You're deliberately keeping a portable, stateless call shape that maps across vendors. That's a legitimate architecture, not laziness.`,
    `  • You have no eval set. Migrating without a baseline means you cannot tell whether you broke something. Build the eval FIRST — that's the real prerequisite.`,
    ``,
    `IT IS NOT A RENAME — budget for these:`,
    `  • Messages → Items. `,
    `  • \`choices[].message\` → an \`output\` array of typed Items (message / reasoning / function_call).`,
    `  • Structured Outputs: \`response_format\` → \`text.format\`.`,
    `  • The function-calling shape changes on request AND response.`,
    `  • \`n\` (parallel generations) is gone — one generation.`,
    `  • Responses are STORED BY DEFAULT. If your data can't sit server-side, \`store: false\` is a deliberate call — treat it as a compliance decision.`,
    ``,
    `HOW TO DO IT SAFELY:`,
    `  1. Build the eval set on your CURRENT behavior first. That's your baseline and your safety net.`,
    `  2. Migrate ONE workflow end-to-end. Not the codebase.`,
    `  3. Compare against the baseline. Same quality or better? Continue. Worse? You just learned something before it hit production.`,
    `  4. Then the rest, one at a time.`,
    ``,
    `Verify the CURRENT migration specifics against the official guide via check_openai → openai_verdict before you start — the shapes above are the documented differences, but this surface moves.`,
  ].join("\n");
}

// ── myth_vs_reality: the platform folklore, debunked ─────────────────────────
interface Myth {
  myth: string;
  reality: string;
}

const MYTHS: Myth[] = [
  {
    myth: `"Never ask Codex to plan first — that makes it stop early."` ,
    reality: `Half-right, and the half matters. TWO DIFFERENT THINGS get conflated here. (1) Building your OWN harness on the API: OpenAI's prompting guide says remove prompting for an upfront plan, preambles, or status updates from your SYSTEM PROMPT, because it can make the model stop abruptly before the rollout completes. That's real. (2) Using the Codex app/CLI: /plan is a documented first-class feature for exactly when you want it to investigate and propose an approach before editing, and /goal sets a persistent goal after it. So: don't bake "tell me your plan" into a custom harness prompt; DO use /plan in the app when the task warrants it. If someone tells you flatly "never let Codex plan", they're applying API-harness advice to a product feature.`,
  },
  {
    myth: `"Codex is a model." / "Codex is that CLI." / "Codex is the cloud thing."`,
    reality: `It's all of them, and that's why online arguments about Codex go nowhere. It's a Codex-tuned model (gpt-5.3-codex in the API), an open-source Rust CLI, an IDE extension (VS Code/Cursor/JetBrains), a cloud + app surface with worktrees and parallel agents, a PR code-review flow, AND an SDK. People confidently contradict each other because they're describing different surfaces. Name the surface before you debate the capability.`,
  },
  {
    myth: `"Better prompting is how you get better Codex results."`,
    reality: `Only up to a point — after that it's AGENTS.md. A prompt is a one-off; AGENTS.md is durable, loaded automatically, and it's where conventions, commands, and do-not rules belong. The tell that you're doing it wrong: retyping the same guidance every session. When Codex repeats a mistake, the fix isn't a cleverer prompt, it's a retrospective folded into the file.`,
  },
  {
    myth: `"Codex is Unix-first — it's rough on Windows."`,
    reality: `Stale. OpenAI's Feb 2026 prompting guide states Codex is now much better in PowerShell and Windows environments. This is a good example of the general hazard: Codex advice ages in months, and confident year-old blog wisdom is the most dangerous kind. Anything specific here goes through check_openai.`,
  },
  {
    myth: `"Chat Completions is deprecated — migrate now or you're on borrowed time."`,
    reality: `False, and it's the most repeated claim in the ecosystem. OpenAI's own docs say Chat Completions REMAINS SUPPORTED; Responses is "recommended for all new projects". Those are different statements. New features do land on Responses first — that's the real argument for migrating eventually. Panic is not.`,
  },
  {
    myth: `"Fine-tune it on our documentation so it knows our stuff."`,
    reality: `The single most expensive mistake on this platform. Fine-tuning teaches BEHAVIOR (format, style, tone), not FACTS. Facts go stale the day your docs change, and retrieval does the job better, cheaper, and with citations. Fine-tune to shape how it answers, or to distill a big model into a cheap one — not to make it "know" things.`,
  },
  {
    myth: `"The Agents SDK means I don't need to understand agent loops."`,
    reality: `It means you don't have to WRITE one. You still have to understand it, because when the run doesn't terminate, or thrashes tools, or drifts, the diagnosis is loop engineering — the SDK just moved the code, not the thinking. The engineering is still in the loop around the model.`,
  },
  {
    myth: `"Guardrails protect us from prompt injection."`,
    reality: `Guardrails are a control layer, not a security boundary. If an agent reads untrusted content AND can take a powerful action, injection is live regardless of what the guardrail config says. The actual defense is architectural: treat all retrieved content as data, never let untrusted text choose the target of an outward action, and gate irreversible actions behind human approval in code.`,
  },
  {
    myth: `"Built-in tracing means we have evals."`,
    reality: `Traces tell you what HAPPENED. Evals tell you whether it was RIGHT. They are not the same tool and one doesn't substitute for the other. A beautifully traced run of a confidently wrong agent is a beautifully traced wrong agent. Consistency ≠ correctness.`,
  },
  {
    myth: `"Multi-agent handoffs will make it smarter."`,
    reality: `Usually it makes it slower, pricier, and harder to debug, and the win never shows up in a measurement — because there was no measurement. Most "I need a team of agents" is one agent with good tools and a clear stop condition. Add the second agent when you can name the failure the first one had.`,
  },
  {
    myth: `"The newest model will fix our quality problem."`,
    reality: `If your problem is a vague spec, bad chunking, an ambiguous tool schema, or no eval, a smarter model will be confidently wrong faster and cost more doing it. Model upgrades fix model problems. Most quality problems are engineering problems wearing a model costume.`,
  },
  {
    myth: `"We should use OpenAI for everything — it's the best platform."`,
    reality: `This asset knows OpenAI deeply and is still going to say it: use something else when the data can't leave your environment, when you genuinely need multi-provider routing (don't put a single-vendor runner at that seam), when the economics don't work at your volume, or when the task is deterministic and doesn't need an LLM at all. Depth in a platform means knowing its edges, not denying they exist.`,
  },
  {
    myth: `"Responses is stateless like Chat Completions was."`,
    reality: `Responses are STORED BY DEFAULT. If you assumed otherwise, you have made a data-residency decision without knowing it. \`store: false\` opts out (and encrypted reasoning lets you keep reasoning benefits while opting out of statefulness). Know which one you chose, and know why.`,
  },
];

export function mythVsReality(): string {
  return [
    `OPENAI PLATFORM MYTHS vs REALITY`,
    `BOTTOM LINE: most of what burns people on this platform isn't the model — it's folklore repeated by people selling courses. The through-line below: the engineering is in the loop, the spec, and the eval. Almost never in the model.`,
    ``,
    ...MYTHS.flatMap((m) => [`  MYTH: ${m.myth}`, `  REALITY: ${m.reality}`, ``]),
    `The honest meta-point: this list is stable engineering judgment, not version trivia — which is exactly why it's safe to keep in memory. Anything with a number in it (a price, a limit, a model ID, a deprecation date) is NOT in this asset's memory on purpose, because that's the stuff that quietly goes wrong. Route those through check_openai → openai_verdict.`,
  ].join("\n");
}
