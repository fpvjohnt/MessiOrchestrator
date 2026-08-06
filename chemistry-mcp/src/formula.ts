// Formula parsing and the arithmetic that hangs off it.
//
// Everything here is COMPUTED from the element table, never recalled. That is
// the point: a molar mass this asset reports can be checked by hand from the
// numbers it shows, and it cannot drift the way a remembered value can. It is
// also why the parser is strict — a formula it does not understand is an error,
// not a guess, because a silently mis-parsed formula produces a confident wrong
// number, which is the single worst thing a chemistry tool can do.

import { BY_SYMBOL, type Element } from "./elements.js";

export interface ParsedFormula {
  /** element symbol -> atom count */
  counts: Map<string, number>;
  /** the formula as given, after whitespace normalisation */
  input: string;
  /** true when any constituent element's mass is a longest-lived isotope */
  hasSynthetic: boolean;
}

export class FormulaError extends Error {}

/**
 * Parse a chemical formula into atom counts.
 *
 * Handles nested parentheses and brackets — Ca(NO3)2, K4[Fe(CN)6] — plus
 * hydrate notation with either the interpunct or a plain asterisk/period,
 * because nobody can type "·" easily: CuSO4·5H2O, CuSO4*5H2O, CuSO4.5H2O.
 */
export function parseFormula(input: string): ParsedFormula {
  const cleaned = input.replace(/\s+/g, "");
  if (!cleaned) throw new FormulaError("Empty formula.");

  // Hydrates: split on the dot forms, parse each part, multiply by its prefix.
  const parts = cleaned.split(/[·•*.]/).filter(Boolean);
  const counts = new Map<string, number>();
  for (const part of parts) {
    const m = /^(\d+)(.*)$/.exec(part); // leading coefficient, as in "5H2O"
    const multiplier = m ? Number(m[1]) : 1;
    const body = m ? m[2] : part;
    if (!body) throw new FormulaError(`"${part}" has a number but no formula after it.`);
    const sub = parseSegment(body);
    for (const [sym, n] of sub) counts.set(sym, (counts.get(sym) ?? 0) + n * multiplier);
  }

  let hasSynthetic = false;
  for (const sym of counts.keys()) {
    const el = BY_SYMBOL.get(sym);
    if (!el) throw new FormulaError(`"${sym}" is not a known element symbol.`);
    if (el.synthetic) hasSynthetic = true;
  }
  return { counts, input: cleaned, hasSynthetic };
}

function parseSegment(s: string): Map<string, number> {
  const counts = new Map<string, number>();
  let i = 0;

  function readNumber(): number {
    let digits = "";
    while (i < s.length && /\d/.test(s[i])) digits += s[i++];
    return digits ? Number(digits) : 1;
  }

  function merge(into: Map<string, number>, from: Map<string, number>, mult: number) {
    for (const [k, v] of from) into.set(k, (into.get(k) ?? 0) + v * mult);
  }

  while (i < s.length) {
    const ch = s[i];

    if (ch === "(" || ch === "[") {
      const close = ch === "(" ? ")" : "]";
      let depth = 1;
      const start = ++i;
      while (i < s.length && depth > 0) {
        if (s[i] === "(" || s[i] === "[") depth++;
        else if (s[i] === ")" || s[i] === "]") depth--;
        if (depth > 0) i++;
      }
      if (depth !== 0) throw new FormulaError(`Unbalanced "${ch}" in "${s}".`);
      const inner = s.slice(start, i);
      i++; // consume the closing bracket
      if (!inner) throw new FormulaError(`Empty group "${ch}${close}" in "${s}".`);
      merge(counts, parseSegment(inner), readNumber());
      continue;
    }

    if (ch === ")" || ch === "]") throw new FormulaError(`Unmatched "${ch}" in "${s}".`);

    // An element symbol is one uppercase letter plus any lowercase that follow.
    if (!/[A-Z]/.test(ch)) {
      throw new FormulaError(
        `Unexpected "${ch}" in "${s}". Element symbols start with a capital letter — "co" is not cobalt, "Co" is.`
      );
    }
    let sym = s[i++];
    while (i < s.length && /[a-z]/.test(s[i])) sym += s[i++];
    if (!BY_SYMBOL.has(sym)) throw new FormulaError(`"${sym}" is not a known element symbol.`);
    counts.set(sym, (counts.get(sym) ?? 0) + readNumber());
  }

  return counts;
}

