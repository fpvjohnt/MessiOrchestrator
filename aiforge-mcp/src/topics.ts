// THE AI/ML ENGINEERING CRAFT — the hands-on plumbing beneath any AI app,
// agentic or not. Four expert lenses John asked for, as areas:
//   python                       — the language the whole stack is written in
//   foundation_model_integration — wiring any foundation model into a real system
//   huggingface_langchain        — the open frameworks, as CODE you write
//   llm_nlp                      — the science: tokens, embeddings, transformers, NLP
//
// SCOPE LINE (the craft-vs-architecture split, agreed with the owner): this
// asset owns HOW TO BUILD IT — the code, the frameworks, the model mechanics.
// It does NOT own agent ARCHITECTURE (ReAct, reflexion, when-to-loop,
// multi-agent) — that's 'loop'. It is not vendor-specific OpenAI platform work —
// that's 'openai'. Every topic that crosses those lines names the asset that
// owns it in `handoff`. Fast-moving framework specifics (a current API, whether
// a technique still wins) are verified via check_practice → practice_verdict,
// never asserted from memory.
//
// Same reverse-index shape as loop's patterns.ts / openai's builders.ts, so
// "ask by any name" works and the regression harness auto-covers every topic.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Area = "python" | "foundation_model_integration" | "huggingface_langchain" | "llm_nlp";

export const AREA_LABELS: Record<Area, string> = {
  python: "Python for AI/ML",
  foundation_model_integration: "Foundation-Model Integration",
  huggingface_langchain: "Hugging Face & LangChain",
  llm_nlp: "LLMs & NLP",
};

export interface Topic {
  label: string;
  keys: string[];
  area: Area;
  what: string; // one-line, the BOTTOM LINE
  why: string; // why a builder cares
  key_ideas: string[]; // the core concepts to actually understand
  how: string[]; // the practical move / code-shape / commands
  pitfalls: string[]; // the traps that burn people
  handoff: string; // where a crossing-the-line question belongs
}

