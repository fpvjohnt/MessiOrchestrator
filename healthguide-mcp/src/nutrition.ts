import { fuzzyFind, displayKey } from "./match.js";

// Stable biology (what these do in the body doesn't change year to year) —
// specific intake AMOUNTS are a research-verified reference item instead,
// since those get revised by USDA/NIH periodically.

interface Macro {
  label: string;
  role: string;
  aging_note: string;
  common_myth: string;
}

export const MACROS: Record<string, Macro> = {
  carbohydrates: {
    label: "Carbohydrates",
    role: "Your body's quick-access fuel. Broken down into glucose, which powers your brain and muscles directly. Extra glucose is stored as glycogen in muscle/liver; once that's full, excess converts to fat. Fiber is a type of carbohydrate your body can't digest — it feeds gut bacteria, slows sugar absorption, and drives satiety.",
    aging_note: "Carb QUALITY matters more with age: insulin sensitivity tends to decline, so fiber-rich, slower-digesting carbs (vegetables, legumes, whole grains) support steadier blood sugar better than refined/fast-digesting ones (white bread, sugary drinks).",
    common_myth: "'Carbs are bad' is a myth — carbs are your body's preferred fuel source. What actually matters is the TYPE (whole/fiber-rich vs. refined) and the total amount relative to what you burn.",
  },
  protein: {
    label: "Protein",
    role: "The body's building material. Made of amino acids — 9 of which are 'essential' because your body can't make them, they must come from food. Used to build/repair muscle, make enzymes and hormones, support immune function, and drives satiety (keeps you full).",
    aging_note: "This is one of the most evidence-backed aging facts there is: protein needs actually INCREASE with age to fight sarcopenia (age-related muscle loss), which is a major driver of frailty and falls in older adults. Combined with resistance exercise, adequate protein is one of the strongest levers against age-related decline.",
    common_myth: "'High protein damages healthy kidneys' is not supported by evidence in people without existing kidney disease — that caution applies specifically to people who already have kidney impairment.",
  },
  fat: {
    label: "Fat (Dietary)",
    role: "Essential for hormone production, absorbing fat-soluble vitamins (A, D, E, K), building cell membranes, and long-term energy storage. The brain itself is largely fat by composition.",
    aging_note: "Type matters more than total amount as you age: omega-3 fats (fatty fish, walnuts, flaxseed) are specifically tied to heart and brain health outcomes, while trans fats and excess saturated fat are the ones with the strongest evidence against them.",
    common_myth: "'All fat makes you fat / all fat is bad for your heart' is outdated — the distinction that actually matters is trans fat and excess saturated fat (evidence against) vs. unsaturated/omega-3 fat (evidence for).",
  },
  insulin: {
    label: "Insulin",
    role: "The hormone your pancreas releases when blood sugar rises (mainly from carbs) — it's the 'key' that lets cells pull glucose out of the blood to use for energy or store it (as glycogen in muscle/liver, or as fat once those stores are full). Without enough insulin, or when cells stop responding well to it (insulin resistance), blood sugar stays elevated.",
    aging_note: "Insulin sensitivity naturally tends to decline with age and with loss of muscle mass — which is exactly why protein intake and resistance/weight training (both of which build/preserve muscle) are two of the strongest levers for keeping insulin working well as you get older.",
    common_myth: "'Eating sugar directly causes diabetes' oversimplifies it. Type 1 diabetes is autoimmune (the pancreas stops producing insulin) and is not caused by diet. Type 2 diabetes is driven by long-term insulin resistance — a mix of genetics, muscle mass, visceral fat, and overall dietary pattern over years, not any single food.",
  },
  sports_nutrition: {
    label: "Sports Nutrition",
    role: "Nutrition timed around exercise: enough carbs to fuel the session, protein afterward to rebuild muscle, and hydration/electrolytes especially for longer or hot-weather sessions.",
    aging_note: "Older adults generally need MORE protein per workout to get the same muscle-building response as a younger person (called 'anabolic resistance') — part of why general protein guidance shifts upward with age.",
    common_myth: "The 'anabolic window' (you must eat protein within 30 minutes post-workout or lose the gains) is outdated — total daily protein intake matters far more than hitting a narrow post-workout timer.",
  },
};

export function explainMacronutrient(type?: string): string {
  if (!type) {
    return (
      `THE THREE MACRONUTRIENTS:\n\n` +
      Object.entries(MACROS).map(([k, m]) => `- ${displayKey(k)}: ${m.role.split(".")[0]}.`).join("\n") +
      `\n\nAsk for any one by name for the full science + the aging-specific angle. Specific gram targets are individual — see 'get_reference' for the current general guideline, and a nutritionist/dietitian for a number tailored to you.`
    );
  }
  const found = fuzzyFind(MACROS, type);
  if (!found) return `Don't know "${type}". I have: ${Object.keys(MACROS).join(", ")}.`;
  const m = found.value;
  return [
    `${displayKey(found.key)}`,
    `BOTTOM LINE: ${m.role}`,
    ``,
    `As you get older: ${m.aging_note}`,
    ``,
    `Common myth: ${m.common_myth}`,
    ``,
    `How the body prioritizes fuel: glucose (from carbs) is used first, then fat, with protein spared for rebuilding unless the body is truly out of other fuel (starvation/extreme low-carb). This is the real mechanism behind most fasting/keto claims — run 'check_the_science' on a specific claim to see what the actual evidence says, not just the theory.`,
    ``,
    `Specific daily amounts are individual (age, activity, health conditions) — see 'get_reference' for the current general guideline and confirm with a nutritionist/dietitian for a number tailored to you.`,
  ].join("\n");
}
