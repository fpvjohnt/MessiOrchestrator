// The periodic table as DATA, not prose.
//
// This is the difference between this asset and curiosity's chemistry_materials
// domain. curiosity answers "why is the periodic table shaped like that" with a
// good paragraph. Nothing in this system could tell you the molar mass of
// Ca(NO3)2, and every question about a real formula therefore fell through to a
// web search. Numbers you can compute with have to live somewhere.
//
// VALUES ARE REAL. Atomic masses are IUPAC standard atomic weights (the
// conventional single value, 4-5 significant figures); for elements with no
// stable isotope the mass number of the longest-lived isotope is used and is
// flagged `synthetic` so a calculation built on it can say so. Electronegativity
// is the Pauling scale; He, Ne and Ar have no accepted Pauling value and carry
// null rather than a convenient zero — a missing measurement must not silently
// become a number that arithmetic will happily consume.

export interface Element {
  z: number;
  symbol: string;
  name: string;
  mass: number;
  group: number; // 1-18; 0 marks the f-block (lanthanides/actinides)
  period: number;
  category: string;
  electronegativity: number | null;
  oxidation: string;
  config: string;
  synthetic: boolean; // mass is a longest-lived isotope, not a stable-isotope average
}

// z|symbol|name|mass|group|period|category|EN|oxidation|config|synthetic
const TABLE = `
1|H|Hydrogen|1.008|1|1|reactive nonmetal|2.20|+1,-1|1s1|0
2|He|Helium|4.0026|18|1|noble gas||0|1s2|0
3|Li|Lithium|6.94|1|2|alkali metal|0.98|+1|[He] 2s1|0
4|Be|Beryllium|9.0122|2|2|alkaline earth metal|1.57|+2|[He] 2s2|0
5|B|Boron|10.81|13|2|metalloid|2.04|+3|[He] 2s2 2p1|0
6|C|Carbon|12.011|14|2|reactive nonmetal|2.55|+4,+2,-4|[He] 2s2 2p2|0
7|N|Nitrogen|14.007|15|2|reactive nonmetal|3.04|-3,+3,+5|[He] 2s2 2p3|0
8|O|Oxygen|15.999|16|2|reactive nonmetal|3.44|-2|[He] 2s2 2p4|0
9|F|Fluorine|18.998|17|2|halogen|3.98|-1|[He] 2s2 2p5|0
10|Ne|Neon|20.180|18|2|noble gas||0|[He] 2s2 2p6|0
11|Na|Sodium|22.990|1|3|alkali metal|0.93|+1|[Ne] 3s1|0
12|Mg|Magnesium|24.305|2|3|alkaline earth metal|1.31|+2|[Ne] 3s2|0
13|Al|Aluminium|26.982|13|3|post-transition metal|1.61|+3|[Ne] 3s2 3p1|0
14|Si|Silicon|28.085|14|3|metalloid|1.90|+4,-4|[Ne] 3s2 3p2|0
15|P|Phosphorus|30.974|15|3|reactive nonmetal|2.19|+5,+3,-3|[Ne] 3s2 3p3|0
16|S|Sulfur|32.06|16|3|reactive nonmetal|2.58|-2,+4,+6|[Ne] 3s2 3p4|0
17|Cl|Chlorine|35.45|17|3|halogen|3.16|-1,+1,+5,+7|[Ne] 3s2 3p5|0
18|Ar|Argon|39.95|18|3|noble gas||0|[Ne] 3s2 3p6|0
19|K|Potassium|39.098|1|4|alkali metal|0.82|+1|[Ar] 4s1|0
20|Ca|Calcium|40.078|2|4|alkaline earth metal|1.00|+2|[Ar] 4s2|0
21|Sc|Scandium|44.956|3|4|transition metal|1.36|+3|[Ar] 3d1 4s2|0
22|Ti|Titanium|47.867|4|4|transition metal|1.54|+4,+3|[Ar] 3d2 4s2|0
23|V|Vanadium|50.942|5|4|transition metal|1.63|+5,+4,+3,+2|[Ar] 3d3 4s2|0
24|Cr|Chromium|51.996|6|4|transition metal|1.66|+6,+3,+2|[Ar] 3d5 4s1|0
25|Mn|Manganese|54.938|7|4|transition metal|1.55|+7,+4,+2|[Ar] 3d5 4s2|0
26|Fe|Iron|55.845|8|4|transition metal|1.83|+3,+2|[Ar] 3d6 4s2|0
27|Co|Cobalt|58.933|9|4|transition metal|1.88|+3,+2|[Ar] 3d7 4s2|0
28|Ni|Nickel|58.693|10|4|transition metal|1.91|+2,+3|[Ar] 3d8 4s2|0
29|Cu|Copper|63.546|11|4|transition metal|1.90|+2,+1|[Ar] 3d10 4s1|0
30|Zn|Zinc|65.38|12|4|transition metal|1.65|+2|[Ar] 3d10 4s2|0
31|Ga|Gallium|69.723|13|4|post-transition metal|1.81|+3|[Ar] 3d10 4s2 4p1|0
32|Ge|Germanium|72.630|14|4|metalloid|2.01|+4,+2|[Ar] 3d10 4s2 4p2|0
33|As|Arsenic|74.922|15|4|metalloid|2.18|+5,+3,-3|[Ar] 3d10 4s2 4p3|0
34|Se|Selenium|78.971|16|4|reactive nonmetal|2.55|-2,+4,+6|[Ar] 3d10 4s2 4p4|0
35|Br|Bromine|79.904|17|4|halogen|2.96|-1,+1,+5|[Ar] 3d10 4s2 4p5|0
36|Kr|Krypton|83.798|18|4|noble gas|3.00|0,+2|[Ar] 3d10 4s2 4p6|0
37|Rb|Rubidium|85.468|1|5|alkali metal|0.82|+1|[Kr] 5s1|0
38|Sr|Strontium|87.62|2|5|alkaline earth metal|0.95|+2|[Kr] 5s2|0
39|Y|Yttrium|88.906|3|5|transition metal|1.22|+3|[Kr] 4d1 5s2|0
40|Zr|Zirconium|91.224|4|5|transition metal|1.33|+4|[Kr] 4d2 5s2|0
41|Nb|Niobium|92.906|5|5|transition metal|1.60|+5,+3|[Kr] 4d4 5s1|0
42|Mo|Molybdenum|95.95|6|5|transition metal|2.16|+6,+4|[Kr] 4d5 5s1|0
43|Tc|Technetium|98|7|5|transition metal|1.90|+7,+4|[Kr] 4d5 5s2|1
44|Ru|Ruthenium|101.07|8|5|transition metal|2.20|+4,+3|[Kr] 4d7 5s1|0
45|Rh|Rhodium|102.91|9|5|transition metal|2.28|+3|[Kr] 4d8 5s1|0
46|Pd|Palladium|106.42|10|5|transition metal|2.20|+2,+4|[Kr] 4d10|0
47|Ag|Silver|107.87|11|5|transition metal|1.93|+1|[Kr] 4d10 5s1|0
48|Cd|Cadmium|112.41|12|5|transition metal|1.69|+2|[Kr] 4d10 5s2|0
49|In|Indium|114.82|13|5|post-transition metal|1.78|+3|[Kr] 4d10 5s2 5p1|0
50|Sn|Tin|118.71|14|5|post-transition metal|1.96|+4,+2|[Kr] 4d10 5s2 5p2|0
51|Sb|Antimony|121.76|15|5|metalloid|2.05|+5,+3,-3|[Kr] 4d10 5s2 5p3|0
52|Te|Tellurium|127.60|16|5|metalloid|2.10|-2,+4,+6|[Kr] 4d10 5s2 5p4|0
53|I|Iodine|126.90|17|5|halogen|2.66|-1,+1,+5,+7|[Kr] 4d10 5s2 5p5|0
54|Xe|Xenon|131.29|18|5|noble gas|2.60|0,+2,+4,+6|[Kr] 4d10 5s2 5p6|0
55|Cs|Caesium|132.91|1|6|alkali metal|0.79|+1|[Xe] 6s1|0
56|Ba|Barium|137.33|2|6|alkaline earth metal|0.89|+2|[Xe] 6s2|0
57|La|Lanthanum|138.91|0|6|lanthanide|1.10|+3|[Xe] 5d1 6s2|0
58|Ce|Cerium|140.12|0|6|lanthanide|1.12|+3,+4|[Xe] 4f1 5d1 6s2|0
59|Pr|Praseodymium|140.91|0|6|lanthanide|1.13|+3|[Xe] 4f3 6s2|0
60|Nd|Neodymium|144.24|0|6|lanthanide|1.14|+3|[Xe] 4f4 6s2|0
61|Pm|Promethium|145|0|6|lanthanide|1.13|+3|[Xe] 4f5 6s2|1
62|Sm|Samarium|150.36|0|6|lanthanide|1.17|+3,+2|[Xe] 4f6 6s2|0
63|Eu|Europium|151.96|0|6|lanthanide|1.20|+3,+2|[Xe] 4f7 6s2|0
64|Gd|Gadolinium|157.25|0|6|lanthanide|1.20|+3|[Xe] 4f7 5d1 6s2|0
65|Tb|Terbium|158.93|0|6|lanthanide|1.20|+3|[Xe] 4f9 6s2|0
66|Dy|Dysprosium|162.50|0|6|lanthanide|1.22|+3|[Xe] 4f10 6s2|0
67|Ho|Holmium|164.93|0|6|lanthanide|1.23|+3|[Xe] 4f11 6s2|0
68|Er|Erbium|167.26|0|6|lanthanide|1.24|+3|[Xe] 4f12 6s2|0
69|Tm|Thulium|168.93|0|6|lanthanide|1.25|+3|[Xe] 4f13 6s2|0
70|Yb|Ytterbium|173.05|0|6|lanthanide|1.10|+3,+2|[Xe] 4f14 6s2|0
71|Lu|Lutetium|174.97|3|6|lanthanide|1.27|+3|[Xe] 4f14 5d1 6s2|0
72|Hf|Hafnium|178.49|4|6|transition metal|1.30|+4|[Xe] 4f14 5d2 6s2|0
73|Ta|Tantalum|180.95|5|6|transition metal|1.50|+5|[Xe] 4f14 5d3 6s2|0
74|W|Tungsten|183.84|6|6|transition metal|2.36|+6,+4|[Xe] 4f14 5d4 6s2|0
75|Re|Rhenium|186.21|7|6|transition metal|1.90|+7,+4|[Xe] 4f14 5d5 6s2|0
76|Os|Osmium|190.23|8|6|transition metal|2.20|+4,+8|[Xe] 4f14 5d6 6s2|0
77|Ir|Iridium|192.22|9|6|transition metal|2.20|+4,+3|[Xe] 4f14 5d7 6s2|0
78|Pt|Platinum|195.08|10|6|transition metal|2.28|+4,+2|[Xe] 4f14 5d9 6s1|0
79|Au|Gold|196.97|11|6|transition metal|2.54|+3,+1|[Xe] 4f14 5d10 6s1|0
80|Hg|Mercury|200.59|12|6|transition metal|2.00|+2,+1|[Xe] 4f14 5d10 6s2|0
81|Tl|Thallium|204.38|13|6|post-transition metal|1.62|+1,+3|[Xe] 4f14 5d10 6s2 6p1|0
82|Pb|Lead|207.2|14|6|post-transition metal|2.33|+2,+4|[Xe] 4f14 5d10 6s2 6p2|0
83|Bi|Bismuth|208.98|15|6|post-transition metal|2.02|+3,+5|[Xe] 4f14 5d10 6s2 6p3|0
84|Po|Polonium|209|16|6|metalloid|2.00|+4,+2|[Xe] 4f14 5d10 6s2 6p4|1
85|At|Astatine|210|17|6|halogen|2.20|-1,+1|[Xe] 4f14 5d10 6s2 6p5|1
86|Rn|Radon|222|18|6|noble gas|2.20|0,+2|[Xe] 4f14 5d10 6s2 6p6|1
87|Fr|Francium|223|1|7|alkali metal|0.70|+1|[Rn] 7s1|1
88|Ra|Radium|226|2|7|alkaline earth metal|0.90|+2|[Rn] 7s2|1
89|Ac|Actinium|227|0|7|actinide|1.10|+3|[Rn] 6d1 7s2|1
90|Th|Thorium|232.04|0|7|actinide|1.30|+4|[Rn] 6d2 7s2|0
91|Pa|Protactinium|231.04|0|7|actinide|1.50|+5,+4|[Rn] 5f2 6d1 7s2|0
92|U|Uranium|238.03|0|7|actinide|1.38|+6,+4|[Rn] 5f3 6d1 7s2|0
93|Np|Neptunium|237|0|7|actinide|1.36|+5,+4|[Rn] 5f4 6d1 7s2|1
94|Pu|Plutonium|244|0|7|actinide|1.28|+4,+6|[Rn] 5f6 7s2|1
95|Am|Americium|243|0|7|actinide|1.13|+3|[Rn] 5f7 7s2|1
96|Cm|Curium|247|0|7|actinide|1.28|+3|[Rn] 5f7 6d1 7s2|1
97|Bk|Berkelium|247|0|7|actinide|1.30|+3|[Rn] 5f9 7s2|1
98|Cf|Californium|251|0|7|actinide|1.30|+3|[Rn] 5f10 7s2|1
99|Es|Einsteinium|252|0|7|actinide|1.30|+3|[Rn] 5f11 7s2|1
100|Fm|Fermium|257|0|7|actinide|1.30|+3|[Rn] 5f12 7s2|1
101|Md|Mendelevium|258|0|7|actinide|1.30|+3|[Rn] 5f13 7s2|1
102|No|Nobelium|259|0|7|actinide|1.30|+2,+3|[Rn] 5f14 7s2|1
103|Lr|Lawrencium|266|3|7|actinide|1.30|+3|[Rn] 5f14 7s2 7p1|1
104|Rf|Rutherfordium|267|4|7|transition metal||+4|[Rn] 5f14 6d2 7s2|1
105|Db|Dubnium|268|5|7|transition metal||+5|[Rn] 5f14 6d3 7s2|1
106|Sg|Seaborgium|269|6|7|transition metal||+6|[Rn] 5f14 6d4 7s2|1
107|Bh|Bohrium|270|7|7|transition metal||+7|[Rn] 5f14 6d5 7s2|1
108|Hs|Hassium|269|8|7|transition metal||+8|[Rn] 5f14 6d6 7s2|1
109|Mt|Meitnerium|278|9|7|unknown||unknown|[Rn] 5f14 6d7 7s2|1
110|Ds|Darmstadtium|281|10|7|unknown||unknown|[Rn] 5f14 6d8 7s2|1
111|Rg|Roentgenium|282|11|7|unknown||unknown|[Rn] 5f14 6d9 7s2|1
112|Cn|Copernicium|285|12|7|unknown||+2|[Rn] 5f14 6d10 7s2|1
113|Nh|Nihonium|286|13|7|unknown||unknown|[Rn] 5f14 6d10 7s2 7p1|1
114|Fl|Flerovium|289|14|7|unknown||unknown|[Rn] 5f14 6d10 7s2 7p2|1
115|Mc|Moscovium|290|15|7|unknown||unknown|[Rn] 5f14 6d10 7s2 7p3|1
116|Lv|Livermorium|293|16|7|unknown||unknown|[Rn] 5f14 6d10 7s2 7p4|1
117|Ts|Tennessine|294|17|7|halogen||unknown|[Rn] 5f14 6d10 7s2 7p5|1
118|Og|Oganesson|294|18|7|noble gas||unknown|[Rn] 5f14 6d10 7s2 7p6|1
`.trim();

