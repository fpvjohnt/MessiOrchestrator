// build_it / debug / myth_vs_reality — the doing tools. Deterministic and
// offline: build_it scans the task for signals and recommends an approach +
// stack + first step (always "simplest thing that works first"); debug maps a
// symptom to the likely cause and the fix in order; myth_vs_reality debunks the
// folklore that burns AI builders. Same shape as loop's toolkit.ts.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

// ── build_it ────────────────────────────────────────────────────────────────
export function buildIt(rawTask: string): string {
  const task = clean(rawTask).toLowerCase();
  const signals: string[] = [];
  const stack: string[] = [];

  // What KIND of task is it?
  const isClassify = has(task, "classif", "categor", "label", "sentiment", "spam", "route ", "triage", "tag ", "tagging", "intent");
  const isExtract = has(task, "extract", "pull out", "named entit", " ner", "parse", "structured", "fields from");
  const isKnowledge = has(task, "our docs", "knowledge base", "company data", "answer questions about", "over my", "from my documents", "about our", "internal doc", "wiki", "pdf");
  const isSearch = has(task, "search", "similar", "recommend", "retriev", "semantic", "find related", "dedup");
  const isGenerate = has(task, "generate", "write", "draft", "summar", "rewrite", "compose", "chatbot", "assistant", "answer");
  const isStyle = has(task, "in our voice", "tone", "style", "always respond", "consistent format", "specific format", "brand voice");
  const isAgent = has(task, "agent", "multi-step", "tools", "take actions", "autonomous", "workflow", "browse", "operate");
  const wantsLocal = has(task, "local", "offline", "on-prem", "on prem", "private", "no data leaves", "on my machine", "on-device");
  const highVolume = has(task, "millions", "high volume", "at scale", "every ", "thousands of", "batch");

  const lines: string[] = [
    `BUILD IT — "${clean(rawTask)}"`,
    `BOTTOM LINE: pick the SIMPLEST approach that could work, wire an eval around it, and only add machinery when the eval says you need it. Here's the starting shape:`,
    ``,
  ];

  // Recommend an approach.
  if (isClassify || isExtract) {
    signals.push(isClassify ? "a classification/labeling task" : "a structured-extraction task");
    lines.push(`APPROACH: This is a NARROW, well-defined task — do NOT default to a big LLM.`);
    if (highVolume) {
      lines.push(`  • High volume → a small fine-tuned encoder (DistilBERT/BERT) or even TF-IDF + logistic regression will beat an LLM on cost, latency, AND consistency. Baseline that first.`);
      stack.push("scikit-learn (TF-IDF baseline)", "Hugging Face Transformers (fine-tune a small encoder)", "spaCy (if NER/POS)");
    } else {
      lines.push(`  • Low/medium volume → start with a well-prompted LLM call returning STRUCTURED output (a schema), validate it, done. Fine-tune only if the eval demands it.`);
      stack.push("a hosted LLM with structured output", "pydantic (validate the output)", "spaCy or a small encoder if it grows to high volume");
    }
    lines.push(`  → See 'explain_topic classic_nlp' and 'explain_topic structured_output'.`);
  } else if (isKnowledge) {
    signals.push("answering from your own documents/data (a knowledge task)");
    lines.push(`APPROACH: This is a KNOWLEDGE problem → RAG, not fine-tuning. Fine-tuning teaches style, not facts.`);
    lines.push(`  • Pipeline: load → chunk → embed → store in a vector index → retrieve top-k → stuff into the prompt → generate with citations.`);
    lines.push(`  • Evaluate RETRIEVAL separately from generation — most "wrong answers" are retrieval misses, not the LLM.`);
    stack.push("an embedding model", "a vector store (FAISS/Chroma/pgvector)", "an LLM for generation", "LangChain LCEL (optional glue)");
    lines.push(`  → See 'explain_topic langchain_retrieval', 'explain_topic embeddings', and 'explain_topic finetune_vs_rag_vs_prompt'.`);
  } else if (isSearch) {
    signals.push("semantic search / similarity / recommendation");
    lines.push(`APPROACH: An EMBEDDINGS problem. Embed your items, store the vectors, similarity-search at query time.`);
    lines.push(`  • The embedding MODEL choice matters more than the vector DB. Evaluate retrieval on your own data.`);
    lines.push(`  • If exact terms (names, codes) must match, add keyword search alongside (hybrid).`);
    stack.push("an embedding model", "a vector index (FAISS/Chroma/pgvector)", "optional hybrid keyword search");
    lines.push(`  → See 'explain_topic embeddings' and 'explain_topic langchain_retrieval'.`);
  } else if (isAgent) {
    signals.push("multi-step / tool-using / 'agent' behavior");
    lines.push(`APPROACH: You want an agent. START with the simplest loop — a while-loop with tool-calling — before any framework.`);
    lines.push(`  • The CRAFT side (this asset): structured tool-calling, validation, the framework-as-code choice (plain loop vs create_agent vs LangGraph).`);
    lines.push(`  • The ARCHITECTURE side (which pattern — ReAct, plan-execute, reflexion, multi-agent, when to loop) belongs to 'loop'. Go there for design_loop.`);
    stack.push("the model's native tool-calling", "a plain loop first", "LangChain create_agent or LangGraph only if control flow demands it");
    lines.push(`  → See 'explain_topic langchain_vs_langgraph', then 'loop design_loop'.`);
  } else if (isGenerate) {
    signals.push("open-ended generation (write/summarize/answer)");
    lines.push(`APPROACH: Start with ONE well-prompted model call. Prove value before adding retrieval, tools, or agents.`);
    if (isStyle) {
      lines.push(`  • A fixed VOICE/FORMAT at scale is the one case where fine-tuning earns its keep — but try few-shot prompting FIRST; it often gets you there.`);
      stack.push("a hosted LLM (prompt + few-shot first)", "HF PEFT/LoRA fine-tune only if prompting can't hold the format");
    } else {
      stack.push("a hosted LLM with a good prompt", "structured output if it feeds code", "RAG only if it needs facts it doesn't have");
    }
    lines.push(`  → See 'explain_topic fm_integration_overview' and 'explain_topic finetune_vs_rag_vs_prompt'.`);
  } else {
    signals.push("general AI/ML build");
    lines.push(`APPROACH: Name the task type first — classify/extract, answer-from-docs (RAG), search (embeddings), generate, or agent. Then take the simplest matching path above.`);
    lines.push(`  • Default: one well-prompted, structured, validated model call + a tiny eval set. Add machinery only when the eval proves you need it.`);
    stack.push("a hosted LLM to start", "pydantic for validated output", "a 20–50 case golden eval set");
  }

  // Cross-cutting: local/privacy.
  if (wantsLocal) {
    lines.push(``);
    lines.push(`PRIVACY/LOCAL CONSTRAINT detected: run open models yourself — Ollama/llama.cpp (local dev) or vLLM/TGI (served), with a quantized (4-bit) build to fit your hardware. See 'explain_topic inference_options' and 'explain_topic hf_inference_quantization'.`);
    stack.push("Ollama or vLLM (self-hosted open model)", "a quantized (GGUF/AWQ/4-bit) model");
  }

  lines.push(``);
  lines.push(`SUGGESTED STACK: ${[...new Set(stack)].join(" · ")}`);
  lines.push(``);
  lines.push(`FIRST STEP: write 15–30 example inputs with the output you'd want (your golden set), THEN build the simplest version above and score it. Signals read: ${signals.join("; ") || "general"}.`);
  lines.push(``);
  lines.push(`Before writing framework code, verify the CURRENT API (HF/LangChain move fast) → check_practice → practice_verdict.`);
  return lines.join("\n");
}

