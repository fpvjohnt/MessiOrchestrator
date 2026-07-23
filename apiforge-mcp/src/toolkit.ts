// how_to / debug / myth_vs_reality for AI APIs & Postman. Deterministic, offline.
// how_to maps a goal to concrete Postman/API setup steps; debug maps an HTTP/
// Postman symptom to cause + fix; myth_vs_reality debunks the folklore.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

// ── how_to ──────────────────────────────────────────────────────────────────
interface Recipe {
  match: (t: string) => boolean;
  title: string;
  steps: string[];
  note?: string;
}

const RECIPES: Recipe[] = [
  {
    match: (t) => has(t, "call an llm", "call an ai", "call a model", "call the openai", "call an api", "send a request", "make a request", "hit an endpoint"),
    title: "Call an AI/LLM API in Postman",
    steps: [
      "New request → method POST → paste the endpoint URL.",
      "Auth: Headers → `Authorization: Bearer {{apiKey}}` (store the real key as a SECRET environment variable, not inline).",
      "Body → raw → JSON: `{ \"model\": \"…\", \"messages\": [ … ], \"temperature\": 0 }` per the provider's schema.",
      "Send, read the response (content + finish reason + usage/tokens). Save the request into a collection.",
    ],
    note: "Field names differ per provider — read THEIR schema. Never hardcode the key; use {{apiKey}}.",
  },
  {
    match: (t) => has(t, "auth token", "add auth", "authenticate", "bearer", "api key", "oauth", "set the key", "add a token"),
    title: "Set up authentication",
    steps: [
      "API key/bearer: create an environment variable `apiKey` (mark it Secret), then Header `Authorization: Bearer {{apiKey}}`.",
      "OAuth 2.0: Request → Authorization tab → type OAuth 2.0 → fill the flow → 'Get New Access Token' → Postman attaches + can refresh it.",
      "Never put the key in the URL/query string, never commit it, never share a collection/environment with the real value in it.",
    ],
    note: "If a key leaks, rotate it at the provider immediately — assume it's compromised.",
  },
  {
    match: (t) => has(t, "test an endpoint", "test the api", "write a test", "assert", "add tests", "test my api"),
    title: "Test an endpoint in Postman",
    steps: [
      "On the request → Scripts/Tests tab, add assertions: `pm.test('status 200', () => pm.response.to.have.status(200));`.",
      "Assert the BODY too, not just status: check the response is valid JSON and required fields exist / are the right type.",
      "For AI endpoints, assert PROPERTIES not exact text (schema, key fields present, value-in-set, latency budget) — see 'testing_ai_endpoints'.",
      "Run the whole collection with the Collection Runner (or the CLI in CI) to see pass/fail.",
    ],
    note: "A 200 with a wrong/empty body still 'passes' a status-only test — assert the shape.",
  },
  {
    match: (t) => has(t, "rate limit", "429", "retry", "backoff", "throttle"),
    title: "Handle rate limits (429)",
    steps: [
      "On 429, respect the `Retry-After` header; retry with exponential backoff + jitter (1s, 2s, 4s…), capped.",
      "Only auto-retry idempotent calls; for a POST, use a provider idempotency key or don't blind-retry.",
      "Reduce pressure: batch/cache where possible; watch the rate-limit headers the provider returns.",
    ],
    note: "In Postman you can script backoff between runs; in code, wrap calls in a retry helper.",
  },
  {
    match: (t) => has(t, "streaming", "stream", "sse", "server sent", "token by token"),
    title: "Work with a streaming (SSE) response",
    steps: [
      "Set the streaming flag in the request body (per provider). The response is `text/event-stream` — many `data:` chunks.",
      "Consume it incrementally: append each delta to build the full text; handle the end-of-stream sentinel and mid-stream errors.",
      "In Postman, send it and watch the incremental response; in code use an SSE/stream-aware client, not a plain JSON parse.",
    ],
    note: "Don't buffer the whole stream before showing anything — that throws away the UX win.",
  },
  {
    match: (t) => has(t, "environment", "variable", "switch env", "dev staging prod", "base url", "secret"),
    title: "Set up environments & variables",
    steps: [
      "Create environments (dev/staging/prod), each with `baseUrl` and `apiKey` (Secret). Select one to activate it.",
      "Reference `{{baseUrl}}` / `{{apiKey}}` in requests so the same collection runs anywhere by swapping environments.",
      "Never export/share an environment containing real secret values; inject secrets from CI at run time.",
    ],
  },
  {
    match: (t) => has(t, "chain", "use response", "pass token", "one request to another", "extract"),
    title: "Chain requests (use one response in the next)",
    steps: [
      "In the first request's Tests, extract the value: `pm.environment.set('token', pm.response.json().access_token);`.",
      "In the next request, reference `{{token}}` in the header/body.",
      "Run them in order via the Collection Runner so the variable is set before it's used.",
    ],
  },
  {
    match: (t) => has(t, "ci", "pipeline", "newman", "cli", "automate", "github actions"),
    title: "Run Postman tests in CI",
    steps: [
      "Export/reference the collection + environment; run headlessly with the Postman CLI or Newman.",
      "Inject the API key from the CI secret store into the environment at run time (never commit it).",
      "Fail the build on a non-zero exit; gate merges on it (pairs with gitforge → 'github_actions').",
    ],
  },
];

