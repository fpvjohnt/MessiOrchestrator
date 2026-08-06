// Deterministic "semantic-lite" layer: a curated concept map that lets natural
// phrasing reach the canonical tag an asset actually carries. "cops"/"custody"
// → police, "stressed"/"overwhelmed" → anxiety, "leasing" → rent. This is a
// hand-built thesaurus, NOT a model — it stays offline, deterministic, and
// testable (the whole system's design principle), unlike embedding matching
// which would add a model dependency and break routing determinism.
//
// Each canonical MUST be a real tag on the asset that should win, or the
// mapping matches nothing. Surface forms are stored in already-stemmed form
// where the plural stemmer would produce it (cops→cop), plus raw where it
// won't (freezing).
//
// TWO levels, because meaning does not live in single words. A word map alone
// hits a wall the paraphrase set makes visible: the word that carries the
// meaning is often ambiguous on its own and only safe in context.
// "screening" is a job filter to jobhunt and a mammogram to healthguide;
// "country" is geography; "offer" is any proposal. Mapping those single tokens
// buys one paraphrase and pays for it with noise on every neighbouring domain.
// So single words that are safe alone go in CONCEPTS, and meaning that only
// exists as a unit goes in PHRASES ("automated screening" → ats, "another
// country" → abroad). Phrases are what makes this a semantic layer rather than
// a second pile of keywords: they encode a concept the words don't carry
// separately.

const CONCEPTS: Record<string, string[]> = {
  // lawguide 'police'
  police: ["cop", "officer", "detained", "custody", "arrested"],
  // lawguide 'sued'
  sued: ["sue", "suing"],
  // homebuyer 'rent'
  rent: ["renting", "leasing", "lease", "leased"],
  // polymath 'crash'
  crash: ["freeze", "freezing", "frozen", "hang", "hanging", "lockup", "unresponsive"],
  // healthguide 'anxiety'
  anxiety: ["anxious", "stressed", "overwhelmed", "panic"],
  // healthguide 'depression' — the adjective was the gap. healthguide tags the
  // NOUN, the router does no stemming, and nobody says "I have depression"
  // first; they say "I think I might be depressed". That phrasing scored 0 on
  // every asset and fell through to the research fallback — i.e. the one asset
  // carrying a non-suppressible 911/988 override never saw it. Found by the
  // psychology boundary test, which is exactly what boundary tests are for.
  depression: ["depressed", "despondent", "hopeless"],
  // healthguide 'crisis' — same shape, higher stakes. These must never be a
  // near-miss; the crisis override runs before any other healthguide tool.
  crisis: ["suicidal", "suicide", "selfharm"],
  // healthguide 'symptom' — the SAME bug as `depression` above, found the same
  // way (a boundary probe written while adding an unrelated asset). healthguide
  // tags the abstract noun `symptom`; nobody types it. They name the symptom:
  // "is my cough viral or bacterial" scored 0 on healthguide and fell through to
  // the research fallback, so the asset carrying the 911/988 override never saw a
  // symptom question. Only unambiguous body-symptom words go here.
  //
  // DELIBERATELY EXCLUDED, and this is the whole reason to be careful: `viral`
  // and `bacterial` are the words the QUERY used, but mapping `viral` to a health
  // concept would route "how do I make a viral video" to a symptom checker. The
  // youtube asset leaves `viral` untagged for the mirror-image reason. Neither
  // side gets it; the specific symptom noun carries the meaning instead.
  symptom: ["cough", "fever", "nausea", "rash", "wheezing", "congestion", "dizziness"],
  // nestegg 'crypto'
  crypto: ["coin", "bitcoin"],
  // polymath 'sql' — "turn my database into a report". Unambiguously technical,
  // no cross-domain collision (unlike "screening", which health also uses).
  sql: ["database"],
  // gitforge 'commit' — the stemmer folds plurals only, so the past tense of
  // the single most common git verb never reaches the tag.
  commit: ["committed", "committing"],
  // lawguide 'legal' — the adverb is how people actually ask ("can they
  // legally do this"), and the plural-only stemmer never folds -ly.
  legal: ["legally", "lawful", "lawfully", "illegal", "illegally"],
  // overseer 'log' — same plural-only stemmer gap on the past tense.
  log: ["logged", "logging"],
  // lawguide 'tax' — the stemmer only strips a trailing "s", so "taxes" becomes
  // "taxe" and never reaches the tag. "do I owe taxes on this settlement" fell
  // through to research because of one letter.
  tax: ["taxe", "taxation"],
  // psychology 'cognition' — the memory/forgetting vocabulary. psychology tags
  // the abstract noun `cognition`; nobody types it. They ask why they forget
  // things. The word people DO type — `memory` — is loop's (agent memory), so
  // it cannot be claimed here; see the IDIOMS entries below that carry the human
  // sense. These surfaces are the ones loop does NOT own, checked against the
  // registry tag->owner map before adding: all five are unclaimed by any asset.
  //
  // DELIBERATELY EXCLUDED, both measured against real phrasings rather than
  // guessed: `recall` is a PRODUCT recall ("is there a recall on my car") and
  // `forgot` is a credential ("I forgot my password"). Both would route an
  // everyday question to a psychology explainer, and neither word is needed —
  // `forget` and `forgetting` carry the cognitive sense on their own. Note the
  // stemmer folds only a trailing "s", so `forget` and `forgot` are distinct
  // tokens and including one does not drag in the other.
  cognition: ["forget", "forgetting", "memorize", "memorise", "amnesia", "mnemonic"],
  // psychology 'conformity' — the stemmer folds only a trailing "s", so the VERB
  // never reaches the noun tag. "why do people conform in groups" is the
  // textbook Asch question and it scored 0 on psychology. `conform` is
  // unclaimed by every other asset.
  conformity: ["conform", "conforming", "conformed"],
};

