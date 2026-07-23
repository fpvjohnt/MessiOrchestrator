// PROMPT ENGINEERING — the vendor-neutral craft of getting reliable output from
// any LLM. Three lenses:
//   techniques  — the named moves (zero/few-shot, chain-of-thought, self-
//                 consistency, role, decomposition, ReAct/tree-of-thought)
//   structure   — how to shape a prompt (anatomy, XML/delimiters, output format,
//                 examples)
//   reliability — making it hold up (iteration/eval, anti-patterns, robustness/
//                 injection, and the reasoning-model caveat)
//
// SCOPE LINE: this asset owns prompt-engineering TECHNIQUE — provider-neutral,
// the moves that work across models. It does NOT own: the OpenAI/ChatGPT-specific
// prompt shape and product modes (that's 'openai'), prompt-as-guardrail inside an
// agent LOOP or multi-agent design (that's 'loop'), or fine-tune-vs-RAG-vs-prompt
// as a build decision (that's 'aiforge'). Prompting best-practice drifts with
// model generations, so anything model-specific is verified via check_practice →
// practice_verdict, not asserted from memory.
//
// Same reverse-index shape as aiforge/gitforge topics.ts.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Area = "techniques" | "structure" | "reliability";

export const AREA_LABELS: Record<Area, string> = {
  techniques: "Techniques — the named moves",
  structure: "Structure — shaping the prompt",
  reliability: "Reliability — making it hold up",
};

export interface Topic {
  label: string;
  keys: string[];
  area: Area;
  what: string;
  why: string;
  key_ideas: string[];
  how: string[];
  pitfalls: string[];
  handoff: string;
}

