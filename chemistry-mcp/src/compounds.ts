// Named substances, polyatomic ions, and organic functional groups.
//
// The lookup table exists for one reason: people ask by NAME ("what is baking
// soda", "table salt", "sulfuric acid") and every calculation downstream needs
// a FORMULA. Without this, the asset can compute anything and answer nothing,
// because the first step of a real question is always the translation.
//
// Formulas here are real and checkable — every one of them round-trips through
// parseFormula(), which the test in index.ts's start_here exercises. Where a
// substance has a common name that is chemically sloppy (nobody means the
// mineral when they say "lime"), the entry says so rather than quietly picking.

export interface Compound {
  name: string;
  formula: string;
  aka: string[];
  kind: "ionic" | "molecular" | "acid" | "base" | "organic" | "element";
  what: string;
  /** Why it behaves the way it does — the mechanism, not the trivia. */
  why: string;
  hazard?: string;
}

export const COMPOUNDS: Compound[] = [
  {
    name: "Water", formula: "H2O", aka: ["dihydrogen monoxide", "h2o"], kind: "molecular",
    what: "Bent molecule, O–H bond angle ~104.5°, the universal solvent for ionic and polar substances.",
    why: "Oxygen is far more electronegative than hydrogen (3.44 vs 2.20), so each O–H bond is polar; the bent shape means those dipoles do not cancel, leaving a net molecular dipole. That polarity plus hydrogen bonding is why water dissolves salts, has an absurdly high boiling point for its mass, and is less dense as a solid.",
  },
  {
    name: "Sodium chloride", formula: "NaCl", aka: ["table salt", "salt", "halite"], kind: "ionic",
    what: "Face-centred cubic ionic lattice; each Na+ is surrounded by six Cl-.",
    why: "Electronegativity difference is 3.16 - 0.93 = 2.23, well past the ~1.7 ionic threshold, so sodium transfers its 3s electron outright rather than sharing. The result is ions held by electrostatic attraction in every direction at once — which is why it is hard, brittle, high-melting, and conducts only when the lattice is broken by melting or dissolving.",
  },
  {
    name: "Sodium bicarbonate", formula: "NaHCO3", aka: ["baking soda", "sodium hydrogen carbonate", "bicarb"], kind: "ionic",
    what: "Weak base; decomposes on heating to Na2CO3, H2O and CO2.",
    why: "The bicarbonate ion is amphoteric — it can take a proton (acting as a base) or give one up. With an acid it takes H+, forming carbonic acid, which immediately falls apart into water and CO2 gas. That gas is the entire point in baking: 2 NaHCO3 -> Na2CO3 + H2O + CO2.",
  },
  {
    name: "Sucrose", formula: "C12H22O11", aka: ["table sugar", "sugar", "saccharose"], kind: "organic",
    what: "A disaccharide: glucose joined to fructose by a glycosidic bond.",
    why: "All those O–H groups hydrogen-bond with water, which is why it dissolves so freely. It is not a reducing sugar because the linkage ties up both anomeric carbons — the reason sucrose fails a Benedict's test while its own hydrolysis products pass it.",
  },
  {
    name: "Sulfuric acid", formula: "H2SO4", aka: ["oil of vitriol", "battery acid"], kind: "acid",
    what: "Diprotic strong acid; first ionisation essentially complete, second one weak (Ka2 ~ 1.2e-2).",
    why: "The sulfate ion spreads its negative charge over four equivalent oxygens by resonance, so losing the first proton is enormously favourable. It is also a powerful dehydrating agent — it strips H and O out of sugars as water, leaving a black carbon foam.",
    hazard: "Severe burns; the dilution direction matters — acid into water, never water into acid, because the mixing enthalpy can boil it and spit.",
  },
  {
    name: "Hydrochloric acid", formula: "HCl", aka: ["muriatic acid", "stomach acid"], kind: "acid",
    what: "Monoprotic strong acid; a gas dissolved in water.",
    why: "The H–Cl bond is polar and the chloride ion that results is large and stable, so ionisation in water is effectively complete — which is what 'strong acid' means: not concentrated, fully dissociated.",
    hazard: "Corrosive; fumes irritate the airway.",
  },
  {
    name: "Sodium hydroxide", formula: "NaOH", aka: ["lye", "caustic soda"], kind: "base",
    what: "Strong base, fully dissociated in water into Na+ and OH-.",
    why: "The hydroxide ion is the strongest base that can exist in water — anything stronger simply deprotonates water itself. Saponification (soap-making) is NaOH attacking the ester bonds in fat.",
    hazard: "Causes deep burns and is especially dangerous to eyes; dissolving it releases a lot of heat.",
  },
  {
    name: "Ammonia", formula: "NH3", aka: ["azane"], kind: "base",
    what: "Trigonal pyramidal, weak base (Kb = 1.8e-5).",
    why: "Nitrogen keeps one lone pair, which is what accepts a proton to become ammonium, NH4+. That same lone pair makes the molecule pyramidal rather than flat, and gives it a dipole — hence its high solubility in water.",
    hazard: "Never mix with bleach: the reaction produces chloramine vapours.",
  },
  {
    name: "Carbon dioxide", formula: "CO2", aka: ["dry ice", "co2"], kind: "molecular",
    what: "Linear, O=C=O, non-polar overall despite polar bonds.",
    why: "Each C=O bond is polar, but the molecule is linear and symmetric so the two dipoles cancel exactly — a textbook case of shape deciding polarity. It sublimes rather than melts at 1 atm because the triple point sits above atmospheric pressure.",
  },
  {
    name: "Methane", formula: "CH4", aka: ["natural gas", "marsh gas"], kind: "organic",
    what: "Tetrahedral, bond angle 109.5°, the simplest alkane.",
    why: "Carbon's four sp3 hybrid orbitals point at the corners of a tetrahedron, which is simply the arrangement that puts four electron pairs as far apart as possible. Combustion: CH4 + 2 O2 -> CO2 + 2 H2O.",
  },
  {
    name: "Ethanol", formula: "C2H5OH", aka: ["alcohol", "ethyl alcohol", "drinking alcohol"], kind: "organic",
    what: "Primary alcohol; hydroxyl group on a two-carbon chain.",
    why: "The -OH end hydrogen-bonds with water and the C2H5 end does not, so ethanol mixes with both water and many organics — which is exactly why it is such a common solvent and extractant.",
  },
  {
    name: "Acetic acid", formula: "CH3COOH", aka: ["vinegar", "ethanoic acid"], kind: "acid",
    what: "Weak carboxylic acid, Ka = 1.8e-5, pKa 4.76.",
    why: "It gives up the O–H proton because the resulting acetate ion delocalises the charge over two oxygens. It is weak because that stabilisation is modest — at any moment only about 1 in 100 molecules in dilute solution is ionised.",
  },
  {
    name: "Calcium carbonate", formula: "CaCO3", aka: ["limestone", "chalk", "marble", "calcite"], kind: "ionic",
    what: "The carbonate rock; decomposes near 840 °C to CaO + CO2.",
    why: "Insoluble in neutral water but dissolves in acid, because H+ pulls carbonate away as CO2 gas and the equilibrium never comes back. That single reaction carved every limestone cave and is why acid rain damages marble.",
  },
  {
    name: "Glucose", formula: "C6H12O6", aka: ["dextrose", "blood sugar"], kind: "organic",
    what: "Aldohexose; in water it mostly closes into a six-membered pyranose ring.",
    why: "Its oxidation is the energy reaction of life: C6H12O6 + 6 O2 -> 6 CO2 + 6 H2O, about -2803 kJ/mol. Photosynthesis runs the identical equation backwards using light.",
  },
  {
    name: "Ozone", formula: "O3", aka: [], kind: "molecular",
    what: "Bent triatomic oxygen, bond order 1.5 by resonance.",
    why: "It absorbs UV-B strongly because that resonance-delocalised bond is weak enough to be broken by ultraviolet photons — the absorption IS the protection.",
  },
  {
    name: "Hydrogen peroxide", formula: "H2O2", aka: ["peroxide"], kind: "molecular",
    what: "Open-book shape; decomposes to water and oxygen.",
    why: "The O–O single bond is weak (about 146 kJ/mol), so it falls apart readily: 2 H2O2 -> 2 H2O + O2. Catalase in blood and potato does this fast enough to foam visibly.",
  },
  {
    name: "Ammonium nitrate", formula: "NH4NO3", aka: [], kind: "ionic",
    what: "Highly soluble salt; dissolving it is strongly endothermic.",
    why: "The lattice energy released on hydration is less than the energy needed to break the lattice, so the solution gets cold — this is the chemistry inside an instant cold pack.",
    hazard: "A strong oxidiser. Bulk storage is regulated in most countries.",
  },
  {
    name: "Calcium hydroxide", formula: "Ca(OH)2", aka: ["slaked lime", "limewater", "pickling lime"], kind: "base",
    what: "Sparingly soluble strong base.",
    why: "Limewater turns milky with CO2 because insoluble CaCO3 precipitates — the standard school test for carbon dioxide, and a genuine reaction rather than a colour trick.",
  },
  {
    name: "Silicon dioxide", formula: "SiO2", aka: ["silica", "quartz", "sand"], kind: "molecular",
    what: "Covalent network solid, not discrete molecules.",
    why: "Every Si is bonded to four O and every O bridges two Si, so a crystal is one continuous molecule. Melting it means breaking covalent bonds rather than intermolecular forces, hence ~1700 °C.",
  },
  {
    name: "Iron(III) oxide", formula: "Fe2O3", aka: ["rust", "hematite", "iron oxide"], kind: "ionic",
    what: "The red oxide of iron; the visible product of corrosion.",
    why: "Rusting is electrochemical, not simple burning: iron oxidises at an anodic patch, oxygen is reduced at a cathodic patch, and it needs BOTH water and oxygen. The oxide is flaky rather than protective, which is why iron rusts through while aluminium does not.",
  },
  {
    name: "Aluminium oxide", formula: "Al2O3", aka: ["alumina", "corundum"], kind: "ionic",
    what: "Very hard, very high melting; sapphire and ruby are this with trace impurities.",
    why: "It forms an adherent 4 nm skin on aluminium metal within milliseconds of exposure to air, and that skin is the reason a reactive metal behaves like an inert one.",
  },
  {
    name: "Methanol", formula: "CH3OH", aka: ["wood alcohol", "methyl alcohol"], kind: "organic",
    what: "Simplest alcohol; looks and smells much like ethanol.",
    why: "The body oxidises it to formaldehyde and then formic acid, which attacks the optic nerve — the toxicity is metabolic, not the parent molecule.",
    hazard: "Toxic: blindness or death from ingestion. Not interchangeable with ethanol in any context.",
  },
  {
    name: "Potassium permanganate", formula: "KMnO4", aka: ["permanganate", "condy's crystals"], kind: "ionic",
    what: "Intense purple strong oxidiser; Mn is in the +7 oxidation state.",
    why: "Manganese at +7 has no d electrons left to lose, so it is desperate to gain them — it takes electrons from almost anything and drops to Mn2+ (colourless) or MnO2 (brown). The colour change IS the titration endpoint.",
    hazard: "Strong oxidiser; stains everything, and reacts violently with glycerol and other organics.",
  },
  {
    name: "Sodium carbonate", formula: "Na2CO3", aka: ["washing soda", "soda ash"], kind: "ionic",
    what: "Basic salt; the carbonate ion hydrolyses in water.",
    why: "Carbonate is the conjugate base of a weak acid, so it pulls protons off water and leaves excess OH-. That is why a 'salt' solution comes out at pH ~11 — the hydrolysis, not any added base.",
  },
  {
    name: "Copper(II) sulfate pentahydrate", formula: "CuSO4·5H2O", aka: ["blue vitriol", "copper sulfate"], kind: "ionic",
    what: "The blue crystalline hydrate; turns white when the water is driven off.",
    why: "The colour comes from d-d electronic transitions in the hydrated Cu2+ ion. Remove the coordinated water and the ligand field vanishes along with the colour — which is the classic reversible test for water.",
  },
  {
    name: "Nitric acid", formula: "HNO3", aka: ["aqua fortis"], kind: "acid",
    what: "Strong acid and strong oxidiser at once.",
    why: "Unusually, it dissolves metals that sit below hydrogen in the activity series — not by the usual acid route but because the nitrate ion itself oxidises the metal, giving NO or NO2 rather than H2.",
    hazard: "Corrosive and an oxidiser; stains skin yellow by reacting with protein.",
  },
];