// Multi-word concepts. The KEY is the phrase as the query says it, in
// stemmed-token form joined by single spaces (see phraseGrams); the VALUE is
// the canonical tag it should reach. Length 2-4 tokens — long enough to
// disambiguate, short enough to survive rewording.
//
// The test for adding one: would mapping the single carrying word instead pull
// this asset into unrelated questions? If yes, it belongs here. Each entry is
// grouped by the asset it feeds so an operator can see, per asset, what natural
// phrasing the tags themselves do not cover.
const PHRASES: Record<string, string> = {
  // NOTE: "attachment theory" and "compound growth" USED to live here, adding a
  // canon without removing the misleading token — which left docingest and
  // curiosity still scoring and riding along as measured golden noise. Both are
  // now IDIOMS below, because they need to SUBTRACT as well as add. If you are
  // looking for them, that is where they went.

  // → jobhunt. jobhunt tags `employment`/`hire`/`promotion` but neither
  // `employee` nor `engagement`. Bare `engagement` is unclaimed and must stay
  // that way: it is simultaneously an engagement ring, an employee-survey metric
  // and a YouTube engagement rate, so youtube claims `engagementrate` and this
  // phrase carries the workplace sense.
  "employee engagement": "employment",
  "employee morale": "employment",
  "team morale": "employment",

  // → lawguide. A tenant dispute is described by the person, never by the tag:
  // nobody types "landlord" when they mean the guy who runs their building.
  "apartment manager": "landlord",
  "property manager": "landlord",
  "building manager": "landlord",
  "security deposit": "landlord",

  // → jobhunt. "offer" and "screening" are both far too common alone.
  "an offer": "negotiate",
  "the offer": "negotiate",
  "job offer": "negotiate",
  "ask for more money": "negotiate",
  "more money": "salary",
  "automated screening": "ats",
  "screening filter": "ats",
  "applicant tracking": "ats",
  "resume screening": "ats",

  // → jobhunt. Scoring a CANDIDATE against a POSTING is jobhunt's frame, but the
  // shared specialty-title words ("Data Analytics Engineer") score higher for
  // polymath's professional-knowledge tags, so the objective lost to polymath —
  // the single largest real-intent miss class (7 cases). These carry the hiring
  // frame to a jobhunt tag. Deliberately bigrams, never the bare "posting"
  // ("posting bail" is lawguide) or "profile" ("risk profile" is nestegg).
  "posting against": "job",
  "the posting": "job",
  "profile against": "resume",
  "candidate profile": "resume",
  "resume against": "resume",

  // → ghmonitor (CI/CD delivery STATUS). gitforge owns the GitHub how-to
  // vocabulary (workflow/actions/ci as a subject to learn); these are
  // STATUS-INTENT phrases — "did it pass/fail", "what broke" — that mean
  // "monitor my delivery", not "teach me GitHub". buildstatus is a ghmonitor tag.
  "pass or fail": "buildstatus",
  "what broke after": "buildstatus",
  "build passed": "buildstatus",
  "build failed": "buildstatus",
  "workflow failed": "buildstatus",
  "workflow passed": "buildstatus",
  "ci failed": "buildstatus",
  "ci passed": "buildstatus",
  // ghmonitor's precise tags (buildstatus/prchecks/actionsrun) can't be produced
  // by tokenization, so natural PRESENT-tense CI-status phrasings need explicit
  // hooks or they fall through to research.
  // (stemmed keys: "checks"->"check", "actions"->"action")
  "ci build": "buildstatus",
  "build pass": "buildstatus",
  "build passing": "buildstatus",
  "check passing": "buildstatus",
  "pull request check": "buildstatus",
  "action run": "buildstatus",
  "failing action": "buildstatus",

  // → docsearch (search the ingested corpus). docingest FETCHES a specific
  // document; docsearch QUERIES what's already indexed. These phrases are the
  // search intent. searchindex is a docsearch tag. NOTE: phrase keys are matched
  // against the STEMMED token stream, so plural words must be written singular
  // ("documents" folds to "document").
  "search my document": "searchindex",
  "search my file": "searchindex",
  "search my note": "searchindex",
  "find document about": "searchindex",
  "document mentioning": "searchindex",
  "spreadsheet mentioning": "searchindex",
  "previous failure": "searchindex",
  "similar deployment": "searchindex",
  "similar failure": "searchindex",

  // → education. "test"/"final"/"material" are all ordinary English words; only
  // the academic phrasing around them means school.
  "prepare for a test": "exam",
  "study for a test": "exam",
  "practice test": "exam",
  "big test": "exam",
  "before final": "exam",
  "for final": "exam",
  "during final": "exam",
  "final week": "exam",
  "the material": "coursework",

  // → communication. Reading a person, stated the way people state it.
  "really thinking": "nonverbal",
  "read people": "nonverbal",
  "reading people": "nonverbal",
  "someone is lying": "deception",
  "if someone is lying": "deception",
  // what is NOT said is the whole subject of nonverbal reading
  "saying out loud": "nonverbal",
  "said out loud": "nonverbal",
  "not saying": "nonverbal",
  // addressing a room, without the word "public speaking" ever appearing
  "give a talk": "publicspeaking",
  "giving a talk": "publicspeaking",
  "in front of people": "publicspeaking",
  "in front of a crowd": "publicspeaking",
  "in front of an audience": "publicspeaking",

  // → polymath. A machine that stops responding, in the words people use for
  // it. CONCEPTS already carries the closed form 'lockup'; the two-word verb
  // is how it is actually typed.
  "lock up": "crash",
  "locking up": "crash",
  "freeze up": "crash",
  "freezing up": "crash",

  // → government. "country"/"move" alone are geography and logistics.
  "another country": "abroad",
  "move to another country": "relocate",
  "move abroad": "relocate",
  "live abroad": "relocate",
  "work permit": "workpermit",

  // → aiforge. The user-facing name for what an embedding index does.
  "similarity search": "embedding",
  "semantic search": "embedding",
  "nearest neighbor": "embedding",

  // → communication. THE largest single real-traffic miss class: 12 of the 41
  // caselog misses are one shape — "draft/reply/reword this message to my
  // agent". communication owns that craft and carries `rapport`/`persuasion`,
  // but it tags none of the words people actually use to ask for it (draft,
  // message, text, reply, reword, voice, tone are ALL unclaimed by every asset).
  // So homebuyer won every one of them on the real-estate CONTENT while the
  // asset that knows how to word the thing was never assigned.
  //
  // Bigrams, not the bare verbs: "draft" alone is a bank draft and a draft
  // pick, "text" alone is any string, "message" alone appears in every error
  // report in the case log. The verb+object pair is what carries the
  // compose-an-interpersonal-message intent. PHRASES only ADD, so this can
  // never displace homebuyer — it rides alongside it, which is exactly the
  // observed correct behaviour.
  "draft a message": "rapport",
  "draft a text": "rapport",
  "draft a reply": "rapport",
  "draft a short": "rapport",
  "draft the reply": "rapport",
  "draft a low": "rapport", // "draft a low-pressure message"
  "message to the": "rapport",
  "reply to the": "rapport",
  "respond professionally": "rapport",
  "respond to the": "rapport",
  "sounding text": "rapport", // "competent-sounding text"
  "own voice": "rapport",
  "own plain": "rapport", // "in the buyer's own plain, casual voice"
  "casual voice": "rapport",
  "reword": "rapport",
  "rewrite the message": "rapport",
  "rewrite the loan": "rapport",

  // → chemistry. The bare tag `equation` was tried and measured out: it pulled
  // chemistry onto "solve this algebra equation for x", which is education's.
  // The VERB is the disambiguator — algebra says SOLVE an equation, chemistry
  // says BALANCE one, and nothing else in this registry balances anything.
  // (Keys match the STEMMED stream, so "this" is written "thi".)
  "balance the equation": "chemicalequation",
  "balance thi equation": "chemicalequation",
  "balance an equation": "chemicalequation",
  "balance my equation": "chemicalequation",
  "balancing equation": "chemicalequation",
  "balanced equation": "chemicalequation",

  // → psychology. `development` cannot go in CONCEPTS: it is SOFTWARE
  // development to half this registry, and mapping the bare word would route
  // every engineering question to a psychology explainer. The qualifier is what
  // makes it developmental psychology.
  "child development": "developmental",
  "childhood development": "developmental",
  "human development": "developmental",
  "cognitive development": "developmental",
};

