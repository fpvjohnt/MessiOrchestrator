// The working tools of Loop Engineering: pick an architecture for a task
// (design_loop), diagnose a misbehaving loop (debug_loop), measure whether it
// actually works (eval_loop), and the honesty backbone that debunks the agent
// folklore (myth_vs_reality). Deterministic, offline, BOTTOM-LINE first so the
// orchestrator's synthesis can extract the headline.

import { PATTERNS, resolvePattern } from "./patterns.js";

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

// ── design_loop: task description → recommended architecture ─────────────────
// A deterministic hint layer: scan the task for signals and suggest the pattern
// that fits, always anchored to the "start simple" rule. It recommends, it
// doesn't decide — the honest framing is that the simplest loop that works wins.
interface Signal {
  pattern: keyof typeof PATTERNS;
  cues: string[];
  because: string;
}
const SIGNALS: Signal[] = [
  { pattern: "rag_loop", cues: ["document", "documents", "my data", "knowledge base", "knowledgebase", "search my", "cite", "citation", "pdf", "wiki", "corpus", "manual", "grounded", "hallucinat"], because: "answers must come from specific documents/your data with citations" },
  { pattern: "multi_agent", cues: ["different specialt", "many domains", "route", "routing", "specialist", "in parallel", "fan out", "fan-out", "orchestrat", "sub-agent", "subagent", "teams of"], because: "the work spans genuinely distinct specialties or needs parallel fan-out" },
  { pattern: "plan_execute", cues: ["multi-step", "multi step", "many steps", "long task", "break down", "break it down", "decompose", "plan", "workflow", "sequence of", "pipeline"], because: "it's a longer task where a plan up front (and approval) beats step-by-step guessing" },
  { pattern: "reflexion", cues: ["must pass", "pass tests", "correct", "high quality", "self-correct", "self correct", "revise", "improve its", "critique", "rubric", "accurate"], because: "quality matters and a first draft is often wrong-but-fixable against a check" },
  { pattern: "evaluator_optimizer", cues: ["best of", "rank", "score", "judge", "choose the best", "compare options", "pick the best", "grade"], because: "there's a measurable 'better' and you can spend extra calls to raise quality" },
  { pattern: "human_in_the_loop", cues: ["approval", "approve", "send", "email", "payment", "pay", "delete", "publish", "irreversible", "high stakes", "high-stakes", "confirm", "sign off"], because: "it takes costly/irreversible/outward-facing actions that a human should gate" },
  { pattern: "tool_use", cues: ["call an api", "api", "fetch", "query", "database", "tool", "function", "integrate", "external service"], because: "the agent must reliably call real functions/APIs and handle their errors" },
];

export function designLoop(rawTask: string): string {
  const task = clean(rawTask);
  const hay = task.toLowerCase();
  const matched = SIGNALS.filter((s) => s.cues.some((c) => hay.includes(c)));
  const lines: string[] = [
    `DESIGN A LOOP — "${task}"`,
    `BOTTOM LINE: start with the SIMPLEST loop that could work (a single basic_agent_loop with a hard stop condition), and add structure only when a real failure forces it. Most "I need a multi-agent system" turns out to be one good loop.`,
    ``,
  ];

  if (matched.length === 0) {
    lines.push(
      `No strong signal for a fancier pattern in that description — which usually means the answer is the basic_agent_loop:`,
      `  • STATE (the running transcript) + a model call that picks the next action + an actuator + a hard STOP CONDITION (max steps AND budget).`,
      `  • Add tools with the tool_use discipline (tight schemas, validated args, capped results).`,
      ``,
      `Tell me more (does it touch your documents? take irreversible actions? need multiple specialties? must it pass a check?) and I'll point at the pattern that fits.`,
    );
  } else {
    lines.push(`Signals in your task point at:`);
    for (const s of matched) {
      lines.push(`  ▸ ${PATTERNS[s.pattern].label} — because ${s.because}. (explain_pattern ${s.pattern})`);
    }
    lines.push(
      ``,
      `Recommended shape: build a basic_agent_loop as the spine, then layer the pattern(s) above ONLY where the task demands them. Order of operations:`,
      `  1. Define the STOP CONDITION and the success check first.`,
      `  2. Get a single plain loop working end-to-end on one real example.`,
      `  3. Add the matched pattern(s) one at a time; measure that each actually helps (eval_loop).`,
      `  4. Put guardrails on anything irreversible (human_in_the_loop).`,
    );
  }

  lines.push(
    ``,
    `THE PARTS EVERY LOOP NEEDS, regardless of pattern:`,
    `  • A stop condition (steps + budget) — write it before the loop body.`,
    `  • Observability — log every thought/action/result so you can replay it.`,
    `  • An eval — how you'll KNOW it works, not just that it ran (eval_loop).`,
    `  • Guardrails in CODE for high-stakes actions, not just in the prompt.`,
    ``,
    `Framework specifics (LangGraph vs. a plain while-loop, the current best library) move monthly — verify with check_practice → practice_verdict before committing.`,
  );
  return lines.join("\n");
}

