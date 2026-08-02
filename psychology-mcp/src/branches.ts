// The psychology map: the branches of the field, each with what it is, the
// ideas that actually carry weight, what it looks like in ordinary life, and
// the caveat that keeps it honest.
//
// SCOPE BOUNDARY — this asset explains the FIELD. It does not handle anyone's
// own mental health. `healthguide` owns that, and it carries a
// non-suppressible 911/988 crisis override that runs before anything else.
// "How does CBT work?" is this asset. "I think I'm depressed" is healthguide,
// every time. Every tool here that touches clinical ground says so out loud
// rather than quietly answering, because a confident explainer is the worst
// possible thing to hand someone who is actually struggling.

export interface Branch {
  label: string;
  keys: string[]; // topic words that route a free-text question to this branch
  what: string;
  key_ideas: string[];
  in_real_life: string[];
  caveat: string;
  deeper: string[];
}

export const BRANCHES: Record<string, Branch> = {
  cognitive: {
    label: "Cognitive Psychology",
    keys: ["memory", "remember", "forget", "attention", "focus", "concentration", "bias", "heuristic", "dissonance", "cognitivedissonance", "cognition", "cognitive", "perception", "thinking", "reasoning", "decision", "problemsolving", "recall", "forgetting", "illusion", "dualprocess", "kahneman"],
    what: "How the mind takes in information, stores it, and uses it — perceiving, remembering, reasoning, and deciding.",
    key_ideas: [
      "Recall is RECONSTRUCTION, not playback. Every time you remember something you rebuild it, and the rebuild can absorb details that were never there.",
      "Working capacity is tiny — roughly a handful of items at once. Almost every 'bad memory' complaint is really an overload problem.",
      "Two modes of thinking: fast, automatic, effortless — and slow, deliberate, effortful. The fast one runs most of the time and is usually right, which is exactly why its mistakes are hard to catch.",
      "Perception is a prediction, not a recording. The brain guesses and corrects; optical illusions are that guess being caught in the act.",
      "Spacing and self-testing beat rereading by a wide margin. Rereading feels effective because it feels FLUENT, and fluency is not learning.",
    ],
    in_real_life: [
      "Confident eyewitness testimony can still be wrong — confidence and accuracy are far more loosely related than juries assume.",
      "Cramming produces a good exam and a bad month-later. Spaced practice produces the reverse.",
      "If a task keeps going wrong, the fix is usually reducing what has to be held at once, not trying harder.",
    ],
    caveat: "A lot of popular 'brain training' rests on this branch and does not survive scrutiny — improvements almost always stay inside the trained task and do not generalise.",
    deeper: ["why the testing effect beats rereading", "how false memories are implanted in the lab", "change blindness", "what dual-process theory actually claims vs the pop version"],
  },

  developmental: {
    label: "Developmental Psychology",
    keys: ["attachmenttheory", "attachmentstyle", "toddler", "teenager", "developmental", "development", "child", "childhood", "infant", "adolescent", "adolescence", "piaget", "vygotsky", "attachment", "parenting", "aging", "lifespan"],
    what: "How thinking, feeling, and relating change across a life — infancy through old age — and what actually drives those changes.",
    key_ideas: [
      "Children are not small adults with less data; the SHAPE of their reasoning differs, then reorganises.",
      "Piaget's stages were the founding map and are now known to be too rigid — the sequence broadly holds, the ages and the sharp boundaries do not.",
      "Attachment: early caregiving shapes a working model of whether people can be relied on. Real, replicated, and routinely overstated into destiny — it predicts tendencies, not outcomes.",
      "Development is not a ladder you finish. Reasoning, regulation, and priorities keep shifting well past adolescence.",
      "Nature versus nurture is the wrong question. Almost everything measured is both, interacting, and heritability is a population statistic that says nothing about a single person.",
    ],
    in_real_life: [
      "A toddler failing to share is usually a capability limit, not defiance.",
      "'Attachment style' as a fixed personality label is pop usage; the research treats it as far more context-dependent and changeable.",
      "Adolescent risk-taking tracks a normal developmental gap between reward sensitivity and regulation — it is a stage, not a character flaw.",
    ],
    caveat: "Parenting advice is where this branch is most abused. Effect sizes are modest, most studies are correlational, and confident universal prescriptions outrun the evidence badly.",
    deeper: ["what replicated from Piaget and what did not", "the Strange Situation and its cultural critiques", "why heritability is so widely misread", "adolescent brain development"],
  },

  social: {
    label: "Social Psychology",
    keys: ["peerpressure", "stereotypethreat", "crowd", "cult", "social", "socialpsychology", "conformity", "obedience", "milgram", "asch", "bystander", "group", "groupthink", "stereotype", "attribution", "ingroup", "prejudice"],
    what: "How other people — present, imagined, or merely implied — change what a person thinks and does.",
    key_ideas: [
      "Situations move behaviour far more than most people expect, and observers systematically under-credit them: we explain others by character and ourselves by circumstance.",
      "Conformity is real and measurable — a lone dissenting voice collapses most of it, which is the finding that actually matters.",
      "Obedience to authority (Milgram) is genuine but far messier than the retelling: rates varied enormously across conditions, and many participants resisted, argued, and stopped.",
      "The bystander effect is real on average and smaller than folklore suggests — in genuine emergencies, intervention is common.",
      "Group membership forms fast, on almost nothing, and immediately shifts who gets the benefit of the doubt.",
    ],
    in_real_life: [
      "If you want honest input in a meeting, collect it before anyone speaks aloud — order of speaking largely determines the outcome.",
      "'They're just like that' is usually an attribution error; change the situation and the behaviour often changes with it.",
      "Being the first person to say 'I'm not sure about this' does most of the work of breaking a bad consensus.",
    ],
    caveat: "This branch took the hardest hit in the replication crisis. Several textbook classics — social priming especially, and the Stanford Prison Experiment as usually told — did not hold up. Verify before repeating.",
    deeper: ["what the Stanford Prison Experiment tapes actually showed", "Milgram's condition-by-condition results", "which priming effects survived replication", "minimal group paradigm"],
  },

  personality: {
    label: "Personality & Individual Differences",
    keys: ["selfesteem", "narcissist", "traittheory", "personality", "trait", "bigfive", "ocean", "extravert", "extrovert", "introvert", "mbti", "myersbriggs", "enneagram", "temperament", "iq", "narcissism"],
    what: "The stable-ish differences between people — how they're described, measured, and how much they actually predict.",
    key_ideas: [
      "The Big Five (openness, conscientiousness, extraversion, agreeableness, neuroticism) is the model with real measurement support. It emerged from the data rather than from a theory.",
      "Traits are DIMENSIONS, not types. Nearly everyone sits in the middle of most of them; the tidy categories are an artefact of chopping a continuum.",
      "Myers-Briggs is popular and psychometrically weak — poor retest reliability, and it forces continuous traits into binary types. It is not used in serious research.",
      "Conscientiousness is the quiet workhorse: it predicts job performance, health behaviour, and longevity better than most things people find more interesting.",
      "Personality is moderately stable and does shift — conscientiousness and agreeableness typically rise with age.",
    ],
    in_real_life: [
      "A team 'type' workshop is mostly a shared vocabulary exercise. That has some value; predictive power is not it.",
      "'I'm an introvert' usually describes energy recovery, not social skill — the two are commonly conflated.",
      "Hiring on personality tests has weak validity; structured work-sample tests do far better.",
    ],
    caveat: "IQ is one of psychology's most predictive measures AND its most misused. It predicts group-level outcomes, is heavily shaped by environment, is not fixed, and says very little about any individual's ceiling.",
    deeper: ["how the Big Five was derived from language", "why MBTI retest reliability is so poor", "the Flynn effect", "person-situation debate"],
  },

  learning_behavior: {
    label: "Learning & Behaviour",
    keys: ["habit", "habits", "willpower", "motivation", "reward", "addictionbehavior", "conditioning", "behaviorism", "behaviourism", "behavioral", "behavioural", "pavlov", "skinner", "reinforce", "punishment", "extinction", "operant", "classical", "habitformation"],
    what: "How behaviour is shaped by what follows it — the oldest experimental core of the field, and still the most directly useful.",
    key_ideas: [
      "Classical conditioning: a neutral cue paired with something meaningful starts producing the response by itself (Pavlov).",
      "Operant conditioning: behaviour is shaped by consequences. Reinforcement increases it, punishment suppresses it.",
      "Unpredictable rewards produce the most persistent behaviour of all. This is precisely why slot machines and feed-refresh work.",
      "Punishment suppresses a behaviour without teaching a replacement, and its effect is tied to the punisher's presence. Reinforcing the alternative works better.",
      "Extinction gets WORSE before it gets better — remove the reward and the behaviour spikes first. Most people quit during that spike and accidentally reinforce it.",
    ],
    in_real_life: [
      "Habit change works best by altering the cue and the immediate consequence, not by summoning more willpower.",
      "Intermittent attention to an unwanted behaviour is the strongest possible way to entrench it.",
      "The extinction burst is why 'ignoring it' seems to fail on day three.",
    ],
    caveat: "Strict behaviourism's claim that inner states are irrelevant lost decisively. The techniques are excellent; the philosophy that thought doesn't matter is not.",
    deeper: ["reinforcement schedules compared", "why punishment generalises poorly", "the cognitive revolution and why behaviourism lost", "applied behaviour analysis debates"],
  },

  clinical_theory: {
    label: "Clinical Psychology — the theory",
    keys: ["phobia", "ocd", "ptsd", "addiction", "depressiontheory", "anxietytheory", "clinical", "psychotherapy", "therapy", "cbt", "psychoanalysis", "freud", "jung", "diagnosis", "dsm", "disorder", "psychopathology"],
    what: "What the major therapies actually claim, how disorders get defined, and what the outcome evidence shows. THE FIELD, not personal care.",
    key_ideas: [
      "CBT's claim: thoughts, feelings, and behaviour drive each other, so changing the reachable ones changes the rest. It has the largest evidence base, especially for anxiety and depression.",
      "Across the major therapies, outcomes are more similar than partisans admit. Common factors — alliance, expectancy, a coherent rationale — carry a large share of the benefit.",
      "The DSM is a working committee document, not a map of natural kinds. Categories get added, merged, and removed; the boundary between disorder and distress is a judgement call.",
      "Freud shaped the culture more than the science. The specific mechanisms are largely unsupported; the durable contribution is that much of mental life runs outside awareness.",
      "Medication and therapy are not rivals in the way public debate frames them — for many conditions the combination outperforms either.",
    ],
    in_real_life: [
      "'It's just CBT worksheets' undersells it — the exposure component does much of the heavy lifting for anxiety.",
      "Therapist fit predicts outcome substantially. A poor match is a reason to switch, not evidence that therapy fails.",
    ],
    caveat: "NOT A SUBSTITUTE FOR CARE. This explains what the approaches claim. Anything about your own symptoms, medication, or safety belongs with healthguide and a real clinician — and if there is any risk to your safety, 988 (US) is the immediate answer, not a reading list.",
    deeper: ["the Dodo bird verdict and its critics", "how DSM categories are decided", "what survived of psychoanalysis", "why exposure works"],
  },

  biological: {
    label: "Biological Psychology",
    keys: ["brainscience", "neuron", "sleepdeprivation", "biological", "neuropsychology", "neurotransmitter", "dopamine", "serotonin", "hormone", "plasticity", "lesion", "fmri", "sleepscience"],
    what: "The physical machinery underneath behaviour — neurons, chemistry, structures — and, just as importantly, the limits of reading behaviour off biology.",
    key_ideas: [
      "Neurotransmitters are not emotions. Dopamine is far closer to WANTING and prediction error than to pleasure; serotonin is not a 'happiness level'.",
      "Plasticity is real and lifelong, but it is slow, effortful, and specific to what is practised.",
      "Brain imaging shows correlation under specific tasks. 'Region X lit up' is a long way from 'region X causes Y'.",
      "Sleep is when memory gets consolidated — losing it degrades learning and emotional regulation directly, not just energy.",
      "Damage studies remain the strongest causal evidence, which is why a handful of patients still anchor whole textbook chapters.",
    ],
    in_real_life: [
      "'Dopamine detox' is built on a misunderstanding of what dopamine does.",
      "Left-brain/right-brain personality typing has no basis; lateralisation is real, the personality claim is not.",
      "Pulling an all-nighter to study trades away the consolidation that makes studying work.",
    ],
    caveat: "Adding a brain scan to a weak claim makes people believe it more without making it truer. Treat neuro-imagery in popular writing as persuasion, not evidence.",
    deeper: ["reward prediction error", "what fMRI actually measures (BOLD)", "the chemical imbalance framing and why it is criticised", "sleep and consolidation"],
  },

  kinesics: {
    label: "Kinesics & Nonverbal Behaviour",
    keys: ["bodymovement", "gesturemeaning", "personalspace", "kinesics", "kinesic", "proxemics", "paralanguage", "oculesics", "haptics", "chronemics", "microexpression", "microexpressions", "mehrabian", "birdwhistell", "facialexpression", "emblem", "gesturescience"],
    what: "The scientific study of body movement as communication — gesture, posture, face, gaze, touch, distance and timing — coined by anthropologist Ray Birdwhistell in the 1950s.",
    key_ideas: [
      "Kinesics is one channel among several: kinesics (movement), proxemics (distance), haptics (touch), oculesics (gaze), chronemics (timing), paralanguage (tone, pace, pauses — how it's said, not what).",
      "Gestures divide by function. EMBLEMS have a fixed dictionary meaning and are culture-specific (a thumbs-up is an insult in parts of the world). ILLUSTRATORS track speech and are near-universal. ADAPTORS are self-soothing — the fidgeting people wrongly read as guilt.",
      "A handful of facial expressions show broad cross-cultural recognition, but 'universal' is contested: recognition drops sharply in remote, non-Western samples and when a word list isn't supplied.",
      "Context and baseline beat any single cue. A gesture means almost nothing without knowing what that person does ordinarily, and how cold the room is.",
      "Nonverbal LEAKAGE is real but weak — people do emit cues under strain. The problem is that stress and deception produce the same cues, so the signal doesn't separate them.",
    ],
    in_real_life: [
      "Interpreters, negotiators and clinicians use baseline-then-deviation, not a cue dictionary — the deviation is the information.",
      "Cross-cultural: eye contact reads as respect in some cultures and challenge in others, and comfortable conversational distance varies by roughly a full arm's length.",
      "Video call flattens most of this channel — no full posture, no distance, and gaze is structurally broken by camera placement.",
    ],
    caveat: "This is the branch with the widest gap between confident public claims and actual evidence. Body-language 'lie detection' does not work: meta-analyses put human accuracy near chance, including for trained police and customs officers, whose confidence rises without their accuracy following. Treat any cue-to-meaning dictionary as entertainment.",
    deeper: ["Ekman's universality thesis and its critics", "why the 7-38-55 rule is misquoted", "emblems vs illustrators vs adaptors", "deception-detection accuracy meta-analyses"],
  },

  methods: {
    label: "Research Methods & the Replication Crisis",
    keys: ["methods", "methodology", "replication", "reproducibility", "phacking", "preregistration", "effectsize", "sample", "weird", "correlation", "causation", "statistics"],
    what: "How psychology knows anything — and the decade in which it discovered that a lot of what it thought it knew did not hold up.",
    key_ideas: [
      "Only a randomised experiment supports a causal claim. Everything else describes association, however sophisticated the analysis.",
      "The replication crisis was real: large coordinated attempts reproduced well under half of a sample of published findings, with effects roughly half the original size.",
      "Causes were structural, not fraud — publication bias against null results, small samples, and analytic flexibility (p-hacking) applied honestly by people who did not realise what it did.",
      "The fixes work and are now mainstream: preregistration, multi-lab replication, bigger samples, reporting effect sizes with intervals instead of bare significance.",
      "WEIRD samples: much of the canon rests on Western, educated, industrialised, rich, democratic undergraduates, then gets described as human nature.",
      "Effect size beats significance. 'Statistically significant' can mean an effect far too small to matter to anyone.",
    ],
    in_real_life: [
      "Before repeating a striking psychology finding, ask one question: has it replicated in a preregistered multi-lab study?",
      "A single study is a lead, never a conclusion — especially a surprising one, since surprise is what gets published.",
      "'Studies show' with no sample size, effect size, or replication is a rhetorical move, not evidence.",
    ],
    caveat: "This branch is the reason this asset ships a verify loop. Psychology's most quotable findings are disproportionately the ones that failed to replicate, so check_finding refuses to answer from memory.",
    deeper: ["the Reproducibility Project results", "how preregistration removes analytic flexibility", "Many Labs replications", "why null results went unpublished"],
  },
};

// Reverse index: canonical key, label, and every alias route to the branch.
const INDEX: Record<string, string> = Object.create(null);
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
for (const [key, b] of Object.entries(BRANCHES)) {
  INDEX[normalize(key)] = key;
  INDEX[normalize(b.label)] = key;
  for (const k of b.keys) INDEX[normalize(k)] = key;
}

export function resolveBranch(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(INDEX, norm)) return INDEX[norm];
  if (norm.length < 3) return undefined;
  // Loose contains-match, LONGEST key first so a specific alias beats a generic
  // one (AGENTS.md: "longest key wins"). Must return undefined for unknown
  // input — regression.mjs asserts it, and null would break every caller.
  const hit = Object.entries(INDEX)
    .filter(([k]) => k.includes(norm) || norm.includes(k))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : undefined;
}
