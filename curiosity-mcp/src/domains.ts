// The curiosity map: the big fields of science + wonder, each with what it is,
// the questions that pull you in, iconic touchstones, a common myth vs the
// reality, and rabbit-hole links to go deeper. Bottom-line-first, plain words.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export interface Domain {
  label: string;
  keys: string[]; // topic words that route a free-text question to this domain
  what: string;
  big_questions: string[];
  touchstones: string[];
  myth: { claim: string; reality: string };
  deeper: string[];
}

export const DOMAINS: Record<string, Domain> = {
  physics_quantum: {
    label: "Physics & Quantum",
    keys: ["physics", "quantum", "relativity", "particle", "atom", "qubit", "superposition", "entanglement", "quantumcomputing", "lightspeed", "gravity", "energy", "matter"],
    what: "The rulebook of the universe at every scale — from particles that are in many states at once, to why time itself slows down near the speed of light.",
    big_questions: [
      "Why does a quantum particle act like a spread-out wave until you measure it, then snap to one spot?",
      "Can a quantum computer solve problems no ordinary computer ever could?",
      "Why do gravity (big things) and quantum mechanics (tiny things) still refuse to agree?",
    ],
    touchstones: ["superposition & entanglement", "Schrödinger's cat", "relativity and time dilation", "the Standard Model of particles", "quantum computing (qubits)"],
    myth: {
      claim: "A quantum computer is just a much faster regular computer.",
      reality: "No. It isn't faster at everything — it exploits superposition and entanglement to attack specific problems (factoring huge numbers, simulating molecules, some searches). For checking email or most tasks, your laptop still wins.",
    },
    deeper: ["how a qubit stays 'coherent' before noise ruins it", "Shor's algorithm and why it worries cryptographers", "the double-slit experiment", "why nothing with mass can reach light speed"],
  },
  space_astronomy: {
    label: "Space & Astronomy",
    keys: ["space", "astronomy", "universe", "cosmos", "cosmology", "planet", "star", "galaxy", "blackhole", "exoplanet", "bigbang", "telescope", "nasa", "alien", "extraterrestrial", "seti", "nebula", "moon", "mars"],
    what: "Everything beyond Earth — planets, stars, black holes, galaxies — and the whole story of the universe from the Big Bang to now.",
    big_questions: [
      "Are we alone — and how would we actually detect life light-years away?",
      "What really happens inside a black hole, past the point of no return?",
      "What are dark matter and dark energy — the 95% of the universe we can't see?",
    ],
    touchstones: ["the Big Bang", "black holes & event horizons", "exoplanets in the habitable zone", "the James Webb telescope", "the search for life (biosignatures, SETI)"],
    myth: {
      claim: "The Big Bang was an explosion in empty space.",
      reality: "It wasn't an explosion IN space — it was the rapid expansion OF space itself, happening everywhere at once. There was no 'outside' and no center for it to blow up from.",
    },
    deeper: ["how we weigh a galaxy we can never touch", "why black holes slowly evaporate (Hawking radiation)", "how Webb sees light that left its source 13 billion years ago", "the Fermi paradox — if aliens are likely, where is everyone?"],
  },
  life_biology: {
    label: "Life & Biology",
    keys: ["biology", "life", "animal", "animals", "evolution", "dna", "gene", "genetics", "cell", "species", "ecosystem", "brain", "octopus", "extinction", "human", "body", "microbe", "creature"],
    what: "Living things and how they work — from a single cell to whole ecosystems, how life evolved, and the DNA code that runs all of it.",
    big_questions: [
      "How did lifeless chemistry become the first living, copying cell?",
      "Why do we age — and could it be slowed or stopped?",
      "How do animals do things we can't — sense magnetic fields, regrow limbs, survive in space?",
    ],
    touchstones: ["evolution by natural selection", "DNA & the genetic code", "the tree of life", "extremophiles (life where nothing should live)", "convergent evolution"],
    myth: {
      claim: "Humans evolved from chimpanzees.",
      reality: "No — humans and chimps share a common ancestor about 6-7 million years ago. We're cousins, not descendants. And neither is 'more evolved' — both have been evolving for exactly the same amount of time.",
    },
    deeper: ["how a tardigrade survives the vacuum of space", "why octopuses are almost alien (arms that think for themselves)", "how CRISPR edits DNA like a text file", "why whales still carry tiny hip bones from land ancestors"],
  },
  earth_geoscience: {
    label: "Earth, Geology & Geography",
    keys: ["earth", "geology", "geography", "rock", "volcano", "earthquake", "tectonic", "continent", "mountain", "ocean", "fossil", "mineral", "climate", "iceage", "geoscience", "lava", "crust", "diamond"],
    what: "The planet itself — how mountains, oceans and continents formed and still move, what's under our feet, and how Earth's systems shape where life can happen.",
    big_questions: [
      "How do we know what's inside a planet we've barely scratched the surface of?",
      "Why do continents drift, and what did the map look like before?",
      "What triggers ice ages and mass extinctions?",
    ],
    touchstones: ["plate tectonics", "the rock cycle & deep time", "volcanoes & earthquakes", "Pangaea and continental drift", "reading Earth's history in layers of rock"],
    myth: {
      claim: "Diamonds form from squeezed coal.",
      reality: "Almost never. Most diamonds formed deep in Earth's mantle over a billion years ago — long before land plants (the source of coal) even existed. Different carbon, different depth, different story.",
    },
    deeper: ["how seismic waves let us 'see' Earth's iron core without digging", "what radiometric dating actually measures", "how the Grand Canyon exposes millions of years at a glance", "supervolcanoes and how we'd know one was waking up"],
  },
  history_archaeology: {
    label: "Ancient History & Archaeology",
    keys: ["history", "ancient", "archaeology", "pyramid", "civilization", "egypt", "rome", "aliens", "ancientaliens", "artifact", "ruins", "stonehenge", "maya", "mesopotamia", "antikythera", "lostcity"],
    what: "The human past dug out of the ground and pieced back together — lost cities, ancient technology, how civilizations rose and vanished, and how we actually know any of it.",
    big_questions: [
      "How did ancient people build things that would still challenge us today?",
      "Why do whole thriving civilizations collapse?",
      "What have we still NOT found — undeciphered scripts, cities under the sand?",
    ],
    touchstones: ["how the pyramids were really built", "Göbekli Tepe (older than Stonehenge, rewrote the timeline)", "the Antikythera mechanism (a 2,000-year-old geared 'computer')", "civilizational collapse", "undeciphered writing (Linear A, the Indus script)"],
    myth: {
      claim: "Aliens must have built the pyramids and other ancient monuments.",
      reality: "There is zero evidence for it — and it quietly erases the real people who did it. We have the quarries, the copper tools, the worker villages, the ramps, and half-finished monuments that show the method step by step. It was human ingenuity, organized labor, and time. 'Ancient aliens' is TV entertainment, not archaeology, and it usually targets non-European cultures — which tells you something.",
    },
    deeper: ["how the Antikythera mechanism modeled eclipses with bronze gears", "why Göbekli Tepe means monuments came BEFORE farming", "how carbon-14 dating pins an artifact's age", "what really ended the Bronze Age civilizations"],
  },
  minds_science: {
    label: "Great Scientific Minds",
    keys: ["einstein", "tesla", "newton", "darwin", "curie", "scientist", "genius", "inventor", "discovery", "nobel", "galileo", "hawking", "feynman"],
    what: "The people behind the breakthroughs — what Einstein, Tesla, Newton, Darwin and Curie ACTUALLY did, the myths that grew around them, and how they thought.",
    big_questions: [
      "What did Einstein really figure out — beyond the famous E=mc²?",
      "Was Tesla a suppressed genius, or a brilliant inventor wrapped in later mythology?",
      "How do breakthroughs actually happen — lone genius, or standing on a mountain of prior work?",
    ],
    touchstones: ["Einstein (relativity — he did NOT build the atomic bomb)", "Tesla (AC power, the induction motor, real radio work) vs the legend", "Newton (gravity, calculus, optics — and a lot of alchemy)", "Darwin (natural selection)", "Marie Curie (radioactivity, the only person with Nobels in two sciences)"],
    myth: {
      claim: "Tesla invented free, unlimited energy and it was covered up by big business.",
      reality: "Tesla was a real genius — alternating current, the induction motor, genuine early radio. But 'free energy' breaks the law of conservation of energy, and there's no working device or reproducible evidence he had it. The true story — the AC-vs-Edison 'war of currents', his wireless-power experiments — is remarkable enough without the conspiracy.",
    },
    deeper: ["what general relativity predicted that was only proven decades later (and by a solar eclipse)", "the real Tesla-vs-Edison war of currents", "why Marie Curie's notebooks are still too radioactive to handle", "how much time Newton spent on alchemy and the Bible vs physics"],
  },
  computing_ai: {
    label: "Computing & AI",
    keys: ["computing", "computer", "ai", "artificial", "intelligence", "algorithm", "neural", "machinelearning", "turing", "code", "software", "llm", "chatbot", "transformer"],
    what: "How machines compute and 'think' — from the logic under every program, to how modern AI learns, what it genuinely can and can't do, and where it's heading.",
    big_questions: [
      "How does a machine 'learn' from examples without being told the answer?",
      "What can never be computed, even in principle, no matter how fast the computer?",
      "Is today's AI actually understanding — or predicting very well?",
    ],
    touchstones: ["how neural networks learn", "the Turing machine & what's computable", "large language models (like the one answering you)", "quantum vs classical computing", "the halting problem (a limit that can't be engineered away)"],
    myth: {
      claim: "AI like ChatGPT understands language the way a person does.",
      reality: "Today's language AI predicts likely next words from patterns in an enormous pile of training text. It's powerful and genuinely useful — but it's statistical pattern-completion, not human-style understanding, beliefs, or knowing when it's wrong. Holding that in mind is what keeps you from over-trusting it.",
    },
    deeper: ["how 'backpropagation' nudges a network toward right answers", "why some problems are provably unsolvable by any program", "what a 'transformer' actually does under the hood", "how quantum computing could both break and rebuild encryption"],
  },
  chemistry_materials: {
    label: "Chemistry & Materials",
    keys: ["chemistry", "chemical", "materials", "element", "elements", "compound", "molecule", "reaction", "periodic", "metal", "metals", "alloy", "steel", "concrete", "cement", "polymer", "plastic", "glass", "ceramic", "acid", "corrosion", "rust", "carbon"],
    what: "What everything is MADE of and how substances transform — atoms bonding into molecules, why materials behave the way they do, and how we engineer new ones (concrete, steel, plastics, glass).",
    big_questions: [
      "Why does one arrangement of atoms make hard steel and another makes soft sugar — what actually gives a material its strength, stretch, or bang?",
      "How do we design a brand-new material that never existed in nature?",
      "Why does anything react at all — what's really happening the instant two substances combine?",
    ],
    touchstones: ["the periodic table (the map of all matter)", "chemical bonds (ionic vs covalent)", "why water is a weird and life-giving molecule", "concrete & steel — the materials that built the modern world", "polymers/plastics", "corrosion — why iron rusts"],
    myth: {
      claim: "Glass is actually a slow-flowing liquid — that's why old cathedral windows are thicker at the bottom.",
      reality: "No. Glass is an amorphous SOLID; it doesn't flow at room temperature. Old windows are uneven because of how they were hand-made (crown glass), and glaziers simply set the thicker edge at the bottom. Glass flowing enough to see would take longer than the age of the universe.",
    },
    deeper: ["why carbon can build both diamond AND pencil lead AND all of life", "how concrete's C-S-H glue actually sets and hardens", "what makes stainless steel 'stainless' (a self-healing chromium-oxide skin)", "why the periodic table's shape isn't arbitrary — it's built from electron shells"],
  },
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "").replace(/[^a-z0-9]/g, "");
}

