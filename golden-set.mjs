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
  { q: "is it better to rent or buy a condo right now", expect: ["homebuyer"] },
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
  { q: "is this supplement's health claim actually backed by science", expect: ["healthguide"] },
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
  { q: "is the ancient aliens theory about the pyramids actually true", expect: ["curiosity"] },

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
  { q: "is the OpenAI Chat Completions API deprecated", expect: ["openai"] },
  { q: "my code broke after migrating to the Responses API", expect: ["openai"] },
  { q: "should I fine-tune GPT on our internal documentation", expect: ["openai"] },
  { q: "how do I cut my OpenAI API costs with prompt caching", expect: ["openai"] },
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
  { q: "should I put my preferences in custom instructions or the prompt", expect: ["openai"] },
];
