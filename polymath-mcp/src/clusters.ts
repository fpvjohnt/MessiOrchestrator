import { displayKey } from "./match.js";

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

// The ~80 job titles collapse into 8 practice families. Each: what the work
// actually is, the core tools, and the ladder. Bottom-line first.

export interface Cluster {
  label: string;
  titles: string[]; // the source job titles this cluster absorbs
  what: string;
  core_tools: string[];
  ladder: string[]; // junior -> senior -> staff/lead
  project_seed: string; // what a starter project in this space typically looks like
  method: string[]; // how this expert actually works a problem, in order
  diagnostic_questions: string[]; // what they'd ask YOU before doing anything
  vocabulary: string[]; // problem-domain words that route free-text questions here
}

export const CLUSTERS: Record<string, Cluster> = {
  ai_engineering_ops: {
    label: "AI Engineering & Ops",
    titles: [
      "AI Engineering", "AI Automation Engineer", "AI Automation Specialist", "AI Analytics", "AI Operations Engineer", "AI Solutions Engineer",
      "MLOps Engineer", "Senior Machine Learning Operations Engineer", "GenAI Tool Support Engineer", "Gen AI Tool Support Engineer",
      "AI Support Engineer", "AI Implementation Support", "Senior AI Workflow and Systems Engineer",
      "AI Research Engineer", "Applied AI Research Engineer", "AI Research Scientist",
      "Applied AI, Enterprise", "Applied AI Engineer, Enterprise Tech", "Technical Specialist, Claude",
      "Research Engineer", "Research Scientist", "Reinforcement Learning Fellow", "RL Fellow",
      "Research Engineer, Knowledge", "Research Scientist, Pre-Training", "Pre-Training Enablement Lead",
      "Enablement Lead, Claude Platform", "Software Engineer, Human Data Interface", "Research Engineer, Research Scientist",
      "AI Deployment Engineer", "RERS Data and Understanding",
    ],
    what: "Wiring AI/LLMs into real, reliable workflows — not the model itself, the plumbing around it: orchestration, monitoring, evals, and keeping it from breaking in production.",
    core_tools: ["Python", "LLM APIs (OpenAI/Anthropic/Bedrock/Vertex)", "orchestration frameworks (LangChain/LangGraph, or custom agent/MCP layers)", "vector databases", "prompt evaluation/testing", "observability (LangSmith, Weights & Biases)", "GPU-aware deployment"],
    ladder: ["AI/GenAI Support Engineer", "AI Automation Engineer", "Senior AI Workflow/Ops Engineer", "AI Solutions Architect / Technical Leader"],
    project_seed: "Python + one LLM API + a small orchestration layer (agents/tools) + a vector store + basic logging/evals. An MCP server is exactly this pattern.",
    method: [
      "Pin down the EXACT task the AI must do and what a correct answer looks like — vague goals produce vague agents.",
      "Get one end-to-end call working with the simplest possible prompt before adding any machinery.",
      "Add structure (tools, retrieval, agents) only where the simple version demonstrably fails.",
      "Build a small eval set from real failures — you can't improve what you don't measure.",
      "Add logging and monitoring BEFORE scaling up — silent AI failures are the expensive kind.",
    ],
    diagnostic_questions: [
      "What exact input goes in, and what exact output should come out?",
      "How will you know when an answer is wrong?",
      "What's the cost and latency budget per call?",
      "Where does the data live, and is it allowed to leave?",
    ],
    vocabulary: [
      "llm", "prompt", "agent", "chatbot", "rag", "embedding", "gpt", "claude", "openai", "anthropic",
      "langchain", "mcp", "automation", "workflow", "eval", "hallucination", "token", "model", "finetune",
      "reinforcement", "rlhf", "pretraining", "pretrain", "inference", "enablement", "humandata",
    ],
  },
  data_bi: {
    label: "Data & BI",
    titles: [
      "Senior Data Analyst", "Data Analytics Engineer", "Senior Business Intelligence Analyst", "Data Scientist",
      "Looker Developer", "Tableau Developer", "Tableau Systems Engineer",
      "Data Operations Manager", "Data Engineer", "Scaling and Analytics",
      "Business Intelligence Developer", "BI Developer", "Data Analytics Developer", "Analytics Developer",
    ],
    what: "Turning raw data into trusted numbers leaders act on — clean models, canonical metrics, dashboards people actually believe.",
    core_tools: ["SQL", "a warehouse (BigQuery/Snowflake/Redshift)", "a transform layer (dbt or hand-rolled SQL pipelines)", "Looker/LookML or Tableau", "Python/pandas for heavier lifting", "data modeling (star schema, marts)"],
    ladder: ["Data Analyst", "Senior Data Analyst / Analytics Engineer", "Staff Analytics Engineer / BI Architect"],
    project_seed: "A warehouse table + a transform step + one dashboard tracking a metric you actually care about (attendance, spending, uptime).",
    method: [
      "Define the metric and WHO acts on it — a dashboard nobody decides from is decoration.",
      "Find the source-of-truth table and profile it: nulls, duplicates, grain, freshness.",
      "Write the SQL that produces the number, and validate it against a case you already know is right.",
      "Build the thinnest dashboard on that one validated query — one chart beats ten unvalidated ones.",
      "Review with the actual consumer, iterate, then harden the refresh schedule and document the metric definition.",
    ],
    diagnostic_questions: [
      "What decision will this dashboard drive, and who makes it?",
      "Where does the data actually live (warehouse, SQL Server, spreadsheets, an API)?",
      "Live connection or extract — how fresh do the numbers need to be?",
      "Who can confirm the numbers are RIGHT — what's the known-good case to validate against?",
    ],
    vocabulary: [
      "dashboard", "tableau", "looker", "lookml", "powerbi", "sql", "query", "bigquery", "snowflake",
      "warehouse", "metric", "kpi", "report", "excel", "csv", "etl", "pipeline", "chart", "viz", "dbt", "database",
      "dataops",
    ],
  },
  cloud_infra: {
    label: "Cloud & Infrastructure",
    titles: [
      "AI and AWS Software Development Engineer", "Senior Platform Engineer", "AI Platform Engineer",
      "Senior Network Automation Engineer", "IT Operations Engineer", "Cloud Project Engineer",
      "Cloud System Engineer", "GPU Clusters",
      "Network Engineer", "Capacity and Efficiency Engineer", "Performance Engineer",
      "Data Center Rack and Cluster Engineer", "Supply Chain Software Engineer",
    ],
    what: "Building and running what everything else sits on — compute, networking, GPU clusters, and automating the operations work humans used to do by hand.",
    core_tools: ["a cloud provider (AWS/GCP/Azure)", "infrastructure-as-code (Terraform)", "containers/Kubernetes", "GPU cluster tooling (Slurm, Ray, K8s + NVIDIA operators)", "automation (Python/Ansible)", "monitoring (Prometheus/Grafana)"],
    ladder: ["IT Operations Engineer", "Cloud/Platform Engineer", "Senior Platform Engineer", "Principal/Staff Infrastructure Architect"],
    project_seed: "Terraform provisioning a small cloud footprint + a containerized app + basic CI/CD + a monitoring dashboard.",
    method: [
      "Map the current state and define what 'done' looks like — infra work without a target drifts forever.",
      "Reproduce the problem or build the new thing in the smallest possible sandbox first, never straight in prod.",
      "Codify it as infrastructure-as-code — if it only exists as console clicks, it doesn't exist.",
      "Add monitoring and alerting before calling it live — you want the system to tell YOU it's broken.",
      "Roll out gradually with a rollback path ready, then document the runbook.",
    ],
    diagnostic_questions: [
      "Which cloud (or on-prem), and what's already running there?",
      "What breaks — and who screams — if this goes down?",
      "Is the current setup codified (Terraform/scripts) or hand-built in a console?",
      "What's the budget ceiling, monthly?",
    ],
    vocabulary: [
      "aws", "gcp", "azure", "terraform", "kubernetes", "docker", "container", "vpc", "ec2", "s3",
      "lambda", "serverless", "dns", "vpn", "gpu", "deploy", "devops", "linux", "nginx", "prometheus", "grafana",
      "network", "capacity", "efficiency", "latency", "throughput", "utilization", "scaling",
      "datacenter", "rack", "supplychain", "logistics",
    ],
  },
  security_trust_forensics: {
    label: "Security, Trust & Forensics",
    titles: [
      "Cyber Security Analyst", "Cybersecurity Analyst", "Senior Information Security Analyst",
      "Trust and Safety Specialist", "Digital Forensics Examiner", "Cloud Security - Customer Support",
      "Incident Response Manager", "Security Engineer, Detection and Response", "Detection and Response Engineer",
      "Research Engineer, Security", "Security Engineer", "Security Software Engineer",
      "Identity and Access Management Engineer", "Identity and Access Controls",
      "Cybersecurity Products Engineer", "Network Security Engineer",
      "Detection and Response Platform Data Scientist",
    ],
    what: "Protecting production systems and data, keeping platforms safe from human abuse and fraud, and investigating when something goes wrong.",
    core_tools: ["SIEM (Splunk, Sentinel)", "EDR tooling", "forensic imaging/analysis (Autopsy, FTK, EnCase)", "content-moderation/abuse-detection systems", "cloud security posture tools", "incident-response playbooks"],
    ladder: ["Security/Trust & Safety Analyst", "Senior Information Security Analyst / Trust & Safety Specialist", "Security Architect / Forensics Lead"],
    project_seed: "A home SIEM lab (free tier Splunk/Wazuh) ingesting your own network logs, or a small incident-response playbook for a realistic scenario.",
    method: [
      "CONTAIN FIRST — isolate the affected account/machine/system before investigating. Stopping the bleeding beats understanding it.",
      "Preserve evidence: logs, screenshots, timestamps — don't wipe or 'clean up' anything yet.",
      "Establish the timeline: what happened, when, and how far it reached (scope honestly, don't hope small).",
      "Identify the entry vector and close it — fixing the damage without closing the door invites round two.",
      "Document everything and harden against recurrence (MFA, patches, least-privilege, monitoring).",
    ],
    diagnostic_questions: [
      "Is it still happening RIGHT NOW, or is this aftermath?",
      "What's exposed — data, accounts, money, customer information?",
      "What logs or evidence exist, and has anything been deleted or reset already?",
      "Who else needs to know (employer, bank, platform, legal)?",
    ],
    vocabulary: [
      "hack", "hacked", "breach", "malware", "virus", "phishing", "ransomware", "password", "mfa",
      "siem", "splunk", "wazuh", "intrusion", "firewall", "forensic", "incident", "threat",
      "vulnerability", "cve", "compliance", "moderation", "abuse", "scam",
      "iam", "identity", "access", "sso", "detection", "soc", "authentication", "authorization",
    ],
  },
  systems_support: {
    label: "Systems & Technical Support",
    titles: [
      "Senior Technical Engineer", "Integration Support Engineer", "Application System Analysis - Enterprise Technical Support",
      "Application Support Senior Analyst", "Senior Technical Solutions Manager", "Software Engineer",
      "Senior Systems Analyst", "System Engineer", "Senior Systems Production Engineer", "Senior Media Technology Engineer",
      "Staff Software Engineer", "Support Engineer", "Developer Productivity Engineer",
      "Messenger Integrations Engineer", "Integrations Engineer", "Applications Engineer",
    ],
    what: "Keeping the systems people depend on running, gluing systems together, and being the escalation point when something breaks — your own strongest lane today.",
    core_tools: ["ITSM/ticketing (ServiceNow, Jira)", "API integration", "scripting (Python/PowerShell/Bash)", "monitoring/alerting", "media/production pipeline tools where relevant"],
    ladder: ["Support Engineer (Tier 1-3)", "Senior Systems/Technical Engineer", "Technical Solutions Manager / Staff Systems Engineer"],
    project_seed: "An automation script against a real ITSM API (like your ServiceNow→BigQuery work) plus a monitoring dashboard on top.",
    method: [
      "Reproduce and scope it: one app or the whole machine? One user or everyone? Intermittent or constant?",
      "Ask what changed right before it started — updates, installs, patches, new hardware. Most breakage follows a change.",
      "Isolate the layer: hardware → OS → application → network. Event Viewer / logs tell you which one is lying.",
      "Search the EXACT error text against known issues (vendor KBs, forums) — someone has almost always hit it first.",
      "Apply the lowest-risk fix first, verify it actually fixed it, then document so the next person doesn't start from zero.",
    ],
    diagnostic_questions: [
      "When did it start, and what changed right before (update, install, new device)?",
      "Is it one application or the whole system? One user or several?",
      "What's the exact error message or behavior — word for word?",
      "Does it still happen in safe mode, or under a different user account?",
    ],
    vocabulary: [
      "windows", "mac", "macos", "laptop", "desktop", "freeze", "freezing", "crash", "crashing", "slow",
      "error", "bluescreen", "bsod", "reboot", "restart", "install", "update", "driver", "printer", "wifi",
      "outlook", "office", "servicenow", "ticket", "troubleshoot", "app", "sync", "registry",
      "productivity", "tooling", "devex", "devtools", "integration", "messenger", "webhook",
    ],
  },
  leadership_delivery: {
    label: "Leadership & Delivery",
    titles: [
      "Project Manager", "Business System Analyst", "Product Architect", "Technical Leader",
      "Program Manager", "Research Operations", "Research Operations Manager",
    ],
    what: "Translating business needs into technical plans and driving delivery across teams — less hands-on-keyboard, more making sure the right thing gets built.",
    core_tools: ["Jira/Confluence", "roadmapping", "requirements gathering", "architecture diagramming", "stakeholder communication"],
    ladder: ["Business/Systems Analyst", "Senior BSA / Project Manager", "Product Architect / Technical Leader / Director"],
    project_seed: "Write a one-page architecture decision record (ADR) for a real project you're already doing — it's the artifact this ladder actually runs on.",
    method: [
      "Name the problem in BUSINESS terms and identify who owns the pain — tech framing loses the room.",
      "Map the stakeholders: who has to say yes, and what does each one need to hear to get there?",
      "Scope the smallest version that proves value — sell the slice, not the whole cake.",
      "Write the one-pager: problem, options considered, recommendation, and the specific ask (money, people, time).",
      "Get an explicit decision with an owner and a date — 'sounds good' without a name and deadline is a no.",
    ],
    diagnostic_questions: [
      "Who has to say yes, and what do they care about most?",
      "What does success look like in THEIR words, not yours?",
      "What's the real deadline and budget, and what happens if nothing changes?",
      "Has someone tried this before here — and what killed it?",
    ],
    vocabulary: [
      "roadmap", "stakeholder", "requirement", "scope", "budget", "deadline", "meeting", "presentation",
      "pitch", "proposal", "prioritize", "agile", "scrum", "sprint", "okr", "adr", "milestone", "sell",
      "buyin", "leadership", "sponsor", "approve", "approval", "approved", "researchops", "coordination",
    ],
  },
  ai_safety_frontier: {
    label: "AI Safety & Frontier Threat",
    titles: [
      "Technical Cyber Threat Investigator", "Technical CBRNE Threat Investigator",
      "CBRNE Threat Investigator, Product Specialist", "Product Specialist, Threat",
      "Safeguards Policy Analyst", "Safeguards Policy Analyst, Scams",
      "Red Team Engineer", "Frontier Red Teamer", "AI Safety Program Manager",
      "Threat Intelligence Analyst", "AI Misuse Investigator",
    ],
    what: "Keeping frontier AI from being misused — investigating cyber and CBRNE (chemical/biological/radiological/nuclear/explosive) threat scenarios, red-teaming models for dangerous capabilities, writing and enforcing safeguards policy (including scam/fraud rings), and running the safety programs that gate a release.",
    core_tools: ["red-team / jailbreak harnesses", "capability & safety evals", "abuse-detection classifiers", "threat modeling (MITRE ATT&CK, bio/chem risk frameworks)", "responsible-scaling policy (ASL tiers)", "policy writing & enforcement", "incident escalation runbooks"],
    ladder: ["Threat Investigator / Red Teamer", "Senior Safeguards / Detection & Response Engineer", "Safety Program Manager / Frontier Red Team Lead"],
    project_seed: "A small red-team eval set that probes a model for ONE disallowed capability, plus a written policy for exactly what happens when it triggers.",
    method: [
      "Define the specific harm and threat model — who is the actor, what capability would they gain, and what's the worst realistic outcome?",
      "Probe adversarially in a sanctioned eval environment: actively try to make the system produce the harmful behavior, varying the attack — don't stop at one prompt that failed.",
      "Score honestly against a rubric — a dangerous capability that reproduces even once is real; document its severity and how far it reaches.",
      "Escalate and gate: route confirmed risk to the safeguard/policy owner and block or add mitigation BEFORE it ships, not after.",
      "Write the safeguard and the runbook so the next instance is caught automatically, then re-test that the mitigation actually holds.",
    ],
    diagnostic_questions: [
      "What exact harmful capability or misuse are we worried about, and for whom?",
      "Is this a live abuse happening now, or a pre-release capability evaluation?",
      "What would 'unacceptably dangerous' look like concretely — where is the line?",
      "Who owns the go/no-go decision, and what mitigations already exist?",
    ],
    vocabulary: [
      "cbrne", "bioweapon", "biorisk", "biosecurity", "chemical", "radiological", "nuclear", "explosive",
      "redteam", "jailbreak", "jailbreaks", "safeguard", "safeguards", "misuse", "frontier", "asl",
      "alignment", "harm", "adversarial", "weaponization", "dangerous", "classifier", "elicitation",
    ],
  },
  design_frontend: {
    label: "Product Design & Frontend Engineering",
    titles: [
      "Design Engineer", "Web Engineer", "Frontend Engineer", "Front-End Engineer",
      "Product Designer", "UX Engineer", "UI Engineer", "Design Systems Engineer",
      "Demo Experience Engineer",
    ],
    what: "Building the part people actually see and touch — the web front end and the product design behind it: turning a design into fast, accessible, working interface code.",
    core_tools: ["HTML / CSS", "TypeScript / JavaScript", "React (or Vue / Svelte)", "a design system / component library", "Figma", "accessibility (WCAG / ARIA)", "browser devtools", "bundlers (Vite / webpack)"],
    ladder: ["Frontend / Web Engineer", "Senior Design Engineer", "Staff Frontend / Design Systems Lead"],
    project_seed: "One real component (a form, a dashboard card) built from a Figma design — responsive, accessible, and wired to real data.",
    method: [
      "Start from the user and the design intent — what should the person be able to DO on this screen?",
      "Build the smallest real component end-to-end (markup → style → state) before polishing anything.",
      "Make it accessible and responsive from the start — semantic HTML and keyboard/screen-reader support are not a later pass.",
      "Wire it to real data and handle the ugly states (loading, empty, error) — the happy path is the easy 20%.",
      "Test across viewports and browsers, measure performance (bundle size, render), then refactor into reusable pieces.",
    ],
    diagnostic_questions: [
      "Who uses this screen, on what device, and what's the one action that matters most?",
      "Is there a design (Figma) and a component library, or are we defining it?",
      "What framework and data source is it wired to?",
      "What are the accessibility and browser-support requirements?",
    ],
    vocabulary: [
      "frontend", "web", "website", "webpage", "css", "html", "react", "vue", "svelte", "javascript",
      "typescript", "ui", "ux", "design", "figma", "component", "responsive", "accessibility", "wcag",
      "aria", "layout", "styling", "tailwind", "demo",
    ],
  },
  hardware_silicon: {
    label: "AI Hardware & Silicon Engineering",
    titles: [
      "Electrical Engineer", "Electronics Engineer", "Analog Design Engineer", "Power Electronics Engineer",
      "Signal Integrity Engineer", "RF Engineer",
      "Computer Hardware Engineer", "Hardware Engineer", "Embedded Systems Engineer", "Firmware Engineer",
      "Board Design Engineer", "Platform Hardware Engineer",
      "Digital Design Engineer", "FPGA Engineer", "ASIC Design Engineer", "RTL Design Engineer",
      "Hardware Verification Engineer", "Physical Design Engineer",
      "AI Hardware Engineer", "AI Accelerator Architect", "GPU Architect", "Silicon Architect",
      "Chip Design Engineer", "Semiconductor Engineer",
    ],
    what: "Designing the physical machine AI runs on — from transistors, signals, and power up through logic design and chips to the GPUs and neural accelerators themselves. Where electrons, silicon, and compute meet.",
    core_tools: ["circuit design & SPICE simulation", "PCB/board design (Altium, KiCad)", "HDLs (Verilog/SystemVerilog, VHDL)", "FPGA toolchains (Vivado, Quartus)", "ASIC EDA flow (Synopsys, Cadence — synthesis, place-and-route, timing)", "hardware verification (UVM/testbenches)", "lab instruments (oscilloscope, logic analyzer)", "accelerator/GPU architecture (CUDA, memory hierarchy, dataflow)"],
    ladder: ["Electrical / Hardware Engineer", "Digital Design / FPGA / ASIC Engineer", "Senior Silicon / AI Hardware Engineer", "Silicon Architect / Principal Hardware Engineer"],
    project_seed: "An FPGA dev board running logic you wrote in Verilog — e.g. a small matrix-multiply or systolic-array block, the literal core of an AI accelerator: simulated in a testbench, then synthesized to real gates.",
    method: [
      "Start from the spec and hard constraints — clock/throughput, power budget, area/cost, I/O — hardware is expensive to fix after fabrication, so nail requirements before designing.",
      "Model and simulate before you build: SPICE for analog, HDL simulation/testbench for digital — catch it in software where a fix is free, not in silicon where it isn't.",
      "Design at the right level of abstraction (transistor → gate → RTL → block) and verify each level against the one above it.",
      "Respect the physics: timing closure, signal integrity, power and thermal — a design that's logically correct but violates timing or overheats does not actually work.",
      "Prototype on real hardware (FPGA/dev board) before a board spin or tapeout, then document the interface so firmware and software can actually drive it.",
    ],
    diagnostic_questions: [
      "What are the hard constraints — clock/throughput target, power budget, area/cost, and I/O?",
      "Analog, digital, or mixed-signal — and at what level: chip, board, or full system?",
      "Is this going to an FPGA (reprogrammable), an ASIC (fabricated), or off-the-shelf parts on a board?",
      "How does software/firmware talk to it, and who owns that interface?",
    ],
    vocabulary: [
      "circuit", "circuitry", "transistor", "semiconductor", "silicon", "wafer", "voltage", "analog",
      "signal", "power", "pcb", "soldering", "oscilloscope", "embedded", "firmware", "microcontroller",
      "fpga", "asic", "verilog", "vhdl", "rtl", "systemverilog", "synthesis", "tapeout", "gate",
      "accelerator", "npu", "tpu", "gpu", "motherboard", "processor", "cpu", "chip", "electronics",
    ],
  },
  ml_modeling_science: {
    label: "ML Modeling & Computational Science",
    titles: [
      "Machine Learning Engineer", "ML Engineer", "Deep Learning Engineer", "Machine Learning Scientist",
      "Applied Scientist", "Research Scientist, Machine Learning", "Computer Vision Engineer", "NLP Engineer",
      "Applied Mathematician", "Computational Scientist", "Computational Mathematician", "Numerical Analyst",
      "Quantitative Researcher", "Scientific Computing Engineer", "Optimization Engineer", "Simulation Engineer",
    ],
    what: "Building and training the models themselves — and the applied math underneath them. Where a real-world problem becomes a dataset, a loss function, and a trained model that generalizes, grounded in linear algebra, calculus, probability, and numerical methods.",
    core_tools: ["Python (NumPy, pandas)", "PyTorch / JAX / TensorFlow", "the math stack (linear algebra, calculus, probability, optimization)", "experiment tracking (Weights & Biases, MLflow)", "GPU / distributed training", "scientific computing (SciPy, simulation, numerical methods)", "training-data pipelines", "evaluation & statistical validation"],
    ladder: ["ML Engineer / Applied Scientist", "Senior ML Engineer / Research Scientist", "Staff ML Scientist / Principal Applied Mathematician"],
    project_seed: "Train one model end-to-end on data you care about — load and clean it, define the model and loss, train, and honestly measure whether it generalizes to data it never saw. Beat a dumb baseline before reaching for a deep network.",
    method: [
      "Frame it mathematically: what's the input, the target, the loss you're minimizing, and what 'good' means numerically — a model with no clear objective can't be trained or judged.",
      "Build a dumb baseline first (linear model, nearest-neighbor, a heuristic) — if the fancy model can't beat it, you learned that cheaply.",
      "Get the data right before the model: splits that don't leak, clean labels, an understood distribution — most model failures are data failures wearing a model's clothes.",
      "Train, then diagnose honestly on a held-out set: underfitting (too weak) or overfitting (memorizing)? The fix differs, and hoping isn't measuring.",
      "Verify the math and the result — check gradients, units, and convergence, and confirm the metric actually reflects the real goal before anyone trusts the model.",
    ],
    diagnostic_questions: [
      "What exactly are you predicting or modeling, and how is 'correct' measured numerically?",
      "How much labeled data is there, and can you trust the labels and the train/test split?",
      "Is this a modeling problem (train something) or a math/simulation problem (solve, optimize, or simulate something)?",
      "What's the compute budget for training, and where does it run?",
    ],
    vocabulary: [
      "train", "training", "neural", "pytorch", "tensorflow", "jax", "numpy", "scipy", "pandas",
      "gradient", "backpropagation", "loss", "overfitting", "underfitting", "hyperparameter", "epoch",
      "convolutional", "transformer", "regression", "classification", "clustering", "optimization",
      "numerical", "matrix", "eigenvalue", "calculus", "probability", "statistics", "bayesian",
      "algebra", "simulation", "montecarlo", "dataset", "generalize", "modeling",
    ],
  },
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// Reverse index: every cluster KEY, every cluster LABEL, and every individual
// job TITLE named for that cluster all resolve to it. This is what makes
// "Trust and Safety Specialist" or "Senior Machine Learning Operations
// Engineer" recognized by name, not just the 8 family names — every position
// named when this MCP was scoped is a first-class, directly-addressable entry.
const TITLE_INDEX: Record<string, string> = {};
for (const [key, c] of Object.entries(CLUSTERS)) {
  TITLE_INDEX[normalize(key)] = key;
  TITLE_INDEX[normalize(c.label)] = key;
  for (const title of c.titles) {
    TITLE_INDEX[normalize(title)] = key;
  }
}

/**
 * Resolves free-text (a cluster key, a cluster label, or any specific job
 * title) to its cluster key. Exact match first; substring fuzzy match only
 * for inputs >=3 chars (mirrors match.ts's fuzzyFind rule) so short/common
 * words can't misfire.
 */
export function resolveCluster(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(TITLE_INDEX, norm)) return TITLE_INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(TITLE_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

export function dayInTheLife(cluster?: string): string {
  if (!cluster) {
    return (
      `THE 8 PRACTICE FAMILIES — every position named collapses into these:\n\n` +
      Object.entries(CLUSTERS).map(([k, c]) => `▸ ${displayKey(k)}: ${c.what}`).join("\n") +
      `\n\nAsk for any by cluster name OR by a specific job title (e.g. "Trust and Safety Specialist", "Senior Machine Learning Operations Engineer") — every position named is recognized directly.`
    );
  }
  const key = resolveCluster(cluster);
  if (!key) return `Don't know "${clean(cluster)}". Known clusters: ${Object.keys(CLUSTERS).join(", ")}. Ask by cluster name or by a specific job title.`;
  const c = CLUSTERS[key];
  return [
    `${c.label}${normalize(cluster) !== key ? ` (matched from "${clean(cluster)}")` : ""}`,
    `BOTTOM LINE: ${c.what}`,
    ``,
    `Absorbs these titles: ${c.titles.join(", ")}`,
    ``,
    `Core tools: ${c.core_tools.join(", ")}`,
    ``,
    `The ladder: ${c.ladder.join(" → ")}`,
    ``,
    `Starter project shape: ${c.project_seed}`,
  ].join("\n");
}
