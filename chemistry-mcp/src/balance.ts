// Balancing a chemical equation is a linear-algebra problem, not a puzzle:
// conservation of each element is one linear equation, and the balanced
// coefficients are the smallest positive integer vector in the null space of
// the element-count matrix. Solving it that way means the answer is DERIVED and
// always correct, including for the ugly redox equations that defeat guessing.
//
// Arithmetic is exact rationals over BigInt, never floats. Gaussian elimination
// on floats accumulates error and then rounds a 2.9999999 to 3 — which happens
// to be right until the day it is 3.0000001 and the equation silently does not
// balance. There is no reason to accept that when the inputs are all integers.

import { parseFormula } from "./formula.js";

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

class Frac {
  n: bigint;
  d: bigint;
  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error("division by zero");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }
  add(o: Frac) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Frac) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Frac) { return new Frac(this.n * o.n, this.d * o.d); }
  div(o: Frac) { return new Frac(this.n * o.d, this.d * o.n); }
  isZero() { return this.n === 0n; }
}

export class BalanceError extends Error {}

export interface BalancedEquation {
  coefficients: number[];
  reactants: string[];
  products: string[];
  equation: string;
  /** element -> atoms on each side, for the proof table */
  check: { element: string; left: number; right: number }[];
}

/** Split "H2 + O2 -> H2O" on the arrow, tolerating =, ->, -->, →, = and "yields". */
function splitSides(input: string): [string[], string[]] {
  const parts = input.split(/-+>|=+>|→|⟶|<=>|⇌|=/).map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BalanceError(
      `Could not find two sides. Write it as "reactants -> products", e.g. "C3H8 + O2 -> CO2 + H2O".`
    );
  }
  const species = (side: string) =>
    side
      .split("+")
      .map((s) => s.trim().replace(/^\d+\s*/, "")) // drop any coefficient the caller already guessed
      .filter(Boolean);
  const left = species(parts[0]);
  const right = species(parts[1]);
  if (!left.length || !right.length) throw new BalanceError("Each side needs at least one species.");
  return [left, right];
}

export function balance(input: string): BalancedEquation {
  const [reactants, products] = splitSides(input);
  const species = [...reactants, ...products];
  if (species.length > 24) throw new BalanceError("Too many species to balance (limit 24).");

  const parsed = species.map((s) => {
    try {
      return parseFormula(s);
    } catch (err) {
      throw new BalanceError(`Could not parse "${s}": ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  const elements = [...new Set(parsed.flatMap((p) => [...p.counts.keys()]))];
  // An element present on only one side can never balance — say so plainly
  // rather than returning a vector of zeros.
  for (const el of elements) {
    const onLeft = parsed.slice(0, reactants.length).some((p) => p.counts.has(el));
    const onRight = parsed.slice(reactants.length).some((p) => p.counts.has(el));
    if (!onLeft || !onRight) {
      throw new BalanceError(
        `${el} appears only on the ${onLeft ? "left" : "right"}. No coefficients can balance that — check the equation.`
      );
    }
  }

  // A[element][species], reactants positive and products negative.
  const rows = elements.map((el) =>
    parsed.map((p, i) => {
      const c = BigInt(p.counts.get(el) ?? 0);
      return new Frac(i < reactants.length ? c : -c);
    })
  );

  const n = species.length;
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < rows.length; c++) {
    let pivot = -1;
    for (let i = r; i < rows.length; i++) if (!rows[i][c].isZero()) { pivot = i; break; }
    if (pivot === -1) continue;
    [rows[r], rows[pivot]] = [rows[pivot], rows[r]];
    const lead = rows[r][c];
    rows[r] = rows[r].map((v) => v.div(lead));
    for (let i = 0; i < rows.length; i++) {
      if (i === r || rows[i][c].isZero()) continue;
      const f = rows[i][c];
      rows[i] = rows[i].map((v, j) => v.sub(f.mul(rows[r][j])));
    }
    pivots.push(c);
    r++;
  }

  const free = [...Array(n).keys()].filter((c) => !pivots.includes(c));
  if (free.length === 0) {
    throw new BalanceError("This equation has no non-trivial solution — as written, nothing balances it.");
  }
  if (free.length > 1) {
    throw new BalanceError(
      `Underdetermined: ${free.length} independent solutions exist, so the coefficients are not unique. ` +
        `That usually means a species is missing, or two reactions have been written as one.`
    );
  }

  // One free variable: set it to 1 and read the pivots off the RREF.
  const x = Array.from({ length: n }, () => new Frac(0n));
  x[free[0]] = new Frac(1n);
  pivots.forEach((c, i) => { x[c] = rows[i][free[0]].mul(new Frac(-1n)); });

  // Clear denominators, then reduce — smallest whole-number coefficients.
  let lcm = 1n;
  for (const v of x) lcm = (lcm * v.d) / gcd(lcm, v.d);
  let ints = x.map((v) => (v.n * lcm) / v.d);
  let g = ints.reduce((a, b) => gcd(a, b), 0n) || 1n;
  ints = ints.map((v) => v / g);
  if (ints.some((v) => v < 0n)) ints = ints.map((v) => -v);
  if (ints.some((v) => v <= 0n)) {
    throw new BalanceError("Balancing produced a non-positive coefficient — the equation as written is not valid.");
  }

  const coefficients = ints.map(Number);
  const show = (list: string[], offset: number) =>
    list.map((s, i) => `${coefficients[offset + i] === 1 ? "" : coefficients[offset + i]}${s}`).join(" + ");

  const check = elements.map((el) => {
    let left = 0;
    let right = 0;
    parsed.forEach((p, i) => {
      const c = (p.counts.get(el) ?? 0) * coefficients[i];
      if (i < reactants.length) left += c;
      else right += c;
    });
    return { element: el, left, right };
  });
  // The proof, actually checked rather than asserted.
  for (const c of check) {
    if (c.left !== c.right) throw new BalanceError(`Internal error: ${c.element} did not balance (${c.left} vs ${c.right}).`);
  }

  return {
    coefficients,
    reactants,
    products,
    equation: `${show(reactants, 0)} -> ${show(products, reactants.length)}`,
    check,
  };
}