// ── debug_loop: symptom → likely cause + fix ────────────────────────────────
interface Symptom {
  label: string;
  cues: string[];
  causes: string[];
  fixes: string[];
}
const SYMPTOMS: Symptom[] = [
  {
    label: "It never stops / runs forever / loops endlessly",
    cues: ["never stop", "infinite", "forever", "endless", "won't stop", "wont stop", "keeps going", "doesn't finish", "loops", "runaway", "never ends"],
    causes: ["No stop condition, or a stop condition the model can't actually trigger.", "The model keeps re-deciding the same action because nothing in state changes.", "A tool that always 'fails soft', so the agent retries the same call forever."],
    fixes: ["Add a HARD cap: max steps AND a token/time budget, enforced in the loop, not requested in the prompt.", "Add a repeat-detector — same action+args twice → break or escalate.", "Make sure tool results (and errors) actually change the state the model sees, so it can move on."],
  },
  {
    label: "It calls tools over and over / thrashes / picks the wrong tool",
    cues: ["thrash", "wrong tool", "too many tool", "keeps calling", "over and over", "picks the wrong", "tool loop", "bounces between", "flailing"],
    causes: ["Too many tools, or vague/overlapping tool descriptions → the model can't choose well.", "Tool results not fed back clearly, so the model doesn't realize it already has the answer.", "Missing 'you're done' signal, so it keeps 'checking'."],
    fixes: ["Cut the tool set to the essential few; sharpen each description (it's prompt engineering).", "Make results legible and explicit; summarize large results so the signal isn't buried.", "Give a clear final-answer path and reward stopping when the goal is met."],
  },
  {
    label: "It invents tools / makes up tool calls / bad arguments",
    cues: ["hallucinate", "makes up", "invents", "made up", "fake tool", "wrong argument", "bad args", "nonexistent", "made-up"],
    causes: ["Free-text action parsing instead of the provider's structured tool-calling.", "Tool schemas that are loose or don't constrain argument types.", "The model under-informed about which tools exist and their exact shape."],
    fixes: ["Use native/structured tool-calling APIs; validate every call against the schema and reject bad ones.", "Tighten schemas (enums, types, required fields) and echo a clear error back so the model self-corrects.", "Keep the tool list short and unambiguous; a smaller, well-typed set hallucinates far less."],
  },
  {
    label: "It runs out of context / dies mid-task / forgets earlier steps",
    cues: ["context", "window", "out of memory", "forgets", "token limit", "too long", "truncat", "loses track", "mid-task", "blows up"],
    causes: ["Unbounded transcript growth — the window fills around some step you didn't plan for.", "Dumping huge tool results verbatim into context.", "No compaction/summarization strategy for long runs."],
    fixes: ["Budget the context explicitly and compact BEFORE the wall (summarize old turns, keeping IDs/numbers/open threads verbatim).", "Cap and summarize tool results before they enter context.", "Move durable facts to external memory (memory_state pattern) and retrieve on demand."],
  },
  {
    label: "It drifts off task / goes off the rails / does the wrong thing",
    cues: ["drift", "off task", "off-task", "off the rails", "wrong thing", "goes rogue", "tangent", "wanders", "loses the goal", "unrelated"],
    causes: ["The goal isn't restated in state, so it fades as the transcript grows.", "Over-long or contradictory instructions the model averages into mush.", "No check that each step actually advances the stated goal."],
    fixes: ["Keep the goal/success-criteria pinned in every model call, not just the first one.", "Simplify and de-conflict the system prompt; fewer, sharper instructions.", "Add a per-step 'does this move us toward the goal?' check, or a plan_execute spine with re-planning."],
  },
  {
    label: "It's too slow / too expensive / costs too much",
    cues: ["slow", "expensive", "cost", "latency", "too many calls", "burning tokens", "budget", "takes forever", "pricey"],
    causes: ["Too many sequential model calls (over-decomposition or needless reflection rounds).", "A multi-agent committee where one loop would do.", "Re-sending a huge context every step; no caching."],
    fixes: ["Collapse steps: fewer, bigger reasoning turns; drop reflection rounds that don't measurably help.", "Question every agent — default to a single loop; parallelize only genuinely independent work.", "Trim/compact context each turn and use prompt caching where the provider supports it."],
  },
  {
    label: "It's inconsistent / flaky / different answer each time",
    cues: ["inconsistent", "flaky", "different every", "nondeterministic", "random", "unreliable", "sometimes works", "unpredictable", "varies"],
    causes: ["Sampling temperature + brittle parsing amplifying small variations.", "Confusing CONSISTENCY with CORRECTNESS — a stable wrong answer isn't success, and an unstable one hides a real bug.", "No eval, so 'flaky' is a vibe, not a measurement."],
    fixes: ["Lower temperature for decision steps and use structured outputs to kill parse variance.", "Build an eval set (eval_loop) so you can SEE the failure rate instead of guessing.", "For the parts that must be deterministic, do them in CODE, not the model — the way this system's router is deterministic under the model."],
  },
];

