import { CLUSTERS, resolveCluster } from "./clusters.js";

// The foundations layer: the SCIENCES and MATH the practice families rest on.
// Clusters answer "how the work is done"; this answers "why it works" — the
// physics/CS/math underneath. Kept as its OWN registry (not a cluster) because
// these are bodies of knowledge, not job ladders — no titles, no project_seed.
// Each science cross-links to the clusters it underpins and the math it leans
// on, so 'foundations <cluster>' can show what a family is built on.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export interface Science {
  label: string;
  explains: string; // plain-English what it explains
  underpins: string[]; // cluster keys this science is foundational to
  math: string[]; // MATH keys this science leans on
  vocabulary: string[]; // tokens that route a free-text question here
}

export interface MathTopic {
  label: string;
  what: string;
  vocabulary: string[];
}

export const SCIENCES: Record<string, Science> = {
  quantum_semiconductor_physics: {
    label: "Quantum & Semiconductor Physics",
    explains: "How transistors work inside computer chips — the quantum behavior of electrons in semiconductors that makes switching, and therefore all computation, possible.",
    underpins: ["hardware_silicon"],
    math: ["calculus_diffeq", "linear_algebra", "probability_statistics"],
    vocabulary: ["quantum", "semiconductor", "transistor", "electron", "bandgap", "doping", "mosfet", "tunneling", "photon", "qubit"],
  },
  electromagnetism: {
    label: "Electromagnetism",
    explains: "Electricity, voltage, current, signals, and how circuits behave — the physics of moving charge and electromagnetic fields.",
    underpins: ["hardware_silicon"],
    math: ["calculus_diffeq", "linear_algebra", "fourier_signal"],
    vocabulary: ["electromagnetism", "electromagnetic", "voltage", "current", "circuit", "magnetic", "maxwell", "capacitor", "inductor", "impedance", "antenna"],
  },
  solid_state_condensed_matter: {
    label: "Solid-State & Condensed-Matter Physics",
    explains: "The physical behavior of silicon and other electronic materials — how solids conduct, insulate, and switch.",
    underpins: ["hardware_silicon"],
    math: ["calculus_diffeq", "linear_algebra", "probability_statistics"],
    vocabulary: ["solidstate", "condensed", "crystal", "lattice", "conduction", "phonon", "superconductor", "dielectric"],
  },
  materials_science: {
    label: "Materials Science",
    explains: "Develops the materials used in chips, batteries, circuit boards, cooling systems, and displays — and how to choose them.",
    underpins: ["hardware_silicon", "cloud_infra"],
    math: ["calculus_diffeq", "numerical_analysis", "probability_statistics"],
    vocabulary: ["materials", "battery", "alloy", "polymer", "composite", "thermal", "cooling", "display", "fabrication", "nanomaterial", "corrosion"],
  },
  computer_science: {
    label: "Computer Science",
    explains: "Algorithms, computation, software, and artificial intelligence — what can be computed and how efficiently.",
    underpins: ["ai_engineering_ops", "ml_modeling_science", "systems_support", "design_frontend", "cloud_infra"],
    math: ["discrete_math_boolean", "probability_statistics", "optimization", "information_theory"],
    vocabulary: ["algorithm", "computation", "complexity", "datastructure", "compiler", "computability", "turing", "recursion", "bigo", "graphtheory"],
  },
  computational_science: {
    label: "Computational Science",
    explains: "Uses mathematics and powerful computers to simulate scientific systems — turning equations into runnable models.",
    underpins: ["ml_modeling_science", "cloud_infra"],
    math: ["numerical_analysis", "calculus_diffeq", "linear_algebra", "optimization"],
    vocabulary: ["computational", "simulation", "hpc", "supercomputer", "montecarlo", "finiteelement", "solver", "scientificcomputing"],
  },
  data_science: {
    label: "Data Science",
    explains: "Combines statistics, programming, and subject-matter knowledge to learn from data.",
    underpins: ["data_bi", "ml_modeling_science"],
    math: ["probability_statistics", "linear_algebra", "optimization"],
    vocabulary: ["datascience", "statistics", "dataset", "prediction", "feature", "correlation", "inference", "hypothesis", "sampling"],
  },
  cognitive_neuroscience: {
    label: "Cognitive Science & Neuroscience",
    explains: "How brains learn, perceive, use language, and reason — inspiration for AI systems modeled on those processes.",
    underpins: ["ml_modeling_science", "ai_engineering_ops"],
    math: ["probability_statistics", "linear_algebra", "information_theory"],
    vocabulary: ["cognitive", "neuroscience", "brain", "neuron", "perception", "cognition", "synapse", "consciousness", "psychology"],
  },
};