// ── debug ─────────────────────────────────────────────────────────────────
interface Symptom {
  keys: string[];
  title: string;
  cause: string;
  fix: string[];
}

const SYMPTOMS: Symptom[] = [
  {
    keys: ["out of memory", "oom", "cuda out", "gpu memory", "memory error", "allocate"],
    title: "CUDA out of memory",
    cause: "The model + activations + optimizer state don't fit in VRAM. Almost always batch size, precision, or model size — not a leak.",
    fix: [
      "Lower the batch size first (and use gradient accumulation to keep the effective batch).",
      "Use mixed precision (bf16) and, for fine-tuning, QLoRA (4-bit base) — that's what fits big models on small GPUs.",
      "Free unused tensors / call empty_cache; make sure you're in torch.no_grad() for inference.",
      "If it still won't fit, the model is too big for the hardware — quantize harder or serve a smaller model.",
    ],
  },
  {
    keys: ["garbage", "gibberish", "nonsense output", "weird output", "wrong output", "bad output", "tokenizer"],
    title: "Model output is garbage / gibberish (open models)",
    cause: "Usually a tokenizer/model mismatch, wrong chat template, or wrong dtype — the model is being fed the wrong inputs.",
    fix: [
      "Confirm the tokenizer matches the model EXACTLY (load both from the same checkpoint).",
      "Apply the model's chat template / prompt format — instruct models expect a specific structure.",
      "Check dtype/device consistency; a precision mismatch can corrupt outputs.",
      "Verify you're using the instruct/chat variant if you want instruction-following, not the base model.",
    ],
  },
  {
    keys: ["device", "same device", "cpu", "expected all tensors", "tensor on"],
    title: "Device / dtype mismatch",
    cause: "A CPU tensor met a GPU tensor, or two different dtypes met — PyTorch requires everything in an op on the same device and compatible dtype.",
    fix: [
      "Move everything to one device: model.to(device) and inputs.to(device).",
      "Match dtypes (don't mix a fp16 model with fp32 inputs unintentionally).",
      "For multi-GPU, let accelerate/device_map handle placement rather than manual .to() calls.",
    ],
  },
  {
    keys: ["import", "modulenotfound", "no module", "dependency", "version", "incompatible", "pip", "install fails", "conflict"],
    title: "Dependency / install / import hell",
    cause: "Version-coupled ML packages (torch, transformers, CUDA, bitsandbytes) disagree, or a package landed in the wrong environment.",
    fix: [
      "Work in an isolated per-project env (uv/venv/conda); never system Python.",
      "Install torch from the index URL matching your CUDA version — a mismatched wheel is the classic failure.",
      "Pin versions with a lockfile so the working combo is reproducible.",
      "On Windows, remember bitsandbytes/Triton/DeepSpeed are Linux-first — use WSL2.",
    ],
  },
  {
    keys: ["agentexecutor", "initialize_agent", "llmchain", "deprecated", "langchain import", "no attribute", "create_react_agent"],
    title: "LangChain code is deprecated / import broken",
    cause: "You're on a pre-1.0 tutorial. AgentExecutor/initialize_agent/LLMChain were deprecated or moved to langchain-classic in the Oct 2025 1.0 release.",
    fix: [
      "Replace AgentExecutor/initialize_agent/old create_react_agent with the unified create_agent.",
      "Legacy chains (LLMChain, ConversationChain) now live in langchain-classic — or rewrite as LCEL (prompt | model | parser).",
      "For loops/branching/durable state/approvals, use LangGraph StateGraph.",
      "Verify the exact current import/signature → check_practice (the API moved recently).",
    ],
  },
  {
    keys: ["hallucinat", "wrong answer", "made up", "makes up", "rag", "retrieval", "not finding", "irrelevant"],
    title: "RAG gives wrong / made-up answers",
    cause: "Usually a RETRIEVAL failure, not an LLM failure — the right chunk never made it into the context, so the model filled the gap.",
    fix: [
      "Evaluate retrieval ALONE: for a failing question, did the correct chunk come back in the top-k? If not, it's retrieval.",
      "Fix chunking (chunk on structure, right size) and the embedding model before touching the prompt.",
      "Add hybrid (keyword + vector) or re-ranking if semantic search misses exact terms.",
      "Instruct the model to answer ONLY from the retrieved context and say 'I don't know' otherwise.",
    ],
  },
  {
    keys: ["slow", "latency", "throughput", "too slow", "takes forever", "timeout", "performance"],
    title: "Inference / app is too slow",
    cause: "Either serving without batching, sending too much context, or a serial loop where you could be concurrent — rarely 'the model'.",
    fix: [
      "Serving open models: use vLLM/TGI (batching) — a bare generate loop won't scale.",
      "Trim context (retrieve fewer, better chunks); stream tokens to cut PERCEIVED latency.",
      "Many API calls: go concurrent (async + gather) instead of a serial loop.",
      "Route easy requests to a smaller/cheaper model; measure tokens+latency to find the real bottleneck.",
    ],
  },
  {
    keys: ["fine-tune", "finetune", "not learning", "training", "loss", "overfit", "diverge", "worse after"],
    title: "Fine-tuning isn't working / made it worse",
    cause: "Too little/dirty data, the wrong objective (teaching facts), or a training bug (LR, forgotten zero_grad).",
    fix: [
      "Check the goal: fine-tuning teaches STYLE/FORMAT, not FACTS. If you wanted knowledge, use RAG instead.",
      "Data quality/quantity: you need enough clean, consistent examples; a few noisy pairs make it worse.",
      "Training bugs: forgotten optimizer.zero_grad(), LR too high/low; for LoRA use ~1e-4 and sane r/alpha.",
      "Confirm on a held-out eval that it beats plain prompting — often it doesn't, and that's the finding.",
    ],
  },
];