export const TOPICS: Record<string, Topic> = {
  // ── Techniques ────────────────────────────────────────────────────────────
  zero_shot: {
    label: "Zero-shot prompting",
    keys: ["zeroshot", "zero", "instructiononly", "plainprompt", "directprompt"],
    area: "techniques",
    what: "Just ask, with a clear instruction and no examples. The baseline you should always try first before adding machinery.",
    why: "Modern models are strong zero-shot; a lot of 'I need few-shot / fine-tuning' turns out to be 'my instruction was vague'. Start here.",
    key_ideas: [
      "A good zero-shot prompt is specific about the task, the audience, the format, and the constraints — vagueness is the #1 failure.",
      "It's the cheapest option (no example tokens) and the right default for well-known tasks.",
      "If zero-shot is unreliable, the next lever is usually a clearer instruction or a couple of examples — not a bigger model.",
    ],
    how: [
      "State the task, then the output format and any hard constraints explicitly: 'Summarize the email below in 3 bullets, each under 12 words. Output only the bullets.'",
      "Name what to do, not just what to avoid — positive instructions beat a pile of 'don't's.",
      "Measure it before deciding it's not enough (→ iteration_evaluation).",
    ],
    pitfalls: [
      "Blaming the model when the instruction was ambiguous — the model filled the gap with a guess.",
      "Skipping zero-shot and jumping to few-shot/fine-tuning for a task the model already does well.",
      "Piling on constraints instead of stating the one format you want clearly.",
    ],
    handoff: "Adding examples → 'few_shot' (this asset). Whether to prompt vs RAG vs fine-tune → 'aiforge finetune_vs_rag_vs_prompt'.",
  },
  few_shot: {
    label: "Few-shot prompting",
    keys: ["fewshot", "examples", "exemplars", "incontext", "incontextlearning", "demonstrations", "shots"],
    area: "techniques",
    what: "Show 3–5 diverse worked examples of input→output inside the prompt. One of the highest-ROI techniques: examples control behavior better than more instructions.",
    why: "When you need a specific format, tone, or edge-case handling, a few good examples 'show' it far more reliably than paragraphs of description.",
    key_ideas: [
      "3–5 DIVERSE examples usually beats both zero-shot and a longer instruction — variety teaches the boundaries, not just the center.",
      "Examples demonstrate the exact output format and how to handle tricky cases; the model pattern-matches them.",
      "Wrap examples in clear delimiters (XML tags or consistent markers) so the model sees where each begins and ends (→ structured_prompting).",
      "Example QUALITY and consistency matter more than quantity — one wrong example poisons the pattern.",
    ],
    how: [
      "Pick examples that cover the range (typical + edge cases), format them identically, and label input/output clearly.",
      "Include a hard/ambiguous case with the correct handling — that's what few-shot buys you over zero-shot.",
      "Keep them short; examples are recurring token cost on every call (→ aiforge cost_latency).",
    ],
    pitfalls: [
      "Inconsistent example formatting — the model copies the inconsistency.",
      "All examples looking alike (same shape) → the model overfits to that one shape and fails on variants.",
      "A single incorrect example silently teaching the wrong pattern.",
    ],
    handoff: "Combining with reasoning → 'chain_of_thought' (this asset). Choosing/placing examples in context → 'context_examples' (this asset).",
  },
  chain_of_thought: {
    label: "Chain-of-thought (CoT)",
    keys: ["chainofthought", "cot", "stepbystep", "thinkstepbystep", "reasoningsteps", "letsthink"],
    area: "techniques",
    what: "Ask the model to reason step by step before answering. It raises accuracy on multi-step problems (math, logic, complex extraction) by giving the model room to work.",
    why: "For anything requiring intermediate reasoning, letting the model 'show its work' materially improves correctness — and makes errors visible.",
    key_ideas: [
      "'Think step by step' (zero-shot CoT) or a few examples that INCLUDE the reasoning (few-shot CoT) — the latter is stronger for hard tasks.",
      "CoT + few-shot layered together outperforms either alone on complex problems.",
      "CRUCIAL 2026 caveat: SKIP explicit CoT for reasoning models (OpenAI o-series, Claude extended thinking, Gemini thinking mode) — they already reason internally, and forcing it can hurt. Just ask clearly.",
      "The visible reasoning is also a debugging aid — you can see WHERE it went wrong.",
    ],
    how: [
      "Non-reasoning model + a multi-step task: add 'Work through it step by step, then give the final answer as …'.",
      "Provide 1–2 examples that show the reasoning explicitly for the hardest tasks.",
      "Reasoning model: DON'T add 'think step by step' — give a clear task and let it think; check_practice for the current model's guidance.",
    ],
    pitfalls: [
      "Forcing CoT on a reasoning model — redundant at best, degrading at worst. Know which kind of model you're prompting.",
      "Trusting the reasoning as proof — a fluent chain can rationalize a wrong answer; verify the RESULT.",
      "Paying for long reasoning on trivial tasks where zero-shot was fine.",
    ],
    handoff: "The reasoning-model caveat in depth → 'reasoning_models' (this asset). Reasoning as an agent-loop pattern (ReAct/reflexion) → 'loop explain_pattern'.",
  },
  self_consistency: {
    label: "Self-consistency & sampling for reliability",
    keys: ["selfconsistency", "voting", "majorityvote", "sampling", "ensemble", "consistency", "multisample"],
    area: "techniques",
    what: "Sample the model several times (with some temperature) and take the majority answer. For hard reasoning tasks, the consensus of N runs beats a single run.",
    why: "A single generation can slip on a hard problem; polling several independent attempts and voting is a cheap accuracy boost when correctness matters.",
    key_ideas: [
      "Generate N answers (with temperature > 0 for diversity), then pick the most common final answer — errors are often uncorrelated, correct answers cluster.",
      "Best for tasks with a checkable/discrete answer (math, classification), less so for open-ended text.",
      "It trades cost (N× calls) for reliability — use it where a wrong answer is expensive.",
    ],
    how: [
      "Run the same CoT prompt N times at moderate temperature; extract each final answer; return the majority.",
      "For code or math, you can VERIFY each candidate (run it) instead of voting — even stronger.",
      "Reserve it for the hard, high-stakes fraction of inputs, not every request (→ cost).",
    ],
    pitfalls: [
      "Using it on open-ended generation where there's no 'majority' to take.",
      "Ignoring the N× cost/latency — it's a targeted tool, not a default.",
      "Voting over correlated errors — if all runs share the same wrong assumption, consensus is confidently wrong.",
    ],
    handoff: "Maker≠checker verification as a loop pattern → 'loop' (evaluator-optimizer). Measuring the gain → 'iteration_evaluation' (this asset).",
  },
  role_persona: {
    label: "Role & persona prompting",
    keys: ["role", "persona", "roleprompt", "systemrole", "actas", "youare", "expert", "roleplay"],
    area: "techniques",
    what: "Set a role or perspective ('You are a senior security reviewer…') to steer tone, depth, and priorities. Useful — but modest, and often overrated.",
    why: "A role can usefully bias vocabulary, rigor, and what the model attends to. It's a steering nudge, not magic, and best combined with concrete instructions.",
    key_ideas: [
      "A role mainly shifts TONE and FOCUS (what the model prioritizes), not raw capability — 'act as a PhD' doesn't add knowledge it lacks.",
      "Most effective when the role implies concrete behavior you then also state ('a security reviewer' + 'flag every injection risk with severity').",
      "Put durable role/instructions in the system prompt; put the specific task in the user turn.",
    ],
    how: [
      "Use a role to set perspective, then back it with explicit criteria: 'As an accessibility auditor, check each element against WCAG AA and list violations by severity.'",
      "Keep it truthful and useful, not theatrical — the role should encode a real evaluation lens.",
      "Combine with format + constraints; role alone rarely fixes a vague prompt.",
    ],
    pitfalls: [
      "Believing a persona grants expertise the model doesn't have — it changes style, not ground truth.",
      "Over-elaborate personas that add tokens and drama but no behavioral signal.",
      "Relying on 'you are a helpful expert' as if it were a technique — it's noise without concrete instructions.",
    ],
    handoff: "System-vs-user prompt placement → 'prompt_anatomy' (this asset). ChatGPT-specific personalization/custom-instructions → 'openai'.",
  },
  decomposition: {
    label: "Decomposition & prompt chaining",
    keys: ["decomposition", "decompose", "promptchaining", "chaining", "subtasks", "pipeline", "breakdown", "steps"],
    area: "techniques",
    what: "Split a big task into smaller prompts, each doing one thing well, and pipe the output of one into the next. Reliability comes from small, checkable steps.",
    why: "A single mega-prompt asked to do five things does each worse. Chaining focused prompts — extract, then transform, then format — is more accurate and debuggable.",
    key_ideas: [
      "One prompt = one clear job. Chain them: step A's structured output becomes step B's input.",
      "Each step is independently testable and fixable — you can see which stage failed instead of debugging one giant prompt.",
      "Between steps, validate/parse the intermediate output (structured output helps) so errors don't cascade.",
    ],
    how: [
      "Decompose the goal into 2–4 stages; make each stage emit structured output the next stage consumes.",
      "Test each stage in isolation with its own examples; assemble once each works.",
      "When a chain gets branchy/stateful, that's where prompt engineering ends and agent ARCHITECTURE begins → 'loop'.",
    ],
    pitfalls: [
      "One prompt trying to do everything — lower accuracy and impossible to debug.",
      "Not validating between steps → a garbled intermediate silently poisons the rest.",
      "Over-decomposing a simple task into a fragile 6-call chain when one prompt would do.",
    ],
    handoff: "When chaining becomes a control-flow/agent problem → 'loop explain_pattern plan_execute'. Structured hand-offs between steps → 'aiforge structured_output'.",
  },
  advanced_reasoning: {
    label: "Advanced reasoning prompts (ReAct, tree-of-thought, meta)",
    keys: ["react", "treeofthought", "tot", "metaprompting", "meta", "reasonact", "deliberation", "advancedreasoning"],
    area: "techniques",
    what: "Higher-order patterns: ReAct (reason + act with tools), tree-of-thought (explore multiple reasoning branches), and meta-prompting (have the model draft/critique the prompt itself).",
    why: "For genuinely hard problems these can help — but they cost a lot more and are often overkill. Know they exist; reach for them only when simpler prompting provably falls short.",
    key_ideas: [
      "ReAct interleaves reasoning with tool calls — but as a running agent it's really a LOOP pattern (that's 'loop'); as a prompt it's 'reason, then act, observe, repeat'.",
      "Tree-of-thought explores several reasoning paths and picks the best — powerful on puzzles, expensive and rarely needed in production.",
      "Meta-prompting: ask the model to improve your prompt, or to generate the rubric it will be judged by — useful for prompt development.",
    ],
    how: [
      "Try zero-shot → few-shot → CoT → self-consistency FIRST; only escalate to ToT/ReAct when an eval shows they're needed.",
      "Use meta-prompting during DEVELOPMENT (draft-critique-refine your prompt), not necessarily in production.",
      "If you're building ReAct as a running agent, go to 'loop' — that's architecture, not a single prompt.",
    ],
    pitfalls: [
      "Reaching for tree-of-thought/ReAct because they sound sophisticated — huge cost for a task few-shot handled.",
      "Confusing the ReAct PROMPT with the ReAct agent LOOP (state, tools, stop condition) — the latter is loop's domain.",
      "Trusting meta-prompted 'improvements' without measuring them.",
    ],
    handoff: "ReAct/reflexion/tree-of-thought as running agent ARCHITECTURES → 'loop explain_pattern'. Verifying a technique still wins → 'check_practice'.",
  },

  // ── Structure ─────────────────────────────────────────────────────────────
  prompt_anatomy: {
    label: "Prompt anatomy — the parts of a strong prompt",
    keys: ["anatomy", "structure", "megaprompt", "promptstructure", "systemprompt", "parts", "template", "sections"],
    area: "structure",
    what: "A reliable prompt has recognizable parts: role/system, task/goal, context/background, the input data, examples, output format, constraints, and error handling.",
    why: "Most weak prompts are missing one of these. Naming the parts turns 'write a good prompt' into a checklist you can actually complete.",
    key_ideas: [
      "The full ('mega') prompt shape: (1) role, (2) task/goal, (3) background/context, (4) explicit instructions, (5) input data, (6) few-shot examples, (7) output format spec, (8) constraints, (9) what to do on uncertainty/errors.",
      "System prompt = durable role + rules that persist; user turn = the specific task + data. Keep them separated by purpose.",
      "Delimit the sections clearly (headings, XML tags) so the model can tell instructions from data (→ structured_prompting).",
      "Not every prompt needs all nine parts — but a failing prompt is usually missing the format spec, the constraints, or an example.",
    ],
    how: [
      "Draft against the checklist: is the goal explicit? the format specified? the constraints stated? at least one example if the format is non-obvious?",
      "Put stable instructions in the system prompt; interpolate the variable input in a clearly-marked data section.",
      "State how to handle uncertainty ('if the answer isn't in the context, say you don't know') — models guess otherwise.",
    ],
    pitfalls: [
      "No output-format spec → inconsistent shape you then have to parse defensively.",
      "Mixing instructions and input data with no delimiter → the model treats your data as commands (or vice versa).",
      "A wall of prose with the actual ask buried in the middle.",
    ],
    handoff: "Delimiting with XML/markdown → 'structured_prompting' (this asset). The OpenAI-specific Goal/Context/Output/Boundaries shape → 'openai explain_primitive chatgpt'.",
  },
  structured_prompting: {
    label: "Structured prompting — XML tags & delimiters",
    keys: ["structuredprompting", "xml", "xmltags", "delimiters", "markdown", "tags", "formatting"],
    area: "structure",
    what: "Use explicit delimiters — XML tags, markdown headings, fenced blocks — to separate instructions, context, examples, and data. In 2026 this is a critical technique for complex prompts.",
    why: "Structure removes ambiguity about what's an instruction vs what's data, which is both a quality win and a prompt-injection defense. Anthropic's guidance emphasizes XML tags for complex prompts.",
    key_ideas: [
      "Wrap distinct parts in tags: <instructions>…</instructions>, <context>…</context>, <example>…</example>, <data>…</data>. The model attends to boundaries.",
      "Delimiting user/retrieved DATA is also a safety measure — it helps the model treat that content as data, not instructions (partial injection mitigation, not a cure).",
      "Consistent, named sections make long prompts legible to the model AND to you when you iterate.",
      "Markdown headings and fenced code blocks work too; XML tags are especially clear for nesting examples.",
    ],
    how: [
      "Tag every section of a complex prompt; reference the tags in your instructions ('Using only the text in <context>, …').",
      "Put untrusted/user/retrieved content inside a clearly-labeled data block and tell the model it's data to analyze, not instructions to follow.",
      "Keep the scheme consistent across examples and the live input.",
    ],
    pitfalls: [
      "Treating delimiters as a full injection defense — they help, but a real guardrail is code that validates the output (→ aiforge fm_guardrails).",
      "Inconsistent or unclosed tags that confuse rather than clarify.",
      "Over-tagging a simple prompt into unreadable soup.",
    ],
    handoff: "Injection defense in depth → 'robustness_injection' (this asset) and 'aiforge fm_guardrails'. Machine-readable OUTPUT (not input) structure → 'output_formatting' (this asset).",
  },
  output_formatting: {
    label: "Output formatting & control",
    keys: ["outputformat", "outputformatting", "format", "jsonoutput", "schema", "responseformat", "constrainoutput", "structuredoutput"],
    area: "structure",
    what: "Specify EXACTLY what the output should look like — and, when it feeds code, use the model/API's structured-output/JSON mode rather than hoping prose parses.",
    why: "'It answered right but in the wrong shape' is a top integration failure. Controlling the output format is half of reliable prompting.",
    key_ideas: [
      "Say the format precisely: 'Return only a JSON object with keys x (string) and y (number). No prose, no markdown fences.'",
      "For code-consumed output, prefer the provider's structured-output/JSON/tool-calling mode over prompt-only formatting (→ aiforge structured_output).",
      "Give an example of the exact output when the format is non-obvious — showing beats describing.",
      "Constrain length and enumerate allowed values for classification ('respond with exactly one of: A, B, C').",
    ],
    how: [
      "State the schema and forbid extras ('output only the JSON'); provide one filled-in example.",
      "When it must feed code, move formatting responsibility to structured-output mode and still validate the parsed object.",
      "For classification, list the exact allowed labels and say 'exactly one'.",
    ],
    pitfalls: [
      "Prompt-only 'return JSON' without validation — it'll wrap it in prose or a code fence eventually. Validate, and prefer real structured output.",
      "Under-specifying the format and then writing brittle regex to parse whatever came back.",
      "Not bounding length/labels → verbose or out-of-set answers.",
    ],
    handoff: "The API/library mechanics of structured output & validation → 'aiforge structured_output'. OpenAI's Structured Outputs specifically → 'openai'.",
  },
  context_examples: {
    label: "Context & example selection",
    keys: ["context", "contextwindow", "exampleselection", "retrieval", "grounding", "contextmanagement", "relevantcontext", "lostinthemiddle"],
    area: "structure",
    what: "What you put IN the prompt — which context, which examples, in what order — often matters more than the wording. Relevant, well-placed context beats more context.",
    why: "Models attend unevenly to long inputs ('lost in the middle') and every token costs. Curating context is a core prompt-engineering skill, not an afterthought.",
    key_ideas: [
      "Relevance over volume: a few on-point chunks/examples beat dumping everything — long context dilutes attention and raises cost.",
      "Placement matters: critical instructions and the most relevant context near the start or end tend to land better than buried in the middle.",
      "For knowledge the model lacks, retrieve and inject it (RAG) rather than hoping it 'knows' — and tell it to use only that context.",
      "Choose few-shot examples that resemble the actual input distribution (relevance), not just any examples.",
    ],
    how: [
      "Retrieve/select the minimum context that answers the task; put the instruction and key data where the model attends.",
      "Tell the model to ground its answer in the provided context and to say 'not in the context' otherwise.",
      "Trim ruthlessly and measure — more tokens is not more quality.",
    ],
    pitfalls: [
      "Stuffing the whole document 'to be safe' — dilution + cost + 'lost in the middle'.",
      "Irrelevant few-shot examples that don't match the real inputs.",
      "Assuming the model read the huge context carefully — it may have skimmed the middle.",
    ],
    handoff: "The RAG plumbing that selects context → 'aiforge langchain_retrieval'. Context cost/latency trade → 'aiforge cost_latency'. Long-context in an agent loop → 'loop'.",
  },

  // ── Reliability ───────────────────────────────────────────────────────────
  iteration_evaluation: {
    label: "Iterating & evaluating prompts",
    keys: ["iteration", "evaluation", "eval", "testing", "measure", "abtest", "promptiteration", "goldenset", "improve"],
    area: "reliability",
    what: "Prompt engineering is empirical: change one thing, measure it against a fixed set of test cases, keep what wins. Tuning by vibes is how prompts silently regress.",
    why: "Without an eval you can't tell whether an edit helped or hurt — and a prompt that 'feels better' often trades one failure for another. The test set is what makes it engineering.",
    key_ideas: [
      "Build a small golden set (15–50 representative inputs with known-good or checkable outputs), including the failures you've actually seen.",
      "Change ONE variable at a time and re-run the whole set — otherwise you can't attribute the change.",
      "Consistency ≠ correctness: stable output isn't necessarily right; score correctness against the golden set separately.",
      "LLM-as-judge can scale scoring but has bias — validate the judge against human labels on a sample first.",
    ],
    how: [
      "Write the golden set before heavy tuning; re-run it on every prompt/model change; track the score.",
      "Keep a held-out set you did NOT tune on, to catch overfitting to your examples.",
      "Log real production failures back into the set so regressions can't hide.",
    ],
    pitfalls: [
      "Tuning on the same examples you test on — grading your own homework.",
      "Changing several things at once, then not knowing which helped.",
      "One aggregate score hiding which slice broke — segment it.",
    ],
    handoff: "The deeper eval theory (trajectory, LLM-judge limits) for agents → 'loop eval_loop'. Integration-level evals → 'aiforge fm_evaluation'.",
  },
  anti_patterns: {
    label: "Prompt anti-patterns",
    keys: ["antipatterns", "antipattern", "mistakes", "badprompt", "vague", "overstuffed", "conflicting", "commonerrors"],
    area: "reliability",
    what: "The recurring mistakes that make prompts unreliable: vagueness, over-stuffing, conflicting instructions, negative-only phrasing, and burying the ask.",
    why: "Most 'the model is bad at this' is really an anti-pattern in the prompt. Recognizing them is faster than any technique.",
    key_ideas: [
      "VAGUENESS — 'summarize this well' with no length, audience, or format. The model guesses; you get inconsistency.",
      "OVER-STUFFING — one prompt asked to do five jobs, or 20 constraints that conflict. Decompose (→ decomposition).",
      "NEGATIVE-ONLY — a list of 'don't's with no positive instruction of what TO do; state the desired behavior.",
      "CONFLICTING instructions ('be concise' + 'explain thoroughly') — the model can't satisfy both; pick one.",
      "BURIED ASK — the actual task hidden mid-paragraph under context; lead with it or delimit it.",
    ],
    how: [
      "Run the checklist: is the goal explicit, the format specified, the constraints non-conflicting, the ask up front?",
      "Replace 'don't be verbose' with 'answer in ≤3 sentences'. Replace 'summarize well' with the exact spec.",
      "If the prompt does many things, split it (→ decomposition).",
    ],
    pitfalls: [
      "Adding MORE words to fix a vague prompt instead of making it specific.",
      "Stacking constraints until they contradict.",
      "Assuming the model 'knows what you mean' — it optimizes the literal prompt.",
    ],
    handoff: "Fixing structure → 'prompt_anatomy' (this asset). Splitting an over-stuffed prompt → 'decomposition' (this asset).",
  },
  robustness_injection: {
    label: "Robustness & prompt injection",
    keys: ["robustness", "promptinjection", "injection", "jailbreak", "adversarial", "security", "untrusted", "safety"],
    area: "reliability",
    what: "Making a prompt hold up against messy and adversarial input — including prompt injection, where untrusted content carries instructions that hijack the model.",
    why: "Any prompt that includes user or retrieved content is an attack surface. Prompt-level defenses help but are NOT sufficient; the real guardrail is code around the model.",
    key_ideas: [
      "Prompt injection: text in the DATA ('ignore previous instructions and…') gets followed as if it were your instruction. Retrieved/tool content is a common vector.",
      "Delimiting data (XML tags) and instructing the model to treat it as data-only REDUCES but does not eliminate injection — it's not a cure.",
      "A prompt is not a guardrail. Real safety = code that validates/limits the OUTPUT before it acts, plus least-privilege on any tools.",
      "Test with adversarial inputs (the nastiest strings you can invent) as part of the eval.",
    ],
    how: [
      "Separate and label untrusted content; tell the model its job is to analyze that content, not obey it.",
      "Validate the output against a schema/policy before anything acts on it; require confirmation for consequential actions.",
      "Red-team your prompt with injection attempts and jailbreaks and fix what leaks (→ iteration_evaluation).",
    ],
    pitfalls: [
      "'I told it to ignore injected instructions' as the ONLY defense — determined input gets around it.",
      "Trusting retrieved/tool content as safe because it's 'internal'.",
      "No output validation, so a hijacked response acts downstream.",
    ],
    handoff: "Guardrails as CODE (validation, moderation, least-privilege) → 'aiforge fm_guardrails'. Guardrails in the agent loop → 'loop'.",
  },
  reasoning_models: {
    label: "Prompting reasoning models (the caveat)",
    keys: ["reasoningmodels", "reasoning", "oseries", "extendedthinking", "thinkingmode", "reasoningmodel", "o1", "thinking"],
    area: "reliability",
    what: "Reasoning models (OpenAI o-series, Claude extended thinking, Gemini thinking mode) reason internally — so the prompting rules change: give them a clear goal and get OUT of the way.",
    why: "Techniques tuned for older chat models (verbose CoT scaffolding, elaborate step-by-step coaxing) can HURT reasoning models. Knowing which kind you're prompting matters.",
    key_ideas: [
      "Reasoning models already do chain-of-thought internally — adding 'think step by step' is redundant and can degrade output.",
      "Prompt them with a clear objective, the constraints, and the success criteria; let them plan. Less scaffolding, not more.",
      "They cost more per call and take longer — use them for genuinely hard tasks, not everything.",
      "Which model is a 'reasoning' model, and its specific prompting guidance, is version-specific — verify it (→ check_practice).",
    ],
    how: [
      "For a reasoning model: state the goal + constraints + what 'done' looks like, then stop. Skip the CoT boilerplate.",
      "For a standard chat model: the classic techniques (few-shot, explicit CoT) apply.",
      "Confirm the current model's guidance before optimizing — it changes per generation.",
    ],
    pitfalls: [
      "Applying old-model CoT scaffolding to a reasoning model and degrading it.",
      "Using an expensive reasoning model for a task a cheap model nailed zero-shot.",
      "Assuming all models want the same prompt — they don't; know the class.",
    ],
    handoff: "Provider-specific model IDs and guidance → 'openai' (OpenAI) / 'check_practice' (current facts). Chain-of-thought basics → 'chain_of_thought' (this asset).",
  },
};

