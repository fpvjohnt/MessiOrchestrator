// WHO BUILDS AND RUNS OPENAI — the engineering, research, safety, data, and
// operations roles behind ChatGPT, Codex, the API, and the agents. This is the
// mirror image of roles.ts: roles.ts is "how an outside profession USES the
// tool"; builders.ts is "what the people who MAKE the tool actually do."
//
// Same reverse-index shape as roles.ts (resolveRole) and polymath's clusters.ts,
// so "ask by any name" works and the regression harness auto-covers every entry.
//
// SCOPE + HONESTY LINE: entries describe the CRAFT of each role — its charter,
// its day-to-day, its stack, and the part outsiders get wrong (the `trap`).
// These are stable role descriptions, grounded in OpenAI's own public job
// families as of 2026. They are NOT live headcount, comp, or "is this role open
// right now" — anything current-facing (a specific posting, a salary band, a
// team reorg) routes through check_openai → openai_verdict, never recalled here.
// Where a role's real WORK belongs to another asset's domain (vendor-neutral
// agent architecture, general career laddering), `adjacent` names that asset.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface Builder {
  label: string;
  keys: string[];
  org: string; // the part of OpenAI this role lives in
  charter: string; // one-line: what they own (the BOTTOM LINE)
  does: string[]; // what they actually do day to day
  stack: string; // the concrete tools/tech of the role
  craft: string; // what separates a great one from a good one
  trap: string; // what outsiders get wrong about the role
  adjacent: string; // related asset in this collection, or a sibling builder role
}