export const MATH: Record<string, MathTopic> = {
  calculus_diffeq: {
    label: "Calculus & Differential Equations",
    what: "Rates of change and the equations that describe how systems evolve over time.",
    vocabulary: ["calculus", "derivative", "integral", "differential", "diffeq", "ode", "pde"],
  },
  linear_algebra: {
    label: "Linear Algebra",
    what: "Vectors, matrices, and transformations — the working language of graphics, ML models, and signals.",
    vocabulary: ["linear", "algebra", "matrix", "vector", "eigenvalue", "eigenvector", "determinant"],
  },
  probability_statistics: {
    label: "Probability & Statistics",
    what: "Reasoning under uncertainty — the backbone of data science and machine learning.",
    vocabulary: ["probability", "statistics", "bayesian", "distribution", "variance", "stochastic", "estimation"],
  },
  discrete_math_boolean: {
    label: "Discrete Mathematics & Boolean Logic",
    what: "Logic, sets, graphs, and the Boolean algebra behind digital circuits and algorithms.",
    vocabulary: ["discrete", "boolean", "logic", "combinatorics", "settheory", "proof", "truthtable"],
  },
  numerical_analysis: {
    label: "Numerical Analysis",
    what: "Computing accurate answers to continuous math on finite machines — error, stability, and convergence.",
    vocabulary: ["numerical", "floatingpoint", "precision", "convergence", "interpolation", "rounding", "stability"],
  },
  optimization: {
    label: "Optimization",
    what: "Finding the best solution under constraints — training models, allocating resources, tuning designs.",
    vocabulary: ["optimization", "convex", "constraint", "minimize", "maximize", "lagrange", "linearprogramming"],
  },
  fourier_signal: {
    label: "Fourier Analysis & Signal Processing",
    what: "Decomposing signals into frequencies — core to communications, audio, imaging, and hardware signals.",
    vocabulary: ["fourier", "fft", "signal", "frequency", "spectrum", "filter", "convolution", "wavelet", "dsp"],
  },
  information_theory: {
    label: "Information Theory",
    what: "Quantifying information, compression, and channel capacity — the limits of communication and coding.",
    vocabulary: ["information", "entropy", "compression", "coding", "shannon", "channel", "mutualinformation"],
  },
};

// ---------------------------------------------------------------------------
// Resolution + routing.
// ---------------------------------------------------------------------------

type FoundationHit = { kind: "science"; key: string } | { kind: "math"; key: string };

// key + label + every vocabulary token resolves to its foundation.
const FOUNDATION_INDEX: Record<string, FoundationHit> = {};
for (const [key, s] of Object.entries(SCIENCES)) {
  FOUNDATION_INDEX[normalize(key)] = { kind: "science", key };
  FOUNDATION_INDEX[normalize(s.label)] = { kind: "science", key };
  for (const v of s.vocabulary) FOUNDATION_INDEX[normalize(v)] ??= { kind: "science", key };
}
for (const [key, m] of Object.entries(MATH)) {
  FOUNDATION_INDEX[normalize(key)] = { kind: "math", key };
  FOUNDATION_INDEX[normalize(m.label)] = { kind: "math", key };
  for (const v of m.vocabulary) FOUNDATION_INDEX[normalize(v)] ??= { kind: "math", key };
}