export interface MassBreakdownRow {
  element: Element;
  count: number;
  subtotal: number;
  percent: number;
}

export interface MolarMass {
  total: number;
  rows: MassBreakdownRow[];
  atoms: number;
  hasSynthetic: boolean;
}

/** Molar mass in g/mol, with the per-element working shown. */
export function molarMass(formula: string): MolarMass {
  const parsed = parseFormula(formula);
  const rows: MassBreakdownRow[] = [];
  let total = 0;
  let atoms = 0;
  for (const [sym, count] of parsed.counts) {
    const element = BY_SYMBOL.get(sym)!;
    const subtotal = element.mass * count;
    total += subtotal;
    atoms += count;
    rows.push({ element, count, subtotal, percent: 0 });
  }
  for (const r of rows) r.percent = (r.subtotal / total) * 100;
  // Heaviest contribution first — that is the one worth sanity-checking.
  rows.sort((a, b) => b.subtotal - a.subtotal);
  return { total, rows, atoms, hasSynthetic: parsed.hasSynthetic };
}

/** Render a counts map back to a formula string, in Hill order (C, H, then alphabetical). */
export function formatCounts(counts: Map<string, number>): string {
  const syms = [...counts.keys()];
  const hill = (a: string, b: string) => {
    if (counts.has("C")) {
      if (a === "C") return -1;
      if (b === "C") return 1;
      if (a === "H") return -1;
      if (b === "H") return 1;
    }
    return a.localeCompare(b);
  };
  return syms
    .sort(hill)
    .map((s) => `${s}${counts.get(s) === 1 ? "" : counts.get(s)}`)
    .join("");
}

/**
 * Empirical formula from percent composition — the classic lab calculation,
 * and one that is pure arithmetic, so there is no reason to approximate it.
 * Divides moles by the smallest, then scales to whole numbers.
 */
export function empiricalFromPercent(entries: { symbol: string; percent: number }[]): {
  formula: string;
  moles: { symbol: string; moles: number; ratio: number }[];
  scale: number;
} {
  if (entries.length < 2) throw new FormulaError("Give at least two elements with their mass percentages.");
  const sum = entries.reduce((a, e) => a + e.percent, 0);
  if (Math.abs(sum - 100) > 2) {
    throw new FormulaError(`Percentages sum to ${sum.toFixed(2)}%, not ~100%. Check the input before trusting a result.`);
  }
  const moles = entries.map((e) => {
    const el = BY_SYMBOL.get(e.symbol) ?? BY_SYMBOL.get(e.symbol[0].toUpperCase() + e.symbol.slice(1).toLowerCase());
    if (!el) throw new FormulaError(`"${e.symbol}" is not a known element symbol.`);
    return { symbol: el.symbol, moles: e.percent / el.mass, ratio: 0 };
  });
  const min = Math.min(...moles.map((m) => m.moles));
  for (const m of moles) m.ratio = m.moles / min;
  // Scale up until every ratio is within 0.1 of an integer (handles the .5/.33
  // cases that make an empirical formula come out as Fe2O3 rather than FeO1.5).
  let scale = 1;
  while (scale <= 6 && !moles.every((m) => Math.abs(m.ratio * scale - Math.round(m.ratio * scale)) < 0.1)) scale++;
  if (scale > 6) scale = 1;
  const counts = new Map(moles.map((m) => [m.symbol, Math.round(m.ratio * scale)]));
  return { formula: formatCounts(counts), moles, scale };
}

export const AVOGADRO = 6.02214076e23; // exact, by the 2019 SI definition