// Non-compositional terms: phrases whose meaning is NOT the sum of their words.
// "body language" is not about language, and a "real estate agent" is not an AI
// agent — but the bare tokens 'language' and 'agent' are real tags on
// linguistics and loop, so both assets get pulled into questions that have
// nothing to do with them. Every idiom here was a measured golden-set noise
// case, not a hypothetical.
//
// Unlike PHRASES, which ADD a concept, these also CONSUME the misleading part:
// once the phrase is recognised, the token that lied about the topic is
// removed. This is the one place the layer subtracts, and it is deliberately
// narrow — consume only a word that is genuinely not the subject when the
// phrase is present.
const IDIOMS: Record<string, { canon?: string; consume: string[] }> = {
  // communication owns this via the 'bodylanguage' compound; linguistics only
  // matched because the phrase contains the word 'language'.
  "body language": { canon: "nonverbal", consume: ["language"] },
  // a realtor, not an agentic AI loop.
  "real estate agent": { canon: "realtor", consume: ["agent"] },
  "real estate broker": { canon: "realtor", consume: ["broker"] },
  // a named vendor product, not the generic subject of API engineering — the
  // bare 'api' tag pulled apiforge into every OpenAI-platform question.
  "response api": { canon: "responsesapi", consume: ["api"] },
  // the department a bot answers for, not polymath's 'support' specialty.
  "customer support": { consume: ["support"] },
  "customer service": { consume: ["support", "service"] },
  // A programming loop, not the agentic-AI 'loop' asset. `loop` is loop's tag
  // per AGENTS.md, so ordinary code questions ("how do I write a for loop in
  // python") were landing on the agent-architecture specialist.
  "for loop": { consume: ["loop"] },
  "while loop": { consume: ["loop"] },
  "nested loop": { consume: ["loop"] },
  "infinite loop": { consume: ["loop"] },
  // React.js, not the ReAct agent pattern — two different things one letter of
  // capitalisation apart, which tokenizing destroys. loop keeps the bare
  // `react` tag (its ReAct pattern is almost always written "ReAct pattern" or
  // "ReAct agent"); the front-end senses are named explicitly here.
  "react hook": { canon: "reactjs", consume: ["react"] },
  "react component": { canon: "reactjs", consume: ["react"] },
  "react app": { canon: "reactjs", consume: ["react"] },
  "react state": { canon: "reactjs", consume: ["react"] },
  // A prediction-market event contract that "trades at" a price in cents —
  // kalshi's domain, not a legal contract. lawguide owns the bare word
  // 'contract' (a contract is signed, breached, binding); an event contract is
  // none of those — it is bought and sold at a price. The disambiguator is the
  // bigram: only a tradable contract "trades at" a number. Do NOT generalise to
  // the bare "trading at": that was measured to collide, pulling kalshi onto
  // stock questions ("stocks trading at a discount"). Keep the narrow bigram.
  "contract trading": { canon: "eventcontract", consume: ["contract"] },
  // The 1930s economic event and the mood disorder are the same word, and
  // healthguide carries the bare tag `depression` — so "what caused the Great
  // Depression" routed to the health specialist. Measured on the build BEFORE
  // the depression/crisis synonyms landed, so this is an old collision those
  // synonyms merely made visible, not one they introduced.
  //
  // Consume-only, no canon. There is no `history` or `economics` tag to hand it
  // to, and inventing one would be a new tag in one domain's sense — the exact
  // move that keeps colliding (see overseer/'assets'). Dropping the token lets
  // the query fall to the research/education path it should have taken anyway.
  //
  // Deliberately narrow. The emotional sense is almost never qualified like
  // this ("I'm depressed", "feeling hopeless"), while the economic sense almost
  // always is — which is what makes the qualifier a safe disambiguator. Do NOT
  // extend this to the bare word: healthguide's crisis override is reached
  // through it, and suppressing that is a safety regression, not a routing one.
  "great depression": { consume: ["depression"] },
  "economic depression": { consume: ["depression"] },
  "depression era": { consume: ["depression"] },
  // The market/economy sense of the ADJECTIVE, which reaches the same tag via
  // the `depressed` surface form. nestegg already wins these on its own tags;
  // this only stops healthguide riding along as a secondary.
  //
  // consume MUST list the canon as well as the surface form. expandConcepts
  // maps depressed -> depression BEFORE idioms run, so dropping only
  // "depressed" leaves "depression" in the set and healthguide still scores.
  // (Keys are stemmed, but stem() only folds words LONGER than 3 chars, so
  // "is" and "are" stay as they are — unlike "this" -> "thi" above.)
  // A video CALL is a meeting, not a YouTube upload. youtube claims the bare
  // `video`/`videos` tags because they carry real weight ("how many views does
  // this video have"), but the conferencing sense shares the word exactly.
  //
  // Found by probe.mjs, NOT by the golden set — golden is self-authored and never
  // thought to ask about a standup. This is the out-of-set collision gate earning
  // its place: the tag looked clean across 154 golden entries and collided on the
  // first neighbouring-domain phrasing anyone wrote down.
  //
  // Consume-only, no canon: there is no meetings asset to hand it to, and
  // inventing a tag in one domain's sense is the move that keeps colliding.
  // Dropping the token lets the query fall through to the research/polymath path
  // it should have taken anyway.
  "video call": { consume: ["video"] },
  "video conference": { consume: ["video"] },
  "video meeting": { consume: ["video"] },
  "video chat": { consume: ["video"] },
  "market is depressed": { consume: ["depressed", "depression"] },
  "economy is depressed": { consume: ["depressed", "depression"] },
  "price are depressed": { consume: ["depressed", "depression"] }, // "prices are depressed"
  "share are depressed": { consume: ["depressed", "depression"] },
  // → docsearch, and CONSUME "index" so nestegg's index-fund tag stops stealing
  // "index this pdf so I can search it". Indexing a document for search is not
  // an index fund. NOTE: keys are matched against the STEMMED token stream, so
  // trailing-s words are pre-stemmed here: "this"->"thi", "status"->"statu".
  "index thi": { canon: "searchindex", consume: ["index"] }, // "index this"
  "index the": { canon: "searchindex", consume: ["index"] },
  "index my": { canon: "searchindex", consume: ["index"] },
  // → ghmonitor, and CONSUME "deployment" so polymath's infra-deployment tag
  // stops riding CI delivery-status questions. A failing/status deployment here
  // is a CI/CD delivery event, not datacenter infrastructure.
  "deployment fail": { canon: "buildstatus", consume: ["deployment"] },
  "deployment failed": { canon: "buildstatus", consume: ["deployment"] },
  "deployment statu": { canon: "buildstatus", consume: ["deployment"] }, // "deployment status"
  "failed deployment": { canon: "buildstatus", consume: ["deployment"] },
  // → curiosity, and CONSUME "bond" so nestegg stops answering chemistry. A
  // chemical bond and a treasury bond are the same word, and nestegg carries
  // BOTH `bond` and `bonds` — which the stemmer folds to one token, so the tag
  // scores TWICE (6) plus a description hit. "what is a covalent bond" therefore
  // routed to the retirement-investing asset at score 7 with every other asset
  // at 0: not a near-miss, an uncontested win. Measured 2026-08-05.
  //
  // The bigram is the disambiguator, exactly as with "contract trading": a
  // financial bond is municipal/treasury/corporate/junk and is ISSUED, BOUGHT and
  // HELD; it is never covalent, ionic, or measured in angles. Do NOT generalise
  // to the bare word — "should I hold bonds in retirement" is nestegg's and must
  // stay that way (probe.mjs guards both senses).
  "covalent bond": { canon: "chemicalbond", consume: ["bond"] },
  "ionic bond": { canon: "chemicalbond", consume: ["bond"] },
  "chemical bond": { canon: "chemicalbond", consume: ["bond"] },
  "hydrogen bond": { canon: "chemicalbond", consume: ["bond"] },
  "metallic bond": { canon: "chemicalbond", consume: ["bond"] },
  "double bond": { canon: "chemicalbond", consume: ["bond"] },
  "triple bond": { canon: "chemicalbond", consume: ["bond"] },
  "peptide bond": { canon: "chemicalbond", consume: ["bond"] },
  "molecular bond": { canon: "chemicalbond", consume: ["bond"] },
  "bond angle": { canon: "chemicalbond", consume: ["bond"] },
  "bond energy": { canon: "chemicalbond", consume: ["bond"] },
  "bond length": { canon: "chemicalbond", consume: ["bond"] },
  // → psychology, and CONSUME "memory" so loop stops answering questions about
  // human recall. `memory` is loop's tag in the AGENT-memory sense, and it was
  // winning "how does memory work and why do we forget things" outright — the
  // cognitive-psychology asset scored 0, because psychology tags `cognition` and
  // nobody types that. Measured 2026-08-05, same shape as the `bond` case above.
  //
  // NARROW BY DESIGN, and this one needed more care than `bond` because both
  // senses are live in this registry and probe.mjs already asserts the agent
  // sense ("how should I design memory for my AI agent" -> loop, NOT psychology).
  // Every key below is a phrasing that only the human sense produces; the agent
  // sense says "design/build/add memory FOR an agent", never "photographic" or
  // "muscle" or "short term". "memory work" is the one general key — it catches
  // the bare "how does memory work" — and the agent sense is guarded by its own
  // probe rather than by hoping the phrase never appears.
  "human memory": { canon: "cognition", consume: ["memory"] },
  "memory work": { canon: "cognition", consume: ["memory"] }, // "how does memory work"
  "memory and forgetting": { canon: "cognition", consume: ["memory"] },
  "photographic memory": { canon: "cognition", consume: ["memory"] },
  "muscle memory": { canon: "cognition", consume: ["memory"] },
  "improve my memory": { canon: "cognition", consume: ["memory"] },
  "short term memory": { canon: "cognition", consume: ["memory"] },
  "long term memory": { canon: "cognition", consume: ["memory"] },
  // CONSUME "video" for PRODUCTION-CRAFT questions. `video` is youtube's tag,
  // and youtube is an ANALYTICS asset — its eleven tools are view counts,
  // growth velocity, comments, topic clusters and demographics. Not one of them
  // can answer "what camera settings should I use". So these questions did not
  // fall through safely to research; they were handed to a specialist that is
  // structurally incapable of answering, with no verifier alongside it.
  // Measured 2026-08-05: three such queries routed to youtube alone.
  //
  // Consume-only, no canon: there is no video-production asset in this registry,
  // and inventing a tag in one domain's sense is the move that keeps colliding
  // (same reasoning as "video call" above). Dropping the token lets these reach
  // research, which CAN answer them. If a production asset is ever added, these
  // keys become its hooks — and `video` will need probing in both directions.
  "camera setting": { consume: ["video"] },
  "b roll": { consume: ["video"] },
  "audio quality": { consume: ["video"] }, // lets elevenlabs win on `audio`
  "color grade": { consume: ["video"] },
  "color grading": { consume: ["video"] },
  "colour grade": { consume: ["video"] },
  "lighting setup": { consume: ["video"] },
  "short film": { consume: ["video"] },
  "film scene": { consume: ["video"] },
  "frame a scene": { consume: ["video"] },
  "shoot a video": { consume: ["video"] },
  "filming a video": { consume: ["video"] },
  // CONSUME "language" in the REGISTER sense — "explain this in plain language",
  // "child-friendly language". linguistics carries `language` AND `languages`,
  // which stem to one token and therefore score twice (6), so it won outright on
  // three real caselog objectives that were about a palm tree, a medication, and
  // diverticulitis. Nobody asking for "plain language" wants a linguist.
  //
  // Exactly the "body language" idiom already above, in a second sense of the
  // same word. Consume-only: the request is about HOW TO WORD an answer, not a
  // topic any asset owns, so dropping the token lets the real subject win.
  "plain language": { consume: ["language"] },
  "simple language": { consume: ["language"] },
  "friendly language": { consume: ["language"] }, // "child-friendly language"
  "everyday language": { consume: ["language"] },
  "clear language": { consume: ["language"] },
  "accessible language": { consume: ["language"] },
  "plain english": { consume: ["language"] },
  // → psychology, and CONSUME "attachment" so docingest (email/file attachments)
  // stops riding attachment-theory questions. This was a PHRASES entry that
  // ADDED `developmental` without removing the misleading token, so docingest
  // still scored and rode along — a measured golden noise case. The comment on
  // the old PHRASES entry already recorded that docingest outscored psychology
  // 7-5 here; adding a concept was only half the fix.
  "attachment theory": { canon: "developmental", consume: ["attachment"] },
  "attachment style": { canon: "developmental", consume: ["attachment"] },
  // → nestegg, and CONSUME "compound" so curiosity (a chemical compound) stops
  // riding compound-interest questions. Same half-fix as attachment above: the
  // PHRASES entry added `compounding` but left `compound` in the set, so
  // curiosity kept scoring. Its own comment called this "a genuine pre-existing
  // collision" — it is, and consuming is the other half.
  "compound growth": { canon: "compounding", consume: ["compound"] },
  "compound interest": { canon: "compoundinterest", consume: ["compound"] },
  "compound return": { canon: "compounding", consume: ["compound"] },
  // → education, and CONSUME "psychology". Studying FOR a psychology exam is
  // education's; the psychology asset explains the FIELD. probe.mjs already
  // asserts this routes to education, but psychology rode along as noise
  // because the subject name is literally its own tag.
  "psychology exam": { canon: "exam", consume: ["psychology"] },
  "psychology test": { canon: "exam", consume: ["psychology"] },
  "psychology class": { canon: "coursework", consume: ["psychology"] },
  "psychology course": { canon: "coursework", consume: ["psychology"] },
};