export interface PolyatomicIon {
  name: string;
  formula: string;
  charge: number;
  note: string;
}

// The set that actually shows up in school and lab work, with the charge that
// makes formula-writing possible.
export const POLYATOMIC_IONS: PolyatomicIon[] = [
  { name: "Ammonium", formula: "NH4", charge: +1, note: "The one common polyatomic CATION — everything else here is negative." },
  { name: "Hydroxide", formula: "OH", charge: -1, note: "Defines a base in water." },
  { name: "Nitrate", formula: "NO3", charge: -1, note: "Essentially all nitrates are soluble — a useful solubility shortcut." },
  { name: "Nitrite", formula: "NO2", charge: -1, note: "-ite is one fewer oxygen than -ate." },
  { name: "Carbonate", formula: "CO3", charge: -2, note: "Fizzes with acid, releasing CO2." },
  { name: "Bicarbonate", formula: "HCO3", charge: -1, note: "Also called hydrogen carbonate; the blood buffer." },
  { name: "Sulfate", formula: "SO4", charge: -2, note: "Resonance-stabilised over four oxygens." },
  { name: "Sulfite", formula: "SO3", charge: -2, note: "A reducing agent; used as a preservative." },
  { name: "Phosphate", formula: "PO4", charge: -3, note: "The backbone linkage of DNA and the P in ATP." },
  { name: "Acetate", formula: "C2H3O2", charge: -1, note: "Conjugate base of acetic acid; also written CH3COO-." },
  { name: "Hypochlorite", formula: "ClO", charge: -1, note: "The active species in household bleach." },
  { name: "Chlorate", formula: "ClO3", charge: -1, note: "Strong oxidiser." },
  { name: "Perchlorate", formula: "ClO4", charge: -1, note: "per- = one MORE oxygen than -ate." },
  { name: "Chromate", formula: "CrO4", charge: -2, note: "Yellow; flips to orange dichromate in acid." },
  { name: "Dichromate", formula: "Cr2O7", charge: -2, note: "Orange; a strong oxidiser in acid." },
  { name: "Permanganate", formula: "MnO4", charge: -1, note: "Deep purple; oxidises almost anything organic." },
  { name: "Cyanide", formula: "CN", charge: -1, note: "Binds iron in cytochrome oxidase — the basis of its toxicity." },
  { name: "Peroxide", formula: "O2", charge: -2, note: "Oxygen at the unusual -1 oxidation state." },
];