// Reverse index: domain key, label, and every topic keyword resolve to a domain.
const TOPIC_INDEX: Record<string, string> = {};
for (const [key, d] of Object.entries(DOMAINS)) {
  TOPIC_INDEX[normalize(key)] = key;
  TOPIC_INDEX[normalize(d.label)] = key;
  for (const k of d.keys) TOPIC_INDEX[normalize(k)] = key;
}

export function resolveDomain(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(TOPIC_INDEX, norm)) return TOPIC_INDEX[norm];
  if (norm.length < 3) return undefined;
  // Substring both ways so "quantum computing" hits "quantumcomputing" etc.
  const hit = Object.entries(TOPIC_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

export function explore(topic?: string): string {
  if (!topic) {
    return (
      `THE CURIOSITY MAP — the big fields, pick one (or ask about any topic and I'll route you):\n\n` +
      Object.entries(DOMAINS).map(([k, d]) => `▸ ${d.label}: ${d.what}`).join("\n") +
      `\n\nAsk with a field name OR any specific thing you're curious about — "black holes", "Tesla", "the pyramids", "quantum computing".`
    );
  }
  const key = resolveDomain(topic);
  if (!key) return `Not sure which field "${clean(topic)}" lands in. The fields: ${Object.values(DOMAINS).map((d) => d.label).join(", ")}. Try a keyword like "space", "evolution", or "Einstein".`;
  const d = DOMAINS[key];
  return [
    `${d.label}${normalize(topic) !== normalize(key) ? ` (from "${clean(topic)}")` : ""}`,
    `BOTTOM LINE: ${d.what}`,
    ``,
    `Questions that pull you in:`,
    ...d.big_questions.map((q) => `  • ${q}`),
    ``,
    `Touchstones worth knowing: ${d.touchstones.join(", ")}`,
    ``,
    `Go deeper (rabbit holes): ${d.deeper.join(" · ")}`,
    ``,
    `Curious if a specific claim here is TRUE? Use check_claim — science and pseudoscience both live in these fields, and telling them apart is half the fun.`,
  ].join("\n");
}

export function mythVsReality(topic?: string): string {
  const entries = Object.entries(DOMAINS);
  const chosen = topic ? entries.filter(([k]) => k === resolveDomain(topic)) : entries;
  if (chosen.length === 0) return `No field matched "${clean(topic ?? "")}". Try a keyword like "aliens", "quantum", or "Tesla".`;
  const blocks = chosen.map(([, d]) => [`▸ ${d.label}`, `   MYTH: ${d.myth.claim}`, `   REALITY: ${d.myth.reality}`].join("\n"));
  return [
    `MYTH vs REALITY${topic ? ` — ${DOMAINS[resolveDomain(topic)!].label}` : " (one per field)"}`,
    `BOTTOM LINE: the popular version of these is wrong in a specific, checkable way — the reality is usually less dramatic and more interesting.`,
    ``,
    ...blocks,
  ].join("\n");
}

export function goDeeper(rawTopic: string): string {
  const topic = clean(rawTopic);
  const key = resolveDomain(topic);
  if (!key) return `Tell me the field or a keyword and I'll hand you the rabbit holes. Fields: ${Object.values(DOMAINS).map((d) => d.label).join(", ")}.`;
  const d = DOMAINS[key];
  return [
    `GO DEEPER — ${d.label}`,
    `BOTTOM LINE: these are the open questions in ${d.label.toLowerCase()} worth your time — and because they're live research, check the current state before you trust any answer.`,
    ``,
    `Next rabbit holes to explore: ${d.deeper.map((x) => `\n  • ${x}`).join("")}`,
    ``,
    `To learn the CURRENT state of any of these (this stuff moves), have research run queries like:`,
    ...d.deeper.slice(0, 2).map((x) => `  • "${x}" latest research explained`),
    ``,
    `And to sanity-check anything you find, run check_claim on it — new + exciting is exactly where bad claims hide.`,
  ].join("\n");
}

const HOW_WE_KNOW = [
  ["How old something is", "Radiometric dating (steady radioactive decay = a clock), tree rings, ice cores, and rock layers. Different clocks cross-check each other."],
  ["What distant stars are made of", "Spectroscopy — split the light into a rainbow and read the missing lines, each element leaves a unique fingerprint."],
  ["How far away a galaxy is", "A ladder of methods: parallax for near stars, 'standard candle' stars of known brightness, then redshift for the far ones."],
  ["What's inside the Earth", "Seismic waves from earthquakes bend and split as they pass through different layers — like an ultrasound of the planet."],
  ["Whether a claim is real", "Reproducibility (others get the same result), peer review (experts try to poke holes), and falsifiability (a real theory makes a prediction that COULD prove it wrong)."],
];

export function howWeKnow(): string {
  return [
    `HOW WE ACTUALLY KNOW — the tools that turn 'I heard' into 'we measured'`,
    `BOTTOM LINE: every one of these works by cross-checking independent methods against each other — that agreement, not any single measurement, is what makes it knowledge.`,
    ``,
    ...HOW_WE_KNOW.map(([q, a]) => `▸ ${q}\n   ${a}`),
    ``,
    `THE ONE RULE that separates science from a good story: extraordinary claims need extraordinary evidence, and a real explanation makes a prediction you could test and be proven wrong on. "You can't prove it DIDN'T happen" is not evidence.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: bring any curiosity — space, quantum, animals, ancient history, Einstein, AI — and I'll give you the real, honest version.`,
    ``,
    `  • Curious about a topic → 'explore <topic>' (or no topic for the whole map).`,
    `  • "Is this actually true?" → 'check_claim <claim>', then 'claim_verdict' once research checks it. This is how ancient aliens, free energy, and viral 'facts' get sorted from real science.`,
    `  • Common myths → 'myth_vs_reality'.  Follow the thread → 'go_deeper <topic>'.  How do we even know? → 'how_we_know'.`,
    ``,
    `Everything checkable routes through research — no confident guessing. Curiosity with honesty.`,
  ].join("\n");
}