export const ELEMENTS: Element[] = TABLE.split("\n").map((line) => {
  const [z, symbol, name, mass, group, period, category, en, oxidation, config, synthetic] = line.split("|");
  return {
    z: Number(z),
    symbol,
    name,
    mass: Number(mass),
    group: Number(group),
    period: Number(period),
    category,
    electronegativity: en === "" ? null : Number(en),
    oxidation,
    config,
    synthetic: synthetic === "1",
  };
});

export const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));
const BY_NAME = new Map(ELEMENTS.map((e) => [e.name.toLowerCase(), e]));
const BY_Z = new Map(ELEMENTS.map((e) => [e.z, e]));

// Spellings that are correct but not the IUPAC form used in the table above.
// Americans do not type "Aluminium" or "Caesium" and should not have to.
const ALIASES: Record<string, string> = {
  aluminum: "Aluminium",
  cesium: "Caesium",
  sulphur: "Sulfur",
  wolfram: "Tungsten",
  natrium: "Sodium",
  kalium: "Potassium",
  ferrum: "Iron",
  plumbum: "Lead",
  stannum: "Tin",
  aurum: "Gold",
  argentum: "Silver",
  cuprum: "Copper",
  hydrargyrum: "Mercury",
  stibium: "Antimony",
};

/** Resolve "Fe", "iron", "26", or "aluminum" to one element. */
export function resolveElement(query: string): Element | undefined {
  const raw = query.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const aliased = ALIASES[lower];
  if (aliased) return BY_NAME.get(aliased.toLowerCase());
  // Symbol match is case-corrected, so "fe" and "FE" both find Fe — but only
  // after the name map, so "no" resolves to Nobelium rather than nothing while
  // a real word like "in" still reaches Indium only when nothing else claims it.
  const byName = BY_NAME.get(lower);
  if (byName) return byName;
  if (/^\d+$/.test(raw)) return BY_Z.get(Number(raw));
  const cased = raw[0].toUpperCase() + raw.slice(1).toLowerCase();
  return BY_SYMBOL.get(cased);
}

/** Pauling electronegativity difference, or null when either value is unmeasured. */
export function enDifference(a: Element, b: Element): number | null {
  if (a.electronegativity === null || b.electronegativity === null) return null;
  return Math.abs(a.electronegativity - b.electronegativity);
}
