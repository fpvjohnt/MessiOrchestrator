// The primitives of the OpenAI platform — the layers you can build on, and the
// choice that decides every architecture: who owns the agent loop, you or the
// SDK. Each: what it is, when to reach for it, its anatomy (the parts you
// actually build), how it fails, and the first move. Plain words, bottom-line
// first. Same reverse-index shape as loop's patterns.ts so "ask by any name"
// works and the regression harness auto-covers it.
//
// HONESTY BOUNDARY FOR THIS FILE: everything here is either (a) the STABLE
// shape of the platform — the tradeoffs, the failure modes, the engineering
// judgment, which don't churn — or (b) confirmed against developers.openai.com.
// Version-sensitive specifics (exact model IDs, parameter names, pricing,
// limits, what's deprecated this month) are deliberately NOT hard-coded here;
// they go stale and this asset would then confidently lie. Those route through
// check_openai → openai_verdict. If you're tempted to add a model ID or a price
// to this file, don't — that's the verify loop's job.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface Primitive {
  label: string;
  keys: string[];
  what: string;
  when: string;
  anatomy: string[];
  failure_modes: string[];
  build_it: string[];
}

export const PRIMITIVES: Record<string, Primitive> = {
  chatgpt: {
    label: "ChatGPT (the product — Chat, Work, Projects, Plugins)",
    keys: ["chatgpt", "chat", "gpt", "theapp", "webapp", "desktop", "prompting", "prompts", "prompt", "plugins", "plugin", "project", "projects", "personalization", "custominstructions", "boundaries", "steering", "queuing", "work", "voicedictation", "connectedsources"],
    what:
      "The product, NOT the API — and confusing the two is the most common beginner error on this platform. ChatGPT is where you prompt, attach files, use plugins to reach Drive/Gmail/Slack/GitHub, keep related work in Projects, set standing preferences in Personalization, and run bigger multi-step jobs in Work. Chat Completions is an API endpoint. They are different things with different rules; an answer about one is not an answer about the other.",
    when:
      "When YOU are the user doing the work — drafting, analyzing, deciding, researching. Use the API instead when you're building software that calls a model programmatically. Rule of thumb: if a human is reading the output, that's ChatGPT; if code is reading it, that's the API.",
    anatomy: [
      "THE PROMPT SHAPE — OpenAI's own four parts: GOAL (what should it do), CONTEXT (what information or sources help), OUTPUT (what format, length, detail), BOUNDARIES (what must stay unchanged; what to avoid or check with you first). Use only the parts that help — there's no required formula, and a short prompt is often enough.",
      "CHAT vs WORK — Chat for questions, drafts, rewrites, brainstorming. Work for tasks that draw on several sources or tools, run multi-step, make changes, or produce a larger deliverable. Work consumes credits, so scope it: include only relevant sources, define audience/format/length, separate required work from polish.",
      "CONTEXT INPUTS — attach documents, spreadsheets, presentations, PDFs; add a screenshot or diagram when the task depends on visual context (and point at the area that matters); ask it to use web search when the answer depends on current information, and ask for sources when you need to check it.",
      "PROJECTS — when related chats should share files, sources, or a local folder. PLUGINS — reusable instructions and connections to tools like Google Drive, Gmail, Slack, GitHub; type @ in the composer to pick one. Connected sources need the matching plugin, and availability depends on plan/workspace.",
      "PERSONALIZATION — preferences that apply across every chat go in Settings → Personalization as custom instructions. Task-specific detail stays in the prompt. Getting this split right is why some people's ChatGPT 'just knows' how they work.",
      "STEERING vs QUEUING — send a message while it's still working: steer adds to the CURRENT run (change direction, add a missing detail); queue saves it for the NEXT run. Desktop default under Settings → General → Follow-up behavior. In Codex CLI: Enter steers, Tab queues.",
      "Voice dictation — hold Ctrl+M in the desktop app and talk; it transcribes into the composer for you to edit before sending.",
    ],
    failure_modes: [
      "Confusing ChatGPT with the API. 'Is ChatGPT deprecated?' / 'What does ChatGPT cost per token?' are category errors — ChatGPT is a product with plans, the API is an endpoint with per-token pricing.",
      "Describing a PROCESS when you should describe a RESULT. Start with the outcome you want; leave it room to search, compare, and adjust its approach. Spell out the process only when the process itself is what matters.",
      "No boundaries on work that touches other people. Without 'prepare as a draft, don't send', 'keep the approved figures unchanged', or 'use only the supplied sources, flag gaps instead of guessing', you get confident output that creates real cleanup.",
      "Treating the first answer as the deliverable. Your first prompt does not need to be perfect — review, then ask for the specific change. Restarting from scratch is usually the wrong move.",
      "Putting task-specific detail in Personalization (it then leaks into every unrelated chat) or retyping standing preferences in every prompt. Both directions of the same mistake.",
      "Pasting things you shouldn't: credentials, client-privileged material, PHI, or anything your employer's policy covers. The prompt box feels private; it isn't a vault.",
    ],
    build_it: [
      "Start in your own words. Short is usually fine. Add the four parts only as the task gets bigger or the stakes rise.",
      "Pick ONE or TWO boundaries that actually prevent damage — not a control for every step. 'Prepare the message as a draft. Don't send it.' does more than a paragraph of caveats.",
      "Tell it how you'll USE the result ('a one-page summary a director can scan, decision first') — that drives length, structure, and detail more than any adjective.",
      "For important work, ask for a FINAL CHECK: confirm every action item has an owner and a due date, flag anything it couldn't verify. Then review it yourself before it goes anywhere.",
      "Refine a Work prompt in a normal task FIRST; once the output is reliable, schedule it. Don't automate something you haven't seen succeed.",
      "Standing preferences → Personalization. This-task detail → the prompt. Shared files/sources → a Project.",
    ],
  },

  codex: {
    label: "Codex (the agentic coding surface)",
    keys: ["codex", "codexcli", "cli", "codexapp", "codexcloud", "agentsmd", "codingagent", "gpt5codex", "codexsdk", "applypatch", "codereview", "pairprogramming"],
    what:
      "OpenAI's agentic coding surface — and the first thing to know is that 'Codex' is not one product. It's SIX things wearing one name: a Codex-tuned MODEL (in the API, gpt-5.3-codex per OpenAI's Feb 2026 prompting guide), an open-source CLI (github.com/openai/codex, written in Rust), an IDE extension (VS Code, Cursor and forks, plus JetBrains: Rider/IntelliJ/PyCharm/WebStorm), a cloud/app surface (per openai.com/codex, a 'command center for agentic coding' with built-in worktrees running agents in parallel), an end-to-end PR code-review flow, and a Codex SDK for simpler integrations. Half the confusion about Codex online is people arguing about different ones. Name which surface you mean before anything else.",
    when:
      "When the work lives IN a repository — a scoped change, a bug with a failing test, a migration across many files, a code review. Reach for Codex when you want an agent to DO the coding work. Reach for the Responses API or Agents SDK instead when you're BUILDING A PRODUCT that happens to use a model. That's the whole dividing line: Codex is a tool you use; the API is a thing you build on.",
    anatomy: [
      "The MODEL — gpt-5.3-codex in the API (per the official prompting guide, Feb 2026). Codex models are OpenAI's recommended agentic coding model. VERIFY the current ID before you pin it; this is the fastest-moving fact here.",
      "REASONING EFFORT as a dial: OpenAI recommends 'medium' as the all-around interactive coding balance of intelligence and speed; 'high' or 'xhigh' for the hardest, long-running tasks. This is a real lever, not a placebo.",
      "AGENTS.md — the durable context file, and the single highest-leverage thing you'll write. An open format (now stewarded by the Agentic AI Foundation under the Linux Foundation), read automatically, working across Codex, Cursor, Jules, Copilot, Gemini CLI and others. Nested files allowed; the CLOSEST file to the edited file wins; an explicit chat prompt overrides everything. OpenAI's own main repo reportedly carries ~88 of them.",
      "COMPACTION — first-class support, so a run can reason for hours without hitting the context limit. This is what makes long autonomous work viable rather than a context-window race.",
      "apply_patch — OpenAI calls the patch tool a MAJOR lever on performance. If you're building your own harness, this is not a detail.",
      "The open-source codex-cli is the reference implementation. OpenAI's actual advice: clone it and ask a coding agent to explain how it works.",
      "THE WORKFLOW LAYER (in the app/CLI, not the API): /plan makes it investigate and propose an approach before editing; /goal sets a persistent goal after the plan; /review runs a local code review on your working tree (and takes focus instructions, e.g. '/review Focus on edge cases and security'); /mention plus @ path autocomplete attaches files. On GitHub, comment '@codex review' on a PR — requires enabling Codex code review on the repo first.",
      "CONTEXT DIFFERS BY SURFACE — this trips people constantly: the IDE extension automatically includes your OPEN FILES. The CLI does not: mention paths explicitly, use @ or /mention. Same model, different context, different results.",
      "THE SANDBOX + APPROVAL POLICY — Codex runs local commands inside a sandbox limiting file and network access, and follows your approval policy before crossing that boundary. This is the guardrail that makes it safe to point at a real repo.",
      "CLOUD TASKS run in isolated environments and internet access is OFF during the agent phase unless you enable it for the environment. Budget for that before you delegate something that needs to fetch dependencies.",
      "STEERING vs QUEUING mid-run: Enter steers the current turn (redirect, add detail), Tab queues for the next turn.",
    ],
    failure_modes: [
      "THE COUNTERINTUITIVE ONE, straight from OpenAI's prompting guide: do NOT prompt Codex for an upfront plan, preambles, or status updates during the rollout — it can cause the model to STOP ABRUPTLY before the work is finished. This is the opposite of standard prompting advice, and if you carry a GPT-5-series or third-party prompt over unchanged, this is what bites you.",
      "Treating 'Codex' as one thing — arguing about the CLI's behavior using the cloud agent's limitations, or vice versa. Most online Codex disagreements are this.",
      "Porting a prompt tuned for GPT-5-series or another vendor's model and expecting parity. OpenAI is explicit: start from their standard Codex-Max prompt and make tactical additions, don't retrofit your old one.",
      "Writing a long, vague AGENTS.md full of aspirational rules. A short accurate one beats a long fuzzy one; the file is read into context, so bloat costs you on every single run.",
      "Expecting real-time inline autocomplete. Codex's model is agentic and task-shaped — you scope work and review output. That's a different workflow, not a worse one.",
      "Repo/cloud constraints: the cloud surface wants your code in its environment. If your code cannot leave (data residency, air-gapped), that surface is out — see the honest edges.",
    ],
    build_it: [
      "Name the surface first: CLI, IDE extension, cloud/app, code review, SDK, or raw model via API. The answer to almost every Codex question depends on which one.",
      "Write AGENTS.md before you write clever prompts. Cover: repo layout, how to run it, build/test/lint commands, conventions, do-not rules, and what DONE means. Scaffold it (the CLI has an /init) then EDIT it — the generated version describes a generic repo, not yours.",
      "Structure the task itself as: GOAL (what to change), CONTEXT (which files/errors/docs matter), CONSTRAINTS (conventions, do-nots), DONE WHEN (tests pass, behavior changes). That four-part shape is what keeps it scoped.",
      "Set reasoning effort to the task: low for well-scoped mechanical work, medium for normal interactive coding, high/xhigh for genuinely hard long-horizon work. Don't leave it on max out of superstition — it costs tokens and time.",
      "When Codex makes the same mistake twice, don't re-prompt — update AGENTS.md. That's the difference between a tool and a teammate that improves.",
      "Windows note: OpenAI states Codex is now much better in PowerShell and Windows environments. Relevant if you're on Windows — older 'it's Unix-first' advice is stale.",
    ],
  },

  responses_api: {
    label: "The Responses API (you own the loop)",
    keys: ["responses", "responsesapi", "response", "newapi", "primitive", "ownloop", "items", "storetrue"],
    what:
      "OpenAI's current API primitive and the recommended starting point for new projects — an evolution of Chat Completions that is agentic by default: the model can call multiple tools (web search, file search, computer use, code interpreter, remote MCP servers, your own functions) within a single request. Its unit of context is an Item, not a Message.",
    when:
      "The default for anything new. Reach for it when you want direct control over model interactions, tools, state, and orchestration — whether the workflow is one call or many — and when you want to implement your own routing, loops, or branching in application code.",
    anatomy: [
      "A single call taking `input` (a string OR a list of items) plus `instructions` for system-level guidance.",
      "An `output` array of typed Items — a message, a reasoning item, a function_call, a function_call_output. Distinct objects, not one glued-together blob.",
      "Built-in platform tools you switch on rather than build: web search, file search, computer use, code interpreter, remote MCP.",
      "State: `store: true` keeps context server-side turn to turn (reasoning + tool context preserved); `store: false` opts out. Response chaining or Conversations are the other options.",
      "The function-calling flow: your app receives the function call, executes it, returns the output, calls the model again. YOU write that loop.",
    ],
    failure_modes: [
      "Porting Chat Completions code line-by-line and expecting it to work — the shapes genuinely differ. Structured Outputs moves from `response_format` to `text.format`; the function-calling shape changes; `n` (parallel choices) is gone; you get one generation.",
      "Assuming stateless. Responses are stored by DEFAULT — if your data isn't allowed to sit on OpenAI's side, you must set `store: false` deliberately. This is a compliance decision, not a performance one.",
      "Writing your own agent loop with no stop condition, then blaming the model when it never terminates. Owning the loop means owning the cap on steps and budget.",
      "Reaching for it when you actually wanted the Agents SDK — you end up rebuilding sessions, tracing, guardrails, and handoffs by hand, badly.",
    ],
    build_it: [
      "Start with ONE call, plain string input, no tools. Prove it end-to-end before adding machinery.",
      "Decide `store` explicitly on the first call, not later — it's the data-residency question in disguise.",
      "Write the stop condition (max steps AND budget) before the loop body. Same discipline as any agent loop — ask `loop` for the pattern.",
      "Add built-in tools before you build custom ones. Remote MCP means your existing MCP servers plug in directly rather than being rewritten as functions.",
    ],
  },

  agents_sdk: {
    label: "The Agents SDK (the SDK owns the loop)",
    keys: ["agentssdk", "agentsdk", "sdk", "agents", "runner", "handoff", "handoffs", "guardrails", "sessions", "sandbox", "agentsastools"],
    what:
      "A first-class platform primitive (TypeScript and Python) that RUNS the agent loop for you: the runner performs the tool loop, switches agents on handoff, and stops when the run finishes or pauses for approval. Core abstraction is an agent run, not a model response.",
    when:
      "When you want the SDK to manage the loop and recurring orchestration (repeated tool calls, branching); when different specialists need different instructions/tools/policies; or when you want built-in sessions, tracing, guardrails, or resumable approval flows rather than building them.",
    anatomy: [
      "Agent definitions — one specialist with its instructions, tools, and policy. Shape this cleanly before adding a second.",
      "The runner — owns the loop, streaming, and continuation.",
      "Handoffs + agents-as-tools — how multiple specialists delegate and who owns the reply.",
      "Guardrails on input, output, and tools, plus resumable human-approval flows — declarative, enforced by the platform, not bolted on.",
      "Sessions and resumable run state; built-in traces across model calls, tools, agents, guardrails, and handoffs.",
      "Sandbox agents — container-based execution for files, commands, packages, mounts.",
      "Local MCP connections and tool wrappers; a voice pipeline for voice-first workflows.",
    ],
    failure_modes: [
      "Reaching for multi-agent handoffs on day one. Most 'I need a team of agents' is one agent with good tools — the same trap `loop` warns about, wearing an OpenAI badge.",
      "Assuming the guardrails are a security boundary against prompt injection. They're a control layer; injection through retrieved content is still your threat model.",
      "Treating built-in tracing as an eval. Traces tell you what happened; they do NOT tell you the answer was correct. Consistency ≠ correctness — that's `loop`'s eval_loop.",
      "Locking a multi-provider workload into a single-vendor runner. If you route across vendors, the SDK's loop is the wrong seam.",
    ],
    build_it: [
      "Do the quickstart, get ONE agent running, and stop there until it's boring. Then add the next capability the workflow actually needs.",
      "Define one specialist cleanly (agent definitions) before touching orchestration and handoffs.",
      "Use traces to debug FIRST; move to a real evaluation loop once it behaves.",
      "Put guardrails and approvals on anything irreversible or outward-facing — in the SDK's declarative layer, not in a prompt asking nicely.",
    ],
  },

  chat_completions: {
    label: "Chat Completions (the incumbent)",
    keys: ["chatcompletions", "completions", "legacy", "old", "oldapi", "messages", "choices"],
    what:
      "The 2023-era API that made everything else: a stateless array of Messages in, an array of `choices` out. Still supported and NOT deprecated — but Responses is what OpenAI recommends for new projects, and new features land there first.",
    when:
      "When you already have working Chat Completions code that does its job — 'not deprecated' means you are not on a migration clock. Also when you deliberately want a dumb, stateless, portable call shape that maps cleanly onto other vendors' APIs.",
    anatomy: [
      "`messages` array in, `choices[].message` out — you manage conversation history client-side and replay it every call.",
      "Stateless by design: your app owns all context. (Stored by default for new accounts; `store: false` opts out.)",
      "Function calling and structured outputs (`response_format`) with the older shapes.",
      "You bolt on your own tool-calling orchestration.",
    ],
    failure_modes: [
      "Migrating for the sake of it. Working code that meets its budget is not a bug. Migrate when you want something Responses has, not because a blog said to.",
      "NOT migrating when you're building an agent — replaying full history every turn, hand-rolling tool orchestration, and paying worse cache utilization for the privilege.",
      "Reasoning-model gaps. Reasoning models have a richer experience on Responses; some reasoning + tool-calling combinations are not supported here. If you're using reasoning models with tools, verify the current constraint before committing.",
    ],
    build_it: [
      "Audit before you migrate: what do you want that you can't get here? If the answer is nothing, stay put and spend the time on evals.",
      "If you ARE migrating: it's not a rename. `response_format` → `text.format`, the function-calling shape changes, Messages → Items, `n` is gone, and `output_text` is a Responses-only helper.",
      "Migrate one workflow end-to-end behind an eval, not the whole codebase at once.",
    ],
  },

  platform_tools: {
    label: "Platform Tools & Remote MCP",
    keys: ["tools", "platformtools", "builtin", "builtintools", "websearch", "filesearch", "computeruse", "codeinterpreter", "mcp", "remotemcp", "connectors", "retrieval", "filesearch"],
    what:
      "The tools OpenAI hosts so you don't build them: web search, file search, computer use, code interpreter, image generation — plus remote MCP, meaning OpenAI has adopted the Model Context Protocol as its tool-interop layer. Your existing MCP servers are callable as tools.",
    when:
      "Before you write a custom function. If a hosted tool does the job, the hosted tool is less code, less maintenance, and fewer failure modes than your version.",
    anatomy: [
      "Hosted tools switched on in the request — the model calls them inside a single API call, no round-trip to your server.",
      "Function tools — your own code, defined by a schema, executed by you.",
      "Remote MCP — point the model at an MCP server; its tools become callable. This is the seam that matters if you already run an MCP collection.",
    ],
    failure_modes: [
      "Prompt injection through retrieved content. Web search and file search pull in text you don't control, and that text can carry instructions. Hosted ≠ trusted. Treat every tool result as data, never as instructions.",
      "Rebuilding file search as a bespoke vector pipeline before proving the hosted one is insufficient.",
      "Uncapped tool results blowing the context window — the failure looks like 'the model got dumber around step 12'.",
      "Handing a broadly-scoped MCP server to a model and calling it least-privilege. The model gets every tool you expose.",
    ],
    build_it: [
      "Try the hosted tool first. Build custom only where it demonstrably fails.",
      "Scope MCP exposure per workflow — expose the three tools this agent needs, not the whole collection.",
      "Cap and truncate every tool result before it re-enters context.",
      "Feed tool ERRORS back as observations rather than swallowing them; a silent failure becomes a hallucination one step later.",
    ],
  },

  realtime_voice: {
    label: "Realtime & Voice",
    keys: ["realtime", "realtimeapi", "voice", "voiceagents", "audio", "speech", "stt", "tts", "whisper", "transcription", "lowlatency"],
    what:
      "The low-latency speech-to-speech surface for conversational voice, plus the Agents SDK's voice pipeline and realtime agent patterns for voice-first workflows.",
    when:
      "When latency is the product — live conversation, phone, interactive assistants. If your voice use case is batch (transcribe a recording, summarize it), you do NOT need realtime; that's a transcription call plus a normal request.",
    anatomy: [
      "A persistent streaming connection rather than request/response.",
      "Speech in → model → speech out, without a hand-rolled STT → LLM → TTS chain.",
      "Turn detection / interruption handling — the part that makes it feel human or broken.",
      "The Agents SDK voice pipeline if you want agent semantics (tools, handoffs) on top.",
    ],
    failure_modes: [
      "Reaching for realtime when batch would do — you take on connection management, reconnects, and cost for latency you don't need.",
      "Ignoring barge-in. If a user can't interrupt, it feels like an IVR from 2004.",
      "Cost surprise: audio tokens price differently from text. Model your per-minute cost before you ship, and verify current numbers — don't trust a blog's.",
      "No fallback when the connection drops mid-turn.",
    ],
    build_it: [
      "Prove the workflow in text first. Voice is a transport; if the logic is wrong, voice makes it wrong AND expensive.",
      "Budget cost per MINUTE, not per token, and verify the current audio pricing via check_openai before committing.",
      "Design the interruption path early — it's the difference between a demo and a product.",
    ],
  },

  embeddings_retrieval: {
    label: "Embeddings & Retrieval",
    keys: ["embeddings", "embedding", "vector", "vectors", "vectordb", "rag", "semantic", "similarity", "search", "chunking"],
    what:
      "Text → vectors, for semantic search and RAG. The plumbing under 'answer from my documents' — either hosted via file search, or built yourself with an embeddings endpoint and a vector store.",
    when:
      "When the answer must come from YOUR corpus with citations, and the corpus is too big to stuff in context. Not when the corpus fits in the context window — then just put it in the context window.",
    anatomy: [
      "Chunking (the part that decides your quality, and the part everyone skips), embedding, indexing, retrieval, re-ranking, then generation grounded in what came back.",
      "Hosted route: file search. Custom route: embeddings endpoint + your own vector store.",
      "Citations back to source chunks — the whole point.",
    ],
    failure_modes: [
      "Building a custom vector pipeline before trying hosted file search. Weeks of work to lose to a checkbox.",
      "Bad chunking blamed on the model. Retrieval quality is chunking quality; the model can only answer from what you handed it.",
      "No retrieval eval — you measure the generated answer and never check whether the right chunk was even retrieved. Two different failures, two different fixes.",
      "Mixing embedding models between index and query, or silently re-indexing with a new model. Vectors from different models are not comparable.",
      "Injection through retrieved documents (see platform_tools) — your corpus is a threat surface if anyone else can write to it.",
    ],
    build_it: [
      "Try hosted file search first. Go custom only when you can name what it can't do.",
      "Evaluate RETRIEVAL separately from generation: did the right chunk come back, yes or no? Fix that before touching the prompt.",
      "Pin the embedding model and record it alongside the index. Changing it means a full re-index.",
      "Ask `loop` for the RAG loop pattern — the architecture is vendor-neutral; only the endpoints here are OpenAI's.",
    ],
  },

  finetune_or_not: {
    label: "Fine-Tuning (and why you probably don't need it)",
    keys: ["finetune", "finetuning", "training", "train", "distillation", "distill", "customModel", "custommodel", "lora", "sft"],
    what:
      "Training a model on your examples to bake in behavior. Real, useful — and the single most over-reached-for tool on the platform.",
    when:
      "When you need consistent FORMAT/STYLE/tone at scale, or you're distilling a big model's behavior into a cheaper one to cut cost and latency. Almost never for teaching the model new facts — that's retrieval's job.",
    anatomy: [
      "A dataset of input→output examples that demonstrate the behavior you want.",
      "A training run, then an eval comparing the tuned model against the base model with a good prompt.",
      "Versioning: which model, which dataset, which eval score.",
    ],
    failure_modes: [
      "Fine-tuning to add KNOWLEDGE. It doesn't reliably work, it goes stale the day your facts change, and retrieval does it better and cheaper.",
      "Fine-tuning before exhausting prompting + few-shot + retrieval. You'll spend weeks to lose to a better prompt — and you won't know, because there's no baseline.",
      "No baseline eval, so you can't tell whether it helped. This is the most common outcome.",
      "Tuning onto a model that gets superseded, leaving you pinned to an aging base while the frontier moves.",
    ],
    build_it: [
      "Build the eval set FIRST. Without a baseline number, fine-tuning is a vibe.",
      "Exhaust the ladder in order: better prompt → few-shot examples → structured outputs → retrieval → THEN fine-tuning.",
      "If the goal is cost/latency (distillation), that's the legitimate case — measure the cost delta AND the quality delta, and be honest if quality dropped.",
      "Verify current fine-tuning availability and pricing per model via check_openai — this surface changes and stale assumptions here are expensive.",
    ],
  },

  batch_and_cost: {
    label: "Cost, Caching & Batch",
    keys: ["cost", "costs", "pricing", "price", "cheap", "expensive", "budget", "batch", "batchapi", "caching", "promptcaching", "cache", "latency", "throughput", "ratelimit", "ratelimits", "tokens"],
    what:
      "The economics layer: prompt caching, batch processing for non-urgent work, and the token accounting that decides whether your thing is viable at scale.",
    when:
      "Before you ship anything with volume. Cost per call times calls per day is a number you should know BEFORE the invoice teaches it to you.",
    anatomy: [
      "Prompt caching — stable prefixes get cheaper. Structure prompts so the constant part comes FIRST and the variable part last.",
      "Batch — trade latency for a discount on work that doesn't need an answer now.",
      "Rate limits as an architecture constraint, not an afterthought.",
      "Per-call cost = input tokens + output tokens (+ reasoning tokens, + audio tokens), each priced differently.",
    ],
    failure_modes: [
      "Discovering cost in production. The agent loop that retries three times costs 3×, and nobody modeled it.",
      "Cache-hostile prompt structure — putting the variable part (timestamp, user ID) at the FRONT and invalidating the whole prefix every call.",
      "Ignoring reasoning tokens in the budget, then being shocked by the bill on a reasoning model.",
      "Using real-time calls for work that had no deadline — paying a latency premium for a nightly job.",
    ],
    build_it: [
      "Model cost per call BEFORE building. Multiply by realistic volume, including retries.",
      "Put the stable prefix first for cache hits; variable content last.",
      "Move anything without a deadline to batch.",
      "NEVER quote pricing from memory or a blog — it changes. Route every number through check_openai → openai_verdict.",
    ],
  },
};

