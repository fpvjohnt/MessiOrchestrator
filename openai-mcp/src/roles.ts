// How real professions actually use ChatGPT and Codex — the "expert in every
// position" lens, pointed at these two tools specifically. Same reverse-index
// shape as polymath's clusters.ts and loop's patterns.ts, so "ask by any name"
// works and the regression harness auto-covers every role added here.
//
// THE SCOPE LINE THAT KEEPS THIS HONEST: this file covers HOW A ROLE USES THE
// TOOL. It does NOT give that role's domain advice. "How does a lawyer use
// ChatGPT" is ours. "Is this contract enforceable" is lawguide's. Every role
// carries a `handoff` naming the asset that owns the actual domain question,
// because an OpenAI expert dispensing legal or medical conclusions is exactly
// the failure this collection is built to avoid.
//
// The `trap` field is the point of this file. Anyone can list use cases; the
// value is knowing the specific way this tool burns THIS role. Traps here are
// stable, well-documented failure CATEGORIES — not case cites, statute
// numbers, or dates, which route through research/lawguide instead.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface Role {
  label: string;
  keys: string[];
  uses: string[];
  surface: string;
  leverage: string;
  trap: string;
  verify: string;
  handoff: string;
}

export const ROLES: Record<string, Role> = {
  software_engineer: {
    label: "Software Engineer / Developer",
    keys: ["softwareengineer", "developer", "dev", "programmer", "coder", "swe", "engineer", "backend", "fullstack", "devops"],
    uses: [
      "Scoped changes and bug fixes with a reproduction recipe — the highest-yield Codex workflow, because a failing test is an unambiguous 'done when'.",
      "Understanding an inherited codebase: 'explain how a request flows through these files, and name two gotchas before I change it'.",
      "Batch maintenance — renaming patterns, updating deprecated calls, standardizing error handling across many files.",
      "Local code review (/review) before a PR, and @codex review on the PR itself.",
      "Prototyping UI from a screenshot, then iterating in small, specific prompts.",
    ],
    surface: "Codex — IDE extension for local exploration (it auto-includes your open files), CLI for a tight repro→fix→verify loop, cloud to delegate a long refactor in parallel. The API only if you're building a product, not doing repo work.",
    leverage: "AGENTS.md. Every convention you'd otherwise retype belongs there — build/test/lint commands, patterns, do-not rules, what DONE means. Then give each task a Goal / Context / Constraints / Done-when.",
    trap: "Plausible-but-wrong code that reads beautifully and passes a shallow glance. Two specific forms: it invents package names that don't exist (install one and you've imported an attacker's squat), and it 'fixes' a symptom while leaving the root cause. Review the DIFF, not the explanation — the explanation is always convincing.",
    verify: "Make it re-run the repro after the fix and report the actual commands and results. 'It should work now' is not verification. If there's no test, the fix is a hypothesis.",
    handoff: "Vendor-neutral agent architecture (ReAct, evals, RAG) → 'loop'. Broader engineering practice across ~70 specialties → 'polymath'.",
  },

  data_analyst: {
    label: "Data / Systems Analyst & BI",
    keys: ["dataanalyst", "analyst", "systemsanalyst", "bi", "businessintelligence", "sql", "tableau", "looker", "dbt", "reporting", "dashboard", "datascientist"],
    uses: [
      "Drafting SQL against a schema you paste in, then explaining what a gnarly inherited query actually does.",
      "Translating a vague stakeholder ask ('why did tickets spike?') into a concrete, answerable question before writing any query.",
      "Documenting models, writing dbt tests, and generating the narrative layer around numbers you already trust.",
      "Codex for the repo side: transformations, pipeline code, dashboard config.",
    ],
    surface: "Chat for one-off SQL and explanation. Work when it needs multiple sources and produces a real deliverable. Codex when the work lives in your dbt/analytics repo.",
    leverage: "Give it the SCHEMA and the grain, not just the question. Most bad SQL is the model guessing at columns and join cardinality. Paste DDL, state the grain, name the filters that always apply.",
    trap: "SQL that runs clean and answers the WRONG question. This is worse than a syntax error, because a syntax error announces itself and a wrong join silently ships to a dashboard someone makes decisions on. It will also invent column names that sound exactly like yours. The number being confidently wrong IS the failure mode.",
    verify: "Check the row count and the grain against something you already know is true. Reconcile one number by hand. If it disagrees with a trusted report, the model is wrong until proven otherwise — never the other way round.",
    handoff: "The data question itself, dashboards, warehouse design → 'polymath' (Data & BI family).",
  },

  researcher: {
    label: "Researcher / Scientist / Academic",
    keys: ["researcher", "scientist", "academic", "phd", "postdoc", "scholar", "literature", "publication"],
    uses: [
      "Literature triage — summarizing what a paper claims, then what it actually SHOWS, and where the two diverge.",
      "Steelmanning your own hypothesis, then arguing against it. The second half is the valuable half.",
      "Drafting methods sections, cleaning analysis code, and explaining an unfamiliar statistical technique.",
      "Turning a fuzzy research question into a falsifiable one with a stated null.",
    ],
    surface: "Work for anything multi-source with a real deliverable (it can attach sources and produce files). Chat for thinking out loud. Codex for the analysis code itself.",
    leverage: "Force it to separate CLAIM from EVIDENCE, and demand it flag what it could not verify. 'Use only the supplied sources; flag missing information instead of guessing' is a boundary that changes the output completely.",
    trap: "Fabricated citations — plausible authors, plausible journal, plausible year, and the paper does not exist. This has embarrassed real academics in real submissions. Second trap: sycophantic agreement. It will find support for whatever you propose, which feels like validation and is actually just autocomplete agreeing with you.",
    verify: "Open every citation. Not 'check that it looks real' — actually resolve the DOI. A citation you didn't open is a citation you're gambling on.",
    handoff: "The science itself, evidence tiers, pseudoscience → 'curiosity'. Multi-source corroborated fact-finding → 'research'.",
  },

  it_ops: {
    label: "IT / SysAdmin / Support",
    keys: ["it", "itops", "sysadmin", "helpdesk", "support", "infrastructure", "networking", "servicedesk", "administrator", "ops", "sre"],
    uses: [
      "Explaining a cryptic error, log dump, or stack trace in plain words, and naming what to check first.",
      "Drafting PowerShell/bash for a repetitive admin task — with Codex now notably stronger on PowerShell and Windows.",
      "Writing runbooks and post-incident notes from rough timeline notes.",
      "Turning a vague ticket ('it's slow') into a diagnostic sequence.",
    ],
    surface: "Chat for triage and explanation. Codex CLI when the work is scripts in a repo — and note Codex runs local commands in a sandbox with an approval policy, which is exactly the guardrail this role needs.",
    leverage: "Give it the real error text, the versions, and what you already ruled out. Most bad IT answers come from the model guessing at an environment you never described.",
    trap: "A confidently destructive command. It will hand you a recursive delete, a firewall rule, or a registry change that reads as authoritative and is scoped wrong for YOUR box. It has no idea what's in production. Never paste a command you can't read line by line into a prod system — and never paste credentials, tokens, or a config full of secrets into the composer.",
    verify: "Dry-run it. Read every flag. Test on something you can lose. If the command is irreversible and you don't fully understand it, that's a stop, not a speed bump.",
    handoff: "Deeper infra, security, incident response → 'polymath' (Cloud & Infrastructure / Security families).",
  },

  legal: {
    label: "Legal — Lawyer / Paralegal / Compliance",
    keys: ["legal", "lawyer", "attorney", "paralegal", "compliance", "counsel", "law", "contract", "litigation", "lawfirm"],
    uses: [
      "First-pass summarization of a long document — what it says, what's unusual, what's missing.",
      "Drafting and redlining routine agreements from a template and a playbook you supply.",
      "Turning legalese into plain language for a client, and plain language into a structured issues list.",
      "Organizing discovery notes and building timelines from documents you provide.",
    ],
    surface: "Work — it handles multiple source documents and produces reviewable files. Boundaries matter more here than anywhere: 'use only the supplied sources', 'prepare as a draft, don't send'.",
    leverage: "Supply the authority; don't ask it to recall the authority. Paste the statute, the contract, the playbook. The model is a strong reader and an unreliable librarian.",
    trap: "FABRICATED CITATIONS. It invents cases with real-sounding names and reporter numbers, and lawyers have been sanctioned for filing them. This is the single most documented professional failure of this technology. Second trap: confidentiality — pasting privileged client material into a consumer account is a real problem, and 'store: false' / enterprise terms are not the same thing as your ethical duty.",
    verify: "Shepardize/KeyCite every single citation. Every one. A citation the model produced and you didn't independently pull does not exist as far as your filing is concerned.",
    handoff: "The actual legal question, rights, which-arena, finding a lawyer → 'lawguide' (which is information, not advice, and routes serious matters to a licensed attorney). This asset covers only how the TOOL is used.",
  },

  real_estate: {
    label: "Real Estate — Agent / Broker / Investor",
    keys: ["realestate", "realtor", "agent", "broker", "property", "listing", "mortgage", "escrow", "landlord", "propertymanager"],
    uses: [
      "Drafting listing copy, then rewriting it for different channels and audiences.",
      "Explaining a contract, disclosure, or inspection report to a client in plain words.",
      "Client comms — follow-ups, updates, objection handling, neighborhood explainers.",
      "Organizing a transaction timeline and a checklist of who owes what by when.",
    ],
    surface: "Chat for copy and client comms. Work when it's pulling from multiple documents into a real deliverable.",
    leverage: "Give it your voice and your constraints. 'Keep the approved dates and figures unchanged' and 'prepare as a draft, don't send' are the two boundaries that prevent most real damage in this role.",
    trap: "FAIR HOUSING. Ask for listing copy and it will cheerfully produce 'perfect for a young family', 'safe neighborhood', 'walking distance to churches' — language that describes the BUYER rather than the PROPERTY and can be a discrimination problem. The model has no idea it just created legal exposure. Second trap: invented comps, prices, and market stats. It does not know your market; it knows what market copy sounds like.",
    verify: "Read every listing line against protected classes — describe the property, never the ideal occupant. Pull every number from the MLS or your actual source; never from the model.",
    handoff: "The actual buying/mortgage/California market question → 'homebuyer'. Contract enforceability and legal exposure → 'lawguide'.",
  },

  healthcare: {
    label: "Healthcare — Clinician / Admin",
    keys: ["healthcare", "medical", "clinician", "doctor", "nurse", "physician", "health", "patient", "clinic", "hospital"],
    uses: [
      "Drafting patient-facing explanations at a readable level from material you supply.",
      "Administrative load — prior-auth letters, scheduling logic, documentation cleanup.",
      "Explaining a paper or guideline you paste in.",
      "Turning rough notes into structured summaries for your own review.",
    ],
    surface: "Chat for drafting and explanation. Nothing patient-identifying goes into a consumer account, full stop.",
    leverage: "Supply the guideline and ask it to apply it — never ask it to recall one. Clinical specifics from model memory are exactly the wrong use of this tool.",
    trap: "PHI. Pasting patient-identifying material into a consumer ChatGPT account is a HIPAA problem regardless of how careful the prompt is — de-identify or don't paste. Second trap: confident clinical specifics (doses, interactions, contraindications) that are subtly wrong in ways only a clinician would catch, and are dangerous precisely because they read fluently.",
    verify: "Every clinical fact against the primary source. Never a model-recalled dose or interaction. Treat output as a draft for a qualified human, never a decision.",
    handoff: "Health information and navigation → 'healthguide' (information only — never diagnosis or treatment, with a crisis override).",
  },

  finance_accounting: {
    label: "Finance & Accounting",
    keys: ["finance", "accounting", "accountant", "cpa", "audit", "bookkeeping", "controller", "fpa", "tax", "sox"],
    uses: [
      "Explaining a standard, a filing, or a policy you paste in.",
      "Drafting variance narratives and reconciliation write-ups from numbers you supply.",
      "Building and checking spreadsheet logic, and documenting a close process.",
      "Turning a messy schedule into a structured summary for review.",
    ],
    surface: "Work for multi-source deliverables and files. Chat for explanation and drafting.",
    leverage: "It's a language engine, not a calculator. Give it the numbers; make it show the arithmetic separately so it's auditable. Better: have it write the FORMULA and compute in the spreadsheet.",
    trap: "Arithmetic and figures that are confidently wrong, presented with the same fluency as correct ones. Also an audit-trail problem: 'the AI produced it' is not a workpaper. If you can't reconstruct how a number was derived, it can't go in the file.",
    verify: "Tie every number to a source. Recompute independently. The model's math is a draft; your reconciliation is the fact.",
    handoff: "Investing, retirement vehicles, tax rules, fees → 'nestegg'.",
  },

  educator: {
    label: "Teacher / Professor / Trainer",
    keys: ["educator", "teacher", "professor", "instructor", "trainer", "school", "curriculum", "lesson", "grading", "classroom"],
    uses: [
      "Building lesson plans, worked examples, and differentiated versions of the same material.",
      "Generating practice problems at graded difficulty, plus the worked solutions.",
      "Rubrics and feedback drafts you then edit.",
      "Explaining a concept five different ways until one lands for a specific student.",
    ],
    surface: "Chat for most of it. Projects when a course's materials and sources should travel together.",
    leverage: "Specify the level, the misconception you're targeting, and the format. 'Explain compound interest to someone who has never invested, one concrete example, define every term' beats 'explain compound interest'.",
    trap: "AI-detection tools are unreliable in both directions and have falsely accused real students, disproportionately non-native speakers. Do not treat a detector score as evidence. Second trap: student data — grades and identifiable work in a consumer account is a FERPA problem.",
    verify: "Work every generated problem yourself before it reaches a student. Wrong answer keys are worse than no answer keys.",
    handoff: "Course ladders, graduation/admissions requirements, study science → 'education'.",
  },

  marketing_sales: {
    label: "Marketing & Sales",
    keys: ["marketing", "sales", "copywriting", "content", "seo", "campaign", "outreach", "crm", "growth", "brand"],
    uses: [
      "Drafting and versioning copy across channels, then tightening it.",
      "Turning one asset into many — a post into a thread, a case study into an email.",
      "Research-shaped work: competitive comparisons, positioning, objection lists.",
      "Personalizing outreach at volume from a real source of customer facts.",
    ],
    surface: "Chat for drafts. Work for multi-source deliverables. Projects to keep brand voice and sources in one place.",
    leverage: "Feed it your actual voice — three pieces you'd be proud of — and make it match, rather than describing your voice in adjectives. Generic output is almost always a context problem, not a model problem.",
    trap: "Confident claims about your own product, your competitors, or the market that are simply invented — and go out publicly with your name on them. Also: everyone is using the same tool, so the default register is instantly recognizable sludge. Sameness is a real competitive cost, not an aesthetic complaint.",
    verify: "Every factual claim, statistic, and competitor assertion against a real source before it ships. Read it aloud — if it sounds like everyone else, it is.",
    handoff: "Persuasion, audience, rhetoric, reading the room → 'communication'.",
  },

  manager_exec: {
    label: "Manager / Executive",
    keys: ["manager", "executive", "exec", "leader", "leadership", "director", "vp", "ceo", "cto", "management", "strategy"],
    uses: [
      "Turning a pile of updates into a one-page brief that leads with the decision.",
      "Prepping hard conversations — steelmanning the other side before you walk in.",
      "Drafting comms, then pressure-testing them for how they'll actually land.",
      "Structuring a decision: options, tradeoffs, what would change your mind.",
    ],
    surface: "Work for anything drawing on multiple sources into a deliverable. Chat for thinking and drafting.",
    leverage: "Name the audience and the decision. 'A one-page summary a director can scan before the meeting, decision and next steps first' produces a different artifact than 'summarize this'.",
    trap: "It agrees with you. Ask 'is this a good strategy?' and you'll get a supportive answer regardless of the strategy's merit — which feels like counsel and is actually a mirror. The second trap is deciding from a summary whose source you never read.",
    verify: "Make it argue the opposite case, hard. If it can't produce a serious counter-argument, you learned nothing from the agreement. And read the source before betting on the summary.",
    handoff: "Hard conversations, persuasion, reading people → 'communication'. Team/technical specialty depth → 'polymath'.",
  },

  student: {
    label: "Student",
    keys: ["student", "study", "studying", "homework", "exam", "college", "university", "learner", "coursework", "revision"],
    uses: [
      "Explaining a concept at your level, then re-explaining it differently when it doesn't land.",
      "Generating practice problems and testing yourself — the actual learning move.",
      "Getting unstuck on a problem by asking it to hint rather than solve.",
      "Turning a reading into questions you should be able to answer.",
    ],
    surface: "Chat, mostly. Projects when a course's materials should stay together.",
    leverage: "Ask for a HINT, not the answer. 'Give me the next step, not the solution' is the difference between a tutor and a plagiarism engine. Then explain it back — if you can't, you didn't learn it.",
    trap: "Fluent output feels like understanding and isn't. You will read a perfect explanation, feel that you get it, and fail the exam — because recognition is not recall. Second trap: academic-integrity policy, which is set by your institution and is not something the model knows or will warn you about.",
    verify: "Close the tab and reproduce it from memory. That's the only test that counts. And check the policy before you use it on graded work.",
    handoff: "Study science (active recall, spaced repetition), course ladders, requirements → 'education'.",
  },

  writer_creative: {
    label: "Writer / Editor / Creative",
    keys: ["writer", "writing", "editor", "editing", "author", "journalist", "creative", "blog", "novel", "screenwriter", "copyeditor"],
    uses: [
      "Structural editing — what's the argument, where does it sag, what's missing.",
      "Line editing against a stated goal: tighter, more direct, less hedged.",
      "Getting past a blank page with deliberately bad first drafts you then rewrite.",
      "Adversarial reading: what would a hostile reader attack here?",
    ],
    surface: "Chat. Projects when a body of work should share context and voice.",
    leverage: "Use it as an editor, not a writer. 'Tell me what's weak and why' produces something useful; 'write this for me' produces something that sounds like everyone. The best output comes from your draft plus its critique.",
    trap: "Voice collapse. Its default register is smooth, hedged, and instantly recognizable — em-dashes, tricolons, 'it's not just X, it's Y'. Let it draft and your writing becomes indistinguishable from the entire internet's. Second: it will confidently attribute quotes and facts that were never said.",
    verify: "Read it aloud. If it doesn't sound like you, it isn't. Check every quote and attribution against the source.",
    handoff: "Rhetoric, argument structure, persuasion → 'communication'.",
  },

  engineer_physical: {
    label: "Engineer — Mechanical / Civil / Electrical",
    keys: ["mechanical", "civil", "electrical", "hardware", "manufacturing", "cad", "structural", "aerospace", "chemicalengineer", "pe"],
    uses: [
      "Explaining a standard, spec, or datasheet you paste in.",
      "Scripting the computational side — analysis, simulation glue, data reduction (that part is Codex work).",
      "Drafting documentation, test plans, and reports from your results.",
      "Sanity-checking your reasoning by making it argue the failure case.",
    ],
    surface: "Chat for explanation. Codex for the analysis/simulation code. Never for the calculation of record.",
    leverage: "Supply the standard and ask it to apply it. Ask it to state assumptions explicitly — most bad engineering answers hide in unstated assumptions.",
    trap: "Physical-world consequences. A hallucinated code clause, safety factor, or material property doesn't throw an exception — it becomes a structure. The model produces confident numbers with no notion that being wrong here hurts people. It is not a licensed engineer and neither is its output.",
    verify: "Every value against the actual standard or datasheet. Hand-check the calculation. A PE stamp is a human accepting liability; nothing here transfers that.",
    handoff: "Materials, chemistry, physics fundamentals → 'curiosity'. Broader engineering specialties → 'polymath'.",
  },

  product_design: {
    label: "Product & Design",
    keys: ["product", "design", "designer", "ux", "ui", "pm", "productmanager", "figma", "prototype", "userresearch"],
    uses: [
      "Turning a screenshot or mock into a working prototype (a genuinely strong Codex workflow — it's multimodal).",
      "Drafting specs, user stories, and acceptance criteria from a rough idea.",
      "Synthesizing user research notes into themes — then challenging the themes.",
      "Rapid iteration on copy, flows, and edge cases you hadn't considered.",
    ],
    surface: "Codex for prototypes and frontend iteration (attach the image; it can see it). Chat for specs and synthesis. Work for multi-source research synthesis.",
    leverage: "The image carries the visual requirement, but you must state everything it can't show — framework, hover states, validation, keyboard behavior, empty states. The screenshot doesn't specify behavior.",
    trap: "Synthesizing user research into the themes you were already hoping for. It's an agreement machine, and research synthesis is exactly where agreement is poison. Also: a prototype that looks finished but has no error states, no empty states, and no accessibility.",
    verify: "Make it list the themes that CONTRADICT your hypothesis. Check the prototype against real edge cases before showing it to anyone who might mistake it for done.",
    handoff: "Design engineering, frontend, accessibility depth → 'polymath' (Product Design & Frontend family).",
  },
};

