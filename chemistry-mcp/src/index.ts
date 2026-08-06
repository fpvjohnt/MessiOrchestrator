#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ELEMENTS, resolveElement } from "./elements.js";
import { molarMass, parseFormula, empiricalFromPercent, AVOGADRO, formatCounts } from "./formula.js";
import { balance } from "./balance.js";
import { COMPOUNDS, POLYATOMIC_IONS, FUNCTIONAL_GROUPS, resolveCompound } from "./compounds.js";
import {
  classifyBond, vsepr, classifyReaction, phFrom, weakAcidPh,
  SYNTHESIS_BOUNDARY, crossesSynthesisBoundary,
} from "./reactions.js";

const server = new McpServer({ name: "chemistry", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
/** Every free-text surface passes through here first. */
function guard(text: string | undefined) {
  if (text && crossesSynthesisBoundary(text)) {
    throw new Error(`REFUSED — ${SYNTHESIS_BOUNDARY}\n\nAsk about the mechanism, the structure, or why it behaves as it does, and you will get a real answer.`);
  }
}

// Sized to match the other assets in this registry, which measured 2000 against
// real case objectives rather than guessing a cap.
const lookupKey = z.string().max(2000);
const num = z.number().finite();

const fmt = (n: number, sig = 4) =>
  Math.abs(n) >= 1e5 || (Math.abs(n) < 1e-3 && n !== 0) ? n.toExponential(sig - 1) : Number(n.toPrecision(sig)).toString();

server.registerTool(
  "periodic_table",
  {
    title: "Periodic Table Lookup",
    description:
      "THE PERIODIC TABLE, as data. Name any element by symbol, name, or atomic number ('Fe', 'iron', '26', " +
      "'aluminum') and get its real atomic mass, group, period, category, Pauling electronegativity, common " +
      "oxidation states and full electron configuration. Omit 'element' for the whole table; pass 'group', " +
      "'period' or 'category' to list a family (e.g. category='halogen'). All 118 elements, IUPAC values.",
    inputSchema: {
      element: lookupKey.optional(),
      group: z.number().int().min(1).max(18).optional(),
      period: z.number().int().min(1).max(7).optional(),
      category: z.string().max(60).optional(),
    },
  },
  async ({ element, group, period, category }) => {
    try {
      if (element) {
        const e = resolveElement(element);
        if (!e) return textResult(`No element matches "${element}". Try a symbol (Fe), a name (iron), or an atomic number (26).`);
        const neighbours = ELEMENTS.filter((x) => x.group === e.group && x.group !== 0 && x.z !== e.z).map((x) => x.symbol);
        return textResult(
          [
            `${e.name.toUpperCase()} (${e.symbol}) — element ${e.z}`,
            `BOTTOM LINE: ${e.category}, ${e.group === 0 ? "f-block" : `group ${e.group}`}, period ${e.period}, atomic mass ${e.mass} g/mol.`,
            ``,
            `  Atomic number (protons) : ${e.z}`,
            `  Atomic mass            : ${e.mass} g/mol${e.synthetic ? "  ← no stable isotope; this is the longest-lived one's mass number" : ""}`,
            `  Group / period         : ${e.group === 0 ? "f-block (lanthanide/actinide)" : e.group} / ${e.period}`,
            `  Category               : ${e.category}`,
            `  Electronegativity      : ${e.electronegativity === null ? "no accepted Pauling value" : e.electronegativity + " (Pauling)"}`,
            `  Common oxidation states: ${e.oxidation}`,
            `  Electron configuration : ${e.config}`,
            ``,
            `WHY IT BEHAVES THAT WAY: the configuration is the explanation. ${e.config.split(" ").slice(-1)[0]} is the outermost` +
              ` subshell, and how far that is from a full shell decides what this element does — elements in the same column` +
              ` share it, which is why group ${e.group === 0 ? "(f-block)" : e.group} behaves as a family${neighbours.length ? `: ${neighbours.join(", ")}` : ""}.`,
          ].join("\n")
        );
      }
      let list = ELEMENTS;
      const filters: string[] = [];
      if (group !== undefined) { list = list.filter((e) => e.group === group); filters.push(`group ${group}`); }
      if (period !== undefined) { list = list.filter((e) => e.period === period); filters.push(`period ${period}`); }
      if (category) {
        const c = category.toLowerCase();
        list = list.filter((e) => e.category.includes(c)); filters.push(`category "${category}"`);
      }
      if (!list.length) return textResult(`Nothing matches ${filters.join(" + ")}.`);
      return textResult(
        [
          `PERIODIC TABLE${filters.length ? ` — ${filters.join(", ")}` : " — all 118 elements"}`,
          `BOTTOM LINE: ${list.length} element(s). Mass in g/mol, EN = Pauling electronegativity.`,
          ``,
          `  Z  Sym  Name             Mass      Grp  Per  EN     Category`,
          ...list.map(
            (e) =>
              `  ${String(e.z).padStart(3)}  ${e.symbol.padEnd(3)}  ${e.name.padEnd(15)}  ${String(e.mass).padEnd(8)}  ` +
              `${(e.group === 0 ? "f" : String(e.group)).padStart(3)}  ${String(e.period).padStart(3)}  ` +
              `${(e.electronegativity === null ? "—" : e.electronegativity.toFixed(2)).padEnd(5)}  ${e.category}`
          ),
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "compound",
  {
    title: "Look Up a Substance",
    description:
      "Name a substance in plain words — 'baking soda', 'table salt', 'rust', 'vinegar', 'battery acid' — or " +
      "give its formula, and get the REAL formula, what it is structurally, and WHY it behaves the way it " +
      "does (the mechanism, not trivia), plus its molar mass computed from the element table and any hazard " +
      "worth knowing. Omit 'name' to list everything known.",
    inputSchema: { name: lookupKey.optional() },
  },
  async ({ name }) => {
    try {
      guard(name);
      if (!name) {
        return textResult(
          [
            `KNOWN SUBSTANCES — ${COMPOUNDS.length} by name or formula:`,
            ``,
            ...COMPOUNDS.map((c) => `  ${c.formula.padEnd(14)} ${c.name}${c.aka.length ? ` (${c.aka.join(", ")})` : ""}`),
            ``,
            `Any formula also works directly in molar_mass, even if it is not listed here.`,
          ].join("\n")
        );
      }
      const c = resolveCompound(name);
      if (!c) {
        // Not in the library — but it may still be a valid formula we can work with.
        try {
          const mm = molarMass(name);
          return textResult(
            [
              `"${name}" is not in the named-substance list, but it parses as a valid formula.`,
              `BOTTOM LINE: molar mass ${fmt(mm.total, 6)} g/mol, ${mm.atoms} atoms per formula unit.`,
              ``,
              `Use molar_mass for the full per-element breakdown, or bonding to see how its atoms are held together.`,
            ].join("\n")
          );
        } catch {
          return textResult(`No substance matches "${name}", and it does not parse as a chemical formula either. Call this tool with no argument to see the list.`);
        }
      }
      const mm = molarMass(c.formula);
      return textResult(
        [
          `${c.name.toUpperCase()} — ${c.formula}`,
          `BOTTOM LINE: ${c.what}`,
          ``,
          `  Also called   : ${c.aka.length ? c.aka.join(", ") : "—"}`,
          `  Type          : ${c.kind}`,
          `  Molar mass    : ${fmt(mm.total, 6)} g/mol  (computed from the element table, not recalled)`,
          ``,
          `HOW IT WORKS: ${c.why}`,
          ...(c.hazard ? [``, `HAZARD: ${c.hazard}`] : []),
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "molar_mass",
  {
    title: "Molar Mass and Percent Composition",
    description:
      "Compute molar mass in g/mol from ANY formula, with the per-element working shown so it can be checked " +
      "by hand. Handles nested groups — Ca(NO3)2, K4[Fe(CN)6] — and hydrates written with a dot, asterisk or " +
      "period (CuSO4·5H2O, CuSO4*5H2O). Also returns percent composition by mass. Pass 'grams' or 'moles' to " +
      "convert between them and particle count in the same call.",
    inputSchema: {
      formula: lookupKey,
      grams: num.positive().optional(),
      moles: num.positive().optional(),
    },
  },
  async ({ formula, grams, moles }) => {
    try {
      guard(formula);
      const mm = molarMass(formula);
      const lines = [
        `MOLAR MASS — ${formula}`,
        `BOTTOM LINE: ${fmt(mm.total, 6)} g/mol (${mm.atoms} atoms per formula unit).`,
        ``,
        `  Element  Count   Atomic mass      Subtotal        % by mass`,
        ...mm.rows.map(
          (r) =>
            `  ${r.element.symbol.padEnd(7)}  ${String(r.count).padStart(5)}   ` +
            `${String(r.element.mass).padEnd(13)}  ${fmt(r.subtotal, 6).padEnd(14)}  ${r.percent.toFixed(2)}%`
        ),
        `  ${"".padEnd(7)}  ${"".padStart(5)}   ${"".padEnd(13)}  ${fmt(mm.total, 6).padEnd(14)}  100.00%`,
      ];
      if (mm.hasSynthetic) {
        lines.push(``, `NOTE: this formula contains an element with no stable isotope, so its "mass" is a longest-lived isotope's mass number. Treat the total as nominal.`);
      }
      if (grams !== undefined) {
        const n = grams / mm.total;
        lines.push(``, `CONVERSION: ${grams} g ÷ ${fmt(mm.total, 6)} g/mol = ${fmt(n, 6)} mol = ${(n * AVOGADRO).toExponential(4)} formula units.`);
      }
      if (moles !== undefined) {
        lines.push(``, `CONVERSION: ${moles} mol × ${fmt(mm.total, 6)} g/mol = ${fmt(moles * mm.total, 6)} g = ${(moles * AVOGADRO).toExponential(4)} formula units.`);
      }
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "balance_equation",
  {
    title: "Balance a Chemical Equation",
    description:
      "Balance any chemical equation and PROVE it, atom by atom. Write it as 'C3H8 + O2 -> CO2 + H2O' (=, ->, " +
      "→ and = all work; any coefficients you already guessed are ignored). Solved as linear algebra over exact " +
      "rational numbers — it finds the smallest whole-number coefficients, or explains precisely why no valid " +
      "set exists, rather than guessing. Also classifies what kind of reaction it is.",
    inputSchema: { equation: lookupKey },
  },
  async ({ equation }) => {
    try {
      guard(equation);
      const b = balance(equation);
      const kinds = classifyReaction(b.reactants, b.products);
      return textResult(
        [
          `BALANCED — ${b.equation}`,
          `BOTTOM LINE: coefficients ${b.coefficients.join(", ")} — the smallest whole numbers that conserve every element.`,
          ``,
          `PROOF (atoms on each side, checked not asserted):`,
          `  Element   Left   Right`,
          ...b.check.map((c) => `  ${c.element.padEnd(8)}  ${String(c.left).padStart(4)}   ${String(c.right).padStart(5)}  ${c.left === c.right ? "✓" : "✗"}`),
          ``,
          `REACTION TYPE:`,
          ...kinds.map((k) => `  ▸ ${k.kind}  (${k.pattern})\n    ${k.what}`),
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "stoichiometry",
  {
    title: "Stoichiometry and Limiting Reagent",
    description:
      "The actual lab calculation: given a balanced equation and how much of each reactant you have (in grams " +
      "or moles), find the limiting reagent, the theoretical yield of any product, and what is left over. " +
      "Balances the equation itself first, so you do not have to. Pass actual_yield to get percent yield.",
    inputSchema: {
      equation: lookupKey,
      have: z.array(z.object({
        formula: z.string().max(200),
        grams: num.positive().optional(),
        moles: num.positive().optional(),
      })).min(1).max(8),
      product: z.string().max(200).optional(),
      actual_yield_grams: num.positive().optional(),
    },
  },
  async ({ equation, have, product, actual_yield_grams }) => {
    try {
      guard(equation);
      const b = balance(equation);
      const norm = (s: string) => s.replace(/\s/g, "");
      const species = [...b.reactants, ...b.products].map(norm);

      const supplied = have.map((h) => {
        const f = norm(h.formula);
        const idx = species.indexOf(f);
        if (idx === -1) throw new Error(`"${h.formula}" is not in the equation. Species are: ${species.join(", ")}.`);
        if (idx >= b.reactants.length) throw new Error(`"${h.formula}" is a product, not a reactant — give what you HAVE.`);
        const mm = molarMass(f);
        if (h.moles === undefined && h.grams === undefined) throw new Error(`Give grams or moles for "${h.formula}".`);
        const moles = h.moles ?? h.grams! / mm.total;
        return { formula: f, idx, mm: mm.total, moles, grams: h.grams ?? moles * mm.total, coeff: b.coefficients[idx] };
      });

      // The limiting reagent is whichever has the fewest "reaction units" —
      // moles divided by its own coefficient. That ratio, not raw mass, is the
      // comparison, which is the step this calculation exists to get right.
      const withRatio = supplied.map((s) => ({ ...s, units: s.moles / s.coeff }));
      const limiting = withRatio.reduce((a, c) => (c.units < a.units ? c : a));
      const extent = limiting.units;

      const productName = product ? norm(product) : b.products[0];
      const pIdx = species.indexOf(productName);
      if (pIdx === -1 || pIdx < b.reactants.length) throw new Error(`"${productName}" is not a product of this equation. Products: ${b.products.join(", ")}.`);
      const pMm = molarMass(productName);
      const pMoles = extent * b.coefficients[pIdx];
      const pGrams = pMoles * pMm.total;

      const lines = [
        `STOICHIOMETRY — ${b.equation}`,
        `BOTTOM LINE: ${limiting.formula} is limiting; theoretical yield of ${productName} is ${fmt(pGrams, 5)} g (${fmt(pMoles, 5)} mol).`,
        ``,
        `WHAT YOU HAVE:`,
        `  Species    Grams        Moles        Coeff   Moles/Coeff`,
        ...withRatio.map(
          (s) =>
            `  ${s.formula.padEnd(9)}  ${fmt(s.grams, 5).padEnd(11)}  ${fmt(s.moles, 5).padEnd(11)}  ${String(s.coeff).padStart(5)}   ${fmt(s.units, 5)}` +
            (s.formula === limiting.formula ? "  ← LIMITING (smallest)" : "")
        ),
        ``,
        `WHY: divide each reactant's moles by its own coefficient. The smallest result runs out first — comparing raw masses or raw moles is the classic wrong answer here.`,
        ``,
        `LEFT OVER:`,
        ...withRatio
          .filter((s) => s.formula !== limiting.formula)
          .map((s) => {
            const used = extent * s.coeff;
            return `  ${s.formula}: used ${fmt(used, 5)} mol of ${fmt(s.moles, 5)} mol → ${fmt((s.moles - used) * s.mm, 5)} g remains`;
          }),
      ];
      if (!withRatio.some((s) => s.formula !== limiting.formula)) lines.push(`  (only one reactant supplied — nothing to compare)`);
      if (actual_yield_grams !== undefined) {
        lines.push(``, `PERCENT YIELD: ${fmt(actual_yield_grams, 5)} g actual ÷ ${fmt(pGrams, 5)} g theoretical = ${((actual_yield_grams / pGrams) * 100).toFixed(2)}%`);
      }
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "bonding",
  {
    title: "Bond Type and Molecular Shape",
    description:
      "Why two atoms stick together, and what shape the result takes. Give two elements to classify the bond " +
      "from their real Pauling electronegativity difference (ionic / polar covalent / nonpolar covalent / " +
      "metallic), with the caveat that the 1.7 cutoff is a convention rather than a law. Give bonding_pairs " +
      "and lone_pairs instead to get the VSEPR geometry, bond angle, and whether the molecule ends up polar.",
    inputSchema: {
      element_a: lookupKey.optional(),
      element_b: lookupKey.optional(),
      bonding_pairs: z.number().int().min(2).max(6).optional(),
      lone_pairs: z.number().int().min(0).max(3).optional(),
    },
  },
  async ({ element_a, element_b, bonding_pairs, lone_pairs }) => {
    try {
      const lines: string[] = [];
      if (element_a && element_b) {
        const v = classifyBond(element_a, element_b);
        lines.push(
          `BOND: ${v.a.symbol}–${v.b.symbol} (${v.a.name} and ${v.b.name})`,
          `BOTTOM LINE: ${v.kind}${v.difference === null ? "" : `, electronegativity difference ${v.difference.toFixed(2)}`}.`,
          ``,
          `  ${v.a.symbol} electronegativity: ${v.a.electronegativity ?? "—"}`,
          `  ${v.b.symbol} electronegativity: ${v.b.electronegativity ?? "—"}`,
          ``,
          `WHY: ${v.explanation}`
        );
        if (v.caveat) lines.push(``, `CAVEAT: ${v.caveat}`);
      }
      if (bonding_pairs !== undefined) {
        const g = vsepr(bonding_pairs, lone_pairs ?? 0);
        if (lines.length) lines.push(``, `---`, ``);
        lines.push(
          `SHAPE: ${g.shape} (${g.bonding} bonding domain(s), ${g.lonePairs} lone pair(s), ${g.domains} total)`,
          `BOTTOM LINE: bond angle ${g.angle}.`,
          ``,
          `WHY: electron domains repel and settle as far apart as possible. Lone pairs are held closer to the`,
          `nucleus and repel HARDER than bonding pairs, which is why every lone pair squeezes the bond angle`,
          `below the ideal — the difference between methane's 109.5° and water's 104.5° is exactly this.`,
          ``,
          `POLARITY: ${g.polarNote}`
        );
      }
      if (!lines.length) return textResult(`Give either two elements (element_a and element_b) or a domain count (bonding_pairs, lone_pairs).`);
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "ph",
  {
    title: "pH, pOH and Acid Strength",
    description:
      "Acid-base arithmetic at 25 °C (Kw = 1.0e-14). Give concentration + species ('H' or 'OH') for a strong " +
      "acid or base, or give ka + concentration for a weak acid — the weak case is solved exactly with the " +
      "quadratic rather than the C-x ≈ C shortcut, and it reports whether that shortcut would have been valid.",
    inputSchema: {
      concentration: num.positive().optional(),
      species: z.enum(["H", "OH"]).optional(),
      ka: num.positive().optional(),
    },
  },
  async ({ concentration, species, ka }) => {
    try {
      if (ka !== undefined && concentration !== undefined) {
        const w = weakAcidPh(ka, concentration);
        return textResult(
          [
            `WEAK ACID — Ka = ${ka.toExponential(2)}, C = ${concentration} M`,
            `BOTTOM LINE: pH = ${w.ph.toFixed(2)}, ${w.percentIonised.toFixed(2)}% ionised.`,
            ``,
            `  [H+] at equilibrium : ${w.x.toExponential(4)} M`,
            `  pKa                 : ${(-Math.log10(ka)).toFixed(2)}`,
            ``,
            `WHY: a weak acid only partly dissociates, so [H+] is not the concentration you started with — it is`,
            `the x that solves x²/(C−x) = Ka. Solved here with the quadratic, exactly.`,
            ``,
            `SHORTCUT CHECK: the usual C−x ≈ C approximation ${w.approxValid ? "WOULD have been valid here (<5% ionised)" : "would NOT have been valid here (>5% ionised) — it would have given a wrong answer"}.`,
          ].join("\n")
        );
      }
      if (concentration === undefined) return textResult(`Give concentration (and species 'H' or 'OH'), or ka + concentration for a weak acid.`);
      const r = phFrom(concentration, species ?? "H");
      return textResult(
        [
          `STRONG ${(species ?? "H") === "H" ? "ACID" : "BASE"} — ${concentration} M`,
          `BOTTOM LINE: pH = ${r.ph.toFixed(2)} (${r.verdict}).`,
          ``,
          `  [H+]  : ${r.h.toExponential(4)} M`,
          `  [OH-] : ${r.oh.toExponential(4)} M`,
          `  pH    : ${r.ph.toFixed(2)}`,
          `  pOH   : ${r.poh.toFixed(2)}   (pH + pOH = 14 at 25 °C)`,
          ``,
          `WHY: pH is just −log₁₀[H+]. Water self-ionises so that [H+][OH−] = 1.0e-14 always holds — push one up`,
          `and the other must come down. "Strong" means fully dissociated, which is why [H+] equals the`,
          `concentration here; it does not mean concentrated.`,
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "empirical_formula",
  {
    title: "Empirical Formula from Percent Composition",
    description:
      "The classic lab back-calculation: give each element's mass percentage and get the empirical formula, " +
      "with the mole ratios shown. Pass molar_mass too and it returns the molecular formula as well (the " +
      "whole-number multiple of the empirical one).",
    inputSchema: {
      composition: z.array(z.object({ symbol: z.string().max(4), percent: num.positive() })).min(2).max(10),
      molar_mass: num.positive().optional(),
    },
  },
  async ({ composition, molar_mass: mmGiven }) => {
    try {
      const r = empiricalFromPercent(composition);
      const emp = molarMass(r.formula);
      const lines = [
        `EMPIRICAL FORMULA — ${r.formula}`,
        `BOTTOM LINE: ${r.formula}, empirical mass ${fmt(emp.total, 5)} g/mol.`,
        ``,
        `  Element   %       ÷ atomic mass = moles     ÷ smallest = ratio`,
        ...r.moles.map(
          (m, i) =>
            `  ${m.symbol.padEnd(8)}  ${composition[i].percent.toString().padEnd(6)}  ${fmt(m.moles, 5).padEnd(22)}  ${fmt(m.ratio, 4)}`
        ),
        ``,
        `WHY: percentages are per 100 g, so each percent IS a mass in grams. Divide by atomic mass to get moles,`,
        `then divide by the smallest to get the ratio.${r.scale > 1 ? ` Ratios were then scaled by ${r.scale} to reach whole numbers — that is what turns FeO1.5 into Fe2O3.` : ""}`,
      ];
      if (mmGiven !== undefined) {
        const mult = Math.round(mmGiven / emp.total);
        const counts = parseFormula(r.formula).counts;
        const scaled = new Map([...counts].map(([k, v]) => [k, v * mult]));
        lines.push(
          ``,
          `MOLECULAR FORMULA: ${fmt(mmGiven, 5)} ÷ ${fmt(emp.total, 5)} = ${(mmGiven / emp.total).toFixed(2)} ≈ ${mult}`,
          `  → ${formatCounts(scaled)}`
        );
      }
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "reference",
  {
    title: "Polyatomic Ions and Functional Groups",
    description:
      "The two lookup tables every chemistry problem needs and nobody memorises: polyatomic ions with their " +
      "charges (nitrate, sulfate, phosphate, ammonium…), and organic functional groups with their suffixes " +
      "and what each one actually does. Pass 'which' as 'ions' or 'groups' to see just one.",
    inputSchema: { which: z.enum(["ions", "groups", "both"]).optional() },
  },
  async ({ which }) => {
    try {
      const w = which ?? "both";
      const lines: string[] = [];
      if (w === "ions" || w === "both") {
        lines.push(
          `POLYATOMIC IONS — ${POLYATOMIC_IONS.length}`,
          `BOTTOM LINE: these travel as one unit with one charge. Getting the charge right is what makes a formula come out right.`,
          ``,
          `  Name            Formula     Charge   Note`,
          ...POLYATOMIC_IONS.map(
            (i) => `  ${i.name.padEnd(14)}  ${i.formula.padEnd(10)}  ${(i.charge > 0 ? "+" : "") + i.charge}${" ".repeat(6)} ${i.note}`
          ),
          ``,
          `NAMING PATTERN: per-…-ate has one MORE oxygen than -ate; -ite has one FEWER; hypo-…-ite has two fewer.`
        );
      }
      if (w === "groups" || w === "both") {
        if (lines.length) lines.push(``, `---`, ``);
        lines.push(
          `ORGANIC FUNCTIONAL GROUPS — ${FUNCTIONAL_GROUPS.length}`,
          `BOTTOM LINE: the group is what reacts. The carbon chain it hangs off mostly just changes solubility and boiling point.`,
          ``,
          `  Group             Formula   Suffix        What it does`,
          ...FUNCTIONAL_GROUPS.map(
            (g) => `  ${g.name.padEnd(16)}  ${g.formula.padEnd(8)}  ${g.suffix.padEnd(12)}  ${g.what}`
          )
        );
      }
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "start_here",
  {
    title: "What This Asset Does",
    description: "The map: what chemistry this asset computes, where the boundary with curiosity sits, and what it will not do.",
    inputSchema: {},
  },
  async () => {
    try {
      // Self-check: prove the engine works rather than claiming it does.
      const mm = molarMass("Ca(NO3)2");
      const b = balance("C3H8 + O2 -> CO2 + H2O");
      return textResult(
        [
          `CHEMISTRY — working chemistry, not chemistry appreciation.`,
          `BOTTOM LINE: this asset COMPUTES. Molar masses, balanced equations, limiting reagents and pH are derived from the element table every time, so any number it gives can be checked by hand from the working it shows.`,
          ``,
          `LIVE SELF-CHECK (run just now, not recorded):`,
          `  molar_mass("Ca(NO3)2")            → ${fmt(mm.total, 6)} g/mol`,
          `  balance("C3H8 + O2 -> CO2 + H2O") → ${b.equation}`,
          ``,
          `TOOLS:`,
          `  periodic_table     all 118 elements — mass, group, EN, oxidation states, electron configuration`,
          `  compound           name a substance in plain words, get the real formula and the mechanism`,
          `  molar_mass         any formula, incl. nested groups and hydrates, with percent composition`,
          `  balance_equation   exact rational linear algebra, with an atom-by-atom proof`,
          `  stoichiometry      limiting reagent, theoretical yield, leftovers, percent yield`,
          `  bonding            ionic vs covalent from real electronegativity; VSEPR shape and polarity`,
          `  ph                 strong and weak acid/base, weak case solved exactly`,
          `  empirical_formula  from percent composition, plus the molecular formula`,
          `  reference          polyatomic ions and organic functional groups`,
          ``,
          `WHERE THE LINE WITH curiosity IS: curiosity owns wonder and history — "why is the periodic table shaped`,
          `like that", "how did we discover argon". This asset owns anything with a formula, a number, or a`,
          `mechanism in it. If the answer is a paragraph, that is curiosity; if it is a calculation, it is here.`,
          ``,
          `BOUNDARY: ${SYNTHESIS_BOUNDARY}`,
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