export function resolveTopic(input: string): string | undefined {
  const q = normalize(input);
  if (!q) return undefined;
  if (TOPICS[q]) return q;
  for (const [key, t] of Object.entries(TOPICS)) {
    if (normalize(key) === q) return key;
    if (normalize(t.label) === q) return key;
    if (t.keys.some((k) => normalize(k) === q)) return key;
  }
  const scored: Array<{ key: string; len: number }> = [];
  for (const [key, t] of Object.entries(TOPICS)) {
    for (const k of [key, ...t.keys]) {
      const nk = normalize(k);
      if (nk.length >= 3 && (q.includes(nk) || nk.includes(q))) scored.push({ key, len: nk.length });
    }
  }
  if (!scored.length) return undefined;
  scored.sort((a, b) => b.len - a.len);
  return scored[0].key;
}

function topicsByArea(area: Area): string[] {
  return Object.entries(TOPICS)
    .filter(([, t]) => t.area === area)
    .map(([k]) => k);
}

export function explainTopic(topic?: string): string {
  if (!topic) {
    const areas = Object.keys(AREA_LABELS) as Area[];
    return [
      `PROMPT ENGINEERING — the vendor-neutral craft of reliable LLM output`,
      `BOTTOM LINE: prompting is empirical and layered — start simple (clear zero-shot), add examples/structure/reasoning only when an eval says you need them. Pick a topic; the 'pitfalls' are the part worth reading.`,
      ``,
      ...areas.flatMap((area) => [
        `${AREA_LABELS[area]}:`,
        ...topicsByArea(area).map((k) => `  ▸ ${TOPICS[k].label} — 'explain_topic ${k}'`),
        ``,
      ]),
      `Other tools: build_prompt <goal> (a structured prompt scaffold + technique picks), improve_prompt <your prompt> (critique + fixes), myth_vs_reality, and check_practice → practice_verdict for model-specific/current guidance.`,
      ``,
      `SCOPE: provider-neutral prompt TECHNIQUE. OpenAI/ChatGPT-specific prompt shape & modes → 'openai'. Prompt-as-guardrail / prompts inside an agent loop → 'loop'. Prompt-vs-RAG-vs-fine-tune as a build choice → 'aiforge'.`,
    ].join("\n");
  }
  const key = resolveTopic(topic);
  if (!key) {
    return `Not sure which prompt-engineering topic "${clean(topic)}" is. Topics: ${Object.values(TOPICS)
      .map((t) => t.label)
      .join(", ")}.`;
  }
  const t = TOPICS[key];
  return [
    `${t.label}  [${AREA_LABELS[t.area]}]${normalize(topic) !== normalize(key) ? ` (from "${clean(topic)}")` : ""}`,
    `BOTTOM LINE: ${t.what}`,
    ``,
    `Why it matters: ${t.why}`,
    ``,
    `The key ideas:`,
    ...t.key_ideas.map((k) => `  • ${k}`),
    ``,
    `How you actually do it:`,
    ...t.how.map((h) => `  → ${h}`),
    ``,
    `⚠ PITFALLS that burn people:`,
    ...t.pitfalls.map((p) => `  ✗ ${p}`),
    ``,
    `Handoff: ${t.handoff}`,
    ``,
    `Prompting best-practice drifts with model generations (especially reasoning models) — anything model-specific is verified via check_practice → practice_verdict, never recalled.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is the prompt-engineering expert — provider-neutral technique for getting reliable output from any LLM. The craft is empirical and layered: start with the simplest clear prompt, measure it, and add machinery only when an eval says you need it.`,
    ``,
    `THREE LENSES:`,
    `  • TECHNIQUES — zero-shot, few-shot, chain-of-thought, self-consistency, role/persona, decomposition, advanced (ReAct/tree-of-thought/meta) → 'explain_topic techniques'.`,
    `  • STRUCTURE — prompt anatomy (the parts of a strong prompt), XML/delimiter structuring, output formatting, context & example selection → 'explain_topic structure'.`,
    `  • RELIABILITY — iterating & evaluating, anti-patterns, robustness & prompt injection, and prompting REASONING models → 'explain_topic reliability'.`,
    ``,
    `THE TOOLS:`,
    `  • 'explain_topic <topic>' — the front door; no arg for the full map.`,
    `  • 'build_prompt <goal>' — a structured prompt scaffold for your task + which techniques fit.`,
    `  • 'improve_prompt <your prompt>' — a critique against the anti-patterns + concrete fixes.`,
    `  • 'myth_vs_reality' — 'a good persona makes it smarter', 'longer prompts are better', 'temperature 0 is deterministic', 'more examples always help'.`,
    `  • 'check_practice' → 'practice_verdict' — model-specific/current guidance (especially reasoning models), verified via research.`,
    ``,
    `THE BIGGEST 2026 CAVEAT: reasoning models (o-series, Claude extended thinking, Gemini thinking) reason internally — skip the 'think step by step' scaffolding and just give a clear goal. Old-model techniques can HURT them. Know which class you're prompting.`,
    ``,
    `SCOPE: technique only. OpenAI/ChatGPT-specific prompt shape → 'openai'. Prompt-as-guardrail / prompts in an agent loop → 'loop'. Prompt-vs-RAG-vs-fine-tune → 'aiforge'.`,
  ].join("\n");
}