/**
 * The plural fold, shared with router.ts. It lives HERE, not there, because
 * both the query tokens and this file's canonical forms have to go through the
 * identical transform or they silently fail to meet.
 *
 * That is not hypothetical: the canon `reactjs` was added to the query set
 * unstemmed while the asset's `reactjs` TAG was stemmed to `reactj`, so an
 * idiom that fired perfectly still matched nothing. Any canon ending in "s"
 * had the same latent bug. Stemming canons at load closes the whole class.
 *
 * Only a trailing "s" on words >3 chars, never "ss" (address, access).
 */
export function stem(w: string): string {
  return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}

const SURFACE_TO_CANON = new Map<string, string>();
for (const [canon, surfaces] of Object.entries(CONCEPTS)) {
  for (const s of surfaces) SURFACE_TO_CANON.set(s, canon);
}

const PHRASE_MAX_LEN = Math.max(
  ...[...Object.keys(PHRASES), ...Object.keys(IDIOMS)].map((p) => p.split(" ").length)
);

/** Every 2..PHRASE_MAX_LEN token window of the query, as space-joined strings.
 * Built over the FULL token sequence including stopwords — "an offer" and
 * "move to another country" only exist with their glue words intact. */
function phraseGrams(sequence: string[]): string[] {
  const grams: string[] = [];
  for (let i = 0; i < sequence.length; i++) {
    for (let n = 2; n <= PHRASE_MAX_LEN; n++) {
      if (i + n > sequence.length) break;
      grams.push(sequence.slice(i, i + n).join(" "));
    }
  }
  return grams;
}

/**
 * Expand a query's tokens with the canonical concept for any colloquial
 * surface form present. Query-side only: asset tags are already canonical.
 *
 * @param tokens    content tokens (stopwords dropped, stemmed) — the scoring set
 * @param sequence  the full stemmed token sequence *including* stopwords, in
 *                  order. Phrase lookup needs it; omit it and only the
 *                  single-word map applies.
 */
export function expandConcepts(tokens: Iterable<string>, sequence: string[] = []): Set<string> {
  const out = new Set(tokens);
  for (const t of tokens) {
    const canon = SURFACE_TO_CANON.get(t);
    if (canon) out.add(stem(canon));
  }
  const grams = phraseGrams(sequence);
  for (const gram of grams) {
    const canon = PHRASES[gram];
    if (canon) out.add(stem(canon));
  }
  // Idioms last: a consumed token must not survive because some other rule
  // added it back.
  for (const gram of grams) {
    const idiom = IDIOMS[gram];
    if (!idiom) continue;
    if (idiom.canon) out.add(stem(idiom.canon));
    for (const token of idiom.consume) out.delete(token);
  }
  return out;
}
