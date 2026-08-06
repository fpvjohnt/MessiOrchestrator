// The "explain how it works" half: what kind of reaction this is, what the
// electrons are actually doing, what shape the molecule takes and why, and the
// acid/base arithmetic.
//
// Where a rule is a RULE OF THUMB it says so. The 1.7 electronegativity cutoff
// between ionic and covalent is the clearest example — it is a teaching
// convention with real exceptions (HF sits at 1.78 and is emphatically
// molecular), and a tool that states it as a law teaches a wrong thing
// confidently. Reporting the number and the caveat costs one line.

import { resolveElement, enDifference, type Element } from "./elements.js";
import { parseFormula } from "./formula.js";

export interface BondVerdict {
  a: Element;
  b: Element;
  difference: number | null;
  kind: string;
  explanation: string;
  caveat?: string;
}

export function classifyBond(symbolA: string, symbolB: string): BondVerdict {
  const a = resolveElement(symbolA);
  const b = resolveElement(symbolB);
  if (!a) throw new Error(`"${symbolA}" is not a known element.`);
  if (!b) throw new Error(`"${symbolB}" is not a known element.`);
  const d = enDifference(a, b);

  // "nonmetal" CONTAINS "metal", and "metalloid" does too. A naive /metal/ test
  // therefore called H–O and C–C metallic bonds — caught by the value tests
  // before this shipped. This is the sense-not-substring bug AGENTS.md already
  // records from the health-claim regex that read "no randomized trials" as
  // evidence of a randomized trial. Exclude the two spoilers explicitly.
  const metal = (e: Element) =>
    /metal/.test(e.category) && !/nonmetal/.test(e.category) && e.category !== "metalloid";
  const bothMetal = metal(a) && metal(b);

  if (d === null) {
    return {
      a, b, difference: null, kind: "undetermined",
      explanation: `No Pauling electronegativity is defined for ${a.electronegativity === null ? a.name : b.name}, so the usual comparison cannot be made. This is a real gap in the data, not a zero.`,
    };
  }
  if (bothMetal) {
    return {
      a, b, difference: d, kind: "metallic",
      explanation: `Both ${a.name} and ${b.name} are metals, so neither holds electrons tightly. They pool their valence electrons into a shared 'sea' that flows between fixed positive cores — which is exactly why metals conduct, bend instead of shattering, and are shiny.`,
    };
  }
  if (d >= 1.7) {
    return {
      a, b, difference: d, kind: "ionic",
      explanation: `Difference is ${d.toFixed(2)}. ${(a.electronegativity! > b.electronegativity! ? a : b).name} pulls hard enough to take the electron outright rather than share it, producing ions held together by electrostatic attraction in all directions. Expect a high-melting, brittle solid that conducts only when molten or dissolved.`,
      caveat: `1.7 is a teaching convention, not a law. HF sits at 1.78 and is unmistakably a molecular gas — bonding is a continuum, and the number is a guide.`,
    };
  }
  if (d >= 0.4) {
    // A metal + nonmetal pair that lands UNDER 1.7 is the case most likely to
    // surprise, because convention calls these compounds ionic while the number
    // says otherwise. Fe–O is 1.61 and Fe2O3 is described as ionic in every
    // textbook. Saying only "polar covalent" here would look like an error to
    // anyone who knows the compound, so the disagreement is stated outright.
    const mixed = (metal(a) && /nonmetal|halogen/.test(b.category)) || (metal(b) && /nonmetal|halogen/.test(a.category));
    return {
      a, b, difference: d, kind: "polar covalent",
      explanation: `Difference is ${d.toFixed(2)}. The electrons are shared but unevenly, sitting closer to ${(a.electronegativity! > b.electronegativity! ? a : b).name}. That leaves a permanent partial charge at each end — a bond dipole. Whether the MOLECULE ends up polar then depends on its shape: symmetric arrangements cancel the dipoles out (CO2 does exactly this).`,
      caveat: mixed
        ? `Heads up: this is a metal with a nonmetal, and compounds of this pair are conventionally CALLED ionic even though ${d.toFixed(2)} sits under the 1.7 cutoff. Both descriptions are in use — the bond has substantial ionic character without being a clean electron transfer. Fe–O (1.61) is the standard example.`
        : undefined,
    };
  }
  return {
    a, b, difference: d, kind: "nonpolar covalent",
    explanation: `Difference is ${d.toFixed(2)}, effectively nothing. The electrons are shared evenly, so there is no permanent dipole and the only intermolecular forces available are the weak, fleeting London dispersion ones. That means low melting and boiling points.`,
  };
}

