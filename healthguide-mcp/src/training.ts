import { fuzzyFind, displayKey } from "./match.js";

// Training methodology — stable exercise-science principles, distinct from
// medical advice. Never a substitute for medical clearance before an intense
// new program (see the sports_trainer specialist's urgency note).

interface Method {
  label: string;
  what: string;
  recovery_note: string;
  common_myth: string;
}

export const TRAINING_METHODS: Record<string, Method> = {
  weight_training: {
    label: "Weight Training (Resistance Training)",
    what: "Progressive overload — gradually increasing weight, reps, or sets over time so muscle is forced to adapt. Rep ranges roughly map to goals: heavier weight/fewer reps skews toward strength, moderate weight/moderate reps toward muscle size (hypertrophy), lighter weight/high reps toward endurance.",
    recovery_note: "Muscle grows during RECOVERY, not during the workout itself — protein and sleep matter as much as the training. A given muscle group generally needs ~48 hours before training it hard again.",
    common_myth: "'Lifting heavy makes women bulky' is not supported — significant muscle bulk requires a sustained caloric surplus and years of dedicated training, not incidental heavy lifting.",
  },
  calisthenics: {
    label: "Calisthenics",
    what: "Bodyweight training — push-ups, pull-ups, squats, dips — using your own body as the resistance and progressing to harder VARIATIONS (knee push-up -> full push-up -> decline -> one-arm progression) instead of adding external weight.",
    recovery_note: "Same recovery principle as weight training — the muscle adapts between sessions, not during them.",
    common_myth: "'Bodyweight training can't build real strength' is false — advanced calisthenics movements (planche, one-arm pull-up) require strength-to-weight ratios that rival or exceed many weight-room lifts.",
  },
  military_calisthenics: {
    label: "Military-Style Calisthenics",
    what: "Built around a fitness TEST format (push-ups, sit-ups, a timed run), so it emphasizes volume and endurance in a handful of basic movements rather than skill progression. Different goal from modern 'street workout' calisthenics, which targets advanced skills (muscle-ups, planche, human flag) and looks more like gymnastics-adjacent strength training.",
    recovery_note: "High-volume, repeated-daily military PT formats carry a real overuse-injury risk (shin splints, joint strain) if intensity ramps up faster than the body adapts — building volume gradually matters more than in lower-frequency lifting programs.",
    common_myth: "'More reps every day is always better' isn't how adaptation works — even high-volume military programming is periodized (structured hard/easy days) in well-designed versions, not maximum effort daily.",
  },
};

export function explainTrainingMethod(type?: string): string {
  if (!type) {
    return (
      `TRAINING METHODS:\n\n` +
      Object.entries(TRAINING_METHODS).map(([k, m]) => `- ${displayKey(k)}: ${m.what.split(".")[0]}.`).join("\n") +
      `\n\nAsk for any by name. A sports trainer/strength coach ('which_specialist') can build a program tailored to you — get medical clearance first if starting intense training after a long break or with an existing condition.`
    );
  }
  const found = fuzzyFind(TRAINING_METHODS, type);
  if (!found) return `Don't know "${type}". I have: ${Object.keys(TRAINING_METHODS).join(", ")}.`;
  const m = found.value;
  return [
    `${displayKey(found.key)}`,
    `BOTTOM LINE: ${m.what}`,
    ``,
    `Recovery: ${m.recovery_note}`,
    ``,
    `Common myth: ${m.common_myth}`,
    ``,
    `Pair with 'explain_macronutrient protein' and 'explain_macronutrient sports_nutrition' for the fueling side.`,
  ].join("\n");
}