export function debugLoop(rawSymptom: string): string {
  const symptom = clean(rawSymptom);
  const hay = symptom.toLowerCase();
  const hit = SYMPTOMS.find((s) => s.cues.some((c) => hay.includes(c)));
  if (!hit) {
    return [
      `DEBUG A LOOP — "${symptom}"`,
      `BOTTOM LINE: first, make it REPLAYABLE — log every thought/action/result. You can't fix a loop you can't watch run.`,
      ``,
      `Which of these is it closest to? Name it and I'll go deep:`,
      ...SYMPTOMS.map((s) => `  ▸ ${s.label}`),
      ``,
      `Universal first moves: (1) add a hard stop condition, (2) log the full trajectory, (3) build a tiny eval so 'broken' becomes a number.`,
    ].join("\n");
  }
  return [
    `DEBUG A LOOP — ${hit.label}`,
    `BOTTOM LINE: this is almost always a loop-engineering problem (stop condition, state, tool plumbing), not a "the model is dumb" problem. Fix the loop around the model.`,
    ``,
    `Likely causes:`,
    ...hit.causes.map((c) => `  • ${c}`),
    ``,
    `Fixes, in order:`,
    ...hit.fixes.map((f) => `  • ${f}`),
    ``,
    `Then PROVE it's fixed with a small eval (eval_loop) — otherwise you've just changed the vibe, not the failure rate.`,
  ].join("\n");
}

