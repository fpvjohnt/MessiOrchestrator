// Golden set for routing accuracy — the answer key we never had. Each entry is
// labeled by GENUINE user intent: the asset that SHOULD own the question,
// regardless of what the current router does. `alsoOk` lists assets that would
// also be a defensible pick (for legitimately cross-domain questions).
//
// Honesty rules for this file:
//  - Label by intent, never by observed behavior. A wrong route must show as a
//    miss, or the number is a lie.
//  - Keep a realistic mix: mostly clear questions, a minority genuinely hard.
//  - Grow it. The Researcher's #2 (paraphrase robustness) and #3 (outcome
//    labels) both build on this file.

export const GOLDEN = [
  // homebuyer
  { q: "how much house can I afford in Murrieta on my salary", expect: ["homebuyer"] },
  { q: "what's the difference between an FHA and a conventional loan", expect: ["homebuyer"] },
  { q: "is it better to rent or buy a condo right now", expect: ["homebuyer"], alsoOk: ["research"], note: "VERIFIER: asks about a fact with a shelf life, so research co-assigns as the independent checker (src/index.ts protocol: never let the maker verify itself). Labeled by INTENT - the specialists are offline and deterministic, so on this question they are the least current source available. Rent-vs-buy turns on CURRENT rates." },
  { q: "what are Mello-Roos taxes and do they apply in Temecula", expect: ["homebuyer"] },
  { q: "how much cash do I need to close on a house", expect: ["homebuyer"] },

  // nestegg
  { q: "how should I start investing in my 401k", expect: ["nestegg"] },
  { q: "what is a Roth IRA and should I open one", expect: ["nestegg"] },
  { q: "are index funds better than picking individual stocks", expect: ["nestegg"] },
  { q: "how much will investing 500 dollars a month grow in 20 years", expect: ["nestegg"] },
  { q: "should I put money into bitcoin", expect: ["nestegg"] },

  // lawguide
  { q: "I got arrested what are my rights", expect: ["lawguide"] },
  { q: "my landlord won't return my security deposit", expect: ["lawguide"] },
  { q: "how does small claims court work in California", expect: ["lawguide"] },
  { q: "a debt collector keeps calling me is that legal", expect: ["lawguide"] },
  { q: "I got a speeding ticket should I fight it in court", expect: ["lawguide"] },

  // jobhunt
  { q: "how do I get my resume past the applicant tracking system", expect: ["jobhunt"] },
  { q: "what career would fit me if I like working with my hands", expect: ["jobhunt"] },
  { q: "how do I negotiate a higher salary for a job offer", expect: ["jobhunt"] },
  { q: "why am I not getting any interview callbacks", expect: ["jobhunt"] },
  { q: "how do I move from tech support into a cybersecurity career", expect: ["jobhunt"], alsoOk: ["polymath"], note: "career-transition — intent is jobhunt, but security vocab pulls polymath" },

  // polymath
  { q: "my Windows machine keeps freezing and I don't know why", expect: ["polymath"] },
  { q: "how would I build a Tableau dashboard from data on a SQL server", expect: ["polymath"] },
  { q: "how do I pitch an AI automation idea to leadership for budget", expect: ["polymath"] },
  { q: "what does a data analytics engineer do day to day", expect: ["polymath"] },
  { q: "how would I set up a home SIEM lab to detect intrusions", expect: ["polymath"], note: "'home' may pull homebuyer" },
  { q: "how do I level up from systems analyst toward AI engineer", expect: ["polymath"] },

  // healthguide
  { q: "I have a migraine which kind of doctor should I see", expect: ["healthguide"] },
  { q: "how much protein do I need to build muscle", expect: ["healthguide"] },
  { q: "is this supplement's health claim actually backed by science", expect: ["healthguide"], alsoOk: ["research"], note: "VERIFIER: a claim asked to be checked against evidence is the maker-can't-verify-itself case (src/index.ts protocol), so research co-assigns as the independent checker. Labeled by INTENT, consistent with the rent-vs-buy/deprecation verifier labels. healthguide answers from a fixed map; 'backed by science' is exactly what an offline specialist should not self-certify." },
  { q: "I've been feeling really anxious lately who should I talk to", expect: ["healthguide"] },
  { q: "what kind of specialist treats ongoing stomach problems", expect: ["healthguide"] },

  // overseer
  { q: "show me exactly what happened in that case", expect: ["overseer"] },
  { q: "did the routing change over time for similar questions", expect: ["overseer"], note: "'routing' isn't an overseer tag — may miss" },
  { q: "which asset has logged the most errors", expect: ["overseer"] },

  // research (fallback — plain factual, no domain)
  { q: "what is the tallest building in the world", expect: ["research"] },
  { q: "who invented the telephone", expect: ["research"] },
  { q: "what is the population of Japan", expect: ["research"] },
  { q: "explain how photosynthesis works", expect: ["research"] },

  // genuinely cross-domain (either is defensible)
  { q: "how do I start investing in real estate", expect: ["nestegg"], alsoOk: ["homebuyer"], note: "invest vs property — both defensible" },
  { q: "can my employer legally cut my pay without telling me", expect: ["lawguide"], alsoOk: ["jobhunt"], note: "legal-rights vs job — lawguide leads" },

  // curiosity (science)
  { q: "why do black holes form and what happens inside them", expect: ["curiosity"] },
  { q: "is the ancient aliens theory about the pyramids actually true", expect: ["curiosity"], alsoOk: ["research"], note: "VERIFIER: 'actually true' asks for an independent check of a claim, the maker-can't-verify-itself case (src/index.ts protocol), so research co-assigns. Labeled by INTENT, consistent with the other verifier labels. curiosity owns the topic; whether the theory holds up is what an offline specialist should not self-certify." },

  // education
  { q: "what math class do I take after algebra 2", expect: ["education"] },
  { q: "how should I study for my chemistry exam", expect: ["education"], alsoOk: ["curiosity"], note: "study/exam=education; chemistry topic could pull curiosity" },

  // communication
  { q: "how do I get better at public speaking and presentations", expect: ["communication"] },
  { q: "how can I read people and understand body language honestly", expect: ["communication"] },

  // sports
  { q: "how do soccer scouts identify a talented young player", expect: ["sports"] },
  { q: "how does the offside rule work in soccer", expect: ["sports"] },

  // government
  { q: "how do I get a work visa to move to Germany", expect: ["government"] },
  { q: "what are the paths to immigrate and get residency abroad", expect: ["government"] },

  // linguistics
  { q: "what language family does Swahili belong to", expect: ["linguistics"] },
  { q: "what is the best way to learn a foreign language", expect: ["linguistics"], alsoOk: ["education"], note: "linguistics=the science; education owns language CLASSES" },

  // faiths
  { q: "what do Buddhists actually believe", expect: ["faiths"] },
  { q: "what is Kabbalah in Judaism", expect: ["faiths"] },

  // loop (agentic AI loop engineering)
  { q: "how do I stop my AI agent from getting stuck in an infinite loop", expect: ["loop"] },
  { q: "should I use ReAct or plan-and-execute for my agent loop", expect: ["loop"] },
  { q: "how do I build a RAG loop that cites its sources", expect: ["loop"], alsoOk: ["research"], note: "'sources' pulls research; rag+loop should lead" },
  { q: "how do I evaluate whether my LLM agent actually works", expect: ["loop"] },
  { q: "what building blocks do I need to make my agent loop autonomous", expect: ["loop"] },
  { q: "why do I need git worktrees when running agents in parallel", expect: ["loop"] },

  // openai (OpenAI platform engineering — the vendor-specific EXECUTION layer)
  { q: "should I use the Responses API or the Agents SDK", expect: ["openai"] },
  { q: "is the OpenAI Chat Completions API deprecated", expect: ["openai"], alsoOk: ["research"], note: "VERIFIER: asks about a fact with a shelf life, so research co-assigns as the independent checker (src/index.ts protocol: never let the maker verify itself). Labeled by INTENT - the specialists are offline and deterministic, so on this question they are the least current source available. Deprecation status is exactly what openai check_openai refuses to answer from memory." },
  { q: "my code broke after migrating to the Responses API", expect: ["openai"] },
  { q: "should I fine-tune GPT on our internal documentation", expect: ["openai"] },
  { q: "how do I cut my OpenAI API costs with prompt caching", expect: ["openai"], alsoOk: ["research"], note: "VERIFIER: asks about a fact with a shelf life, so research co-assigns as the independent checker (src/index.ts protocol: never let the maker verify itself). Labeled by INTENT - the specialists are offline and deterministic, so on this question they are the least current source available. Pricing moves on a scale of weeks." },
  { q: "what does store true do on an OpenAI response", expect: ["openai"] },
  // The genuine openai↔loop boundary — vendor-specific execution vs vendor-neutral architecture.
  { q: "how do I build a customer support agent on OpenAI with handoffs", expect: ["openai"], alsoOk: ["loop"], note: "multi-agent vocab pulls loop; 'on OpenAI' makes it an execution question — openai should lead" },
  { q: "what agent architecture should I use, ReAct or plan-and-execute", expect: ["loop"], alsoOk: ["openai"], note: "vendor-neutral architecture — loop owns this even though it's agent+AI vocab" },
  // Codex — the agentic coding surface. Lives with openai, NOT loop.
  { q: "what is Codex and how do I use it", expect: ["openai"] },
  { q: "why does Codex stop early before finishing the work", expect: ["openai"] },
  { q: "how do I write a good AGENTS.md for my repo", expect: ["openai"], alsoOk: ["loop"], note: "AGENTS.md is a Codex artifact; loop's 'Skills/durable knowledge' block is a defensible second read" },

  // openai — the profession lens (how_they_use_it). These are TOOL-USAGE questions,
  // so openai owns them; the domain asset riding along is correct, not noise.
  { q: "how does a lawyer use ChatGPT without getting sanctioned", expect: ["openai"], alsoOk: ["lawguide"], note: "tool-usage question; lawguide owns the legal question itself" },
  { q: "how do real estate agents write listings with ChatGPT", expect: ["openai"], alsoOk: ["homebuyer"], note: "Fair Housing trap is a tool-usage matter; homebuyer owns the market question" },
  { q: "what is the difference between ChatGPT Chat and Work mode", expect: ["openai"] },
  { q: "should I put my preferences in custom instructions or the prompt", expect: ["openai"], alsoOk: ["promptcraft"], note: "BOUNDARY: 'custom instructions' is a ChatGPT feature (openai); 'the prompt' pulls the promptcraft asset — keyword routing can't fully disambiguate. Documented ceiling case, like black-holes/employer-pay." },

  // aiforge (AI/ML engineering CRAFT — the code/frameworks/science, vs loop's architecture)
  { q: "how do I fine-tune a Hugging Face model with LoRA", expect: ["aiforge"] },
  { q: "how do I quantize an open model to run it locally", expect: ["aiforge"] },
  { q: "what Python libraries do I need for machine learning", expect: ["aiforge"] },
  { q: "how do embeddings and vector search actually work", expect: ["aiforge"] },
  { q: "how does a tokenizer split text into subword tokens", expect: ["aiforge"], note: "tokenization is aiforge's craft/science ('language model' phrasing would pull linguistics)" },
  { q: "my LangChain code uses AgentExecutor and it says deprecated", expect: ["aiforge"], alsoOk: ["research"], note: "VERIFIER: asks about a fact with a shelf life, so research co-assigns as the independent checker (src/index.ts protocol: never let the maker verify itself). Labeled by INTENT - the specialists are offline and deterministic, so on this question they are the least current source available. aiforge check_practice says this stack rots in months." },
  { q: "what is the difference between RAG and fine-tuning", expect: ["aiforge"], alsoOk: ["loop"], note: "RAG pulls loop; the fine-tune-vs-RAG-vs-prompt decision is aiforge's craft" },

  // gitforge (Git & GitHub)
  { q: "how do I undo my last git commit", expect: ["gitforge"] },
  { q: "what does git reflog do and how do I recover lost commits", expect: ["gitforge"] },
  { q: "how do I fix a merge conflict", expect: ["gitforge"] },
  { q: "how do I set up a GitHub Actions workflow for CI", expect: ["gitforge"] },
  { q: "what is the difference between git merge and rebase", expect: ["gitforge"] },

  // promptcraft (prompt engineering — vendor-neutral technique)
  { q: "how do I write a good few-shot prompt", expect: ["promptcraft"] },
  { q: "should I use chain of thought prompting for this", expect: ["promptcraft"] },
  { q: "how should I prompt a reasoning model differently", expect: ["promptcraft"] },
  { q: "why is my prompt giving inconsistent output", expect: ["promptcraft"], alsoOk: ["aiforge"], note: "prompt reliability is promptcraft; 'output/eval' can pull aiforge" },

  // apiforge (AI APIs & Postman)
  { q: "how do I call an LLM API in Postman", expect: ["apiforge"] },
  { q: "how do I test an API endpoint and assert the response", expect: ["apiforge"] },
  { q: "why am I getting a 401 error from the API", expect: ["apiforge"] },
  { q: "how do I handle rate limiting and retries when calling an API", expect: ["apiforge"] },
  { q: "how do I consume a streaming SSE response from an AI API", expect: ["apiforge"] },

  // kalshi (event contracts & prediction markets)
  { q: "how do prediction markets actually work", expect: ["kalshi"] },
  { q: "what is an event contract and how does it settle", expect: ["kalshi"] },
  { q: "how much do the fees cost on an event contract", expect: ["kalshi"], alsoOk: ["research"], note: "VERIFIER: asks about a fact with a shelf life, so research co-assigns as the independent checker (src/index.ts protocol: never let the maker verify itself). Labeled by INTENT - the specialists are offline and deterministic, so on this question they are the least current source available. The kalshi asset holds NO fee numbers by design." },
  // DOCUMENTED CEILING CASE — expected to MISS, and left in deliberately.
  // Only prediction markets quote a contract in cents, so the intent is
  // unambiguous to a human, but the query's one strong noun is "contract",
  // which lawguide owns and kalshi may not claim (AGENTS.md). Tagging kalshi
  // with "cents" was tried and measured: it captured "how many cents on the
  // dollar will creditors take" (a debt question) and was reverted. A miss
  // here is the honest number; making it pass would cost a real misroute.
  { q: "is a contract trading at 90 cents nearly free money", expect: ["kalshi"], note: "CEILING: 'contract' belongs to lawguide; tagging 'cents' to fix this broke debt routing" },
  { q: "how does kalshi compare to polymarket", expect: ["kalshi"] },
  // BOUNDARY CASES against the neighbouring assets. Each of these words —
  // betting, odds, market, contract, legal — belongs to someone else in another
  // sense, and getting them wrong is how a new asset quietly degrades routing.
  { q: "is betting on the election legal where I live", expect: ["kalshi"], alsoOk: ["lawguide"], note: "BOUNDARY: legality OF prediction markets is kalshi's subject; lawguide legitimately rides on 'legal'" },
  { q: "what are the odds the Lakers win tonight", expect: ["sports"], alsoOk: ["research"], note: "BOUNDARY: sports 'odds' must NOT reach kalshi — this is why the bare 'odds' tag was dropped" },
  { q: "how should I invest my 401k for retirement", expect: ["nestegg"], note: "BOUNDARY: real investing stays with nestegg, not the speculation asset" },
  { q: "how do I hedge my portfolio against a downturn", expect: ["nestegg"], note: "BOUNDARY: 'hedge' is portfolio vocabulary, deliberately not a kalshi tag" },

  // psychology (the FIELD — not anyone's own mental health)
  { q: "explain classical and operant conditioning", expect: ["psychology"] },
  { q: "what is the Big Five personality model", expect: ["psychology"] },
  { q: "how does attachment theory work in child development", expect: ["psychology"] },
  { q: "what did the Milgram obedience experiments actually find", expect: ["psychology"] },
  { q: "what is kinesics and how do researchers study body movement", expect: ["psychology"] },
  { q: "explain the replication crisis in psychology", expect: ["psychology"] },
  { q: "is the Myers-Briggs personality test scientifically valid", expect: ["psychology"], alsoOk: ["research"], note: "VERIFIER: 'scientifically valid' asks for an independent check of a claim — the maker-can't-verify-itself case (src/index.ts protocol). psychology owns the topic; whether MBTI holds up is what an offline specialist should not self-certify." },

  // BOUNDARY CASES against the neighbouring assets. Psychology's natural
  // vocabulary is almost entirely spoken for, and every line below is a word
  // this asset deliberately did NOT tag. Measured before shipping, because a
  // golden-set win can hide a real collision (see the kalshi block above).
  { q: "I think I might be depressed and I don't know what to do", expect: ["healthguide"], note: "BOUNDARY, SAFETY-CRITICAL: personal mental health must NEVER reach the explainer. healthguide runs a non-suppressible 911/988 override first. This is why 'depression'/'anxiety'/'stress'/'therapist' are healthguide tags and psychology does not claim one of them." },
  { q: "how do I find a therapist and will my insurance cover it", expect: ["healthguide"], note: "BOUNDARY: care navigation is healthguide, not the field explainer" },
  { q: "how do I read someone's body language in a negotiation", expect: ["communication"], note: "BOUNDARY: the PRACTICE of reading people is communication's — it owns bodylanguage/nonverbal/posture/eyecontact. psychology only claims the technical science terms (kinesics, proxemics, paralanguage)." },
  { q: "how do I make my presentation more persuasive", expect: ["communication"], note: "BOUNDARY: 'persuasion' is a communication tag, deliberately not claimed here" },
  { q: "how should I study for my psychology exam", expect: ["education"], note: "BOUNDARY: studying a SUBJECT is education, even when the subject is this asset's field" },
  { q: "what did Einstein actually discover", expect: ["curiosity"], note: "BOUNDARY: curiosity's 'minds_science' branch is GREAT SCIENTIFIC MINDS — biography, not cognition. Easy to confuse by name." },
  { q: "how does the attention mechanism work in a transformer", expect: ["aiforge"], note: "BOUNDARY: 'attention' is an aiforge tag (attention mechanism). psychology does not claim it, despite attention being a core cognitive topic." },
  { q: "how should I design memory for my AI agent", expect: ["loop"], note: "BOUNDARY: 'memory' belongs to loop (agent memory). psychology does not claim it, despite memory being its most famous subject." },

  // youtube (NETWORKED asset — see AGENTS.md "Networked assets")
  { q: "how many views and likes does this YouTube video have", expect: ["youtube"] },
  { q: "compare the subscriber counts of these two YouTube channels", expect: ["youtube"] },
  { q: "what age group watches my YouTube channel", expect: ["youtube"] },
  { q: "what device type and operating system do my viewers watch on", expect: ["youtube"] },
  { q: "which of my videos do 18-24 year olds watch the most", expect: ["youtube"] },
  { q: "find fast growing YouTube videos about AI agents from this week", expect: ["youtube"] },
  { q: "get me the captions for this YouTube video", expect: ["youtube"] },
  { q: "what is my YouTube watch time and engagement rate", expect: ["youtube"] },
  { q: "pull the comments on this YouTube video and cluster what people care about", expect: ["youtube"] },
  { q: "what topics do the top trending videos in my niche cover", expect: ["youtube"] },

  // BOUNDARY CASES against the neighbouring assets. Every line below is a word
  // youtube deliberately did NOT tag, either because another asset already owns
  // it (audience/analytics/platform/upload) or because the everyday sense of the
  // word lives elsewhere. Enumerated from the registry tag->owner map BEFORE
  // shipping, not after — a golden-set win hides collisions otherwise, which is
  // exactly what happened to kalshi and psychology above.
  { q: "how do I read my audience during a presentation", expect: ["communication"], note: "BOUNDARY: 'audience' is communication's (persuasion). youtube wanted it badly for viewer demographics and does not claim it." },
  { q: "what analytics platform should I use for our data warehouse", expect: ["polymath"], note: "BOUNDARY: 'analytics' AND 'platform' are both polymath tags. youtube uses the compound 'ytanalytics' instead." },
  { q: "how do I upload a document so the AI can read it", expect: ["docingest"], note: "BOUNDARY: 'upload' is docingest's, despite being core YouTube vocabulary." },
  { q: "what are Buddhist views on suffering", expect: ["faiths"], note: "BOUNDARY: 'views' left untagged on purpose — the religious-opinion sense would have been captured by a view-count tag." },
  { q: "is my cough viral or bacterial", expect: ["healthguide"], note: "BOUNDARY, SAFETY-CRITICAL: 'viral' left untagged. A viral-video tag would have routed a symptom question to a metrics server." },
  { q: "what is the compound growth on 500 dollars a month", expect: ["nestegg"], note: "BOUNDARY: 'growth' left untagged — nestegg owns the compounding sense and youtube uses per-tool vocabulary for velocity." },
  { q: "should I be shorting a stock right now", expect: ["nestegg"], alsoOk: ["kalshi"], note: "BOUNDARY: 'shorts' left untagged. The YouTube product name collides head-on with the trading verb; youtube claims 'youtubeshorts' instead." },
  { q: "how do I request my college transcript", expect: ["education"], note: "BOUNDARY: 'transcript' left untagged — the academic sense is education's. youtube claims 'captions'." },
  { q: "how do I improve employee engagement on my team", expect: ["jobhunt"], note: "BOUNDARY: bare 'engagement' left untagged; youtube claims 'engagementrate'." },
];