export function resolveRole(input: string): string | undefined {
  const q = normalize(input);
  if (!q) return undefined;
  if (ROLES[q]) return q;
  for (const [key, r] of Object.entries(ROLES)) {
    if (normalize(key) === q) return key;
    if (normalize(r.label) === q) return key;
    if (r.keys.some((k) => normalize(k) === q)) return key;
  }
  // Loose contains-match, longest key first so "softwareengineer" beats "engineer".
  const scored: Array<{ key: string; len: number }> = [];
  for (const [key, r] of Object.entries(ROLES)) {
    for (const k of [key, ...r.keys]) {
      const nk = normalize(k);
      if (nk.length >= 3 && (q.includes(nk) || nk.includes(q))) scored.push({ key, len: nk.length });
    }
  }
  if (!scored.length) return undefined;
  scored.sort((a, b) => b.len - a.len);
  return scored[0].key;
}

export function howTheyUseIt(role?: string): string {
  if (!role) {
    return [
      `HOW REAL ROLES USE CHATGPT & CODEX`,
      `BOTTOM LINE: the tool is the same; the leverage and the traps are completely different by role. Pick yours — the trap is the part worth reading.`,
      ``,
      ...Object.entries(ROLES).map(([key, r]) => `  ▸ ${r.label} — 'how_they_use_it ${key}'`),
      ``,
      `THE SCOPE LINE: this covers how a role USES the tool. It is not that role's domain advice — every entry names the asset that owns the real question (lawguide, homebuyer, healthguide, nestegg, education, communication, polymath, curiosity).`,
      ``,
      `The pattern across every role: supply the authority, don't ask it to recall the authority. Verify the specifics. The model is a strong reader and an unreliable librarian.`,
    ].join("\n");
  }
  const key = resolveRole(role);
  if (!key) {
    return `Not sure which role "${clean(role)}" is. Roles: ${Object.values(ROLES).map((r) => r.label).join(", ")}.`;
  }
  const r = ROLES[key];
  return [
    `${r.label} — HOW THEY USE CHATGPT & CODEX${normalize(role) !== normalize(key) ? ` (from "${clean(role)}")` : ""}`,
    `BOTTOM LINE: ${r.leverage}`,
    ``,
    `What they actually use it for:`,
    ...r.uses.map((u) => `  • ${u}`),
    ``,
    `Which surface fits: ${r.surface}`,
    ``,
    `⚠ THE TRAP THAT BURNS THIS ROLE SPECIFICALLY:`,
    `  ${r.trap}`,
    ``,
    `How they verify: ${r.verify}`,
    ``,
    `Domain handoff: ${r.handoff}`,
    ``,
    `Anything version-specific (a model ID, a price, a limit, whether a feature exists) → check_openai → openai_verdict. This asset is the source of truth for the METHOD and the TRAPS, not for live facts — those live in the docs and get verified, never recalled.`,
  ].join("\n");
}