export interface FunctionalGroup {
  name: string;
  formula: string;
  suffix: string;
  what: string;
}

export const FUNCTIONAL_GROUPS: FunctionalGroup[] = [
  { name: "Alkane", formula: "C–C", suffix: "-ane", what: "Only single bonds. Unreactive apart from combustion and radical halogenation." },
  { name: "Alkene", formula: "C=C", suffix: "-ene", what: "Double bond; the pi electrons make it a nucleophile, so it undergoes addition." },
  { name: "Alkyne", formula: "C≡C", suffix: "-yne", what: "Triple bond; linear at the carbons, and mildly acidic when terminal." },
  { name: "Alcohol", formula: "-OH", suffix: "-ol", what: "Hydrogen bonds, so boiling points jump sharply above the parent alkane." },
  { name: "Aldehyde", formula: "-CHO", suffix: "-al", what: "Carbonyl at the END of a chain. Oxidises easily to a carboxylic acid." },
  { name: "Ketone", formula: "C=O", suffix: "-one", what: "Carbonyl in the MIDDLE. Resists further oxidation — which is how it is told apart from an aldehyde." },
  { name: "Carboxylic acid", formula: "-COOH", suffix: "-oic acid", what: "Genuinely acidic; the conjugate base is resonance-stabilised." },
  { name: "Ester", formula: "-COO-", suffix: "-oate", what: "Acid + alcohol, minus water. Responsible for most fruit smells." },
  { name: "Amine", formula: "-NH2", suffix: "-amine", what: "Basic — nitrogen's lone pair accepts a proton." },
  { name: "Amide", formula: "-CONH2", suffix: "-amide", what: "NOT basic, unlike amines: the lone pair is tied up with the carbonyl. This is the peptide bond." },
  { name: "Ether", formula: "C-O-C", suffix: "ether", what: "Oxygen between two carbons. Low reactivity; a common solvent." },
  { name: "Haloalkane", formula: "-X", suffix: "halo-", what: "C bonded to F/Cl/Br/I. The polar C–X bond invites substitution." },
];

const norm = (s: string) => s.toLowerCase().trim().replace(/[\s\-_]+/g, "");

export function resolveCompound(query: string): Compound | undefined {
  const q = norm(query);
  if (!q) return undefined;
  const exact = COMPOUNDS.find(
    (c) => norm(c.name) === q || norm(c.formula) === q || c.aka.some((a) => norm(a) === q)
  );
  if (exact) return exact;
  return COMPOUNDS.find(
    (c) => norm(c.name).includes(q) || c.aka.some((a) => norm(a).includes(q)) || q.includes(norm(c.name))
  );
}