// ── eval_loop: how to know the loop actually works ──────────────────────────
export function evalLoop(): string {
  return [
    `EVALUATING AN AGENT LOOP — how you actually KNOW it works`,
    `BOTTOM LINE: the loop running without crashing is not the loop working. Consistency ≠ correctness — a loop can be perfectly stable and perfectly wrong. Build an eval before you trust it, and before you 'improve' it (or you can't tell if the change helped).`,
    ``,
    `THE LEVELS OF EVAL, weakest to strongest:`,
    `  1. It ran — necessary, meaningless alone.`,
    `  2. Consistency — same input → same behavior. Proves stability, NOT correctness. (This system's regression suite lives here.)`,
    `  3. Correctness on a GOLDEN SET — a labeled set of inputs → the right outcome, scored. The first real measurement. (This system's golden-set is exactly this.)`,
    `  4. Robustness — does it still work when the input is rephrased / noisy / adversarial? (This system's paraphrase set.)`,
    `  5. Outcome — did it actually resolve the user's real task? The feedback loop most systems never close.`,
    ``,
    `WHAT TO MEASURE:`,
    `  • Final-answer quality against labels (correctness).`,
    `  • TRAJECTORY, not just the answer — did it take a sane path, or luck into the right answer via a broken route? Two loops with the same answer aren't equal.`,
    `  • Cost & latency per task — quality per dollar/second is a real axis.`,
    `  • Failure MODE breakdown — which step fails, how it fails safe.`,
    ``,
    `LLM-AS-JUDGE, honestly: useful, but biased — it favors longer answers, its own style, and the first option shown. Prefer an OBJECTIVE check (tests, validators, exact-match, retrieval hit@k) whenever one exists; only reach for an LLM judge when quality is genuinely subjective, and then randomize order, control for length, and spot-check it against human labels.`,
    ``,
    `THE DISCIPLINE: label by INTENT (what the right answer is), never by what the system currently does — or your number is a lie. Gate changes on the eval so quality can't silently regress. Make failures fail SAFE (fall back to a generalist / ask a human) rather than fail wrong.`,
    ``,
    `This entire system was built this way: regression (consistency) + golden (correctness) + paraphrase (robustness) + outcome labels. That's the model to copy.`,
  ].join("\n");
}

// ── myth_vs_reality: the honesty backbone ───────────────────────────────────
export function mythVsReality(): string {
  const myths: [string, string][] = [
    ["'More agents = better. Build a multi-agent system.'", "Usually the opposite. Every added agent adds latency, cost, and failure surface, and committees drift and contradict each other. A single well-built loop beats a committee for most tasks. Reach for multi-agent only when scopes are genuinely distinct or you need parallelism — then measure that it actually helped."],
    ["'Just add a reflection step and it'll fix its own mistakes.'", "Only if the reflection has something OBJECTIVE to push against (tests, a validator, a tool result). A model grading its own free-text output will confidently bless a wrong answer. Self-critique without a ground-truth check plateaus fast — often after one round."],
    ["'The model will figure out the loop / the agent is basically autonomous.'", "The model picks next actions; YOU build the loop — stop conditions, state, tool plumbing, error handling, guardrails. The hard, failure-prone part is the loop engineering around the model, not the model. 'Agentic' is not 'autonomous'."],
    ["'Temperature 0 makes it deterministic.'", "It reduces sampling variance but does NOT guarantee identical outputs (batching, hardware, provider changes still vary it), and it does nothing for correctness. If a step MUST be deterministic, do it in code, not the model."],
    ["'It's consistent, so it works.'", "Consistency is stability, not correctness — a loop can return the same wrong answer every time. You need a labeled eval to know it's RIGHT, not just stable. This is the single most common self-deception in agent building."],
    ["'RAG doesn't work' / 'the model keeps hallucinating over my docs.'", "Almost always a RETRIEVAL problem, not a model problem: if the right chunk isn't in the top-k, no model can ground on it. Measure retrieval separately (hit@k) before blaming the generator — usually chunking or the index is the fix."],
    ["'Prompt it not to do the dangerous thing and you're safe.'", "A prompt is a suggestion, not a limit. Real guardrails are enforced in CODE — allow-lists, spend caps, scope limits, validated arguments. Anything irreversible or outward-facing needs a hard gate, not a polite instruction."],
    ["'Bigger model / better prompt is the answer to a flaky agent.'", "Most agent failures are loop bugs: no stop condition, unbounded context, swallowed tool errors, vague tool descriptions. Swapping the model hides those for a while, then they come back. Fix the loop first."],
  ];
  return [
    `AGENTIC LOOP MYTHS vs REALITY — the folklore that burns people (and the honest version)`,
    ``,
    ...myths.map(([m, r]) => `▸ MYTH: ${m}\n   REALITY: ${r}`),
    ``,
    `The real takeaway: the intelligence is in the model; the ENGINEERING is in the loop. Stop conditions, evals, retrieval quality, and code-enforced guardrails are what separate a demo from something you can trust. Anyone promising an autonomous agent that "just works" with no eval is selling the myth.`,
  ].join("\n");
}