export interface Vsepr {
  domains: number;
  bonding: number;
  lonePairs: number;
  shape: string;
  angle: string;
  polarNote: string;
}

/**
 * VSEPR from electron-domain counting. Domains repel; lone pairs repel harder
 * than bonding pairs, which is the whole reason water is 104.5° and not 109.5°.
 */
export function vsepr(bonding: number, lonePairs: number): Vsepr {
  const domains = bonding + lonePairs;
  const key = `${domains}-${lonePairs}`;
  const table: Record<string, [string, string, string]> = {
    "2-0": ["linear", "180°", "Symmetric, so identical bond dipoles cancel exactly — CO2 is polar-bonded but non-polar overall."],
    "3-0": ["trigonal planar", "120°", "Symmetric; dipoles cancel if all three outer atoms are the same."],
    "3-1": ["bent", "<120°", "The lone pair squeezes the bond angle and breaks the symmetry, so the molecule IS polar. SO2."],
    "4-0": ["tetrahedral", "109.5°", "Symmetric; cancels with identical outer atoms, as in CH4."],
    "4-1": ["trigonal pyramidal", "~107°", "One lone pair pushes the bonds down and leaves a net dipole. NH3."],
    "4-2": ["bent", "~104.5°", "Two lone pairs, two hard shoves — this is water, and the reason it is so strongly polar."],
    "5-0": ["trigonal bipyramidal", "120° and 90°", "Two distinct positions (equatorial and axial), which is unusual."],
    "5-1": ["seesaw", "<90°, <120°", "The lone pair takes an equatorial slot, where it has the most room."],
    "5-2": ["T-shaped", "~90°", "Two equatorial lone pairs."],
    "5-3": ["linear", "180°", "Three equatorial lone pairs; the remaining bonds are pushed to the axes."],
    "6-0": ["octahedral", "90°", "Fully symmetric — SF6."],
    "6-1": ["square pyramidal", "~90°", "One lone pair below the square base."],
    "6-2": ["square planar", "90°", "Lone pairs go opposite each other, leaving a flat square. XeF4."],
  };
  const hit = table[key];
  if (!hit) throw new Error(`No standard VSEPR geometry for ${bonding} bonding domain(s) and ${lonePairs} lone pair(s).`);
  return { domains, bonding, lonePairs, shape: hit[0], angle: hit[1], polarNote: hit[2] };
}

export interface ReactionKind {
  kind: string;
  pattern: string;
  what: string;
}

/** Classify a balanced (or unbalanced) equation by its shape. */
export function classifyReaction(reactants: string[], products: string[]): ReactionKind[] {
  const kinds: ReactionKind[] = [];
  const has = (list: string[], f: string) => list.some((s) => s.replace(/\s/g, "") === f);
  const isElement = (s: string) => {
    try {
      return parseFormula(s).counts.size === 1;
    } catch {
      return false;
    }
  };

  if (reactants.length > 1 && products.length === 1) {
    kinds.push({ kind: "Synthesis (combination)", pattern: "A + B -> AB", what: "Two or more things become one. Usually exothermic — bonds form and release energy." });
  }
  if (reactants.length === 1 && products.length > 1) {
    kinds.push({ kind: "Decomposition", pattern: "AB -> A + B", what: "One thing becomes several. Usually needs energy in — heat, light, or electricity." });
  }
  if (has(reactants, "O2") && products.some((p) => /CO2/.test(p)) && products.some((p) => /H2O/.test(p))) {
    kinds.push({ kind: "Combustion", pattern: "CxHy + O2 -> CO2 + H2O", what: "A hydrocarbon burning in oxygen. Complete combustion always gives carbon dioxide and water; incomplete combustion gives CO or soot instead, which is why ventilation matters." });
  }
  if (reactants.length === 2 && products.length === 2 && reactants.some(isElement) && products.some(isElement)) {
    kinds.push({ kind: "Single replacement", pattern: "A + BC -> AC + B", what: "One element displaces another from its compound. It only proceeds if the free element is MORE reactive than the one it is trying to displace — that is what the activity series is for." });
  }
  if (reactants.length === 2 && products.length === 2 && !reactants.some(isElement) && !products.some(isElement)) {
    kinds.push({ kind: "Double replacement (metathesis)", pattern: "AB + CD -> AD + CB", what: "The partners swap. It only actually goes if one product leaves the solution — as a precipitate, a gas, or water." });
  }
  const acidish = reactants.some((r) => /^H\d*[A-Z]/.test(r));
  const baseish = reactants.some((r) => /OH/.test(r));
  if (acidish && baseish) {
    kinds.push({ kind: "Acid-base neutralisation", pattern: "HA + BOH -> salt + H2O", what: "A proton transfers from acid to base. The net ionic reaction is almost always just H+ + OH- -> H2O; the ions that do not change are spectators." });
  }
  if (!kinds.length) {
    kinds.push({ kind: "Unclassified", pattern: "-", what: "This does not match a standard textbook pattern. It may be a redox reaction that needs oxidation numbers tracked, or an organic mechanism." });
  }
  return kinds;
}