export function debug(rawSymptom: string): string {
  const s = clean(rawSymptom).toLowerCase();
  const matches = SYMPTOMS.filter((sym) => sym.keys.some((k) => s.includes(k)));
  const chosen = matches.length ? matches : [];
  const header = [
    `DEBUG — "${clean(rawSymptom)}"`,
    `BOTTOM LINE: in AI/ML the bug is usually the plumbing — inputs, environment, retrieval, or serving — not "the model is dumb". Likely cause and the fix, in order:`,
    ``,
  ];
  if (!chosen.length) {
    return [
      ...header,
      `No exact match to a known symptom. The usual suspects, in order:`,
      `  1. INPUTS — tokenizer/model mismatch, wrong chat template, wrong dtype/device (garbage output).`,
      `  2. ENVIRONMENT — version-coupled deps, wrong CUDA/torch wheel, wrong environment (imports/OOM).`,
      `  3. RETRIEVAL — for RAG, a wrong answer is usually the right chunk never arriving, not the LLM.`,
      `  4. SERVING — slowness is usually missing batching / too much context / a serial loop, not the model.`,
      ``,
      `Describe the exact error text or behavior for a targeted read. Known symptoms: ${SYMPTOMS.map((x) => x.title).join("; ")}.`,
      ``,
      `Fast-moving framework specifics → check_practice → practice_verdict.`,
    ].join("\n");
  }
  const body = chosen.flatMap((sym) => [
    `▸ ${sym.title}`,
    `  Likely cause: ${sym.cause}`,
    `  Fix, in order:`,
    ...sym.fix.map((f) => `    ${f}`),
    ``,
  ]);
  return [
    ...header,
    ...body,
    `Still stuck, or it's a CURRENT-API question (a framework signature changed)? → check_practice → practice_verdict. Agent-loop misbehavior (never stops, thrashes tools) → 'loop debug_loop'.`,
  ].join("\n");
}