export function howTo(rawGoal: string): string {
  const goal = clean(rawGoal).toLowerCase();
  const hit = RECIPES.find((r) => r.match(goal));
  if (!hit) {
    return [
      `HOW TO — "${clean(rawGoal)}"`,
      `No exact recipe matched. Common goals I have step-by-steps for:`,
      ...RECIPES.map((r) => `  • ${r.title}`),
      ``,
      `Rephrase toward one of those, or 'explain_topic <topic>' for the concept. For current Postman/provider specifics, 'check_practice' verifies them.`,
    ].join("\n");
  }
  return [
    `HOW TO — ${hit.title}`,
    `BOTTOM LINE: set it up so secrets stay out of the request and the test asserts the real thing, not just a 200.`,
    ``,
    `Steps:`,
    ...hit.steps.map((s, i) => `  ${i + 1}. ${s}`),
    ...(hit.note ? ["", `⚠ ${hit.note}`] : []),
    ``,
    `Two rules underneath everything: credentials go in headers/secret store (never the URL, never committed); AI endpoints are tested by PROPERTIES, never exact text.`,
  ].join("\n");
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
    keys: ["401", "unauthorized", "unauthenticated", "invalid api key", "invalid key", "authentication failed"],
    title: "401 Unauthorized",
    cause: "The API doesn't accept your credentials — missing/wrong/expired key, wrong header name, or the `{{apiKey}}` variable didn't resolve.",
    fix: [
      "Confirm the header is exactly what the provider wants (`Authorization: Bearer <key>` vs `x-api-key`).",
      "Check the `{{apiKey}}` variable actually resolved — is an environment SELECTED and does it hold the value?",
      "Verify the key is current and not expired/rotated; regenerate if unsure.",
    ],
  },
  {
    keys: ["403", "forbidden", "permission", "not allowed", "access denied"],
    title: "403 Forbidden",
    cause: "You're authenticated but not authorized — the key lacks the scope/permission, or you're hitting a resource you can't access.",
    fix: [
      "Check the key's scopes/permissions and the plan/tier allows this endpoint.",
      "Confirm you're targeting the right org/project/resource.",
      "401 = who are you; 403 = I know you, you can't. Different fix.",
    ],
  },
  {
    keys: ["429", "rate limit", "too many requests", "throttled", "quota"],
    title: "429 Too Many Requests",
    cause: "You exceeded the rate/quota limit.",
    fix: [
      "Respect the `Retry-After` header; back off exponentially with jitter, capped.",
      "Reduce call volume: batch, cache, route easy calls to a cheaper model.",
      "Only auto-retry idempotent calls; don't blind-retry a POST.",
    ],
  },
  {
    keys: ["400", "bad request", "invalid body", "malformed", "422", "validation"],
    title: "400/422 Bad Request",
    cause: "The request body/params don't match the API's schema — wrong field names/types, invalid JSON, or missing required fields.",
    fix: [
      "READ the response body — it almost always names the offending field.",
      "Set `Content-Type: application/json`; validate your JSON (no trailing commas/single quotes).",
      "Match the provider's exact schema (field names differ across providers).",
    ],
  },
  {
    keys: ["cors", "cross origin", "blocked by cors", "access-control"],
    title: "CORS error (from a browser)",
    cause: "A browser is blocking a cross-origin call — usually because you're calling the API directly from front-end JS, which also EXPOSES YOUR KEY.",
    fix: [
      "Don't call a secret-key API from the browser — proxy it through your backend (which holds the key).",
      "CORS is a browser policy; server-to-server calls and Postman aren't subject to it.",
      "If it's a public API meant for browsers, ensure you're using the correct endpoint/headers it allows.",
    ],
  },
  {
    keys: ["timeout", "timed out", "hangs", "slow", "no response", "etimedout"],
    title: "Request timeout / hangs",
    cause: "AI calls can be slow; with no timeout the request hangs, or the endpoint/network is unreachable.",
    fix: [
      "Set an explicit timeout; on transient failure retry with backoff (not instantly, not forever).",
      "For long jobs, use the async pattern (job ID + webhook/poll) instead of one long blocking call.",
      "Check reachability (URL, network, is it a streaming endpoint you're parsing as one blob?).",
    ],
  },
  {
    keys: ["streaming not", "stream not working", "sse not", "only get part", "chunks", "delta not"],
    title: "Streaming response not working",
    cause: "You're parsing an event-stream as a single JSON response, or the streaming flag/headers aren't set.",
    fix: [
      "Set the provider's streaming flag; expect `text/event-stream` with many `data:` chunks, not one JSON body.",
      "Consume incrementally (append deltas); handle the done sentinel and mid-stream errors.",
      "Use an SSE-aware client/tool; a plain JSON parser will choke on the stream.",
    ],
  },
  {
    keys: ["variable", "{{", "not resolving", "undefined variable", "no environment", "blank url"],
    title: "{{variable}} not resolving",
    cause: "No environment is selected, the variable is in the wrong scope, or the name is misspelled — so `{{x}}` stays literal and the request malforms.",
    fix: [
      "Select the environment that defines the variable (top-right selector).",
      "Check the scope (global vs collection vs environment) and the exact name.",
      "Set dynamic values (like a token) in a prior request's test script before using them.",
    ],
  },
];