export function resolveFoundation(input: string): FoundationHit | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(FOUNDATION_INDEX, norm)) return FOUNDATION_INDEX[norm];
  if (norm.length < 4) return undefined; // avoid short/common-word misfires
  const hit = Object.entries(FOUNDATION_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

// Reverse index: which sciences lean on a given math key.
function sciencesUsingMath(mathKey: string): string[] {
  return Object.entries(SCIENCES).filter(([, s]) => s.math.includes(mathKey)).map(([k]) => k);
}
// Every science that underpins a cluster, and the union of math those sciences use.
function foundationsForCluster(clusterKey: string): { sciences: string[]; math: string[] } {
  const sciences = Object.entries(SCIENCES).filter(([, s]) => s.underpins.includes(clusterKey)).map(([k]) => k);
  const math = [...new Set(sciences.flatMap((k) => SCIENCES[k].math))];
  return { sciences, math };
}

const VOCAB_TO_FOUNDATION: Array<{ token: string; hit: FoundationHit }> = [
  ...Object.entries(SCIENCES).flatMap(([key, s]) => s.vocabulary.map((v) => ({ token: normalize(v), hit: { kind: "science" as const, key } }))),
  ...Object.entries(MATH).flatMap(([key, m]) => m.vocabulary.map((v) => ({ token: normalize(v), hit: { kind: "math" as const, key } }))),
];

/**
 * Loose token-overlap scorer used only as a SUPPLEMENT in ask_the_expert — it
 * points at the science/math under a question, it does not pick the expert.
 * Returns foundations with >=2 distinct vocab hits, best first.
 */
export function matchFoundations(text: string): FoundationHit[] {
  const words = new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const score = new Map<string, { hit: FoundationHit; n: number }>();
  for (const { token, hit } of VOCAB_TO_FOUNDATION) {
    if (!words.has(token)) continue;
    const id = `${hit.kind}:${hit.key}`;
    const cur = score.get(id);
    if (cur) cur.n += 1;
    else score.set(id, { hit, n: 1 });
  }
  return [...score.values()].filter((e) => e.n >= 2).sort((a, b) => b.n - a.n).map((e) => e.hit);
}

export function foundationLabel(hit: FoundationHit): string {
  return hit.kind === "science" ? SCIENCES[hit.key].label : MATH[hit.key].label;
}

// ---------------------------------------------------------------------------
// Rendering.
// ---------------------------------------------------------------------------

function renderAll(): string {
  const sci = Object.values(SCIENCES).map((s) => `  ▸ ${s.label}: ${s.explains}`);
  const math = Object.values(MATH).map((m) => `  • ${m.label}: ${m.what}`);
  return [
    `THE SCIENCE & MATH UNDERNEATH — what every practice family actually rests on.`,
    `(day_in_the_life tells you HOW the work is done; this tells you WHY it works.)`,
    ``,
    `SCIENCES:`,
    ...sci,
    ``,
    `THE MATHEMATICS SUPPORTING THEM:`,
    ...math,
    ``,
    `Ask 'foundations <topic>' for one (e.g. "electromagnetism", "linear algebra", "information theory"),`,
    `or 'foundations <cluster or job title>' to see what a practice family is built on (e.g. "hardware_silicon").`,
  ].join("\n");
}

function renderScience(key: string): string {
  const s = SCIENCES[key];
  const clusters = s.underpins.map((k) => CLUSTERS[k]?.label ?? k);
  const math = s.math.map((k) => MATH[k]?.label ?? k);
  return [
    `${s.label} — SCIENCE`,
    `BOTTOM LINE: ${s.explains}`,
    ``,
    `Underpins these practice families: ${clusters.join(", ")}`,
    `Leans on the math: ${math.join(", ")}`,
    ``,
    `LEARN / VERIFY CURRENT — have research check:`,
    `  • "${s.label.toLowerCase()} explained for engineers"`,
    `  • "${s.label.toLowerCase()} role in ${clusters[0]?.toLowerCase() ?? "modern engineering"} 2026"`,
  ].join("\n");
}

function renderMath(key: string): string {
  const m = MATH[key];
  const sciences = sciencesUsingMath(key).map((k) => SCIENCES[k].label);
  const clusters = [...new Set(sciencesUsingMath(key).flatMap((k) => SCIENCES[k].underpins))].map((k) => CLUSTERS[k]?.label ?? k);
  return [
    `${m.label} — MATHEMATICS`,
    `BOTTOM LINE: ${m.what}`,
    ``,
    sciences.length ? `Shows up in the sciences: ${sciences.join(", ")}` : `A general-purpose tool across the sciences.`,
    clusters.length ? `Which puts it under: ${clusters.join(", ")}` : ``,
    ``,
    `LEARN — have research check:`,
    `  • "${m.label.toLowerCase()} for engineers, worked examples"`,
  ].filter((l) => l !== "").join("\n");
}

function renderClusterFoundations(clusterKey: string): string {
  const c = CLUSTERS[clusterKey];
  const { sciences, math } = foundationsForCluster(clusterKey);
  if (sciences.length === 0 && math.length === 0) {
    return [
      `${c.label} — foundations`,
      `No specific hard-science foundations mapped: this is primarily a delivery/ops/communication practice, so its "foundations" are method and judgment (see day_in_the_life), not physics or math.`,
    ].join("\n");
  }
  return [
    `WHAT ${c.label.toUpperCase()} IS BUILT ON:`,
    ``,
    `Sciences:`,
    ...sciences.map((k) => `  ▸ ${SCIENCES[k].label}: ${SCIENCES[k].explains}`),
    ``,
    `Mathematics:`,
    ...math.map((k) => `  • ${MATH[k].label}: ${MATH[k].what}`),
    ``,
    `That's the "why it works" under the "how to do it" from day_in_the_life ${clusterKey}.`,
  ].join("\n");
}

/** Front door for the foundations tool. Dispatches on what `topic` resolves to. */
export function foundations(topic?: string): string {
  if (!topic || !topic.trim()) return renderAll();
  const found = resolveFoundation(topic);
  if (found) return found.kind === "science" ? renderScience(found.key) : renderMath(found.key);
  const clusterKey = resolveCluster(topic);
  if (clusterKey) return renderClusterFoundations(clusterKey);
  return [
    `Don't recognize "${clean(topic)}" as a science, a math topic, or a practice family.`,
    ``,
    `Sciences: ${Object.keys(SCIENCES).join(", ")}`,
    `Math: ${Object.keys(MATH).join(", ")}`,
    `Or pass a cluster/job title to see what it's built on.`,
  ].join("\n");
}
