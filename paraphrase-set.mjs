// Paraphrase robustness set — the Researcher's #2. Each base question is one we
// KNOW routes correctly (it's golden-derived); the paraphrases are how real
// people actually phrase the same intent, deliberately varying vocabulary and
// often DROPPING the keyword the matcher relies on ("arrested" → "the cops
// took me in", "Windows freezing" → "my pc locks up"). If routing is robust,
// these still land on the same asset. Where they don't, we've found the
// keyword matcher's ceiling — and the concrete case for semantic matching or
// targeted vocab additions.
//
// Honesty: paraphrases must preserve INTENT exactly. No sneaking the keyword
// back in — that would fake robustness.

export const PARAPHRASES = [
  {
    base: "how much house can I afford", expect: ["homebuyer"],
    variants: ["what's the biggest mortgage I could realistically take on", "can I afford to stop renting and get my own place", "what price range should I be looking at for a first home"],
  },
  {
    base: "is it better to rent or buy", expect: ["homebuyer"],
    variants: ["is renting just throwing money away", "should I keep leasing my apartment or purchase something"],
  },
  {
    base: "how do I start investing in my 401k", expect: ["nestegg"],
    variants: ["how do I begin putting money into my retirement account", "I want my savings to grow for when I'm older, where do I start"],
  },
  {
    base: "should I buy bitcoin", expect: ["nestegg"],
    variants: ["is crypto a smart move for me", "everyone's talking about digital coins, should I get in"],
  },
  {
    base: "I got arrested what are my rights", expect: ["lawguide"],
    variants: ["the cops just took me into custody, what do I do", "police detained me, am I required to answer their questions"],
  },
  {
    base: "my landlord won't return my deposit", expect: ["lawguide"],
    variants: ["my apartment manager is keeping the money I put down", "can my landlord legally hold onto my security deposit"],
  },
  {
    base: "how do I negotiate a higher salary", expect: ["jobhunt"],
    variants: ["they made me an offer, how do I ask for more money", "what's the best way to counter a lowball job offer"],
  },
  {
    base: "how do I get past the ATS", expect: ["jobhunt"],
    variants: ["why does my resume never get seen by an actual person", "how do I beat the automated screening filters"],
  },
  {
    base: "my Windows machine keeps freezing", expect: ["polymath"],
    variants: ["my pc locks up every few minutes", "my computer keeps hanging and I have to restart it", "windows 11 keeps crashing on me"],
  },
  {
    base: "build a Tableau dashboard from a SQL server", expect: ["polymath"],
    variants: ["how do I turn my database into a visual report for the team", "make charts in Tableau off a SQL database"],
  },
  {
    base: "how do I level up toward AI engineer", expect: ["polymath"],
    variants: ["what's the path to becoming an AI engineer", "how do I grow from my analyst role into AI work"],
  },
  {
    base: "I have a migraine which doctor should I see", expect: ["healthguide"],
    variants: ["I keep getting really bad headaches, who should I go to", "which specialist handles chronic migraines"],
  },
  {
    base: "how much protein to build muscle", expect: ["healthguide"],
    variants: ["what should I eat to gain muscle", "how much protein for muscle growth"],
  },
  {
    base: "I've been feeling anxious who should I talk to", expect: ["healthguide"],
    variants: ["I've been really stressed and overwhelmed lately", "who helps with anxiety and panic attacks"],
  },
  {
    base: "what specialist treats stomach problems", expect: ["healthguide"],
    variants: ["I have ongoing gut issues, which doctor treats that", "who do I see for digestive trouble"],
  },
  {
    base: "what is the tallest building in the world", expect: ["research"],
    variants: ["what's the highest skyscraper on earth", "which country has the biggest tower"],
  },
  {
    base: "how do I set up a home SIEM lab", expect: ["polymath"],
    variants: ["how do I monitor my network for hackers", "set up intrusion detection on my own network"],
  },
  {
    base: "how does small claims court work", expect: ["lawguide"],
    variants: ["how do I sue someone for a small amount of money", "can I take my contractor to court over a few thousand dollars"],
  },
  {
    base: "why do black holes form", expect: ["curiosity"],
    variants: ["what happens if you fall into one of those collapsed stars", "how does the universe make something light can't escape"],
  },
  {
    base: "did ancient aliens build the pyramids", expect: ["curiosity"],
    variants: ["is it true extraterrestrials made those ancient monuments", "could people back then really have built the pyramids themselves"],
  },
  {
    base: "what math class comes after algebra 2", expect: ["education"],
    variants: ["what course do I take once I finish algebra", "which class is next on the high school math track"],
  },
  {
    base: "how do I study for my chemistry exam", expect: ["education"], alsoOk: ["curiosity"],
    variants: ["what's the best way to prepare for a big test", "how do I actually make the material stick before finals"],
  },
  {
    base: "how do I get better at public speaking", expect: ["communication"],
    variants: ["I get nervous presenting to a crowd, how do I improve", "how do I give a confident talk in front of people"],
  },
  {
    base: "how can I read people honestly", expect: ["communication"],
    variants: ["how do I tell what someone is really thinking", "how do I pick up on what people aren't saying out loud"],
  },
  {
    base: "how do soccer scouts identify talent", expect: ["sports"],
    variants: ["how do they know if a young player is good enough to go pro", "what makes a kid stand out to the people who recruit athletes"],
  },
  {
    base: "how do I get a work visa for Germany", expect: ["government"],
    variants: ["how can I legally move to another country and work there", "what do I need to relocate abroad for a job"],
  },
  {
    base: "what language family does Swahili belong to", expect: ["linguistics"],
    variants: ["where does the Swahili language come from and what's it related to", "which languages are cousins of Swahili"],
  },
  {
    base: "how do I learn a new language", expect: ["linguistics"], alsoOk: ["education"],
    variants: ["what's the fastest way to become fluent in another tongue", "how do people actually pick up a foreign language"],
  },
  {
    base: "what do Buddhists believe", expect: ["faiths"],
    variants: ["what is the main teaching of Buddhism", "what does the Buddhist religion say about life"],
  },
  {
    base: "how do I stop my agent from looping forever", expect: ["loop"],
    variants: ["how do I keep an autonomous agent from running endlessly", "my llm agent gets stuck repeating the same step and never finishes"],
  },
  {
    base: "which agent pattern should I use", expect: ["loop"],
    variants: ["should my agent plan everything first or decide step by step", "when should I add a reflexion step to my agent"],
  },
  {
    base: "how do I evaluate my agent", expect: ["loop"],
    variants: ["how do I measure whether my llm agent is actually correct", "how do I know my agentic loop works and isn't just consistent"],
  },
  {
    base: "what does my agent loop need to run autonomously", expect: ["loop"],
    variants: ["should the agent that writes the code be the one that reviews it", "how do I give each parallel agent its own clean workspace"],
  },
  // aiforge — the AI/ML engineering craft (keyword-dropping rephrasings)
  {
    base: "how do I fine-tune a Hugging Face model", expect: ["aiforge"],
    variants: ["how do I train an open model on my own data cheaply with LoRA", "how do I adapt a transformers model to my task"],
  },
  {
    base: "how does tokenization work", expect: ["aiforge"],
    variants: ["why does a model miscount the tokens in a word", "how is text split into subword tokens a model can read"],
  },
  {
    base: "how do embeddings work", expect: ["aiforge"],
    variants: ["how do I turn text into vectors for semantic search", "how does similarity search find related documents"],
  },
  // gitforge
  {
    base: "how do I undo my last commit", expect: ["gitforge"],
    variants: ["how do I take back the commit I just made in git", "I committed too early, how do I roll it back"],
  },
  {
    base: "how do I fix a merge conflict", expect: ["gitforge"],
    variants: ["git says both branches changed the same lines, what do I do", "how do I resolve conflicting changes when merging branches"],
  },
  // promptcraft
  {
    base: "how do I write a better prompt", expect: ["promptcraft"],
    variants: ["how do I get more reliable answers out of the model with examples", "what few-shot examples should I give the model"],
  },
  // apiforge
  {
    base: "how do I test an API in Postman", expect: ["apiforge"],
    variants: ["how do I assert the response fields of a REST endpoint", "how do I check my API returns the right JSON"],
  },
];