export const BUILDERS: Record<string, Builder> = {
  software_engineer: {
    label: "Software Engineer",
    keys: ["softwareengineer", "swe", "developer", "dev", "programmer", "backend", "fullstack", "productengineer"],
    org: "Applied / product & infra engineering across ChatGPT, API, and internal systems",
    charter: "Ship and operate the production software — services, APIs, and product surfaces — that turns research into something millions of people can actually use.",
    does: [
      "Design, build, and own backend services and product features end to end, from proposal through rollout and on-call.",
      "Work against extreme scale and change: the traffic, the model behavior, and the requirements all move under you.",
      "Cut scope hard — ship the smallest correct thing, measure it, then expand. A frontier lab rewards shipped-and-learned over designed-and-perfect.",
      "Collaborate with research to productionize a capability that started life as an experiment.",
    ],
    stack: "Python and TypeScript most commonly; also Go/Rust in infra. Postgres, gRPC/FastAPI, Kubernetes, cloud (Azure/GCP), and the internal model-serving stack.",
    craft: "Judgment about what NOT to build, and comfort operating a system whose hardest dependency — the model — is non-deterministic. The best ones make correctness observable instead of assumed.",
    trap: "Thinking it's ordinary CRUD engineering with a fancier employer. The hard part is that requirements and model behavior shift weekly, so over-engineering for a spec that won't survive the month is the classic waste.",
    adjacent: "Vendor-neutral agent architecture (ReAct, evals, RAG) → 'loop'. The ~70 general engineering specialties and how to level into them → 'polymath'.",
  },

  data_engineer: {
    label: "Data Engineer",
    keys: ["dataengineer", "de", "pipelines", "etl", "elt", "analyticsengineering", "scalinganalytics"],
    org: "Data / Scaling Analytics — often the Infrastructure org",
    charter: "Build the pipelines, models, and trusted datasets that turn fragmented operational data into the numbers the company actually decides on.",
    does: [
      "Design and maintain scalable data pipelines feeding infrastructure deployment, capacity planning, supply chain, and finance.",
      "Produce trusted datasets and reporting on hardware inventory, site readiness, capacity utilization, and operational performance.",
      "Support executive reporting, operational reviews, and forecasting — the analytical foundation under strategic planning.",
      "Define the grain, the source of truth, and the tests, so a downstream number can't silently drift.",
    ],
    stack: "SQL and Python; modern warehouses (Snowflake, BigQuery, Redshift); orchestration (Airflow, Dagster); dbt-style modeling and data-quality tests.",
    craft: "Modeling data so the RIGHT question is answerable and the wrong join is hard to write. Reliability and lineage over cleverness — a pipeline nobody trusts is worse than no pipeline.",
    trap: "Confusing volume with value. The job isn't moving the most rows; it's producing a small number of datasets the whole org treats as ground truth, and defending their correctness.",
    adjacent: "The data/analytics/BI career family and warehouse design → 'polymath'. How an analyst USES ChatGPT for SQL → 'how_they_use_it data analyst'.",
  },

  data_scientist_business: {
    label: "Data Scientist, Business",
    keys: ["datascientistbusiness", "businessdatascientist", "growthdatascientist", "productdatascience", "gtmdatascience"],
    org: "Business / Go-To-Market data science (ChatGPT Team, Enterprise, API)",
    charter: "Build the data-driven understanding of customers and growth — what drives activation, engagement, and expansion across OpenAI's business products.",
    does: [
      "Find intervention points in the customer lifecycle that move activation and onboarding.",
      "Identify target audiences for feature launches and measure whether emails, events, and campaigns actually worked.",
      "Self-serve the underlying business data and turn it into decisions, alongside Data Engineering, Finance, and GTM.",
      "Design the experiment or quasi-experiment before running the query — causal clarity over a pretty dashboard.",
    ],
    stack: "SQL + Python (pandas, statsmodels/scikit); experimentation and causal-inference methods; BI (Looker/Tableau/Mode); the warehouse.",
    craft: "Translating a vague business ask ('why did expansion stall?') into a measurable, causal question — and being honest when the data can only show correlation.",
    trap: "Mistaking a significant p-value for a business insight. The value is the decision that changes, not the model that fits; a beautiful analysis nobody acts on is a null result.",
    adjacent: "How a BI/analyst role USES ChatGPT → 'how_they_use_it data analyst'. Investing/retirement/personal-finance questions → 'nestegg'.",
  },

  data_scientist_infrastructure: {
    label: "Data Scientist, Infrastructure",
    keys: ["datascientistinfrastructure", "infradatascientist", "capacitydatascience", "computeanalytics"],
    org: "Infrastructure data science",
    charter: "Quantify how OpenAI's compute is used, how efficient it is, and how it should scale — the analytics that steer where the GPUs go.",
    does: [
      "Build the foundational datasets and metrics for infrastructure usage, efficiency, and scaling.",
      "Develop forecasting and optimization models for infrastructure planning and resource allocation.",
      "Drive source-of-truth dashboards and analyses that guide infrastructure decisions company-wide.",
      "Partner with engineering, research, and product to shape infra strategy with data, not vibes.",
    ],
    stack: "SQL + Python; forecasting and optimization (time series, linear/convex optimization); large-scale telemetry; warehouse + BI.",
    craft: "Turning noisy utilization telemetry into a forecast leadership will spend hundreds of millions against — and stating the uncertainty band honestly.",
    trap: "Treating it as pure modeling. Most of the leverage is defining what 'utilization' and 'efficiency' even mean across heterogeneous clusters, before any model is fit.",
    adjacent: "Cloud & infrastructure engineering as a discipline → 'polymath'. The agentic-loop side of scaling model training → 'loop'.",
  },

  platform_engineering: {
    label: "Platform Engineering",
    keys: ["platformengineering", "platformengineer", "apiplatform", "internalplatform", "developerplatform", "devplatform"],
    org: "Platform / API Platform engineering",
    charter: "Build the shared platforms other engineers build ON — the developer API surface and the internal paved roads that make every other team faster and safer.",
    does: [
      "Own the API platform: the request/response contracts, auth, rate limiting, versioning, and backward compatibility developers depend on.",
      "Build internal 'paved road' tooling — deploy, config, service scaffolding — so product teams don't each reinvent it.",
      "Treat other engineers as customers: stable interfaces, deprecation discipline, and docs are the product.",
      "Balance velocity against the reality that a platform break fans out to everyone at once.",
    ],
    stack: "Backend (Python/Go), gRPC/REST, Kubernetes, Terraform/IaC, CI/CD, observability (Datadog/Prometheus/Grafana).",
    craft: "Designing an interface that's hard to misuse and cheap to evolve. The great platform engineer is measured by the teams they unblock, not the code they personally ship.",
    trap: "Building the platform you find elegant instead of the one your internal users need — a 'paved road' nobody drives on is shelfware, however clean.",
    adjacent: "Vendor-neutral agent-loop building blocks (connectors, worktrees) → 'loop'. General cloud/platform career family → 'polymath'.",
  },

  site_reliability_engineer: {
    label: "Site Reliability Engineer (SRE)",
    keys: ["sitereliabilityengineer", "sre", "reliabilityengineer", "infrareliability", "clusterreliability", "oncall"],
    org: "Infrastructure — Frontier Systems / reliability",
    charter: "Keep the largest compute clusters in the world up — scale them, automate them, and be the calm hands when something is on fire at 3am.",
    does: [
      "Scale Kubernetes to massive node counts and automate bare-metal bring-up across multiple data centers.",
      "Build the software layer that hides the complexity of tens of thousands of nodes, switches, and hardware-health systems.",
      "Stand up monitoring/observability that catches issues early, and diagnose-and-fix fast when they don't.",
      "Relentlessly raise the automation and uptime bar — toil you do twice should be scripted the third time.",
    ],
    stack: "Kubernetes at scale, Terraform/IaC, cloud (AWS/GCP/Azure), bare-metal/datacenter networking, Datadog/Prometheus/Grafana/Splunk, ELK.",
    craft: "Systems thinking under pressure: designing for graceful degradation, and knowing that at frontier scale the rare failure mode happens constantly.",
    trap: "Thinking SRE is 'ops that restarts servers.' It's distributed-systems engineering — the deliverable is automation and reliability as code, not manual heroics.",
    adjacent: "Debugging an agent loop that never stops / thrashes → 'loop debug_loop'. The IT/infra career family → 'polymath'.",
  },

  software_engineer_agent_infrastructure: {
    label: "Software Engineer, Agent Infrastructure",
    keys: ["agentinfrastructure", "agentinfra", "softwareengineeragentinfrastructure", "agentplatform", "trainingenvironment", "sandboxinfra"],
    org: "Agent Infrastructure",
    charter: "Build the platform that AI agents are trained in and run on — the sandboxes where models write code, use tools, and operate computers just like a human engineer would.",
    does: [
      "Stand up and scale the environments where agentic models are trained, then run them on some of the largest compute clusters in the world.",
      "Build and maintain the production platform ALL agents run on — the same rails serving Codex, Operator, and tool use in ChatGPT.",
      "Develop FastAPI and gRPC APIs that are the interface to agentic infra in both training and production.",
      "Work hand-in-hand with researchers to stand up systems for novel training runs, using Terraform for complex infra.",
    ],
    stack: "Python, FastAPI, gRPC, Terraform, Kubernetes, containerized sandboxes, the model-training and serving stack.",
    craft: "Making an execution sandbox that is simultaneously powerful (real code, real tools), safe (isolated), and fast enough to not bottleneck a training run costing a fortune per hour.",
    trap: "Underestimating the security and isolation problem. You're giving a model a real computer; the infra IS the guardrail, and a leaky sandbox is a safety incident, not a bug.",
    adjacent: "How to ARCHITECT agent loops (vendor-neutral: tool use, memory, orchestration) → 'loop'. Building on OpenAI's own agent primitives → 'explain_primitive agents_sdk'.",
  },

  chatgpt_performance_engineer: {
    label: "ChatGPT Performance Engineer",
    keys: ["chatgptperformanceengineer", "performanceengineer", "perfengineer", "latencyengineer", "throughputengineer", "productperformance"],
    org: "ChatGPT / product performance engineering",
    charter: "Push latency, throughput, and cost-efficiency of ChatGPT and the API to the next level, across every layer from GPU to browser.",
    does: [
      "Drive performance-testing strategy and define SLAs/SLOs around latency and throughput for critical systems.",
      "Profile and optimize across application, middleware, runtime, and infra — networking, storage, Python runtime, GPU utilization.",
      "Lead investigations into performance regressions and build the observability/tracing that surfaces them.",
      "Trade off latency vs cost vs quality explicitly — at this scale a millisecond and a penny both multiply by billions of requests.",
    ],
    stack: "Profilers and tracing systems, GC/runtime internals (Python/Go), OS internals (scheduling, memory, IO), GPU utilization tooling, load-testing frameworks.",
    craft: "Finding the one layer that actually bounds the system among many plausible suspects — and proving it with a measurement, not a hunch.",
    trap: "Optimizing what's easy to measure instead of what's actually slow. Without a real profile and a defined SLO, 'performance work' becomes expensive guessing.",
    adjacent: "Why an OpenAI API integration is slow / 429s / cost blowout → 'debug_openai'. Which primitive minimizes cost → 'pick_primitive'.",
  },

  ai_deployment_engineer: {
    label: "AI Deployment Engineer",
    keys: ["aideploymentengineer", "deploymentengineer", "solutionsengineer", "solutionsarchitect", "customerengineer"],
    org: "Deployment Engineering / GTM technical",
    charter: "Ensure strategic customers actually get GenAI into production safely and effectively — the technical trusted-advisor who turns a roadmap into shipped use cases.",
    does: [
      "Embed with strategic platform customers as the technical lead; build and qualify a backlog of high-value GenAI use cases for their industry.",
      "Accelerate time-to-value with hands-on prototypes and direct strategic guidance.",
      "Manage relationships with customer leadership to get applications deployed AND scaled, not just demoed.",
      "Carry high-fidelity insights from real deployments back into product proposals and model feedback.",
    ],
    stack: "OpenAI API/Responses/Agents SDK, Python/JS prototyping, retrieval/RAG, evals, the customer's own data and systems.",
    craft: "Reading an organization: finding the use case that's both valuable AND actually shippable given their data, compliance, and politics — and killing the ones that aren't.",
    trap: "Confusing a great demo with a deployment. The job is production adoption and measurable impact; a prototype that wows the room but never ships is a failure, not a win.",
    adjacent: "The vendor-neutral architecture of what you're deploying → 'loop'. Which OpenAI primitive to build on → 'pick_primitive'. Sibling role that goes deeper into the customer's codebase → 'forward deployed engineer'.",
  },

  forward_deployed_engineer: {
    label: "Forward Deployed Engineer (FDE)",
    keys: ["forwarddeployedengineer", "fde", "forwarddeploy", "forwarddeployedsoftwareengineer", "embeddedengineer"],
    org: "Forward Deployed Engineering",
    charter: "Lead end-to-end deployments of frontier models inside a specific customer's messy real-world environment — and stay accountable, writing the code, until it's running in production.",
    does: [
      "Own discovery, technical scoping, system design, build, and production rollout alongside the customer's own engineers.",
      "Make the product work against THEIR data schemas, compliance rules, legacy systems, and real users — not a clean reference environment.",
      "Write and review production-grade code across frontend and backend (Python/JS/similar); don't hand off a slide deck and leave.",
      "Feed eval-driven signal from the field back into the product and model roadmap.",
    ],
    stack: "Full-stack production code (Python, JS/TS), the OpenAI API + Agents SDK, retrieval/evals, plus whatever the customer runs — and the judgment to integrate with it.",
    craft: "Thriving in ambiguity and other people's codebases: shipping something real in an environment you didn't design and don't control, under time pressure.",
    trap: "Thinking it's sales engineering. It's real, accountable software engineering done AT the customer — success is measured by production adoption and workflow impact, not meetings held.",
    adjacent: "The lighter-touch platform-customer version → 'ai deployment engineer'. Vendor-neutral loop design → 'loop'. Government-embedded variant exists under OpenAI for Gov.",
  },

  ai_support_engineer: {
    label: "AI Support Engineer",
    keys: ["aisupportengineer", "supportengineer", "useroperations", "technicalsupport", "customersupportengineer"],
    org: "User Operations",
    charter: "Resolve the complex technical issues that reach OpenAI's customers — and turn each resolution into tooling and automation so the next thousand users never hit it.",
    does: [
      "Provide deep technical guidance and resolve complex product/API issues for developers and enterprises.",
      "Use scripting and emerging AI capabilities to improve internal tooling and automate recurring processes.",
      "Turn patterns from resolved issues into scaled solutions, working with Product and GTM.",
      "Be the early-warning system: recurring tickets are product feedback in disguise.",
    ],
    stack: "The OpenAI API and product surface, scripting (Python), internal support/observability tooling, and AI-assisted automation of their own workflow.",
    craft: "Diagnosing a problem across the seam between the customer's code and OpenAI's platform — and then making the fix systemic instead of one-off.",
    trap: "Measuring the role by tickets closed. At a frontier lab the point is scaling yourself out of the loop — automating the recurring issue beats heroically answering it a hundredth time.",
    adjacent: "Debugging a specific OpenAI integration symptom → 'debug_openai'. The IT/support career family → 'polymath'.",
  },

  technical_threat_investigator: {
    label: "Technical Threat Investigation Engineer",
    keys: ["technicalthreatinvestigator", "threatinvestigator", "threatintel", "threatintelligenceengineering", "threatinvestigation", "adversaryhunting"],
    org: "Safety / Security — Threat Intelligence Engineering",
    charter: "Protect OpenAI and the ecosystem from sophisticated adversaries — investigate capable threat actors misusing the models, and turn what you find into mitigations.",
    does: [
      "Run complex, end-to-end investigations into capable threat actors: their behavior, infrastructure, techniques, and how AI is woven into their operations.",
      "Understand how adversaries integrate models into cyber operations, and get ahead of emerging techniques.",
      "Partner with Security, Safety Systems, Product Policy, and Integrity to operationalize findings into real outcomes.",
      "Write the detections and the intel that shorten the next investigation.",
    ],
    stack: "Threat-intel and investigation tooling, log/infrastructure analysis, malware/TTP analysis, data querying (SQL/Python), the model-abuse telemetry.",
    craft: "Thinking like the adversary while reasoning from incomplete evidence — attribution and intent are probabilistic, and overclaiming is its own failure.",
    trap: "Treating it as generic SOC alert-triage. This is proactive, investigative work against capable actors specifically abusing AI — closer to intelligence analysis than to a rules queue.",
    adjacent: "The rapid-analysis sibling → 'technical intelligence analyst'. The quantify-the-risk sibling → 'quantitative analyst'. General cybersecurity/forensics careers → 'polymath'.",
  },

  technical_intelligence_analyst: {
    label: "Technical Intelligence Analyst",
    keys: ["technicalintelligenceanalyst", "intelligenceanalyst", "sia", "strategicintelligence", "safetyintelligence", "riskanalyst"],
    org: "Strategic Intelligence & Analysis (SIA)",
    charter: "Produce fast, structured, decision-ready intelligence on how OpenAI's products are being abused — the analysis that safety mitigations and product calls are made from.",
    does: [
      "Generate scaled, rapid risk analysis: monitor, analyze, and forecast real-world abuse, geopolitical risk, and strategic threats.",
      "Turn messy signals into structured, decision-ready intelligence products for safety, product, and partnerships teams.",
      "Track how misuse patterns shift as products, policies, and world events change.",
      "Brief decision-makers clearly and fast — intelligence that arrives after the decision is worthless.",
    ],
    stack: "OSINT and abuse telemetry, data querying (SQL/Python), structured-analytic techniques, briefing/writing craft.",
    craft: "Analytic rigor at speed: separating signal from noise, stating confidence honestly, and writing so a busy decision-maker can act on it.",
    trap: "Mistaking a data dump for intelligence. The deliverable is a judgment with a confidence level and a 'so what,' not a chart — analysis, not reporting.",
    adjacent: "The deep-dive investigation sibling → 'technical threat investigator'. The quantitative-modeling sibling → 'quantitative analyst'.",
  },

  quantitative_analyst: {
    label: "Quantitative (Intelligence) Analyst",
    keys: ["quantitativeanalyst", "quant", "quantitativeintelligenceanalyst", "riskmodeling", "quantanalyst"],
    org: "Strategic Intelligence & Analysis (SIA)",
    charter: "Discover and measure emerging risks in human–AI systems BEFORE they're well-defined — build the models that turn weak early signals into structured, quantified insight.",
    does: [
      "Surface weak, early, unconventional risk signals with quantitative tooling and subject-matter depth.",
      "Build analytic models that explain how harms could form, evolve, and propagate as products and policies change.",
      "Translate ambiguous patterns into structured, data-driven insight leadership can act on.",
      "Develop the frameworks that map new risks before they're widely understood or easy to measure.",
    ],
    stack: "Statistical modeling, data mining, supervised learning; Python (pandas/scikit); large-scale abuse and usage data.",
    craft: "Modeling the not-yet-defined: quantifying a risk that has no clean label or baseline yet, without over-fitting a story onto noise.",
    trap: "This is NOT a finance/trading quant. At OpenAI the 'quant' works safety risk in the SIA team — measuring emerging harm in human–AI systems, not pricing derivatives.",
    adjacent: "The narrative-analysis sibling → 'technical intelligence analyst'. The investigation sibling → 'technical threat investigator'. Investing/markets questions → 'nestegg'.",
  },

  agent_post_training: {
    label: "Agent Post-Training (Engineering)",
    keys: ["agentposttraining", "posttraining", "agenttraining", "rlengineer", "posttrainingengineer", "graders", "rewardmodeling"],
    org: "Agent Post-Training",
    charter: "Improve the capability, reliability, and product-fit of OpenAI's agentic models — own pieces of the post-training stack that teach a model to act in the world.",
    does: [
      "Own end-to-end improvements to the post-training stack: RL, data pipelines, graders, reward signals, evals, diagnostics, model-behavior analysis.",
      "Build training signal for models that write and debug code, use tools, call functions, operate computers, and coordinate with other agents.",
      "Build the infrastructure that makes large training runs faster and more trustworthy.",
      "Drive a capability from idea → experiment → integration → launch.",
    ],
    stack: "PyTorch, RL/RLHF/RLAIF pipelines, graders and reward models, eval harnesses, synthetic-data generation, large-scale training infra.",
    craft: "Making progress on an ambiguous capability problem across research, engineering, data, evals, AND product — not being defined by a single method.",
    trap: "Thinking post-training is 'fine-tuning.' The hard, decisive work is the graders, reward signal, and evals — the training signal — far more than the training loop itself.",
    adjacent: "The pure-research sibling → 'agent post-training research'. The work-product-artifacts sibling → 'artifact research'. Vendor-neutral eval design → 'loop eval_loop'.",
  },

  agent_post_training_research: {
    label: "Agent Post-Training Research",
    keys: ["agentposttrainingresearch", "researcheragenticposttraining", "agenticposttraining", "researchscientistagent", "posttrainingresearcher"],
    org: "Agent Post-Training (Research)",
    charter: "Define what the next generation of agents should be able to do, then invent the training signal and experiments that make it real.",
    does: [
      "Own a research direction: take a fuzzy capability (long-horizon execution, calibrated reasoning, tool use, 'taste') and make it a trainable objective.",
      "Build the data, environments, graders, and feedback loops that teach a capability, then carry it through major training runs into shipped products.",
      "Create evals that reveal exactly where models fail — the failing eval is the research artifact.",
      "Run experiments across coding, computer use, multi-agent coordination, factuality, and instruction-following.",
    ],
    stack: "Deep learning / RL research stack (PyTorch), eval and grader design, environment building, large-scale experiment tooling.",
    craft: "Turning a capability nobody has operationalized into a measurable objective — and knowing which experiment would actually change your mind.",
    trap: "Assuming 'research' means detached from shipping. Here the loop runs all the way to products people use; an insight that never reaches a training run doesn't count.",
    adjacent: "The engineering-heavy sibling → 'agent post-training'. The artifacts specialization → 'artifact research'. Vendor-neutral loop/eval theory → 'loop'.",
  },

  artifact_research: {
    label: "Artifact Research (Agent Post-Training, Artifacts)",
    keys: ["artifactresearch", "artifacts", "artifact", "researcherartifacts", "workproductresearch", "canvasresearch"],
    org: "Agent Post-Training — Artifacts",
    charter: "Train frontier models to produce polished, genuinely useful WORK PRODUCTS — documents, spreadsheets, slide decks, dashboards, reports, and other editable artifacts.",
    does: [
      "Define what 'good' looks like for a model-generated document, sheet, deck, or dashboard, then build the training signal for it.",
      "Build the data, environments, and graders that teach quality, structure, and taste in produced artifacts.",
      "Run experiments that move real output quality, and carry them through training runs into ChatGPT/Codex/API surfaces.",
      "Wrestle the hardest part: grading subjective quality ('is this a good deck?') in a way a model can actually learn from.",
    ],
    stack: "Post-training research stack (PyTorch, RL, graders), plus artifact-quality evals for structured/formatted outputs, and synthetic-data pipelines.",
    craft: "Operationalizing 'taste' — converting a fuzzy human judgment about a finished work product into a reproducible training signal.",
    trap: "Thinking it's about formatting or templates. The research problem is quality and usefulness as a learnable objective, not slapping Markdown on an answer.",
    adjacent: "The parent discipline → 'agent post-training'. The broader research role → 'agent post-training research'. How a role USES artifacts/Canvas in ChatGPT → 'how_they_use_it'.",
  },

  workday_engineer: {
    label: "Workday Engineer",
    keys: ["workdayengineer", "workday", "hris", "peoplesystems", "workdayintegrations", "peopletech"],
    org: "People Systems / People Innovation",
    charter: "Make OpenAI's People (HR) systems reliable and scalable — engineer the Workday integrations and automations that connect HR to finance, internal tools, and AI-driven systems.",
    does: [
      "Build reliable Workday integrations across payroll, comp, performance, and case management.",
      "Improve People-systems architecture and automate complex HR workflows with real engineering, testing, and operational rigor.",
      "Connect Workday to internal platforms, external vendors, and emerging AI tooling.",
      "Own data integrity and business-process design in a system the whole company's employment runs on.",
    ],
    stack: "Workday EIB, Studio, Cloud Connect, Extend, reporting, calculated fields, security, business-process framework; plus general integration engineering.",
    craft: "Combining genuine Workday depth with software-engineering discipline — treating an HRIS like production software (tested, versioned, observable), which most Workday work is not.",
    trap: "Dismissing it as 'HR config, not real engineering.' At scale it's integration and platform engineering on a system where a payroll or comp bug is a very high-stakes incident.",
    adjacent: "General platform/integration engineering careers → 'polymath'. The internal-tooling side of the company.",
  },

  strategy_and_operations: {
    label: "Strategy and Operations",
    keys: ["strategyandoperations", "stratops", "bizops", "businessoperations", "operationsstrategy", "chiefofstaff"],
    org: "Cross-functional Strategy & Operations / BizOps",
    charter: "Turn broad, undefined priorities into clear operating models and shipped outcomes — the central operator who brings order as products go from early adoption to scaled deployment.",
    does: [
      "Own 1–2 high-impact initiatives end to end, from problem definition through execution.",
      "Model and analyze technical and business data to inform strategy and build the business case behind a decision.",
      "Turn ambiguity into launch plans, requirements, stakeholder alignment, reporting, and an execution rhythm.",
      "Align company strategy with the product roadmap and build scalable operating models for global growth.",
    ],
    stack: "Financial/operational modeling (spreadsheets, SQL for self-serve data), BI, and the operating-cadence tooling — but the real tools are structured thinking and writing.",
    craft: "Imposing structure on a genuinely undefined problem — scoping it, sequencing it, and driving cross-functional execution when you own the outcome but not the people.",
    trap: "Reading it as 'slides and meetings.' The good ones are operators judged on initiatives that actually shipped and moved a number, not decks produced.",
    adjacent: "Hard conversations, persuasion, stakeholder alignment → 'communication'. The manager/exec lens on USING ChatGPT → 'how_they_use_it manager'.",
  },
};