export const TOPICS: Record<string, Topic> = {
  // ── Python for AI/ML ──────────────────────────────────────────────────────
  python_for_ai: {
    label: "Python for AI/ML — the stack",
    keys: ["python", "pythonai", "pythonml", "pythonstack", "pythonexpert", "pythonlanguage"],
    area: "python",
    what: "Python is the lingua franca of AI because the numerical stack (NumPy, PyTorch) is C/CUDA under a readable API — you write Python, the heavy math runs native.",
    why: "Almost every model, framework, and glue script you'll touch is Python. Fluency here is the base layer under all three other areas.",
    key_ideas: [
      "The stack in layers: NumPy (arrays) → PyTorch/JAX (tensors + autograd + GPU) → Transformers/frameworks (models) → your app code.",
      "The 'Python is slow' myth is about the interpreter loop; the array/tensor libraries do the work in native code, so the trick is to stay OUT of per-element Python loops.",
      "Typing (type hints + dataclasses/pydantic) is how you keep a fast-moving ML codebase debuggable.",
    ],
    how: [
      "Learn to think in vectorized operations, not for-loops: `arr * 2` not `[x*2 for x in arr]` — orders of magnitude faster and clearer.",
      "Use pydantic or dataclasses for the shapes crossing boundaries (configs, API payloads, tool args) so bad data fails loudly and early.",
      "Reach for generators/iterators for anything large — stream data, don't materialize a million rows in a list.",
    ],
    pitfalls: [
      "Mutable default arguments (`def f(x=[])`) — the classic bug: the list persists across calls. Use `None` and create inside.",
      "The GIL means threads don't give you CPU parallelism — use processes (or the native library's own threading) for CPU-bound work; threads are fine for IO.",
      "Silent dtype/precision surprises (int vs float, float32 vs float64) that only show up as wrong numbers, never an error.",
    ],
    handoff: "Career/day-in-the-life of a Python or data engineer → 'polymath'. Using ChatGPT/Codex to WRITE the Python → 'openai how_they_use_it software engineer'.",
  },
  python_environments: {
    label: "Python environments & dependencies",
    keys: ["environments", "venv", "virtualenv", "conda", "uv", "poetry", "pip", "dependencies", "packaging", "requirements", "dependencyhell", "cuda"],
    area: "python",
    what: "The single biggest source of 'it works on my machine' in ML: isolating and pinning the exact package + CUDA versions a project needs.",
    why: "ML dependencies (torch, transformers, CUDA, bitsandbytes) are heavy, version-coupled, and break each other constantly. Reproducibility lives or dies here.",
    key_ideas: [
      "One isolated environment PER project — never install ML libs into system Python.",
      "Pin versions (a lockfile), because 'latest' torch + 'latest' transformers are not guaranteed to agree, and a silent upgrade breaks a working repo.",
      "The GPU stack is a coupled chain: NVIDIA driver ↔ CUDA toolkit ↔ the torch build (cu121 etc.). The torch wheel must match your CUDA.",
    ],
    how: [
      "`uv` is the current fast default (a venv + resolver in one, Rust-fast); `python -m venv` + pip works everywhere; conda still shines when you need non-Python binaries (CUDA, MKL).",
      "Commit a lockfile (uv.lock / poetry.lock / a pinned requirements.txt) so a clone reproduces exactly.",
      "Install torch from the correct index URL for your CUDA version — don't rely on the default PyPI wheel to match your GPU.",
    ],
    pitfalls: [
      "Mixing conda and pip carelessly — they can each think they own a package and leave you with a broken import.",
      "A CPU-only torch wheel silently installed on a GPU box → everything runs, just 50× slower, no error.",
      "Windows note (relevant here): some ML libs (bitsandbytes, Triton, DeepSpeed) are Linux-first; on Windows use WSL2 or expect gaps.",
    ],
    handoff: "General dev-environment/tooling setup → 'polymath' (developer productivity). Nothing model-specific here.",
  },
  python_data_stack: {
    label: "NumPy & pandas — the data stack",
    keys: ["numpy", "pandas", "dataframe", "array", "vectorization", "datawrangling", "datastack", "dataframes"],
    area: "python",
    what: "NumPy arrays and pandas DataFrames are how you load, clean, and shape data before it ever reaches a model — vectorized, columnar, native-speed.",
    why: "Every training set, eval set, and batch of features passes through here. Bad data shaping is the quiet cause of most 'the model is wrong' bugs.",
    key_ideas: [
      "An ndarray/DataFrame operation applies to the WHOLE array at native speed; the moment you write a Python loop over rows you've lost the plot (and the speed).",
      "Broadcasting: NumPy stretches compatible shapes so `matrix + vector` just works — learn the shape rules or you'll get silent wrong results, not errors.",
      "dtype and shape are the two things to check first when a tensor/array 'looks wrong'.",
    ],
    how: [
      "Vectorize: `df['x'] * 2`, `np.where(cond, a, b)`, boolean masks — not `.iterrows()`, which is the pandas anti-pattern.",
      "Check `.shape` and `.dtype` obsessively at boundaries; most model input bugs are a wrong axis or a stray float64.",
      "Use `.value_counts()`, `.describe()`, and null checks to actually LOOK at data before trusting it — the 'explore first' habit.",
    ],
    pitfalls: [
      "`iterrows()`/apply-with-a-python-function on big frames — correct but agonizingly slow; vectorize instead.",
      "Chained-assignment / SettingWithCopy in pandas — you edit a copy and the original is untouched, silently.",
      "Off-by-one on axes: `axis=0` (down rows) vs `axis=1` (across columns) is the eternal confusion.",
    ],
    handoff: "The BI/analytics profession and dashboards → 'polymath' (Data & BI). SQL-vs-DataFrame and warehouse design → 'polymath'.",
  },
  pytorch_basics: {
    label: "PyTorch — tensors, autograd, the training loop",
    keys: ["pytorch", "torch", "tensor", "tensors", "autograd", "trainingloop", "backprop", "gpu", "gradient", "gradients"],
    area: "python",
    what: "PyTorch is the default deep-learning framework: tensors (arrays on a GPU), autograd (automatic gradients), and a training loop you write yourself.",
    why: "It's what Transformers, TRL, and most research code are built on. Even if you never train from scratch, you'll read and debug PyTorch constantly.",
    key_ideas: [
      "A tensor is a NumPy array that can live on a GPU and remember how it was computed (the autograd graph).",
      "The training loop is always the same five beats: forward pass → compute loss → `loss.backward()` (gradients) → `optimizer.step()` (update) → `optimizer.zero_grad()` (reset).",
      "`.to(device)` moves tensors/models to GPU; everything in a single op must be on the SAME device and a compatible dtype.",
      "`model.eval()` + `torch.no_grad()` for inference — turns off dropout/batchnorm updates and stops building the gradient graph (faster, less memory).",
    ],
    how: [
      "Read the loop before the model: if you can trace forward→loss→backward→step, you can debug almost any training script.",
      "Watch dtypes for mixed precision (fp16/bf16) — bf16 is the safer half-precision on modern GPUs.",
      "Use `DataLoader` for batching/shuffling; the dataset yields samples, the loader batches them.",
    ],
    pitfalls: [
      "Forgetting `optimizer.zero_grad()` → gradients accumulate across steps and training silently diverges.",
      "`CUDA out of memory` → reduce batch size, use gradient accumulation, enable mixed precision, or free cached tensors; it's the #1 GPU error.",
      "Device/dtype mismatch (`Expected all tensors on the same device`) — a CPU tensor met a GPU tensor.",
    ],
    handoff: "Whether to fine-tune at all vs prompt/RAG → 'finetune_vs_rag_vs_prompt' (this asset). The AGENT loop around a model → 'loop'.",
  },
  python_gotchas: {
    label: "Python performance & the traps",
    keys: ["performance", "profiling", "gil", "async", "asyncio", "concurrency", "gotchas", "speed", "optimization"],
    area: "python",
    what: "The handful of Python behaviors that bite ML/AI code specifically: the GIL, sync-vs-async IO, and the profile-before-optimizing discipline.",
    why: "AI apps are usually IO-bound (waiting on model APIs) OR GPU-bound (waiting on compute) — almost never bound by Python itself. Knowing which changes everything.",
    key_ideas: [
      "IO-bound (calling model APIs, hitting a DB): use `asyncio`/concurrency to fire many requests at once — huge wins, no CPU needed.",
      "CPU-bound pure-Python: the GIL blocks threads; use multiprocessing or push the work into a native library.",
      "GPU-bound: the lever is batch size, precision, and kernel efficiency — not Python at all.",
    ],
    how: [
      "Profile before optimizing: `cProfile`, `py-spy`, or just timing — optimize the layer that's actually slow, which is rarely the one you'd guess.",
      "For many concurrent model calls, use an async client and `asyncio.gather` (or a bounded semaphore) instead of a serial loop.",
      "Cache expensive deterministic calls (`functools.lru_cache`, or a real cache for model responses).",
    ],
    pitfalls: [
      "Reaching for threads to speed up CPU work — the GIL means you get concurrency, not parallelism.",
      "Optimizing the wrong layer: rewriting Python that runs in 5ms while a model call takes 800ms.",
      "Blocking the event loop with a sync call inside async code — one sync `requests.get` stalls all your concurrency.",
    ],
    handoff: "Serving/latency/throughput at production scale → 'cost_latency' (this asset) and 'openai how_they_build chatgpt performance engineer'.",
  },

  python_testing: {
    label: "Testing Python — pytest",
    keys: ["pytest", "unittest", "fixtures", "mocking", "tdd", "testsuite", "coverage", "parametrize"],
    area: "python",
    what: "pytest is the de-facto Python test framework: plain `assert`, fixtures for setup/teardown, parametrization for table-driven tests, and mocking to isolate the unit under test.",
    why: "In AI/ML code the deterministic parts (data shaping, parsing, tool functions, business logic) MUST be tested even though the model isn't — that's where most real bugs live.",
    key_ideas: [
      "A test is a function starting with `test_` that uses plain `assert`; run `pytest` and it discovers them.",
      "Fixtures provide reusable setup (a temp file, a fake client) and clean up after; parametrize runs one test over many input/expected pairs.",
      "Mock the non-deterministic / external edges (the model API, the network) so your logic is tested in isolation and fast.",
      "Test the deterministic seams around the model (prompt assembly, response parsing, validation) with exact assertions; evaluate the MODEL separately with a golden set (→ fm_evaluation).",
    ],
    how: [
      "Write small `test_*` functions with `assert`; use `@pytest.mark.parametrize` for many cases; put fixtures in `conftest.py`.",
      "Mock the model/API boundary (monkeypatch / unittest.mock) so tests don't hit the network or cost tokens.",
      "Run in CI on every push (pairs with 'gitforge github_actions'); track coverage but chase meaningful cases, not the number.",
    ],
    pitfalls: [
      "Not testing the deterministic glue because 'it's an AI app' — the parsing/validation/tool code is exactly what breaks.",
      "Tests that hit the real model API — slow, flaky, and they cost money; mock that boundary.",
      "Chasing 100% coverage with trivial tests instead of covering the real edge cases.",
    ],
    handoff: "Evaluating the MODEL (non-deterministic) → 'fm_evaluation' (this asset). Running tests in CI → 'gitforge github_actions'.",
  },
  python_typing: {
    label: "Typing — hints, dataclasses, mypy",
    keys: ["typing", "typehints", "typehint", "mypy", "dataclass", "dataclasses", "annotations", "typed"],
    area: "python",
    what: "Python's optional type hints (plus dataclasses and a checker like mypy) catch a whole class of bugs before runtime and make a fast-moving ML codebase navigable.",
    why: "ML code passes around tensors, configs, and API payloads whose shape is easy to get wrong. Types document the contract and let the tooling catch mismatches early.",
    key_ideas: [
      "Type hints (`def f(x: int) -> str:`) are optional and don't affect runtime — but a checker (mypy/pyright) enforces them statically.",
      "Dataclasses (and pydantic for validated/parsed data) give you typed, self-documenting structures for configs, tool args, and API payloads.",
      "Types are the cheapest documentation that can't go stale — the signature IS the contract.",
      "Especially valuable at boundaries: what shape goes into a model call, what comes back, what a tool function accepts.",
    ],
    how: [
      "Annotate function signatures and the data structures crossing module boundaries; run mypy/pyright in CI.",
      "Use dataclasses for internal structures; pydantic when you need runtime validation/parsing (API payloads, tool args) — see 'structured_output'.",
      "Add types incrementally to the hot paths first; you don't need 100% to get value.",
    ],
    pitfalls: [
      "Assuming type hints are enforced at runtime — they're not; you need a checker (or pydantic for runtime validation).",
      "Over-annotating trivial code while leaving the risky boundaries untyped.",
      "`Any` everywhere, which silently disables the checking you added types for.",
    ],
    handoff: "Runtime validation of model/API data with pydantic → 'structured_output' (this asset). Type-checking in CI → 'gitforge github_actions'.",
  },
  python_debugging: {
    label: "Debugging Python — pdb, logging, tracebacks",
    keys: ["debugging", "pdb", "breakpoint", "logging", "traceback", "stacktrace", "debugger", "logs"],
    area: "python",
    what: "The tools for finding out why Python code misbehaves: read the traceback bottom-up, drop a `breakpoint()` to inspect state, and use structured logging instead of stray prints.",
    why: "AI apps fail in layered ways (a bad payload, a wrong shape, a swallowed API error). Systematic debugging + real logging is how you find the actual cause instead of guessing.",
    key_ideas: [
      "A traceback is read BOTTOM-UP: the last line is the actual error and type; the frames above are the call path to it.",
      "`breakpoint()` drops into pdb at that line — inspect variables, step, and evaluate expressions live, far faster than sprinkling prints.",
      "Use the `logging` module (levels, structure) over `print` — you can dial verbosity and keep logs in production.",
      "For AI apps, LOG the actual request and response at the model boundary — most 'the model is wrong' bugs are a malformed request or a swallowed error.",
    ],
    how: [
      "Read the error type + message on the traceback's last line first; then walk up to your code.",
      "Drop `breakpoint()` (or use your IDE's debugger) to inspect state at the failure; check `.shape`/`.dtype`/types.",
      "Add structured logging around external calls; never swallow exceptions silently (bare `except: pass` hides the cause).",
    ],
    pitfalls: [
      "Reading a traceback top-down and fixing the wrong frame — the real error is at the bottom.",
      "`except: pass` swallowing the exact error you need to see.",
      "Debugging by guessing/prints when a breakpoint would show the state in seconds.",
    ],
    handoff: "AI-specific failure modes (CUDA OOM, tokenizer mismatch, deprecated imports) → 'debug' (this asset's tool). Logging around API calls → 'apiforge ai_api_reliability'.",
  },

  // ── Foundation-Model Integration ──────────────────────────────────────────
  fm_integration_overview: {
    label: "Foundation-model integration — the mindset",
    keys: ["foundationmodel", "foundationmodels", "integration", "fmintegration", "modelintegration", "aiintegration", "llmapp", "aiapp"],
    area: "foundation_model_integration",
    what: "Integrating a foundation model means treating it as ONE component in a system — with validation, control flow, and fallbacks around it — not as the whole application.",
    why: "The teams that ship treat the model as a fallible service; the teams that stall treat its raw output as the finished product. This mindset is the difference.",
    key_ideas: [
      "The model is a non-deterministic dependency. Everything else in your system should assume it can be wrong, slow, or unavailable.",
      "'Most foundation-model failures are not model failures — they're organizational readiness failures': missing data, evals, or guardrails, not a dumb model.",
      "Modality-task fit first: a text LLM is the WRONG tool for images, video, or tabular forecasting — pick the model class that matches the data.",
      "Build the smallest thing that works (a single call), measure it, THEN add retrieval/tools/agents only if the eval says you need them.",
    ],
    how: [
      "Wrap every model call: validate the output against a schema, handle the error path, set a timeout, and log the input+output for later eval.",
      "Decide the boundary: what does the MODEL do vs what does DETERMINISTIC CODE do? Push anything checkable (math, lookups, formatting) to code.",
      "Start with a hosted API to prove value; only self-host when cost, latency, privacy, or control demands it.",
    ],
    pitfalls: [
      "Shipping the model's raw text straight to a user or a database with no validation layer — the fastest way to a production incident.",
      "Reaching for an agent framework on day one when a single well-prompted call would have done it.",
      "No eval, so you can't tell whether a prompt/model change made things better or worse — you're flying blind.",
    ],
    handoff: "The AGENT LOOP architecture around the model (ReAct, tool-use loop, multi-agent) → 'loop'. Building specifically on OpenAI primitives → 'openai pick_primitive'.",
  },
  inference_options: {
    label: "Inference options — hosted vs self-hosted vs local",
    keys: ["inference", "serving", "hosted", "selfhosted", "local", "ollama", "deployment", "endpoint", "endpoints"],
    area: "foundation_model_integration",
    what: "Where the model actually runs: a hosted API (OpenAI/Anthropic), a self-hosted open model (vLLM/TGI on your GPUs), or local (Ollama/llama.cpp on a workstation).",
    why: "This one choice drives your cost, latency, privacy posture, and how much infra you own. It's the first real architecture decision in any FM app.",
    key_ideas: [
      "Hosted API: fastest to ship, no infra, pay per token, data leaves your walls. The default to START with.",
      "Self-hosted open model: you run vLLM/TGI on GPUs — control, privacy, and flat cost at scale, but you own the ops and the GPU bill.",
      "Local: Ollama / llama.cpp / GGUF quantized models on a laptop or workstation — great for dev, offline, and privacy; limited by the hardware.",
      "The crossover: hosted is cheaper until volume is high and steady; then self-hosting amortizes.",
    ],
    how: [
      "Prototype on a hosted API. Instrument tokens and latency from day one so the cost/latency picture is real, not guessed.",
      "For self-hosting, vLLM is the current throughput default (paged attention, continuous batching); TGI is Hugging Face's server.",
      "For local dev, Ollama is the easiest on-ramp to run open models; use a quantized (4-bit) build to fit consumer GPUs.",
    ],
    pitfalls: [
      "Self-hosting a 70B model 'to save money' before you have the volume — you've bought a GPU cluster to serve ten requests a day.",
      "Ignoring data-residency/privacy until legal asks — that constraint often DECIDES this and should be known up front.",
      "Benchmarking latency on a warm single request and being shocked by tail latency and concurrency under load.",
    ],
    handoff: "Whether OpenAI's hosted platform specifically fits → 'openai pick_primitive'. Cluster/GPU reliability at frontier scale → 'openai how_they_build site reliability engineer'.",
  },
  structured_output: {
    label: "Structured output — JSON, schemas, tool calling",
    keys: ["structuredoutput", "structuredoutputs", "jsonmode", "json", "functioncalling", "toolcalling", "schema", "pydantic", "jsonschema", "parsing"],
    area: "foundation_model_integration",
    what: "Getting a model to return machine-usable structured data (JSON matching a schema) instead of free text you have to parse and pray over.",
    why: "The moment a model's output feeds code (a DB write, an API call, a branch), you need it structured and validated. This is the seam where most integration bugs live.",
    key_ideas: [
      "Three levels: (1) ask for JSON in the prompt (weakest), (2) JSON mode / constrained decoding (guarantees valid JSON), (3) schema-constrained / tool-calling (guarantees valid JSON matching YOUR schema).",
      "Tool calling and structured outputs exist to reduce the validation/parsing glue between the model and your systems — use them.",
      "Always validate the parsed object against your schema (pydantic) even when the API 'guarantees' it — belt and suspenders at the boundary.",
    ],
    how: [
      "Define the schema once (pydantic model / JSON Schema) and pass it to the provider's structured-output or tool-calling API; parse into the typed object.",
      "On a validation failure, retry with the error fed back ('your JSON failed validation because X') — a cheap, effective self-correction.",
      "Keep schemas flat and well-named; deeply nested optional fields are where models and parsers both stumble.",
    ],
    pitfalls: [
      "Regex-parsing free-text output — brittle, and it breaks the day the model phrases it differently. Use real structured output.",
      "Trusting 'JSON mode' to match your SCHEMA — plain JSON mode guarantees valid JSON, not the right FIELDS; that needs schema-constrained output.",
      "No validation step, so a subtly wrong field (a string where you expected a number) flows silently downstream.",
    ],
    handoff: "OpenAI's specific Structured Outputs / tool APIs → 'openai explain_primitive'. Tool-use as an agent LOOP pattern → 'loop explain_pattern tool_use'.",
  },
  cost_latency: {
    label: "Cost, latency & throughput",
    keys: ["cost", "latency", "throughput", "batching", "caching", "streaming", "modelrouting", "budget"],
    area: "foundation_model_integration",
    what: "The levers that make an FM app affordable and fast: token economics, caching, batching, streaming, and routing cheap vs expensive models by task.",
    why: "At any real volume, tokens are the bill and latency is the UX. Ignoring this ships a demo that's too slow and too expensive to run for real.",
    key_ideas: [
      "You pay per token, in AND out; the context you stuff in is a recurring cost on every call, not a one-time setup.",
      "Prompt/response caching, request batching, and streaming (show tokens as they arrive) are the three biggest wins.",
      "Model routing: send easy requests to a small cheap model and only escalate hard ones to the big model — often a huge cost cut at equal quality.",
    ],
    how: [
      "Measure tokens and latency per request from day one; you can't optimize a bill you're not reading.",
      "Cache deterministic or repeated calls; batch where the provider supports it; stream to cut perceived latency.",
      "Trim context aggressively — retrieve the few relevant chunks, don't dump the whole document every call.",
    ],
    pitfalls: [
      "Sending the entire conversation/history every turn as it grows — cost and latency creep up linearly and silently.",
      "Optimizing model quality with zero cost/latency budget, then discovering the 'best' setup is unshippable.",
      "Caching non-deterministic outputs and serving a stale wrong answer — cache the deterministic layers, not everything.",
    ],
    handoff: "OpenAI-specific pricing/batch/prompt-caching mechanics → 'openai explain_primitive batch_and_cost'. Production performance engineering → 'openai how_they_build chatgpt performance engineer'.",
  },
  fm_evaluation: {
    label: "Evaluating an integration (offline)",
    keys: ["evaluation", "evals", "eval", "goldenset", "testing", "metrics", "benchmark", "calibration", "quality", "accuracy"],
    area: "foundation_model_integration",
    what: "How you actually KNOW your model integration works and whether a change helped: a golden set of inputs→expected, scored automatically, run on every change.",
    why: "Without evals you're tuning prompts by vibes. The golden set is what turns 'it feels better' into a number you can defend.",
    key_ideas: [
      "Build a golden set: representative inputs with known-good outputs (or a checkable property). Small and real beats big and synthetic.",
      "Score by the task: exact-match/regex for structured tasks; rubric or LLM-as-judge for open-ended — knowing LLM-judge has real bias.",
      "'Evaluation debt': as you inherit big model capability surfaces, most of them are only partially characterized — measure what YOUR app relies on.",
      "Consistency ≠ correctness: the same output every time doesn't mean it's right. Measure correctness against the golden set, separately.",
    ],
    how: [
      "Write 20–50 golden cases before heavy prompt-tuning; re-run them on every prompt/model change; track the score over time.",
      "Include the failure cases you've actually seen in production — regressions hide there.",
      "If you use LLM-as-judge, validate the judge against human labels on a sample first, and watch for self-preference bias.",
    ],
    pitfalls: [
      "Testing on the examples you tuned the prompt on — you're grading your own homework; hold out a real test set.",
      "One aggregate accuracy number that hides which SLICE broke; segment the eval.",
      "Trusting an LLM judge's score as ground truth without ever checking it against humans.",
    ],
    handoff: "The deeper theory of evaluating an agent LOOP (trajectory, levels of eval) → 'loop eval_loop'. NLP-specific metrics (BLEU/ROUGE/perplexity) → 'classic_nlp' & 'decoding' (this asset).",
  },
  fm_guardrails: {
    label: "Guardrails & safety at the boundary",
    keys: ["guardrails", "safety", "validation", "moderation", "adversarial", "promptinjection", "inputvalidation", "outputvalidation", "redteam"],
    area: "foundation_model_integration",
    what: "The input/output checks that stop a model integration from doing harm: validating what goes in, constraining what comes out, and adversarial-testing both.",
    why: "Any feature that takes user content or acts on model output is an attack surface. Guardrails are the difference between a feature and a liability.",
    key_ideas: [
      "Guard both sides: sanitize/scope inputs (prompt-injection, jailbreaks) AND validate outputs (schema, policy, safety) before anything acts on them.",
      "Prompt injection is unsolved by prompting alone — untrusted retrieved/user content can carry instructions; treat model output as untrusted until validated.",
      "A guardrail is code that can SAY NO — a schema check, a moderation call, an allowlist, a human approval — not a polite request in the system prompt.",
    ],
    how: [
      "Validate every output against a schema and a policy before it touches a database, an API, or a user.",
      "Red-team your own feature: throw the nastiest adversarial inputs you can invent at it and confirm nothing crashes or leaks.",
      "For actions with real consequences (send, delete, pay), require deterministic confirmation or a human in the loop — never the model's say-so alone.",
    ],
    pitfalls: [
      "'Prompt it not to do the dangerous thing' as your only defense — a prompt is not a guardrail; determined input gets around it.",
      "Trusting retrieved/tool content as safe — injection rides in on the data, not just the user's message.",
      "Guarding the input but shipping the output unchecked (or vice versa) — you need both ends.",
    ],
    handoff: "'Prompt-as-guardrail is a myth' and guardrails in the agent loop → 'loop myth_vs_reality' & 'loop debug_loop'. OpenAI-platform moderation specifics → 'openai'.",
  },

  // ── Hugging Face & LangChain ──────────────────────────────────────────────
  hf_transformers: {
    label: "Hugging Face Transformers & the Hub",
    keys: ["huggingface", "transformers", "pipeline", "automodel", "autotokenizer", "hub", "modelhub", "hf", "datasets", "hfdatasets"],
    area: "huggingface_langchain",
    what: "The Transformers library + the Hub: download an open model by name and run it in a few lines — `pipeline()` for the easy path, `AutoModel`/`AutoTokenizer` for control.",
    why: "It's the front door to thousands of open models (LLMs, embeddings, vision, speech). If you work with open weights at all, this is the tool.",
    key_ideas: [
      "`pipeline('task', model=...)` is the one-liner for common tasks (classification, NER, summarization, generation) — great default.",
      "`AutoTokenizer` + `AutoModelForX` is the explicit path: tokenize → model → decode, with full control over batching and generation.",
      "The Hub hosts models AND datasets; a model card tells you the license, intended use, and limits — READ IT, licenses vary wildly.",
      "`datasets` streams and memory-maps large corpora so you don't blow RAM loading a training set.",
    ],
    how: [
      "Start with `pipeline()` to prove the model does the task; drop to `AutoModel` only when you need batching, custom generation, or fine-tuning.",
      "Match the tokenizer to the model exactly — a mismatched tokenizer gives silently garbage inputs.",
      "Check the model card's license before you build on it (some are non-commercial / gated).",
    ],
    pitfalls: [
      "Downloading a huge model onto a machine that can't hold it — check parameter count vs your VRAM/RAM first.",
      "Ignoring the license and shipping a non-commercial model in a product.",
      "Tokenizer/model mismatch — the #1 'why is the output garbage' cause with open models.",
    ],
    handoff: "The SCIENCE of what the tokenizer/model does → 'tokenization' & 'transformer_architecture' (this asset). Fine-tuning one → 'hf_finetuning' (this asset).",
  },
  hf_finetuning: {
    label: "Fine-tuning open models — PEFT, LoRA, QLoRA, TRL",
    keys: ["finetune", "finetuning", "lora", "qlora", "peft", "trl", "sfttrainer", "adapter", "adapters", "dpo", "posttraining", "sft"],
    area: "huggingface_langchain",
    what: "Adapting an open model to your task cheaply: PEFT/LoRA trains small adapter weights (not the whole model), QLoRA does it on a 4-bit quantized base to fit modest GPUs.",
    why: "Full fine-tuning a large model is expensive and rarely necessary. LoRA/QLoRA is how normal teams actually customize open models — often on a single GPU.",
    key_ideas: [
      "LoRA freezes the base model and trains tiny low-rank ADAPTER matrices — a fraction of the parameters, a fraction of the memory.",
      "QLoRA = quantize the base to 4-bit (frozen) + attach LoRA adapters + train only the adapters. This is what puts fine-tuning on one consumer/prosumer GPU.",
      "TRL's `SFTTrainer` integrates PEFT natively: define a `LoraConfig`, pass it in, train the adapter. The 2026 post-training stack layers SFT → DPO → RLHF/GRPO.",
      "After training you can MERGE the adapter into the base for deployment, or serve it as a separate lightweight adapter.",
    ],
    how: [
      "Typical LoRA config: r=16–32, lora_alpha=16–32, lora_dropout=0.05, bias='none', task_type='CAUSAL_LM'; use a higher LR (~1e-4) since only adapters train.",
      "Start with SFT (supervised fine-tuning) on clean input→output pairs; only reach for DPO/RLHF when you need preference alignment.",
      "Verify the CURRENT TRL/PEFT API before writing code — this stack moves monthly → check_practice → practice_verdict.",
    ],
    pitfalls: [
      "Fine-tuning to teach FACTS — fine-tuning teaches STYLE/FORMAT/BEHAVIOR, not knowledge; for facts you want RAG. (See finetune_vs_rag_vs_prompt.)",
      "Too little or too dirty data — a few hundred noisy pairs will make the model worse, not better.",
      "Windows gap: bitsandbytes/QLoRA is Linux-first; use WSL2 or a Linux box.",
    ],
    handoff: "WHETHER to fine-tune vs RAG vs prompt (the decision) → 'finetune_vs_rag_vs_prompt' (this asset). OpenAI-hosted fine-tuning specifically → 'openai explain_primitive finetune_or_not'.",
  },
  hf_inference_quantization: {
    label: "Serving & quantizing open models",
    keys: ["quantization", "quantize", "bitsandbytes", "gguf", "ggml", "vllm", "tgi", "4bit", "8bit", "llamacpp", "awq", "gptq"],
    area: "huggingface_langchain",
    what: "Making an open model actually runnable: quantization shrinks it (16-bit → 8/4-bit) to fit your hardware, and a serving stack (vLLM/TGI) runs it with real throughput.",
    why: "An open model you can't fit or can't serve fast is useless. Quantization + a proper server are what turn 'downloaded weights' into 'a service'.",
    key_ideas: [
      "Quantization stores weights in fewer bits (4-bit/8-bit) → far less VRAM, slightly lower quality. Usually a great trade for inference.",
      "Formats: bitsandbytes (on-the-fly, training-friendly/QLoRA), GPTQ/AWQ (calibrated, inference-optimized), GGUF (llama.cpp / CPU + Apple-silicon friendly).",
      "vLLM is the current high-throughput server (paged attention, continuous batching); TGI is Hugging Face's; Ollama/llama.cpp for local.",
    ],
    how: [
      "Pick the quantization by target: GGUF for local/CPU/Mac, AWQ/GPTQ for GPU inference, bitsandbytes when you're also QLoRA-training.",
      "Serve with vLLM/TGI for anything concurrent — a raw `model.generate()` loop won't batch and will crawl under load.",
      "Confirm the current serving/quant tooling before committing — it changes fast → check_practice.",
    ],
    pitfalls: [
      "Expecting 4-bit to be free — there's a quality cost; measure it on YOUR eval, don't assume.",
      "Serving from a bare generate loop and wondering why throughput is terrible — you need batching/a real server.",
      "Quantization-format/hardware mismatch (a CUDA-only kernel on a Mac, or GGUF where you wanted GPU tensor cores).",
    ],
    handoff: "Cluster-scale serving reliability → 'openai how_they_build site reliability engineer'. The cost/latency trade at the app layer → 'cost_latency' (this asset).",
  },
  langchain_core: {
    label: "LangChain today — LCEL, create_agent, and what changed",
    keys: ["langchain", "lcel", "createagent", "langchainclassic", "chains", "chain", "runnable", "expressionlanguage"],
    area: "huggingface_langchain",
    what: "LangChain is a framework for wiring model calls, prompts, retrievers, and tools into chains/agents. As of the 1.0 release it changed a lot — the old machinery is deprecated.",
    why: "It's the most common 'glue' framework, and the API you'll find in most tutorials is now OUTDATED. Knowing the current shape saves you from building on deprecated rails.",
    key_ideas: [
      "LangChain + LangGraph reached 1.0 GA (Oct 22 2025). Big deprecations: `AgentExecutor`, `initialize_agent`, and the old `create_react_agent` collapsed into one `create_agent`; migrate off the old ones (maintenance mode).",
      "Legacy machinery — `LLMChain`, `ConversationChain`, old retrievers/memory — moved OUT of core into `langchain-classic`. If a tutorial imports `LLMChain`, it's old.",
      "LCEL (the pipe operator, `prompt | model | parser`) is still the recommended way to build simple linear chains and RAG pipelines — but 'LCEL everywhere for agents' is de-emphasized in favor of `create_agent`.",
      "`create_agent` is the current high-level agent entry point; it runs on LangGraph's engine under the hood.",
    ],
    how: [
      "For a simple chain/RAG: use LCEL — `prompt | model | output_parser`, clean and streamable.",
      "For a standard agent: `create_agent` (not `AgentExecutor`). For loops/branching/durable state/human approval/multi-agent: LangGraph `StateGraph`.",
      "Because this API moved recently, verify the exact current import/signature → check_practice → practice_verdict before writing much code.",
    ],
    pitfalls: [
      "Copying a pre-2025 tutorial (`AgentExecutor`, `initialize_agent`, `LLMChain`) — you're building on deprecated APIs from day one.",
      "Reaching for LangChain when a couple of direct API calls would do — the framework earns its keep on real composition, not a single call.",
      "Confusing LangChain (the framework) with the model — LangChain doesn't make the model smarter, it organizes the plumbing.",
    ],
    handoff: "WHEN to use LangGraph vs a plain loop vs multi-agent (the ARCHITECTURE choice) → 'langchain_vs_langgraph' (this asset) and ultimately 'loop'.",
  },
  langchain_retrieval: {
    label: "RAG plumbing — retrievers & vector stores",
    keys: ["retrieval", "rag", "vectorstore", "vectordb", "retriever", "chunking", "embeddingsearch", "similaritysearch", "pinecone", "chroma", "faiss"],
    area: "huggingface_langchain",
    what: "The mechanics of retrieval-augmented generation: chunk your documents, embed them, store the vectors, and fetch the most similar chunks to ground a model's answer.",
    why: "RAG is how you give a model knowledge it wasn't trained on WITHOUT fine-tuning — the default answer to 'make it know our docs'. The plumbing is where quality is won or lost.",
    key_ideas: [
      "The pipeline: load → chunk → embed (an embedding model) → store (a vector DB) → at query time, embed the question, similarity-search, stuff the top-k chunks into the prompt.",
      "Chunking strategy dominates quality: too big = noisy context, too small = severed meaning. Chunk on structure (headings/paragraphs), not blind character counts, where you can.",
      "The embedding model choice matters more than the vector DB — retrieval is only as good as the embeddings' sense of similarity.",
      "Vector stores (FAISS local, Chroma, pgvector, Pinecone/Weaviate hosted) are mostly interchangeable at small scale; pick on ops, not magic.",
    ],
    how: [
      "Start simple: a good embedding model + FAISS/Chroma + top-k=3–5, and EVALUATE retrieval quality separately from generation.",
      "Measure retrieval on its own (did the right chunk come back?) before blaming the LLM for a wrong answer.",
      "Add re-ranking or hybrid (keyword + vector) search only if a retrieval eval says plain vector search is missing things.",
    ],
    pitfalls: [
      "Blaming the LLM for a hallucination that's actually a RETRIEVAL miss — the right chunk never made it into context.",
      "'RAG doesn't work' — usually it's a chunking/embedding/retrieval problem, not the concept.",
      "Dumping huge chunks or too many of them — you blow the context budget and bury the signal.",
    ],
    handoff: "The RAG LOOP as an agent architecture (when to retrieve, iterative retrieval) → 'loop explain_pattern rag_loop'. The science of embeddings → 'embeddings' (this asset).",
  },
  langchain_vs_langgraph: {
    label: "LangChain vs LangGraph vs a plain loop",
    keys: ["langgraph", "stategraph", "langchainvslanggraph", "frameworkchoice", "orchestrationframework", "whenlanggraph"],
    area: "huggingface_langchain",
    what: "The decision of what to build agent behavior ON: a plain loop you write, LangChain's `create_agent`, or LangGraph's `StateGraph` — matched to how much control flow you need.",
    why: "Picking the framework before you know the shape of the problem is a classic time-sink. This is the craft-side of a decision whose architecture half belongs to 'loop'.",
    key_ideas: [
      "Plain loop (no framework): a while-loop with your own tool-calling. Best default for a single, simple agent — total control, no framework churn.",
      "LangChain `create_agent`: fast path to a standard tool-using agent without managing a graph yourself.",
      "LangGraph `StateGraph`: when you genuinely need loops, branching, durable state, human-in-the-loop approval, or multi-agent handoffs — an explicit state machine.",
      "More framework = more power AND more to learn/debug; earn each step up with a real need.",
    ],
    how: [
      "Ask what control flow you ACTUALLY need. Linear chain? LCEL. One agent + tools? create_agent or a plain loop. Branches/durable state/approvals? LangGraph.",
      "Prototype the plain-loop version first; adopt a graph framework when the control flow outgrows what you want to hand-maintain.",
      "This is where the craft asset stops and 'loop' begins — the WHICH-PATTERN reasoning (ReAct vs plan-execute vs multi-agent) is loop's job.",
    ],
    pitfalls: [
      "Reaching for LangGraph's full machinery for a task a 30-line loop would handle.",
      "The opposite: hand-rolling durable state + approvals + retries that a graph framework gives you for free.",
      "Choosing the framework for its popularity instead of your task's actual control-flow needs.",
    ],
    handoff: "The AGENT ARCHITECTURE decision itself — ReAct, plan-execute, reflexion, multi-agent, when to loop → 'loop design_loop'. This asset only covers the framework-as-code side.",
  },

  // ── LLMs & NLP ────────────────────────────────────────────────────────────
  tokenization: {
    label: "Tokenization — how text becomes numbers",
    keys: ["tokenization", "tokenizer", "tokens", "token", "bpe", "bytepair", "wordpiece", "subword", "sentencepiece", "contextwindow"],
    area: "llm_nlp",
    what: "Models don't see text — they see tokens (subword pieces). A tokenizer splits text into these pieces and maps them to integer IDs the model actually consumes.",
    why: "Tokens are the unit of cost, the unit of the context window, and the cause of a surprising number of 'weird' model behaviors. Understanding them demystifies a lot.",
    key_ideas: [
      "Subword tokenization (BPE, WordPiece, SentencePiece) splits rare words into pieces and keeps common words whole — a balance between characters and words.",
      "A token is ~4 characters / ~0.75 words in English on average, but code, numbers, and other languages tokenize very differently (often worse).",
      "The context window is measured in TOKENS, not words or characters; your prompt + response must fit.",
      "Each model family has its OWN tokenizer — token counts and splits differ across models.",
    ],
    how: [
      "Count tokens with the model's own tokenizer before you assume something fits or estimate a bill — never eyeball it from character count.",
      "When a model miscounts letters or mangles a number, suspect tokenization: it never saw the characters, only the chunk.",
      "For non-English or heavy-code workloads, check the token efficiency — some models are far more token-hungry on your data.",
    ],
    pitfalls: [
      "Assuming 'characters ≈ tokens' — off by ~4×, which wrecks context-budget and cost estimates.",
      "Expecting reliable character-level tasks (count the r's, reverse a string) — tokenization makes these genuinely hard for LLMs.",
      "Using one model's token count to budget for another — the tokenizers differ.",
    ],
    handoff: "Cost/context budgeting in an app → 'cost_latency' (this asset). Running a tokenizer in code → 'hf_transformers' (this asset).",
  },
  embeddings: {
    label: "Embeddings — meaning as vectors",
    keys: ["embedding", "embeddings", "vector", "vectors", "semanticsearch", "similarity", "cosine", "embed", "vectorsearch"],
    area: "llm_nlp",
    what: "An embedding turns a piece of text (or image) into a vector of numbers such that similar meanings land near each other in space — the basis of semantic search and RAG.",
    why: "Embeddings are how machines compare MEANING instead of matching keywords. They power retrieval, clustering, recommendation, dedup, and classification.",
    key_ideas: [
      "Similar meaning → nearby vectors; you measure closeness with cosine similarity (angle) or distance.",
      "An embedding MODEL produces the vectors; its quality (its sense of 'similar') is what makes retrieval good or bad — choose it deliberately.",
      "Dimensionality (e.g., 384, 768, 1536) trades detail for cost/speed; more isn't automatically better for a given task.",
      "Embeddings capture semantics but not exactness — they'll rank a paraphrase high and can miss an exact keyword; hybrid search fixes that.",
    ],
    how: [
      "Pick an embedding model that matches your domain and language; evaluate it on YOUR retrieval task, not a leaderboard.",
      "Normalize vectors and use cosine similarity for text; store in a vector index (FAISS/pgvector/etc.) for scale.",
      "For search that must also honor exact terms (names, codes), combine vector + keyword (hybrid).",
    ],
    pitfalls: [
      "Assuming a bigger/hyped embedding model is better for you — domain fit and your own eval decide it.",
      "Comparing vectors from two DIFFERENT embedding models — they live in different spaces; the numbers are meaningless across models.",
      "Expecting embeddings to catch exact keywords (a part number, a rare name) — semantics can smear those; add keyword search.",
    ],
    handoff: "The retrieval PIPELINE that uses embeddings → 'langchain_retrieval' (this asset). RAG as an agent LOOP → 'loop explain_pattern rag_loop'.",
  },
  transformer_architecture: {
    label: "Transformers & attention — the architecture",
    keys: ["transformer", "attention", "selfattention", "architecture", "encoder", "decoder", "bert", "gpt", "modelarchitecture", "neuralnetwork"],
    area: "llm_nlp",
    what: "The transformer is the architecture behind essentially all modern LLMs. Its core trick is ATTENTION: each token looks at every other token to decide what's relevant.",
    why: "You don't need to build one, but knowing the shape explains capabilities and limits — why context matters, why there's a context-length wall, why some models suit some tasks.",
    key_ideas: [
      "Attention lets every token weigh every other token's relevance — that's how the model captures long-range meaning, and why compute grows with sequence length.",
      "Three families: ENCODER-only (BERT — understanding/classification/embeddings), DECODER-only (GPT-style — generation), ENCODER-DECODER (T5 — translation/seq-to-seq).",
      "'Foundation model' = a large transformer pretrained on massive data, then adapted (fine-tuned/prompted) to many tasks.",
      "Context length is bounded because attention cost scales with sequence length — hence the constant push on efficient/long-context attention.",
    ],
    how: [
      "Match the family to the task: classification/embeddings → encoder (BERT-like); open-ended generation → decoder (GPT-like); translation/summarization → enc-dec.",
      "Treat the architecture as a lens for debugging capability limits, not something to reimplement.",
      "When you hit a context wall or quadratic-cost slowdown, that's attention — the fix is retrieval/chunking, not a bigger prompt.",
    ],
    pitfalls: [
      "Using a decoder LLM for a job a small encoder (BERT) does cheaper and better (e.g., plain text classification at volume).",
      "Believing 'bigger context = always better' — attention dilutes over very long inputs ('lost in the middle'); relevant-context beats more-context.",
      "Anthropomorphizing attention as 'understanding' — it's weighted relevance, not comprehension.",
    ],
    handoff: "The physics/history/'how we know' of AI as a science → 'curiosity computing_ai'. Choosing an OpenAI model → 'openai'.",
  },
  finetune_vs_rag_vs_prompt: {
    label: "Fine-tune vs RAG vs prompt — the decision",
    keys: ["finetunevsrag", "ragvsfinetune", "whenfinetune", "promptvsrag", "customization", "adaptation", "knowledge", "teachit"],
    area: "llm_nlp",
    what: "The most-asked question in applied LLMs: to make a model do YOUR thing, do you prompt it better, give it your data via RAG, or fine-tune it? Usually in that order.",
    why: "Teams routinely reach for the expensive option (fine-tuning) to solve a problem prompting or RAG would fix cheaper and faster. Getting this order right saves weeks.",
    key_ideas: [
      "Prompting: change BEHAVIOR with instructions/examples. Cheapest, fastest, first. Solves more than people expect.",
      "RAG: add KNOWLEDGE the model lacks by retrieving it at query time. The answer for 'make it know our docs/data' and for facts that change.",
      "Fine-tuning: change STYLE, FORMAT, or consistent BEHAVIOR by training on examples. The answer for 'always respond in this exact way/format', NOT for teaching facts.",
      "The rule of thumb: prompt → RAG → fine-tune, escalating only when the cheaper option provably falls short on your eval.",
    ],
    how: [
      "Write the eval first, then try prompting. Most 'we need to fine-tune' turns out to be a prompting or retrieval gap.",
      "For knowledge/facts (especially changing ones) → RAG. For a fixed voice/format/behavior at scale → fine-tune. They compose (fine-tune the style, RAG the facts).",
      "Only fine-tune with enough clean, consistent examples and a clear metric that prompting/RAG couldn't hit.",
    ],
    pitfalls: [
      "Fine-tuning to inject FACTS — it teaches form, not knowledge; the model will confidently make up the details. Use RAG for facts.",
      "Jumping straight to fine-tuning to skip prompt engineering — usually more work for a worse result.",
      "No eval, so you can't tell which approach actually helped — you just spent money to feel productive.",
    ],
    handoff: "The fine-tuning MECHANICS (PEFT/LoRA/TRL) → 'hf_finetuning' (this asset). The RAG plumbing → 'langchain_retrieval'. OpenAI's hosted fine-tune-or-not guidance → 'openai explain_primitive finetune_or_not'.",
  },
  decoding: {
    label: "Decoding & sampling — temperature, top-p, greedy",
    keys: ["decoding", "sampling", "temperature", "topp", "topk", "greedy", "beamsearch", "generation", "creativity", "randomness"],
    area: "llm_nlp",
    what: "How a model turns its next-token probabilities into actual text: greedy/beam (pick the likeliest) vs sampling with temperature/top-p (introduce controlled randomness).",
    why: "These knobs control the determinism-vs-creativity trade and are the fix for output that's too bland OR too unhinged — and they explain why 'temperature 0' still isn't fully deterministic.",
    key_ideas: [
      "Temperature: low (→0) = focused, repetitive, near-deterministic; high = diverse, creative, riskier. It reshapes the probability distribution before sampling.",
      "top-p (nucleus) / top-k: limit sampling to the most probable tokens so you get variety WITHOUT the model wandering into nonsense.",
      "Greedy/beam search: always take the most likely path — good for deterministic-ish tasks (extraction, translation), can be dull for open generation.",
      "Temperature 0 is NOT guaranteed deterministic in practice — ties, hardware/kernel nondeterminism, and infra can still vary output.",
    ],
    how: [
      "Extraction/classification/structured output → low temperature (or greedy). Brainstorming/creative → higher temperature + top-p.",
      "Tune temperature and top-p together; leave one at a sane default and move the other, measuring on your eval.",
      "If you need reproducibility, set a seed where supported AND pin the model/infra — and still expect small drift.",
    ],
    pitfalls: [
      "Believing temperature 0 = deterministic and building a test suite that flakes on it.",
      "Cranking temperature to fix 'boring' output and getting hallucinations instead — often it's a prompt problem, not a sampling one.",
      "Sampling (temp>0) under structured-output tasks where you wanted stability — crank it down for those.",
    ],
    handoff: "'Temperature 0 = deterministic' as an agent-loop myth → 'loop myth_vs_reality'. Provider-specific parameter names → 'openai'.",
  },
  classic_nlp: {
    label: "Classic NLP — when you don't need an LLM",
    keys: ["nlp", "classicnlp", "ner", "sentiment", "classification", "tfidf", "pos", "namedentity", "topicmodeling", "spacy", "textclassification"],
    area: "llm_nlp",
    what: "The pre-LLM toolkit — tokenization, TF-IDF, named-entity recognition, sentiment, classification, topic modeling — that is often faster, cheaper, and more reliable than an LLM for narrow tasks.",
    why: "Reaching for a giant LLM to classify text or pull entities at volume is frequently the wrong call: a small model or classic method is cheaper, faster, and more predictable.",
    key_ideas: [
      "For a well-defined task (sentiment, spam, NER, topic) at volume, a fine-tuned small encoder (BERT/DistilBERT) or even TF-IDF + logistic regression can beat an LLM on cost, latency, AND consistency.",
      "NER (named-entity recognition) pulls people/places/orgs; POS tags grammar; TF-IDF scores word importance; topic models cluster themes — mature, well-understood tools.",
      "spaCy and scikit-learn are the workhorses; Hugging Face gives you fine-tunable transformer versions when you need more.",
      "LLMs shine on open-ended, few-shot, or messy-instruction tasks; classic NLP shines on narrow, high-volume, well-labeled ones.",
    ],
    how: [
      "For a narrow high-volume task, baseline with a classic method or a small fine-tuned encoder BEFORE assuming you need an LLM.",
      "Use spaCy for fast NER/POS/pipelines; scikit-learn for TF-IDF + a linear classifier; a fine-tuned DistilBERT when you need accuracy at scale.",
      "Measure the classic baseline's accuracy AND its cost/latency edge — it's often the shippable answer.",
    ],
    pitfalls: [
      "Paying LLM prices and latency to classify millions of short texts a 50MB model would nail.",
      "Ignoring that classic models need labeled data and don't generalize past their training the way an LLM few-shots.",
      "Skipping the simple baseline entirely, so you never learn the LLM wasn't buying you anything.",
    ],
    handoff: "Evaluating any of these (metrics, golden sets) → 'fm_evaluation' (this asset). The linguistics/science of language itself → 'linguistics'.",
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
  // Loose contains-match, longest key first so a specific alias beats a generic one.
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
      `THE AI/ML ENGINEERING CRAFT — hands-on building with AI, across four expert lenses`,
      `BOTTOM LINE: this is the CODE and the SCIENCE beneath any AI app — the language, the frameworks, the model mechanics. Pick a topic; the 'pitfalls' are the part worth reading.`,
      ``,
      ...areas.flatMap((area) => [
        `${AREA_LABELS[area]}:`,
        ...topicsByArea(area).map((k) => `  ▸ ${TOPICS[k].label} — 'explain_topic ${k}'`),
        ``,
      ]),
      `Other tools: build_it <task> (pick the approach + stack), debug <symptom>, myth_vs_reality, and check_practice → practice_verdict for anything fast-moving (a current framework API, whether a technique still wins).`,
      ``,
      `SCOPE: this asset owns HOW TO BUILD IT. Agent ARCHITECTURE (ReAct, when-to-loop, multi-agent) → 'loop'. OpenAI-specific platform work → 'openai'. Careers/which-specialist → 'polymath'.`,
    ].join("\n");
  }
  const key = resolveTopic(topic);
  if (!key) {
    return `Not sure which topic "${clean(topic)}" is. Topics: ${Object.values(TOPICS)
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
    `Anything version-specific — a current framework API, a model's limits, whether a technique still wins — is verified, never recalled: check_practice → practice_verdict.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is the AI/ML engineering CRAFT — the hands-on plumbing and science beneath any AI app, agentic or not. Four expert lenses, one job: help you actually BUILD it, honestly, with the simplest thing that works.`,
    ``,
    `THE FOUR LENSES:`,
    `  • PYTHON — the language and stack it's all written in (NumPy, pandas, PyTorch, environments, the traps) → 'explain_topic python'.`,
    `  • FOUNDATION-MODEL INTEGRATION — wiring any model into a real system (inference options, structured output, cost/latency, evals, guardrails) → 'explain_topic fm_integration_overview'.`,
    `  • HUGGING FACE & LANGCHAIN — the open frameworks as CODE (Transformers, PEFT/LoRA/QLoRA fine-tuning, serving/quantization, LCEL/create_agent, RAG plumbing) → 'explain_topic huggingface'.`,
    `  • LLMs & NLP — the science (tokenization, embeddings, transformers, fine-tune-vs-RAG-vs-prompt, decoding, classic NLP) → 'explain_topic llm_nlp'.`,
    ``,
    `THE TOOLS:`,
    `  • 'explain_topic <topic>' — the front door; no arg for the full map.`,
    `  • 'build_it <task>' — task → the approach, the stack, the first step (simplest thing that works first).`,
    `  • 'debug <symptom>' — CUDA OOM, tokenizer mismatch, dependency hell, a deprecated LangChain import, bad RAG answers.`,
    `  • 'myth_vs_reality' — 'fine-tune it so it knows our facts', 'bigger model always wins', 'you need a vector DB', 'RAG doesn't work'.`,
    `  • 'check_practice' → 'practice_verdict' — for fast-moving specifics (a current HF/LangChain API, whether a technique still beats the simpler option). Verified via research, never from stale memory.`,
    ``,
    `THE SCOPE LINE (why this isn't 'loop' or 'openai'):`,
    `  • This asset = the CRAFT: the code, the frameworks, the model mechanics. "How do I fine-tune a HF model / write a LangChain chain / how do embeddings work?"`,
    `  • 'loop' = the ARCHITECTURE: ReAct, reflexion, when-to-loop, multi-agent. "Should the agent that writes code review it?"`,
    `  • 'openai' = one vendor's platform (ChatGPT, Codex, the API). "Responses API or Agents SDK?"`,
    `  • 'polymath' = careers/which-specialist. 'curiosity' = AI as a science to wonder at.`,
    ``,
    `The through-line: the model is one fallible component; the engineering is the validation, the retrieval, the evals, and the guardrails you build AROUND it. Simplest thing that works, measured — not the shiniest framework.`,
  ].join("\n");
}