export function resolvePrimitive(input: string): string | undefined {
  const q = normalize(input);
  if (!q) return undefined;
  if (PRIMITIVES[q]) return q;
  for (const [key, p] of Object.entries(PRIMITIVES)) {
    if (normalize(key) === q) return key;
    if (normalize(p.label) === q) return key;
    if (p.keys.some((k) => normalize(k) === q)) return key;
  }
  // Loose contains-match, longest key first so "agentssdk" beats "agents".
  const scored: Array<{ key: string; len: number }> = [];
  for (const [key, p] of Object.entries(PRIMITIVES)) {
    for (const k of [key, ...p.keys]) {
      const nk = normalize(k);
      if (nk.length >= 3 && (q.includes(nk) || nk.includes(q))) scored.push({ key, len: nk.length });
    }
  }
  if (!scored.length) return undefined;
  scored.sort((a, b) => b.len - a.len);
  return scored[0].key;
}

export function explainPrimitive(primitive?: string): string {
  if (!primitive) {
    return [
      `THE OPENAI PLATFORM — THE PRIMITIVES`,
      `BOTTOM LINE: every architecture decision on this platform starts with ONE question — who owns the agent loop, you or the SDK? Responses API when you own it. Agents SDK when the SDK runs it. Everything else is a detail hanging off that choice.`,
      ``,
      ...Object.entries(PRIMITIVES).map(([key, p]) => `  ▸ ${p.label} — ${p.what.split(" — ")[0].slice(0, 120)}… ('explain_primitive ${key}')`),
      ``,
      `Not sure which? → 'pick_primitive <what you want to build>'.`,
      `Something broken? → 'debug_openai <symptom>'.`,
      `Any version-sensitive fact (model IDs, pricing, limits, what's deprecated) → 'check_openai' → 'openai_verdict'. Never from memory.`,
    ].join("\n");
  }
  const key = resolvePrimitive(primitive);
  if (!key) {
    return `Not sure which primitive "${clean(primitive)}" is. Primitives: ${Object.values(PRIMITIVES).map((p) => p.label).join(", ")}.`;
  }
  const p = PRIMITIVES[key];
  return [
    `${p.label}${normalize(primitive) !== normalize(key) ? ` (from "${clean(primitive)}")` : ""}`,
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
    `Model IDs, parameter names, pricing, limits and deprecations are NOT quoted from this asset's memory — they move. Verify with check_openai → openai_verdict before you commit code.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is the OpenAI Platform Engineer — 15 years shipping production software, on the OpenAI platform since the API launched. The job is to name the right primitive, build the smallest thing that works, and tell you honestly when OpenAI is the wrong tool.`,
    ``,
    `  • CHATGPT — the product: the Goal/Context/Output/Boundaries prompt shape, Chat vs Work, Projects, Plugins, Personalization, steering vs queuing → 'explain_primitive chatgpt'.`,
    `  • CODEX — the agentic coding surface (gpt-5.3-codex, the open-source CLI, the IDE extension, the cloud/app, PR code review, the SDK), AGENTS.md, reasoning effort, /plan · /goal · /review · @codex review, the sandbox → 'explain_primitive codex'.`,
    `  • "How does MY kind of work use these?" → 'how_they_use_it <role>' — engineer, analyst, researcher, IT, lawyer, realtor, clinician, accountant, teacher, marketer, manager, student, writer, product/design. The trap per role is the part worth reading.`,
    `  • "What should I build this on?" → 'pick_primitive <what you want to build>' — names the layer and justifies it.`,
    `  • The primitives (ChatGPT, Codex, Responses API, Agents SDK, Chat Completions, platform tools/MCP, realtime/voice, embeddings, fine-tuning, cost/batch) → 'explain_primitive <name>' (or no name for the map).`,
    `  • Something's broken → 'debug_openai <symptom>' — the OpenAI-specific failure modes, in likelihood order.`,
    `  • "Should I move off Chat Completions?" → 'migration_check' — an honest audit, not a sales pitch.`,
    `  • The folklore that burns people ("Chat Completions is deprecated", "fine-tune it on our docs") → 'myth_vs_reality'.`,
    `  • Any current specific — model IDs, pricing, limits, deprecations → 'check_openai' → 'openai_verdict'. Verified via research, never from stale memory.`,
    ``,
    `THREE RULES THAT DECIDE MOST THINGS:`,
    `  1. ChatGPT is the PRODUCT (a human reads the output). The API is the ENDPOINT (code reads the output). Confusing the two is the most common error on this platform.`,
    `  2. Codex is a tool you USE (the work lives in a repo). The API is a thing you BUILD ON (you're making a product). Don't rebuild Codex on the API.`,
    `  3. Within the API: Responses when you want to own the loop; Agents SDK when you want the SDK to run it. That's OpenAI's own framing.`,
    ``,
    `WHAT THIS ASSET IS THE SOURCE OF TRUTH FOR: the method, the workflows, and the traps — the durable part, and the part worth being expert in. It is deliberately NOT the source of truth for live facts (model IDs, pricing, limits, deprecations); those live in OpenAI's docs and get VERIFIED here, never recalled. An expert who quotes today's price from memory is just a confident liar with good timing.`,
    ``,
    `WHAT THIS ASSET IS NOT: it's not the agent-architecture theorist — vendor-neutral loop patterns (ReAct, reflexion, RAG, evals, multi-agent) belong to 'loop'. It's not neutral about OpenAI, but it will tell you plainly when OpenAI is the wrong answer: multi-provider routing, on-prem/data-residency constraints, cost floors, or an existing stack that already works.`,
  ].join("\n");
}