export function resolveBuilder(input: string): string | undefined {
  const q = normalize(input);
  if (!q) return undefined;
  if (BUILDERS[q]) return q;
  for (const [key, b] of Object.entries(BUILDERS)) {
    if (normalize(key) === q) return key;
    if (normalize(b.label) === q) return key;
    if (b.keys.some((k) => normalize(k) === q)) return key;
  }
  // Loose contains-match, longest key first so "softwareengineeragentinfrastructure"
  // beats "softwareengineer".
  const scored: Array<{ key: string; len: number }> = [];
  for (const [key, b] of Object.entries(BUILDERS)) {
    for (const k of [key, ...b.keys]) {
      const nk = normalize(k);
      if (nk.length >= 3 && (q.includes(nk) || nk.includes(q))) scored.push({ key, len: nk.length });
    }
  }
  if (!scored.length) return undefined;
  scored.sort((a, b) => b.len - a.len);
  return scored[0].key;
}

export function howTheyBuild(role?: string): string {
  if (!role) {
    return [
      `WHO BUILDS & RUNS OPENAI — the roles behind ChatGPT, Codex, the API, and the agents`,
      `BOTTOM LINE: same company, wildly different crafts. Pick a role — the 'trap' (what outsiders get wrong) is the part worth reading.`,
      ``,
      `Build & product:`,
      ...["software_engineer", "platform_engineering", "software_engineer_agent_infrastructure", "chatgpt_performance_engineer", "site_reliability_engineer"].map(
        (k) => `  ▸ ${BUILDERS[k].label} — 'how_they_build ${k}'`
      ),
      ``,
      `Data & analytics:`,
      ...["data_engineer", "data_scientist_business", "data_scientist_infrastructure"].map((k) => `  ▸ ${BUILDERS[k].label} — 'how_they_build ${k}'`),
      ``,
      `Research — agents & post-training:`,
      ...["agent_post_training", "agent_post_training_research", "artifact_research"].map((k) => `  ▸ ${BUILDERS[k].label} — 'how_they_build ${k}'`),
      ``,
      `Deployment & customer-facing:`,
      ...["forward_deployed_engineer", "ai_deployment_engineer", "ai_support_engineer"].map((k) => `  ▸ ${BUILDERS[k].label} — 'how_they_build ${k}'`),
      ``,
      `Safety, security & intelligence:`,
      ...["technical_threat_investigator", "technical_intelligence_analyst", "quantitative_analyst"].map((k) => `  ▸ ${BUILDERS[k].label} — 'how_they_build ${k}'`),
      ``,
      `Internal systems & operations:`,
      ...["workday_engineer", "strategy_and_operations"].map((k) => `  ▸ ${BUILDERS[k].label} — 'how_they_build ${k}'`),
      ``,
      `Grounded in OpenAI's public role families as of 2026. Anything live — a specific opening, comp, or a team reorg — is not answered here; that routes check_openai → openai_verdict.`,
      `The mirror tool: how an OUTSIDE profession uses ChatGPT/Codex → 'how_they_use_it'.`,
    ].join("\n");
  }
  const key = resolveBuilder(role);
  if (!key) {
    return `Not sure which OpenAI role "${clean(role)}" is. Roles: ${Object.values(BUILDERS)
      .map((b) => b.label)
      .join(", ")}.`;
  }
  const b = BUILDERS[key];
  return [
    `${b.label} — WHAT THEY ACTUALLY DO${normalize(role) !== normalize(key) ? ` (from "${clean(role)}")` : ""}`,
    `BOTTOM LINE: ${b.charter}`,
    ``,
    `Where it sits: ${b.org}`,
    ``,
    `What they actually do:`,
    ...b.does.map((d) => `  • ${d}`),
    ``,
    `The stack: ${b.stack}`,
    ``,
    `What separates a great one: ${b.craft}`,
    ``,
    `⚠ WHAT OUTSIDERS GET WRONG ABOUT THIS ROLE:`,
    `  ${b.trap}`,
    ``,
    `Related: ${b.adjacent}`,
    ``,
    `This is the stable CRAFT of the role. Anything current — a live posting, a salary band, a team change — → check_openai → openai_verdict. Never recalled from memory.`,
  ].join("\n");
}