// ── myth_vs_reality ──────────────────────────────────────────────────────────
const MYTHS: Array<{ myth: string; reality: string }> = [
  {
    myth: "Fine-tune the model on our docs so it KNOWS our stuff.",
    reality: "Fine-tuning teaches STYLE, FORMAT, and BEHAVIOR — not facts. Train it on your docs and it learns to SOUND like them while confidently inventing details. For knowledge, use RAG (retrieve the facts at query time). Fine-tune the voice, RAG the facts.",
  },
  {
    myth: "A bigger / newer model will fix the quality problem.",
    reality: "Usually the problem is the plumbing — a weak prompt, bad retrieval, no eval — not the model's IQ. A bigger model makes those failures more expensive, not gone. Fix the context and the eval first; the model swap is often the smallest lever.",
  },
  {
    myth: "You need a vector database.",
    reality: "For a few thousand documents, in-memory FAISS or even numpy cosine similarity is plenty. A hosted vector DB is an ops choice for scale, not a requirement. The embedding MODEL quality matters far more than which store you pick.",
  },
  {
    myth: "RAG doesn't work / RAG is dead.",
    reality: "When RAG 'fails' it's almost always a RETRIEVAL problem — bad chunking, a weak embedding model, wrong top-k — not the concept. Evaluate retrieval on its own; fix that, and the 'RAG doesn't work' complaint usually disappears.",
  },
  {
    myth: "You need LangChain (or any framework) to build with LLMs.",
    reality: "A few direct API calls with your own thin glue is often clearer and more debuggable than a framework. Frameworks earn their keep on real composition (many chained steps, durable agent state) — not on a single call. Start without one; adopt it when the plumbing genuinely gets heavy.",
  },
  {
    myth: "Temperature 0 makes the model deterministic.",
    reality: "It makes decoding greedy, which is far more stable — but not guaranteed identical. Ties, hardware/kernel nondeterminism, and infra changes still cause drift. Don't build a test suite that assumes byte-identical output at temp 0.",
  },
  {
    myth: "Just use an LLM for everything (classification, extraction, search).",
    reality: "For a narrow, high-volume task, a small fine-tuned encoder or even TF-IDF + logistic regression is cheaper, faster, and MORE consistent than an LLM. Reaching for a giant model to classify short texts at volume is the expensive wrong default.",
  },
  {
    myth: "Prompt it not to do the dangerous thing and you're safe.",
    reality: "A prompt is not a guardrail. Untrusted/retrieved content can carry injected instructions, and determined input gets around a polite system message. Real guardrails are CODE that can say no — schema validation, moderation, allowlists, human approval on consequential actions.",
  },
  {
    myth: "Fine-tuning is how serious teams customize models.",
    reality: "The order is prompt → RAG → fine-tune. Most 'we need to fine-tune' turns out to be a prompting or retrieval gap. Fine-tuning is the right tool for a fixed voice/format at scale — reached AFTER the cheaper options provably fall short on your eval.",
  },
  {
    myth: "More context is always better — just give it the whole document.",
    reality: "Attention dilutes over very long inputs ('lost in the middle'), and every token is cost and latency. Relevant context beats more context: retrieve the few chunks that matter instead of dumping everything.",
  },
];

export function mythVsReality(): string {
  return [
    `AI/ML BUILD MYTHS vs REALITY`,
    `BOTTOM LINE: knowing this craft means knowing its edges. The folklore below wastes the most time and money — the reality is almost always "simpler, measured, and about the plumbing, not the model".`,
    ``,
    ...MYTHS.flatMap(({ myth, reality }, i) => [`${i + 1}. MYTH: "${myth}"`, `   REALITY: ${reality}`, ``]),
    `The through-line: the model is one fallible component. The engineering — retrieval, validation, evals, guardrails, the simplest approach that works — is where the quality actually comes from.`,
  ].join("\n");
}