export interface PhResult {
  ph: number;
  poh: number;
  h: number;
  oh: number;
  verdict: string;
}

/** pH from [H+], or from [OH-] when given that end instead. Kw = 1.0e-14 at 25 °C. */
export function phFrom(concentration: number, species: "H" | "OH"): PhResult {
  if (!(concentration > 0)) throw new Error("Concentration must be greater than zero.");
  const h = species === "H" ? concentration : 1e-14 / concentration;
  const oh = 1e-14 / h;
  const ph = -Math.log10(h);
  const poh = 14 - ph;
  const verdict =
    ph < 3 ? "strongly acidic" : ph < 6.5 ? "acidic" : ph <= 7.5 ? "essentially neutral" : ph < 11 ? "basic" : "strongly basic";
  return { ph, poh, h, oh, verdict };
}

/** Weak-acid pH from Ka and concentration, via the standard x^2/(C-x) treatment solved exactly. */
export function weakAcidPh(ka: number, c: number): { ph: number; x: number; percentIonised: number; approxValid: boolean } {
  if (!(ka > 0) || !(c > 0)) throw new Error("Ka and concentration must both be greater than zero.");
  // x^2 + Ka*x - Ka*C = 0 — solved properly rather than assuming C - x ~ C.
  const x = (-ka + Math.sqrt(ka * ka + 4 * ka * c)) / 2;
  const percentIonised = (x / c) * 100;
  return { ph: -Math.log10(x), x, percentIonised, approxValid: percentIonised < 5 };
}

// The boundary this asset does not cross, stated once and applied everywhere.
//
// Modelled on healthguide's non-suppressible emergency override: the refusal is
// not a mood the caller can talk it out of. Note what it does NOT cover — the
// chemistry of why nitroglycerin is unstable, how nerve agents inhibit
// acetylcholinesterase, why meth precursors are regulated, and every hazard
// warning in this file are all legitimate and stay answerable. Understanding is
// not the line; an actionable preparation route is.
export const SYNTHESIS_BOUNDARY =
  `This asset explains chemistry — structures, mechanisms, and why substances behave as they do — and it ` +
  `does not provide preparation routes, quantities, or procedures for explosives, chemical weapons, or ` +
  `controlled substances. It will still explain the underlying chemistry of any of those, including why they ` +
  `are dangerous, because that is the part worth understanding.`;

const REFUSE_PATTERNS = [
  /\b(how (do|to|can) (i|you|we) )?(make|synthes(is|ise|ize)|manufactur|cook|produc|prepar)\w*\b[\s\S]{0,40}\b(meth|methamphetamine|fentanyl|heroin|cocaine|lsd|mdma|nerve agent|sarin|vx|tabun|novichok|mustard gas|ricin|explosive|tnt|rdx|petn|nitroglycerin|c4|semtex|thermite bomb|pipe bomb|napalm)\b/i,
  /\b(meth|methamphetamine|fentanyl|nerve agent|sarin|vx|novichok|ricin|tnt|rdx|petn|c4|semtex)\b[\s\S]{0,40}\b(synthesis|route|recipe|procedure|precursor list|step by step|how much)\b/i,
  /\b(chlorine gas|mustard gas|phosgene|chloramine)\b[\s\S]{0,30}\b(make|produce|generate|at home|recipe)\b/i,
];

/** True when the request is for an actionable preparation route rather than an explanation. */
export function crossesSynthesisBoundary(text: string): boolean {
  return REFUSE_PATTERNS.some((p) => p.test(text));
}
