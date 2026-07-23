// AI APIs & POSTMAN — the craft of calling, testing, and automating APIs, with a
// focus on AI/LLM endpoints and Postman as the workbench. Three lenses:
//   api_fundamentals — HTTP/REST, auth, rate limits, JSON payloads (the base)
//   postman          — collections, environments, tests, mocks/monitors, the CLI,
//                      and Postman's 2026 AI features
//   ai_apis          — calling LLM/AI APIs specifically: request shape, streaming/
//                      SSE, reliability (retries/backoff), testing non-deterministic
//                      endpoints, webhooks/async
//
// SCOPE LINE: this asset owns the HTTP/testing/Postman CRAFT — how to call an API,
// wire it in Postman, test it, and make the calls reliable. It does NOT own:
// foundation-model INTEGRATION architecture (structured-output design, evals,
// guardrails as build decisions — that's 'aiforge'), OpenAI-specific API
// primitives/SDKs (that's 'openai'), or the PROMPT content you send (that's
// 'promptcraft'). Postman features and provider API specs change fast, so anything
// version-specific is verified via check_practice → practice_verdict.
//
// Same reverse-index shape as aiforge/gitforge/promptcraft topics.ts.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Area = "api_fundamentals" | "postman" | "ai_apis";

export const AREA_LABELS: Record<Area, string> = {
  api_fundamentals: "API fundamentals",
  postman: "Postman — the workbench",
  ai_apis: "AI/LLM APIs",
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
  // ── API fundamentals ──────────────────────────────────────────────────────
  http_rest: {
    label: "HTTP & REST basics",
    keys: ["http", "rest", "restapi", "methods", "verbs", "statuscode", "statuscodes", "get", "post", "idempotent", "httprequest"],
    area: "api_fundamentals",
    what: "REST APIs are HTTP: a method (GET/POST/PUT/PATCH/DELETE) against a URL, with headers and usually a JSON body, returning a status code and a body.",
    why: "Every API call — AI or not — is this. Fluency in methods and status codes is what lets you read an API's docs and debug a failing request in seconds.",
    key_ideas: [
      "Methods carry meaning: GET (read, safe), POST (create/action), PUT (replace), PATCH (partial update), DELETE (remove). AI APIs are almost all POST (you're sending a prompt/payload).",
      "Status codes are the first diagnostic: 2xx success, 3xx redirect, 4xx YOUR fault (400 bad request, 401 unauthenticated, 403 forbidden, 404 not found, 429 rate limited), 5xx THEIR fault (500, 502, 503).",
      "Idempotency: GET/PUT/DELETE can be safely retried; POST usually can't (you might create twice) — matters for retry logic (→ ai_api_reliability).",
      "Headers carry auth, content type, and metadata; the body carries the payload.",
    ],
    how: [
      "Read the docs for the method + URL + required headers + body shape, then reproduce it with curl or Postman before writing code.",
      "On a failure, look at the status code FIRST — it tells you whether to fix your request (4xx) or retry/wait (5xx/429).",
      "Set `Content-Type: application/json` and `Accept: application/json` for JSON APIs.",
    ],
    pitfalls: [
      "Blindly retrying a POST on timeout and creating duplicates — POST isn't idempotent unless the API gives you an idempotency key.",
      "Ignoring the status code and parsing the body as if it succeeded.",
      "Confusing 401 (who are you?) with 403 (I know you, you can't) — different fixes.",
    ],
    handoff: "Where credentials go → 'api_auth' (this asset). Testing the call in Postman → 'postman_collections' (this asset).",
  },
  api_auth: {
    label: "API authentication — keys, bearer, OAuth",
    keys: ["auth", "authentication", "apikey", "bearer", "oauth", "authorization", "credentials", "secret", "clientsecret"],
    area: "api_fundamentals",
    what: "How an API knows who you are: an API key or bearer token in a header (most AI APIs), or an OAuth flow that exchanges credentials for a short-lived access token.",
    why: "Auth is where most 'it works in the docs but not for me' failures live — and where the biggest security mistakes happen (leaked keys).",
    key_ideas: [
      "Most AI APIs: send `Authorization: Bearer <API_KEY>` (or an `x-api-key` header). Simple, but the key IS the identity — protect it.",
      "OAuth 2.0 (for user-delegated access): exchange client credentials / an auth code for a short-lived access token, then send that as a bearer token; refresh when it expires.",
      "Credentials go in HEADERS (or a secure store) — NEVER in the URL/query string (they get logged), never committed to git, never pasted into shared collections.",
      "Scope tokens to the minimum needed and rotate them if exposed.",
    ],
    how: [
      "AI API: put the key in an Authorization header. In Postman, store it as an environment SECRET variable and reference `{{apiKey}}`, not the literal.",
      "OAuth: use Postman's built-in OAuth 2.0 helper to run the flow and auto-attach the token; let it refresh.",
      "If a key ever leaks (committed, logged, shared) — ROTATE it immediately at the provider; assume it's compromised.",
    ],
    pitfalls: [
      "Putting the API key in the URL/query string — it lands in logs, history, and analytics. Headers only.",
      "Committing a key to git or hardcoding it in a shared Postman collection — use environment/secret variables.",
      "Long-lived, over-scoped tokens — scope down and rotate.",
    ],
    handoff: "Storing secrets in Postman safely → 'postman_environments' (this asset). Provider-specific auth (OpenAI keys) → 'openai'. The 'never paste your key' rule generally → 'gitforge github_security'.",
  },
  rate_limits_pagination: {
    label: "Rate limits, retries & pagination",
    keys: ["ratelimit", "ratelimits", "429", "retry", "backoff", "throttle", "pagination", "paginate", "cursor", "retryafter"],
    area: "api_fundamentals",
    what: "APIs cap how often you can call them (rate limits, signaled by 429 + Retry-After) and split big result sets across pages. Handling both is what makes a client production-ready.",
    why: "Ignore rate limits and your integration dies under load; ignore pagination and you silently process only the first page. Both are classic 'worked in dev, broke in prod' bugs.",
    key_ideas: [
      "429 Too Many Requests means slow down; respect the `Retry-After` header. Transient 5xx also warrant retry.",
      "Exponential backoff with jitter is the standard retry strategy — retry after 1s, 2s, 4s… with randomness so clients don't retry in lockstep.",
      "Only retry IDEMPOTENT operations automatically (or use an idempotency key) — blindly retrying a POST can double-charge or double-create.",
      "Pagination: results come in pages via cursor/offset/next-link; loop until there's no next page.",
    ],
    how: [
      "Implement retry-with-exponential-backoff-and-jitter for 429/5xx, honoring Retry-After; cap the number of retries.",
      "For AI APIs, cache and batch where possible to stay under the limit; watch the rate-limit headers the provider returns.",
      "Follow pagination to completion (next cursor/link) — never assume page one is everything.",
    ],
    pitfalls: [
      "Hammering retries with no backoff → you make the rate-limiting worse and can get blocked.",
      "Retrying a non-idempotent POST automatically → duplicate side effects.",
      "Processing only the first page and reporting incomplete results as complete.",
    ],
    handoff: "Reliability for AI calls specifically (timeouts, cost) → 'ai_api_reliability' (this asset). Automating this in Postman tests → 'postman_tests' (this asset).",
  },
  json_payloads: {
    label: "JSON payloads, headers & content types",
    keys: ["json", "payload", "body", "headers", "contenttype", "requestbody", "responsebody", "serialization", "parsing"],
    area: "api_fundamentals",
    what: "The request and response bodies — usually JSON — plus the headers that describe them. Getting the shape and the Content-Type right is half of a working call.",
    why: "Most 400 errors are a malformed body or a missing/wrong Content-Type. Reading the response body's error message is the fastest debugging move there is.",
    key_ideas: [
      "Set `Content-Type: application/json` when you send JSON; the server rejects or mis-parses otherwise.",
      "The request body must match the API's expected schema exactly — wrong key names/types are the usual 400 cause; the response body usually explains what's wrong.",
      "Responses carry useful headers too: rate-limit counters, request IDs (quote these when reporting a bug), pagination links.",
      "Validate/parse the response into a known shape before using it (especially for AI outputs → aiforge structured_output).",
    ],
    how: [
      "When a call 400s, READ the response body — it almost always names the offending field. Fix the body/Content-Type and retry.",
      "In Postman, use the Body → raw → JSON editor; it sets Content-Type for you.",
      "Log/keep the provider's request-ID header for support tickets.",
    ],
    pitfalls: [
      "Sending JSON without `Content-Type: application/json` and getting a confusing 400/415.",
      "Trailing commas / single quotes — invalid JSON the API rejects.",
      "Ignoring the error body and guessing at the cause.",
    ],
    handoff: "Designing/validating STRUCTURED output from an AI model → 'aiforge structured_output'. Postman request setup → 'postman_collections' (this asset).",
  },

  // ── Postman — the workbench ───────────────────────────────────────────────
  postman_collections: {
    label: "Postman collections & requests",
    keys: ["postman", "collection", "collections", "request", "requests", "folder", "workspace", "sendrequest"],
    area: "postman",
    what: "A Postman collection is a saved, organized set of API requests (in folders) you can run, share, and version — the core unit of work in Postman.",
    why: "Collections turn ad-hoc requests into a reusable, shareable, testable suite — the difference between poking an API once and having a living API workbench.",
    key_ideas: [
      "A request = method + URL + headers + body + auth; collections group related requests into folders; workspaces group collections + environments for a team.",
      "Requests can reference variables (`{{baseUrl}}`, `{{apiKey}}`) so one collection runs against dev/staging/prod by swapping the environment.",
      "The Collection Runner executes a whole collection in order — the basis for automated/CI testing.",
      "In the 2026 unified workbench, collections/environments/specs/flows/mocks live together and organize however fits the work.",
    ],
    how: [
      "Build a request, Save it into a collection/folder; parameterize the URL and secrets with `{{variables}}`.",
      "Import from an OpenAPI/spec or a curl command to bootstrap a collection fast.",
      "Run the collection (Runner or CLI) to exercise the whole flow.",
    ],
    pitfalls: [
      "Hardcoding URLs and keys in requests instead of variables → can't switch environments and you leak secrets when sharing.",
      "One giant unorganized collection → nobody can find anything; use folders.",
      "Sharing a collection with a real key baked in (→ postman_environments for the fix).",
    ],
    handoff: "Variables & secrets → 'postman_environments' (this asset). Writing assertions → 'postman_tests' (this asset).",
  },
  postman_environments: {
    label: "Environments, variables & secrets",
    keys: ["environment", "environments", "variable", "variables", "secrets", "baseurl", "vault", "envvar"],
    area: "postman",
    what: "Environments are named sets of variables (baseUrl, apiKey, tokens) that let the same collection run against dev/staging/prod — and keep secrets out of the requests themselves.",
    why: "This is how you avoid hardcoding, switch targets in one click, and — critically — keep API keys out of shared/committed collections.",
    key_ideas: [
      "Variable scopes: global → collection → environment → local (most specific wins). Pick the scope that matches how widely the value applies.",
      "Reference variables as `{{name}}` anywhere in a request (URL, headers, body).",
      "Store secrets as SECRET-type variables (masked) or in Postman Vault — never as plain text in a shared collection.",
      "Swap environments to point the same tests at a different server without editing requests.",
    ],
    how: [
      "Create a `dev`/`staging`/`prod` environment each with `baseUrl` + `apiKey`; select one and every `{{baseUrl}}`/`{{apiKey}}` resolves to it.",
      "Mark keys as secret; don't export/share an environment that contains real secret values.",
      "Set dynamic values (like an auth token) from a test script so later requests reuse them (→ postman_tests).",
    ],
    pitfalls: [
      "Committing/sharing an environment export with real secrets in it — treat it like a credentials file.",
      "Putting an environment-specific value in a global variable → it bleeds across environments.",
      "Forgetting to SELECT an environment, so `{{variables}}` resolve to nothing and requests fail cryptically.",
    ],
    handoff: "Where auth actually goes → 'api_auth' (this asset). Chaining a token between requests → 'postman_tests' (this asset).",
  },
  postman_tests: {
    label: "Writing tests & pre-request scripts",
    keys: ["test", "tests", "assertion", "assertions", "prerequest", "script", "scripting", "pmtest", "chaining", "postresponse"],
    area: "postman",
    what: "Postman runs JavaScript tests after a response (assert status, body, schema) and pre-request scripts before it (set up data, sign requests) — turning requests into automated checks.",
    why: "Tests are what make an API workbench a test SUITE: automatic verification on every run, in the app and in CI. Scripts also let requests chain (one request's output feeds the next).",
    key_ideas: [
      "Post-response tests use `pm.test(...)` + `pm.expect(...)`: assert `pm.response.code`, response time, JSON fields, and schema.",
      "Pre-request scripts run BEFORE the call — compute a timestamp, sign a payload, or set a variable.",
      "Chain requests by saving a value from one response into a variable (`pm.environment.set('token', ...)`) and using `{{token}}` in the next.",
      "The Collection Runner + these tests = a full regression run; 2026 Postman can also AI-generate contract/load/integration tests.",
    ],
    how: [
      "Add tests to a request: assert 2xx, assert the response schema, assert key fields. Run the collection to see pass/fail.",
      "Extract an auth token in a login request's test script and set it as an environment variable for downstream requests.",
      "Let AI test generation draft a baseline suite, then review and keep what's meaningful.",
    ],
    pitfalls: [
      "Only asserting status 200 — a 200 with a wrong/empty body still 'passes'. Assert the body shape too.",
      "Over-trusting AI-generated tests without reading them — they can assert the wrong thing.",
      "Fragile tests tied to exact values that legitimately change (assert types/shapes, not volatile data).",
    ],
    handoff: "Testing NON-DETERMINISTIC AI endpoints (where exact-match fails) → 'testing_ai_endpoints' (this asset). Running tests in CI → 'postman_cli' (this asset).",
  },
  postman_mocks_monitors: {
    label: "Mock servers & monitors",
    keys: ["mock", "mocks", "mockserver", "monitor", "monitors", "contracttest", "stub", "uptime", "scheduled"],
    area: "postman",
    what: "Mock servers return canned responses from your collection's examples (so you can build against an API before it exists), and monitors run collections on a schedule (uptime/health/contract checks).",
    why: "Mocks unblock front-end/integration work in parallel; monitors turn your test collection into ongoing production monitoring.",
    key_ideas: [
      "A mock server serves saved example responses at a URL — develop and test the client without the real backend.",
      "Monitors run a collection on a schedule from Postman's cloud (or CLI in your CI) and alert on failures — health checks, contract drift, SLA probes.",
      "Together they support contract-first development: agree the shape, mock it, build against it, then swap in the real API.",
    ],
    how: [
      "Add example responses to requests, create a mock server from the collection, point your client at the mock URL.",
      "Create a monitor from a test collection to run every N minutes and notify on failure.",
      "Use a mock for the not-yet-built dependency; use a monitor for the already-live endpoint you care about.",
    ],
    pitfalls: [
      "Mock responses drifting from the real API → you build against a fiction. Keep examples in sync.",
      "Monitors that only check uptime, not correctness — assert the body, not just a 200.",
      "Running expensive AI calls in a frequent monitor and racking up cost.",
    ],
    handoff: "Scheduling runs in your own CI instead → 'postman_cli' (this asset). Test assertions → 'postman_tests' (this asset).",
  },
  postman_cli: {
    label: "Postman CLI & Newman (CI)",
    keys: ["cli", "postmancli", "newman", "ci", "cicd", "pipeline", "automation", "commandline", "headless"],
    area: "postman",
    what: "Run your Postman collections and tests from the command line — Newman (the classic runner) or the newer Postman CLI — so the same suite runs locally and in CI/CD.",
    why: "This is how Postman tests become part of your pipeline: every push/PR runs the API tests headlessly and fails the build on a regression.",
    key_ideas: [
      "Export/reference a collection + environment and run it headlessly: pass/fail exit codes drive CI.",
      "The Postman CLI (2026) runs the same collections, tests, and mocks locally and in CI without reconfiguring per environment; Newman is the long-standing Node-based runner.",
      "Keep secrets as CI environment variables injected at run time — never in the exported files.",
    ],
    how: [
      "In CI: install the runner, run the collection against the right environment, let a non-zero exit fail the build.",
      "Inject the API key/secret from the CI's secret store into the environment at run time.",
      "Gate merges on the API tests passing (pairs with 'gitforge github_actions').",
    ],
    pitfalls: [
      "Committing an environment file with real secrets so CI can read it — inject secrets from the CI vault instead.",
      "Tests that pass locally but assume local-only state → make them self-contained.",
      "CLI/Newman flags and features change — verify current usage (→ check_practice).",
    ],
    handoff: "Wiring this into GitHub Actions → 'gitforge github_actions'. The AI features that assist test creation → 'postman_ai' (this asset).",
  },
  postman_ai: {
    label: "Postman's AI features (2026)",
    keys: ["postmanai", "agentmode", "aiagent", "aitestgen", "aidebug", "aibuilder", "mcpinpostman", "aifeatures"],
    area: "postman",
    what: "The 2026 'AI-native' Postman: Agent Mode (conversational; completes workflows, generates code, fixes errors), AI test generation, AI debugging in the Runner/monitors, and adding AI models / MCP servers to test against.",
    why: "These speed up the grunt work — drafting tests, diagnosing a failed run, generating client/server code — but they're assistants to review, not oracles to trust blindly.",
    key_ideas: [
      "Agent Mode works conversationally and can complete multi-step workflows, generate server stubs/client code, and propose fixes in run results.",
      "AI Test Generation adds contract/load/unit/integration/e2e tests to raise coverage; AI debugging diagnoses a failing run's root cause and suggests a fix.",
      "You can add an AI model (OpenAI/Anthropic/Google) or an MCP server to a project and test prompts/inputs directly in the client, Runner, or Flows.",
      "It's a copilot: review generated tests and fixes — AI can assert the wrong thing or 'fix' a symptom.",
    ],
    how: [
      "Use AI test generation to draft a baseline suite, then READ and prune it to what's meaningful.",
      "Let Agent Mode triage a failing run, but verify the proposed fix before accepting it.",
      "Add your AI provider/MCP server to test AI endpoints and prompts inside Postman.",
    ],
    pitfalls: [
      "Shipping AI-generated tests unread — coverage numbers that assert the wrong things.",
      "Trusting an AI 'root cause' without confirming it against the actual response/logs.",
      "These features move fast — verify current capabilities (→ check_practice), don't assume.",
    ],
    handoff: "The specifics change monthly → 'check_practice' → 'practice_verdict'. Testing AI endpoints' non-determinism → 'testing_ai_endpoints' (this asset).",
  },

  // ── AI/LLM APIs ───────────────────────────────────────────────────────────
  calling_ai_apis: {
    label: "Calling an AI/LLM API",
    keys: ["aiapi", "llmapi", "callai", "chatcompletion", "messages", "completions", "modelapi", "inference", "callmodel"],
    area: "ai_apis",
    what: "An LLM API call is a POST with your auth header and a JSON body containing the model name, the input (messages/prompt), and parameters (temperature, max tokens); the response holds the generated output + usage.",
    why: "It's the shape behind every AI feature. Knowing the common request/response structure lets you call any provider (and test it in Postman) from their docs alone.",
    key_ideas: [
      "Typical body: `model`, an input (a `messages` array for chat APIs, or a prompt), and params (`temperature`, `max_tokens`, tool/function specs).",
      "The response carries the generated content, a finish/stop reason, and a usage object (token counts → your cost).",
      "Providers differ in exact field names — read THEIR schema; the concepts transfer, the keys don't.",
      "For structured/tool output, the request declares the schema/tools and the response returns the structured call (design → aiforge).",
    ],
    how: [
      "In Postman: POST to the endpoint, Authorization: Bearer `{{apiKey}}`, JSON body with model + messages; Send and read the response.",
      "Save it as a collection request with the key as a secret variable; add tests asserting the response shape.",
      "Track the usage/token fields to watch cost (→ ai_api_reliability).",
    ],
    pitfalls: [
      "Copying one provider's exact body to another — field names differ; check the schema.",
      "Hardcoding the key in the request instead of `{{apiKey}}`.",
      "Ignoring the finish/stop reason (e.g. truncated because max_tokens hit).",
    ],
    handoff: "Designing the prompt content → 'promptcraft'. Structured-output DESIGN and integration architecture → 'aiforge'. OpenAI's specific API → 'openai'.",
  },
  streaming_sse: {
    label: "Streaming responses & SSE",
    keys: ["streaming", "stream", "sse", "serversentevents", "eventstream", "chunks", "delta", "tokenstream"],
    area: "ai_apis",
    what: "AI APIs can stream the answer token-by-token via Server-Sent Events (SSE) instead of waiting for the whole response — you read a sequence of `data:` chunks and assemble them.",
    why: "Streaming is what makes a chatbot feel instant. Testing and consuming it is different from a normal request/response, and trips people up.",
    key_ideas: [
      "With streaming on, the response is an event stream (`text/event-stream`): many `data: {delta}` lines, ending with a done marker — you concatenate the deltas.",
      "It cuts PERCEIVED latency (first token fast) even if total time is similar; great UX for long outputs.",
      "Standard request/response tools show streaming awkwardly — you need an SSE-aware client; Postman can display streamed responses.",
      "Errors mid-stream and connection drops need handling — a partial stream is a real state.",
    ],
    how: [
      "Set the streaming flag in the request body; read the SSE chunks and append each delta to build the full text.",
      "In Postman, send the streaming request and watch the incremental response; for code, use an SSE/stream-aware client.",
      "Handle the end-of-stream sentinel and mid-stream errors explicitly.",
    ],
    pitfalls: [
      "Treating a streamed response like one JSON blob — it's many events; parse incrementally.",
      "No handling for a dropped connection mid-stream → truncated output silently treated as complete.",
      "Buffering the whole stream before showing anything, throwing away the UX benefit.",
    ],
    handoff: "Cost/latency trade of streaming vs batch → 'aiforge cost_latency'. Provider-specific streaming params → 'openai' / 'check_practice'.",
  },
  ai_api_reliability: {
    label: "Reliability — retries, timeouts, cost",
    keys: ["reliability", "retries", "timeout", "timeouts", "cost", "usage", "resilience", "errorhandling"],
    area: "ai_apis",
    what: "Making AI API calls production-safe: sensible timeouts, retry-with-backoff on 429/5xx, idempotency, and tracking token usage so cost doesn't surprise you.",
    why: "AI endpoints are slower, rate-limited, and metered by token — a naive client is slow, flaky, and expensive. Reliability engineering is most of the real work.",
    key_ideas: [
      "Set explicit timeouts — AI calls can be slow; don't hang forever. Retry transient failures (429/5xx) with exponential backoff + jitter, capped.",
      "Watch idempotency: retrying a POST can double-spend tokens; use provider idempotency keys where offered.",
      "Every response reports token usage — log it; that's your bill. Set budget alerts and consider cheaper models for easy calls (→ aiforge cost_latency).",
      "Have a fallback for when the API is down or slow (cached answer, smaller model, graceful degradation).",
    ],
    how: [
      "Wrap calls with timeout + capped exponential-backoff retry on 429/5xx honoring Retry-After; never retry blindly on ambiguous POST failures.",
      "Record token usage per call; alert on spend; route easy requests to cheaper models.",
      "Add a fallback path so an outage degrades gracefully instead of hard-failing.",
    ],
    pitfalls: [
      "No timeout → a slow call hangs your whole request.",
      "Retrying a completed-but-timed-out POST → paying twice / duplicate side effects.",
      "Not tracking token usage until the bill arrives.",
    ],
    handoff: "The cost/latency levers (batching, caching, routing) in depth → 'aiforge cost_latency'. Generic rate-limit/backoff → 'rate_limits_pagination' (this asset).",
  },
  testing_ai_endpoints: {
    label: "Testing non-deterministic AI endpoints",
    keys: ["testingai", "aitesting", "nondeterministic", "llmtesting", "goldenoutput", "evalapi", "flaky", "validate"],
    area: "ai_apis",
    what: "AI endpoints don't return the same text twice, so exact-match assertions fail. You test them by asserting PROPERTIES — schema, contains-key-facts, is-valid-JSON, latency, safety — not exact strings.",
    why: "Standard API testing assumes a deterministic response; AI breaks that assumption. Testing them well is a distinct skill that most Postman tutorials miss.",
    key_ideas: [
      "Assert the SHAPE and PROPERTIES, not the exact text: valid JSON, required fields present, value in an allowed set, length bounds, no PII/unsafe content, response under a latency budget.",
      "For correctness, use a golden set + a grader (rules or an LLM-as-judge) rather than string equality — the eval mindset (→ aiforge fm_evaluation).",
      "Pin what you CAN (temperature 0, seeds) to reduce variance, but never assume byte-identical output.",
      "Contract-test the request/response schema so a provider change breaks a test, not production.",
    ],
    how: [
      "In Postman tests: assert status, assert the JSON schema, assert key fields/values are present and in range; add a latency assertion.",
      "For quality, run a golden set through the Runner/CLI and grade properties, not exact matches.",
      "Lower temperature for tests you want more stable, but still assert properties, not strings.",
    ],
    pitfalls: [
      "Asserting exact output text → a flaky test that fails on every rewording.",
      "Only asserting 200 → misses wrong-but-well-formed answers.",
      "Confusing 'consistent' with 'correct' — pin temperature and it's stable, still not necessarily right.",
    ],
    handoff: "The eval methodology (golden sets, LLM-judge caveats) → 'aiforge fm_evaluation'. Writing the Postman assertions → 'postman_tests' (this asset).",
  },
  webhooks_async: {
    label: "Webhooks & async APIs",
    keys: ["webhook", "webhooks", "async", "asynchronous", "callback", "polling", "longrunning", "job", "eventdriven"],
    area: "ai_apis",
    what: "Long-running AI jobs (batch, video/audio generation, deep research) often return a job ID immediately and deliver the result later — via a webhook (they call you) or polling (you ask repeatedly).",
    why: "Not every AI call is instant. Handling async correctly — and testing webhooks — is needed for batch and heavy generation workloads.",
    key_ideas: [
      "Async pattern: POST kicks off a job → you get a job ID → the result arrives via webhook (push) or you poll a status endpoint (pull) until done.",
      "A webhook is the provider POSTing to YOUR endpoint on an event — you need a reachable URL, and you should verify the signature to trust it.",
      "Polling is simpler to build but wastes calls; webhooks are efficient but need a public endpoint and security.",
      "Test webhooks with a mock/receiver and verify the signature; test polling by asserting the status transitions.",
    ],
    how: [
      "For async jobs: submit, store the job ID, then either register a webhook or poll the status endpoint with backoff until complete/failed.",
      "For an incoming webhook: expose an endpoint, VERIFY the signature/secret, respond 2xx fast, process out of band.",
      "Test with Postman: mock the webhook receiver, or use a request that asserts the polling status flow.",
    ],
    pitfalls: [
      "Trusting an unverified webhook payload — anyone can POST to your URL; verify the signature.",
      "Polling too aggressively (rate limits/cost) or too slowly (stale) — back off sensibly.",
      "Doing heavy work synchronously in the webhook handler instead of ack-fast-process-later.",
    ],
    handoff: "Webhook/automation as an agent-loop trigger (automations) → 'loop building_blocks'. Securing the receiving endpoint → 'aiforge fm_guardrails' / 'gitforge github_security'.",
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
      `AI APIs & POSTMAN — calling, testing, and automating APIs (AI endpoints especially)`,
      `BOTTOM LINE: an API call is just HTTP; the craft is auth, reliability, and testing — and for AI endpoints, testing PROPERTIES not exact text. Pick a topic; the 'pitfalls' are the part worth reading.`,
      ``,
      ...areas.flatMap((area) => [
        `${AREA_LABELS[area]}:`,
        ...topicsByArea(area).map((k) => `  ▸ ${TOPICS[k].label} — 'explain_topic ${k}'`),
        ``,
      ]),
      `Other tools: how_to <goal> (set up a call/test in Postman step by step), debug <symptom>, myth_vs_reality, and check_practice → practice_verdict for Postman features & provider API specs (they move fast).`,
      ``,
      `SCOPE: HTTP/testing/Postman craft. Foundation-model INTEGRATION architecture (structured-output design, evals, guardrails) → 'aiforge'. OpenAI-specific API primitives → 'openai'. The PROMPT content → 'promptcraft'.`,
    ].join("\n");
  }
  const key = resolveTopic(topic);
  if (!key) {
    return `Not sure which API/Postman topic "${clean(topic)}" is. Topics: ${Object.values(TOPICS)
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
    `Postman features and provider API specs move fast — anything version-specific is verified via check_practice → practice_verdict, never recalled.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is the AI-API & Postman expert — how to call an API, wire it into Postman, test it, and make the calls reliable, with a focus on AI/LLM endpoints. Under it all, every API call is just HTTP: a method, a URL, headers, a body, a status code.`,
    ``,
    `THREE LENSES:`,
    `  • API FUNDAMENTALS — HTTP/REST & status codes, authentication (keys/bearer/OAuth), rate limits/retries/pagination, JSON payloads & headers → 'explain_topic api_fundamentals'.`,
    `  • POSTMAN (the workbench) — collections & requests, environments/variables/secrets, tests & pre-request scripts, mocks & monitors, the CLI/Newman for CI, and Postman's 2026 AI features → 'explain_topic postman'.`,
    `  • AI/LLM APIs — calling an AI API (request/response shape), streaming & SSE, reliability (retries/timeouts/cost), testing NON-DETERMINISTIC endpoints, webhooks & async jobs → 'explain_topic ai_apis'.`,
    ``,
    `THE TOOLS:`,
    `  • 'explain_topic <topic>' — the front door; no arg for the full map.`,
    `  • 'how_to <goal>' — set up a specific call or test in Postman ('call an LLM API', 'add an auth token', 'test an endpoint', 'handle rate limits', 'test a streaming response').`,
    `  • 'debug <symptom>' — 401/403, 429, CORS, timeout, streaming not working, {{variable}} not resolving, 400 bad body.`,
    `  • 'myth_vs_reality' — 'a 200 means it worked', 'put the key in the URL', 'retry everything', 'test AI endpoints with exact-match', 'AI-generated tests are trustworthy'.`,
    `  • 'check_practice' → 'practice_verdict' — Postman features & provider API specs (they change monthly), verified via research.`,
    ``,
    `THE TWO RULES THAT PREVENT THE MOST PAIN: (1) credentials go in HEADERS or a secret store — never the URL, never committed, never in a shared collection; rotate any key that leaks. (2) AI endpoints are non-deterministic — test PROPERTIES (schema, key facts, latency, safety), never exact text.`,
    ``,
    `SCOPE: the HTTP/testing/Postman craft — not FM-integration architecture (aiforge), not OpenAI-specific primitives (openai), not the prompt content (promptcraft).`,
  ].join("\n");
}