export function debug(rawSymptom: string): string {
  const s = clean(rawSymptom).toLowerCase();
  const matches = SYMPTOMS.filter((sym) => sym.keys.some((k) => s.includes(k)));
  const header = [
    `DEBUG — "${clean(rawSymptom)}"`,
    `BOTTOM LINE: the status code (or the response body) usually names the fix. Likely cause and the fix, in order:`,
    ``,
  ];
  if (!matches.length) {
    return [
      ...header,
      `No exact match. The API debugging reflex:`,
      `  1. Look at the STATUS CODE — 4xx is your request (fix it), 5xx/429 is theirs (retry/wait).`,
      `  2. READ the response body — it usually explains a 400/401/403.`,
      `  3. Check auth (header name + {{apiKey}} resolved + environment selected) and Content-Type.`,
      ``,
      `Known symptoms: ${SYMPTOMS.map((x) => x.title).join("; ")}. Paste the exact status/message for a targeted read.`,
    ].join("\n");
  }
  const body = matches.flatMap((sym) => [
    `▸ ${sym.title}`,
    `  Likely cause: ${sym.cause}`,
    `  Fix, in order:`,
    ...sym.fix.map((f) => `    ${f}`),
    ``,
  ]);
  return [...header, ...body, `Postman/provider specifics change — verify current behavior via check_practice → practice_verdict.`].join("\n");
}

// ── myth_vs_reality ──────────────────────────────────────────────────────────
const MYTHS: Array<{ myth: string; reality: string }> = [
  {
    myth: "A 200 status means the call worked.",
    reality: "200 means the HTTP request succeeded — the BODY can still be empty, wrong, or an error the API returned with a 200. Always assert the body shape and the fields you need, not just the status.",
  },
  {
    myth: "Putting the API key in the URL is fine.",
    reality: "Query strings get logged everywhere — server logs, proxies, browser history, analytics. Credentials go in HEADERS or a secret store, never the URL. And never commit a key or ship it in front-end JS.",
  },
  {
    myth: "Just retry any failed request.",
    reality: "Retry idempotent calls (GET/PUT/DELETE) and transient failures (429/5xx) with backoff — but blindly retrying a POST that may have succeeded double-creates/double-charges. Use idempotency keys or don't auto-retry POSTs.",
  },
  {
    myth: "You can test an AI endpoint with exact-match assertions.",
    reality: "AI responses aren't deterministic — exact-match tests flake on every rewording. Test PROPERTIES: valid schema, key facts present, value in an allowed set, latency budget, safety. Use a golden set + grader for correctness.",
  },
  {
    myth: "AI-generated tests (Postman Agent Mode) can be trusted as-is.",
    reality: "They're a great first draft that boosts coverage — but AI can assert the wrong thing or 'fix' a symptom. Read every generated test and proposed fix before keeping it; a passing suite that checks the wrong thing is worse than none.",
  },
  {
    myth: "Postman and a real client behave the same, so if it works in Postman it works everywhere.",
    reality: "Postman isn't subject to browser CORS and handles auth/streaming for you. A browser call can hit CORS (and leak your key); a naive code client can mishandle SSE or timeouts. Test the ACTUAL client path too.",
  },
  {
    myth: "Streaming is just a faster response.",
    reality: "Streaming returns an event-stream of chunks, not one JSON blob — you must parse deltas incrementally, handle mid-stream errors and drops, and detect the end sentinel. It improves PERCEIVED latency, and it needs different handling.",
  },
];

export function mythVsReality(): string {
  return [
    `AI-API & POSTMAN MYTHS vs REALITY`,
    `BOTTOM LINE: most API bugs are auth, the request body, or a wrong assumption about the response. The reality below is 'read the status + body, protect the key, and test properties not text'.`,
    ``,
    ...MYTHS.flatMap(({ myth, reality }, i) => [`${i + 1}. MYTH: "${myth}"`, `   REALITY: ${reality}`, ``]),
    `The through-line: a 200 isn't success, the key never goes in the URL, retries need idempotency, and AI endpoints are tested by properties — never exact text.`,
  ].join("\n");
}
