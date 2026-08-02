// Myth vs reality.
//
// This tool matters more in psychology than in any other domain here. The
// field's most repeated claims are disproportionately the ones that failed —
// partly because a surprising result is what gets published and retold, and a
// quiet correction years later never catches up with it. Several entries below
// are still taught, still in trainings, still in bestsellers.
//
// House rule (AGENTS.md): every tool opens with a BOTTOM LINE, and the honest
// answer is allowed to be "the boring version is correct".

export interface Myth {
  branch: string;
  claim: string;
  reality: string;
}

export const MYTHS: Record<string, Myth> = {
  learning_styles: {
    branch: "cognitive",
    claim: "People learn better when taught in their own style — visual, auditory, kinaesthetic.",
    reality:
      "One of the most tested and most consistently failed ideas in education research. People have real PREFERENCES; matching teaching to them does not improve learning. What does: matching the format to the MATERIAL (diagrams for spatial content, sound for sound), plus spacing and self-testing. Still taught in teacher training worldwide.",
  },
  ten_percent_brain: {
    branch: "biological",
    claim: "We only use 10% of our brains.",
    reality:
      "False, and never had a source. Imaging shows activity throughout; damage to almost any region causes deficits. The brain burns roughly a fifth of the body's energy — evolution does not maintain that for idle tissue.",
  },
  left_right_brain: {
    branch: "biological",
    claim: "Left-brained people are logical, right-brained people are creative.",
    reality:
      "Lateralisation is real — language leans left in most people — but the personality claim is invented. Large imaging studies find no evidence that individuals are 'left-dominant' or 'right-dominant'. Any real task uses both extensively.",
  },
  stanford_prison: {
    branch: "social",
    claim: "The Stanford Prison Experiment showed that ordinary people spontaneously turn cruel when given power.",
    reality:
      "The most-cited demonstration in psychology and among the least sound. Recordings and participant accounts later showed guards were coached toward harshness, at least one 'breakdown' was acknowledged as acted, and there was no control condition. It is best treated as a demonstration of demand characteristics, not of human nature.",
  },
  milgram_65: {
    branch: "social",
    claim: "Milgram proved 65% of people will obey an authority to the point of killing someone.",
    reality:
      "The 65% is ONE condition of many. Obedience swung from near-zero to over 90% depending on the experimenter's proximity, the victim's proximity, and whether peers resisted. Many participants argued, refused, and stopped. The real finding is that SITUATIONS move obedience enormously — which is more useful and far less quotable.",
  },
  social_priming: {
    branch: "social",
    claim: "Subtle cues reliably reshape behaviour — read words about old age and you walk more slowly.",
    reality:
      "The flagship of the replication crisis. Large preregistered multi-lab attempts failed to reproduce the elderly-priming effect and many like it. Some priming is real (semantic priming is solid); the sweeping behavioural version is not.",
  },
  power_posing: {
    branch: "social",
    claim: "Standing in a 'power pose' for two minutes raises testosterone, lowers cortisol, and improves performance.",
    reality:
      "The hormonal and behavioural claims failed replication, and one of the original authors publicly withdrew support for the effect. A small self-reported FEELING of confidence may survive. That is a much smaller claim than the one that sold millions of talks and books.",
  },
  mozart_effect: {
    branch: "cognitive",
    claim: "Playing Mozart to children makes them smarter.",
    reality:
      "The original study found a small, temporary bump in one spatial task in adults, lasting minutes. It was never about babies and never about general intelligence. Any enjoyable arousing music produces the same short-lived effect.",
  },
  eyewitness_confidence: {
    branch: "cognitive",
    claim: "A confident eyewitness is a reliable eyewitness.",
    reality:
      "Confidence and accuracy are far more weakly related than juries believe, and confidence INFLATES with repeated questioning and feedback. Memory is reconstructive — a witness can sincerely and confidently recall a face that was never there. A leading cause of wrongful convictions later overturned by DNA.",
  },
  goldfish_attention: {
    branch: "cognitive",
    claim: "Human attention span has fallen below a goldfish's — about eight seconds.",
    reality:
      "Fabricated. The statistic traces to a consultancy summary with no underlying study, and there is no goldfish attention research behind it. Attention is task-dependent, not a fixed duration.",
  },
  mbti_types: {
    branch: "personality",
    claim: "Personality type tests tell you which of sixteen kinds of person you are.",
    reality:
      "Traits are continuous; the types come from cutting continua near the middle, which is why a large share of people get a different result on retest weeks later. Popular and enjoyable — not a measurement instrument, and not used in serious research.",
  },
  opposites_attract: {
    branch: "social",
    claim: "Opposites attract.",
    reality:
      "The evidence points the other way. Similarity in values, background, and education predicts attraction and stability; complementarity does not. Memorable because the exceptions are the ones worth telling stories about.",
  },
  ten_thousand_hours: {
    branch: "learning_behavior",
    claim: "10,000 hours of practice makes anyone an expert.",
    reality:
      "A popularisation that the underlying researcher disputed. Practice matters enormously, but the number was an average in a few domains, deliberate practice differs from repetition, and the share of variance it explains varies hugely by field — high in chess and music, low in less structured domains.",
  },
  chemical_imbalance: {
    branch: "clinical_theory",
    claim: "Depression is caused by a chemical imbalance — too little serotonin.",
    reality:
      "A marketing simplification the field has largely moved past. Reviews find no consistent evidence that low serotonin causes depression. This does NOT mean antidepressants don't work for many people — mechanism and efficacy are separate questions, and confusing them has caused real harm in both directions.",
  },
  repressed_memory: {
    branch: "clinical_theory",
    claim: "Traumatic memories are commonly repressed and can be accurately recovered in therapy.",
    reality:
      "Among the most damaging ideas the field exported. Lab work shows detailed false memories can be implanted through suggestive questioning, and recovered-memory techniques produced wrongful convictions and shattered families. Trauma more typically produces intrusive, over-remembered recall — the opposite of forgetting.",
  },
  mehrabian_rule: {
    branch: "kinesics",
    claim: "Communication is 55% body language, 38% tone, and only 7% words.",
    reality:
      "The most misquoted statistic in the field. Mehrabian's experiments were narrow: single words, spoken with mismatched tone and expression, judged only for FEELING toward the speaker. The ratio applies when channels CONFLICT and the message is emotional — nothing more. Mehrabian himself has repeatedly said it should not be generalised to communication overall. Taken literally it would mean you could follow a lecture in a language you don't speak.",
  },
  crossed_arms: {
    branch: "kinesics",
    claim: "Crossed arms mean someone is defensive or closed off.",
    reality:
      "A cue dictionary with no evidential base. Crossed arms track being cold, having no armrest, or simple habit at least as often as any attitude. Real nonverbal reading is baseline-then-deviation — what does THIS person do normally, and what changed — not a lookup table. The dictionaries persist because they are easy to teach and satisfying to apply.",
  },
  microexpression_lies: {
    branch: "kinesics",
    claim: "Trained observers can spot lies from microexpressions and body language.",
    reality:
      "Meta-analyses put human deception detection at roughly 54% — barely above a coin flip — and training programmes raise CONFIDENCE far more than accuracy. Police, judges and customs officers score about the same as everyone else. The underlying problem is that anxiety and deception produce identical cues, so an honest nervous person looks exactly like a liar. Real-world programmes built on this have been formally criticised as ineffective.",
  },
  subliminal_ads: {
    branch: "cognitive",
    claim: "Subliminal messages in adverts control what you buy.",
    reality:
      "The founding demonstration was admitted by its author to be fabricated. Subliminal exposure can produce tiny, short-lived shifts on an already-intended choice under lab conditions. It cannot create a preference or drive a purchase.",
  },
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const INDEX: Record<string, string> = Object.create(null);
for (const key of Object.keys(MYTHS)) INDEX[normalize(key)] = key;

export function resolveMyth(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(INDEX, norm)) return INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(INDEX)
    .filter(([k]) => k.includes(norm) || norm.includes(k))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : undefined;
}
