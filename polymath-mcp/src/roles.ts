// PER-TITLE deep dives, one layer below the practice clusters.
//
// clusters.ts collapses ~80 job titles into 8 families, which is the right
// default: most titles are the same work wearing a different name, and eight
// good answers beat eighty thin ones. But a few titles are a CRAFT in their own
// right — asking about them and getting the generic family answer is a miss.
// "Looker Developer" resolved to Data & BI and returned SQL/warehouse/dbt
// advice, none of which is what the job actually is day to day.
//
// So: a title in ROLES gets its own answer; everything else still falls through
// to its cluster. Add a role here only when the family answer would genuinely
// mislead — not merely because a title is popular.

export interface RoleLevel {
  level: string;
  years: string;
  focus: string;
}

export interface RolePillar {
  name: string;
  what: string;
  skills: string[];
}

export interface RolePhase {
  phase: string;
  what: string;
  artifact?: string; // the concrete thing that exists when the phase is done
}

export interface Role {
  title: string;
  aka: string[];
  cluster: string; // the family it still belongs to
  bottom_line: string;
  morning: string[]; // the code-and-optimization half
  afternoon: string[]; // the people-and-strategy half
  pillars: RolePillar[];
  levels: RoleLevel[];
  inside: string; // what the technical work actually is
  outside: string; // the business impact, away from the screen
  hiring_signal: string[]; // what separates a real one from a resume
  /**
   * Optional ordered lifecycle, for roles whose value IS the process rather
   * than a set of daily tasks. An architect's contribution is that the same
   * sequence runs every time — describing their morning misses the point.
   */
  lifecycle?: RolePhase[];
}

export const ROLES: Record<string, Role> = {
  looker_developer: {
    title: "Looker Developer",
    aka: ["lookml developer", "looker engineer", "looker analytics developer", "lookml", "looker"],
    cluster: "data_bi",
    bottom_line:
      "Owns the SEMANTIC LAYER — the one place a metric is defined so that every dashboard in the company " +
      "agrees on what it means. The job is half software engineering (LookML is code, in Git, reviewed) and " +
      "half translation (turning what Finance means by 'revenue' into logic that cannot drift).",

    morning: [
      "Content Validator sweep — find dashboards broken overnight by an upstream schema change and fix the LookML before anyone opens them. Upstream renamed a column; hundreds of tiles depend on it.",
      "Performance auditing — read the instance performance dashboards for slow queries, then fix the cause: a missing index, an unaggregated explore, a join fanning out rows.",
      "PDT work — write and update Persistent Derived Tables so expensive calculations materialise overnight instead of being recomputed by every viewer. This is the main lever on warehouse cost.",
    ],
    afternoon: [
      "Requirements gathering — sit with Marketing or Finance and turn a business metric into technical logic. Most of this hour is finding out that two people in the room define the metric differently.",
      "Building Explores — assemble the drag-and-drop sandbox so non-technical users can answer their own questions without writing SQL, and without being able to produce a wrong number.",
      "Code review — approve Git pull requests from junior developers to hold LookML quality. In a semantic layer, one sloppy merge silently changes a number on every dashboard that uses it.",
    ],

    pillars: [
      {
        name: "LookML expertise (the semantic layer)",
        what: "The modelling language itself. This is the part that is unique to the role and cannot be picked up from general SQL work.",
        skills: [
          "Core objects: dimensions, measures, views, explores — and knowing which belongs where.",
          "Liquid templating and HTML parameters to change fields dynamically based on who is viewing.",
          "DRY code via extends and refinements, so logic is reused rather than copy-pasted into drift.",
          "The Looker API/SDK for custom apps and automated data alerts.",
        ],
      },
      {
        name: "Data and cloud architecture",
        what: "What sits underneath. LookML generates SQL, so a Looker developer who cannot read a query plan is guessing.",
        skills: [
          "Dialect-specific SQL tuned for the actual warehouse — BigQuery, Snowflake, or Databricks each reward different things.",
          "Cost management through caching policies and datagroups, so a refresh does not rescan the warehouse.",
          "Data modelling: turning star and snowflake schemas into logical LookML relationships without fanouts.",
        ],
      },
      {
        name: "Software engineering mindset",
        what: "The pillar most self-taught Looker developers are missing, and the one that separates mid from senior.",
        skills: [
          "Git workflows: feature branches, merge conflicts, pull requests as a normal daily rhythm.",
          "CI/CD with automated LookML tests that catch logic errors before they reach production dashboards.",
        ],
      },
    ],

    levels: [
      { level: "Junior", years: "1–2", focus: "Build dashboards, write basic dimensions and measures, clear simple validation errors." },
      { level: "Mid-level", years: "3–5", focus: "Design complex Explores, optimise PDTs, run Git workflows, gather stakeholder requirements directly." },
      { level: "Senior / Architect", years: "5+", focus: "Instance-wide security and governance, Looker API integrations, scalable hub-and-spoke LookML architecture." },
    ],

    inside:
      "They live in the Looker IDE writing text files that define rules once — 'gross margin = (revenue − COGS) / revenue' — " +
      "and that single definition then updates identically across hundreds of dashboards. The leverage is enormous in both " +
      "directions: define it right and the whole company is correct; define it wrong and the whole company is confidently wrong.",
    outside:
      "They are data translators. Away from the screen they teach business units how to use the platform and, more " +
      "importantly, build trust — the win condition is that when Finance and Marketing each pull a 'revenue report', " +
      "the two numbers match. That is a political achievement as much as a technical one.",

    hiring_signal: [
      "Ask what they do when two departments disagree on a metric definition. A real one has a process; a junior one picks a side.",
      "Ask how they decide something becomes a PDT. The answer should mention cost and refresh windows, not just 'it was slow'.",
      "Ask about a LookML change that broke production. Anyone senior has one, and can say what test they added afterwards.",
      "Ask them to explain a symmetric aggregate or a join fanout. It is the single most common source of silently wrong numbers in Looker.",
    ],
  },

  data_analyst: {
    title: "Data Analyst",
    aka: ["analyst", "insight analyst", "business analyst data", "reporting analyst", "data analytics"],
    cluster: "data_bi",
    bottom_line:
      "Extracts meaning from data and packages it into something a business person can act on. The under-rated half " +
      "of the job is WRITING: an analyst who cannot document a metric definition ends up answering the same question " +
      "forever, and becomes the bottleneck instead of the multiplier.",
    morning: [
      "SQL against the warehouse — pull the numbers, then check them against a case already known to be right before believing any of it.",
      "Dashboard work in Tableau or Power BI, aimed at a decision someone actually makes. A dashboard nobody decides from is decoration.",
      "Root-cause analysis — 'why did signups drop 12% on Tuesday' — which is mostly ruling out instrumentation bugs before concluding anything about behaviour.",
    ],
    afternoon: [
      "Automated reporting pipelines, so the recurring questions answer themselves and stop arriving as Slack messages.",
      "Confluence as the knowledge base — publish data dictionaries, document metric definitions ('how we calculate Monthly Active Users'), archive post-mortems, embed live dashboards in team spaces for self-serve.",
      "Stakeholder review — walk someone through a finding and watch which part they do not believe. That part is the real work.",
    ],
    pillars: [
      {
        name: "Technical",
        what: "Getting to a correct number, repeatably.",
        skills: [
          "Advanced SQL — window functions, CTEs, and knowing when a join is quietly duplicating rows.",
          "Python or R for anything SQL is bad at: statistics, cohorting, forecasting.",
          "Data visualisation that answers a question rather than displaying a table.",
        ],
      },
      {
        name: "Business acumen",
        what: "Knowing which number matters, which is the part that cannot be taught from a tool.",
        skills: [
          "Translating a vague ask ('are we doing well?') into a measurable question.",
          "Knowing the decision behind the request — the answer changes depending on what it will be used for.",
          "Saying when the data cannot support the conclusion someone wants.",
        ],
      },
      {
        name: "Technical writing and documentation",
        what: "The scaling pillar. This is where Confluence earns its place, and where most analysts are weakest.",
        skills: [
          "Data dictionaries and canonical metric definitions written so a non-analyst can apply them.",
          "Post-mortem and analysis archives, so last quarter's investigation is findable instead of redone.",
          "Embedding live dashboards into the spaces people already read, rather than sending links.",
        ],
      },
    ],
    levels: [
      { level: "Junior", years: "0–2", focus: "Run and modify existing queries, build straightforward dashboards, answer defined questions." },
      { level: "Mid-level", years: "2–5", focus: "Own a business area end to end, do root-cause work unprompted, define and document metrics." },
      { level: "Senior / Lead", years: "5+", focus: "Set metric standards company-wide, mentor, and decide what is NOT worth measuring." },
    ],
    inside: "SQL, notebooks and a BI tool — turning a question into a number, and then into a chart that makes the number obvious.",
    outside:
      "They are the company's memory. Documented definitions in Confluence are what stop three teams computing 'active users' three different ways, and what let the analyst move on to a new question instead of re-answering the old one.",
    hiring_signal: [
      "Ask for a time their analysis was wrong. Everyone has one; the useful answer names how they found out.",
      "Ask how they validate a new query. 'I check it against something I already know' is the answer you want.",
      "Ask what they do when a stakeholder wants a conclusion the data does not support.",
      "Ask where their metric definitions live. If the answer is 'in my head', they are a bottleneck.",
    ],
  },

  engineering_manager: {
    title: "Engineering Manager",
    aka: ["em", "eng manager", "engineering management", "software engineering manager", "dev manager"],
    cluster: "leadership_delivery",
    bottom_line:
      "Responsible for the PEOPLE, the execution, and the technical health of an engineering team — in that order when " +
      "they conflict. The hard transition is that output is no longer something they produce personally; it is something " +
      "they create the conditions for.",
    morning: [
      "1-on-1s — the core of the job, not an interruption to it. Career growth, friction, and the things people will not say in a group.",
      "Unblocking — finding the decision, dependency or access that has quietly stalled someone for two days.",
      "Reviewing technical direction without taking the keyboard. Staying close enough to judge, far enough not to bottleneck.",
    ],
    afternoon: [
      "Sprint planning and delivery rhythm — making shipping predictable rather than heroic.",
      "Partnering with Product on the roadmap, including saying what is not achievable in the window.",
      "Technical health: paying down the debt and flakiness that never appears on a roadmap but decides next quarter's speed.",
    ],
    pillars: [
      {
        name: "People management",
        what: "The pillar the role is actually judged on, and the one an ex-IC is least prepared for.",
        skills: [
          "1-on-1s that surface problems early rather than reporting status.",
          "Career growth and honest, specific performance feedback — including the conversation nobody wants.",
          "Conflict resolution between engineers, and between the team and other functions.",
        ],
      },
      {
        name: "Technical judgement",
        what: "Enough architecture understanding to evaluate a decision without making it yourself.",
        skills: [
          "Reading a design doc and finding the risk in it.",
          "Knowing when to allow a shortcut and when the debt will compound.",
          "Keeping credibility with engineers — a manager who cannot follow the discussion loses the room.",
        ],
      },
      {
        name: "Execution and delivery",
        what: "Turning a roadmap into shipped software on a believable schedule.",
        skills: [
          "Agile practice as a tool rather than a ceremony.",
          "Scoping, sequencing and cutting — deciding what does not get built.",
          "Managing up: giving leadership an accurate forecast, especially a bad one, early.",
        ],
      },
    ],
    levels: [
      { level: "New EM", years: "0–2 in role", focus: "One team (5–8 engineers), delivery and 1-on-1s, still partly hands-on." },
      { level: "Experienced EM", years: "2–5", focus: "Larger or multiple teams, hiring, performance management, roadmap partnership." },
      { level: "Senior EM / Director", years: "5+", focus: "Managers of managers, org design, headcount, cross-team technical strategy." },
    ],
    inside: "Docs, 1-on-1 notes, planning boards and design reviews — very little code, and that is correct, not a failure.",
    outside:
      "They set whether the team is a place good engineers stay. Culture, psychological safety and whether people say 'this will not work' out loud are all downstream of the EM.",
    hiring_signal: [
      "Ask how they handled an underperformer. Vagueness here usually means they avoided it.",
      "Ask what they stopped doing when they became a manager — a real answer names something they missed.",
      "Ask how they know their team is healthy, and listen for a signal other than velocity.",
      "Ask about a deadline they missed and what leadership heard, and when.",
    ],
  },

  program_manager: {
    title: "Program Manager",
    aka: ["pgm", "technical program manager", "tpm", "programme manager"],
    cluster: "leadership_delivery",
    bottom_line:
      "Owns a PROGRAM — a set of interconnected projects aimed at one strategic objective. The distinction that matters: " +
      "a Project Manager owns one deliverable; a Program Manager owns the space BETWEEN teams, which is exactly where " +
      "things fail and where nobody else is looking.",
    morning: [
      "Dependency mapping across teams — finding the thing team C needs from team A that neither has scheduled.",
      "Risk register: what could derail this, how likely, what the mitigation is, and who owns it. Kept live, not written once.",
      "Timeline tracking across separate engineering and product teams, each with its own planning rhythm.",
    ],
    afternoon: [
      "Status and alignment — telling several audiences the same true thing at the right altitude.",
      "Launch coordination: the checklist across engineering, product, support, legal, and marketing.",
      "Breaking silos — usually by getting two people who have been emailing into one room for ten minutes.",
    ],
    pillars: [
      {
        name: "Cross-functional leadership",
        what: "Leading without authority. Nobody on the program reports to them.",
        skills: [
          "Building credibility fast enough that teams accept a schedule they did not set.",
          "Running a meeting that produces a decision instead of a recap.",
          "Escalating without turning it into a political event.",
        ],
      },
      {
        name: "Risk and dependency management",
        what: "The technical core of the job — foreseeing the collision before it happens.",
        skills: [
          "Critical-path thinking: which slip moves the launch and which does not.",
          "A living risk register with owners and triggers, not a document written at kickoff.",
          "Contingency planning for the dependency you do not control.",
        ],
      },
      {
        name: "Communication and method",
        what: "Same facts, different altitudes, without contradiction.",
        skills: [
          "Stakeholder communication tuned per audience — engineers, executives, support.",
          "Agile and waterfall both, because a program usually spans teams that run differently.",
          "Written status that a busy executive can act on in thirty seconds.",
        ],
      },
    ],
    levels: [
      { level: "Junior PgM", years: "1–3", focus: "One workstream, tracking and reporting, learning the org." },
      { level: "PgM / TPM", years: "3–6", focus: "A full program across several teams, owns risk and launch." },
      { level: "Senior / Principal PgM", years: "6+", focus: "Multi-quarter strategic programs, org-wide dependencies, defines how programs run." },
    ],
    inside: "Dependency maps, risk registers, timelines and status docs — the connective tissue nobody else maintains.",
    outside:
      "They are the reason a launch involving five teams happens on one day rather than five. Their success is largely invisible: a program that runs smoothly looks like it was never at risk.",
    hiring_signal: [
      "Ask them to describe a program that slipped and what the first real signal was — good ones saw it early.",
      "Ask how they handle a team that will not commit to a date.",
      "Ask the difference between their job and a project manager's. If they cannot answer, they are a project manager.",
      "Ask what they cut to make a launch date.",
    ],
  },

  director_program_management: {
    title: "Director of Program Management",
    aka: ["director of pmo", "head of program management", "pmo director", "director program management"],
    cluster: "leadership_delivery",
    bottom_line:
      "Runs the SYSTEM that programs run inside — the PMO. Owns strategy, governance and standards across a department " +
      "or company, and manages the Program Managers rather than the programs. The output is an organisation that can " +
      "execute predictably, not any single launch.",
    morning: [
      "Portfolio review — which programs are green, which are lying about being green, and where the money is going.",
      "Managing PgMs: coaching, load-balancing, and deciding who takes the politically hard program.",
      "Budget and resourcing across the portfolio, including the decision to stop something.",
    ],
    afternoon: [
      "Aligning company strategy with actual execution capacity — usually the news that the roadmap exceeds the headcount.",
      "Executive reporting to C-level: honest portfolio status without drowning them in detail.",
      "Designing the frameworks, tooling and process the whole org uses, so quality does not depend on which PgM you got.",
    ],
    pillars: [
      {
        name: "Portfolio and strategy",
        what: "Thinking in a portfolio, where the job is allocation and sequencing rather than delivery.",
        skills: [
          "Prioritising across programs competing for the same people.",
          "Connecting company objectives to what teams are actually doing.",
          "Killing a program that is no longer worth its cost — the hardest and most valuable call.",
        ],
      },
      {
        name: "Operational design",
        what: "Building the machine: the PMO itself.",
        skills: [
          "Standard intake, planning and reporting that scales without becoming bureaucracy.",
          "Tooling and governance decisions the whole org lives with.",
          "Metrics for predictability — knowing whether the org is actually getting better at shipping.",
        ],
      },
      {
        name: "Executive presence and mentorship",
        what: "Credibility upward, growth downward.",
        skills: [
          "Delivering bad portfolio news to executives with a plan attached.",
          "Mentoring PgMs into senior operators.",
          "Influencing peer VPs whose teams they do not control.",
        ],
      },
    ],
    levels: [
      { level: "Senior PgM → Director", years: "8+", focus: "First people-management of PgMs, owns a portfolio slice." },
      { level: "Director", years: "10+", focus: "Department-wide PMO, budget ownership, executive reporting." },
      { level: "Senior Director / VP", years: "12+", focus: "Company-wide operating model, org design, strategy-to-execution accountability." },
    ],
    inside: "Portfolio dashboards, budgets, operating reviews and process design — almost no individual program work.",
    outside:
      "They decide whether a company can execute strategy at all. Good ones make delivery boring and predictable; bad ones add process weight without adding predictability, which is the classic PMO failure.",
    hiring_signal: [
      "Ask what process they REMOVED. Directors who only add ceremony are how PMOs get a bad name.",
      "Ask how they measure whether the org got better at shipping, and listen for something other than on-time percentage.",
      "Ask about a program they killed.",
      "Ask how they handle a VP peer whose team is the dependency and will not move.",
    ],
  },

  slack_expert: {
    title: "Slack Power User / Expert",
    aka: ["slack expert", "slack admin", "slack administrator", "workspace admin", "slack power user", "slack workflow"],
    cluster: "systems_support",
    bottom_line:
      "Turns Slack from a noisy chat app into an operational hub — automating routine work, cutting interruptions, and " +
      "imposing a channel structure people can navigate. The measure of success is LESS message volume and fewer " +
      "interruptions, not more engagement.",
    morning: [
      "Build no-code workflows in Workflow Builder: request intake, on-call handoffs, onboarding checklists that used to be a person remembering.",
      "Integrations — wiring Jira, GitHub and Google Drive so status arrives in the channel instead of being asked for.",
      "Channel architecture: naming conventions that scale (#help-data vs #proj-looker), archiving the dead ones, and making the right channel findable.",
    ],
    afternoon: [
      "Workspace administration — permissions audits, guest and external access, app approvals.",
      "Retention and compliance policy, which is a legal question as much as a technical one.",
      "Teaching etiquette: threads over channel-wide replies, when @here is justified, why a status update belongs in a thread. This is the highest-leverage and least technical part.",
    ],
    pillars: [
      {
        name: "Automation",
        what: "Removing the routine work people do by hand in chat.",
        skills: [
          "Workflow Builder for no-code intake, approvals and reminders.",
          "The Slack API, bots and webhooks for anything Workflow Builder cannot reach.",
          "Integrations with the tools the company already runs.",
        ],
      },
      {
        name: "Enterprise administration",
        what: "Running it as real infrastructure, because at scale it holds company records.",
        skills: [
          "Permissions, SSO, guest and external-connection policy.",
          "Retention, eDiscovery and compliance settings.",
          "App governance — which third-party apps can read your workspace.",
        ],
      },
      {
        name: "Information architecture and etiquette",
        what: "The human half, and the one that actually determines whether it works.",
        skills: [
          "Channel taxonomy and naming that survives growth.",
          "Norms: threading, urgency, what belongs in a doc instead.",
          "Training and nudging, since a convention nobody follows is not a convention.",
        ],
      },
    ],
    levels: [
      { level: "Power user", years: "—", focus: "Workflows and integrations for their own team; the informal go-to person." },
      { level: "Workspace admin", years: "1–3", focus: "Org-wide channel design, app approvals, onboarding automation." },
      { level: "Enterprise / Grid admin", years: "3+", focus: "Multi-workspace governance, compliance, SSO, retention, security review." },
    ],
    inside: "Admin console, Workflow Builder, API tokens and audit logs — plus a lot of naming conventions.",
    outside:
      "They shape how a company communicates. Done well, internal email nearly disappears and questions reach the right people without a meeting; done badly, Slack becomes an unsearchable interruption machine that people hide from.",
    hiring_signal: [
      "Ask what they did to REDUCE notifications. Anyone can add an integration; restraint is the skill.",
      "Ask their channel naming convention and why. A real one has a scheme and a reason.",
      "Ask how they handle a team that ignores the conventions.",
      "Ask what they would automate first in a 200-person company, and listen for whether they ask about the company first.",
    ],
  },

  tableau_expert: {
    title: "Tableau Expert",
    aka: ["tableau developer", "tableau", "tableau analyst", "tableau architect"],
    cluster: "data_bi",
    bottom_line:
      "The mirror image of a Looker Developer. Looker's centre of gravity is governance and centralised code; Tableau's " +
      "is visualisation, exploration and storytelling. A Tableau expert makes a complex dataset legible and interactive " +
      "for an executive who will look at it for ninety seconds.",
    morning: [
      "Dashboard design and build — high-performance, interactive, and aimed at a specific decision rather than a general 'overview'.",
      "Complex calculations: Level of Detail (LOD) expressions, table calcs, and getting the order of operations right, which is where most wrong Tableau numbers come from.",
      "Performance work — reducing render times by fixing extracts, cutting unused fields, and removing quick filters that trigger a query per keystroke.",
    ],
    afternoon: [
      "Tableau Server / Cloud administration: extract refresh schedules, permissions, and row-level security so two viewers of the same dashboard see only their own data.",
      "Data blending and prep in Tableau Prep when the warehouse does not already give a clean shape.",
      "Sitting with the audience to watch them use the dashboard. What they click first, and where they get stuck, is the design feedback.",
    ],
    pillars: [
      {
        name: "Tableau mastery",
        what: "The product suite itself — Desktop, Prep and Server/Cloud are three different skills.",
        skills: [
          "LOD expressions (FIXED / INCLUDE / EXCLUDE) and knowing where they sit in the order of operations.",
          "Advanced calculations, parameters, and dynamic sets.",
          "Server/Cloud administration: extracts, schedules, permissions, row-level security.",
        ],
      },
      {
        name: "Visual design and UX",
        what: "The pillar Looker developers usually lack, and the reason this is a distinct role.",
        skills: [
          "Chart choice driven by the question, not by variety — a bar chart is usually the right answer.",
          "Layout and hierarchy so the headline number is seen first.",
          "Interactivity that guides rather than overwhelms: filters, actions, drill paths.",
        ],
      },
      {
        name: "Performance optimisation",
        what: "The difference between a dashboard people use and one they abandon.",
        skills: [
          "Extracts versus live connections, and knowing when each is right.",
          "Reducing the query count a single dashboard fires.",
          "Pushing heavy transformation upstream into the warehouse instead of doing it in the workbook.",
        ],
      },
    ],
    levels: [
      { level: "Junior", years: "0–2", focus: "Build workbooks from a defined spec, basic calcs, publish to Server." },
      { level: "Mid-level", years: "2–5", focus: "LOD-heavy logic, performance tuning, own dashboards end to end with stakeholders." },
      { level: "Senior / Architect", years: "5+", focus: "Server governance, row-level security design, standards and templates across the org." },
    ],
    inside: "Tableau Desktop and Prep, plus the Server admin console — workbooks, extracts, and a lot of iteration on layout.",
    outside:
      "They make data persuasive. A well-built Tableau dashboard changes what an executive believes in the meeting it is shown in; that is a different skill from making the number correct, and both are needed.",
    hiring_signal: [
      "Ask them to explain FIXED versus INCLUDE. Anyone senior can, and most resumes claiming 'advanced Tableau' cannot.",
      "Ask how they made a slow dashboard fast, and listen for whether they measured before changing.",
      "Ask about a chart type they talked a stakeholder OUT of.",
      "Ask how they implement row-level security — it is where governance mistakes become data leaks.",
    ],
  },

  data_engineer: {
    title: "Data Engineer",
    aka: ["data engineering", "etl engineer", "elt engineer", "pipeline engineer", "analytics infrastructure"],
    cluster: "data_bi",
    bottom_line:
      "Builds and runs the plumbing everything else sits on. Without them the Looker and Tableau people have nothing " +
      "clean to model. The job is judged on reliability far more than cleverness: a pipeline that is right 99% of the " +
      "time is a pipeline nobody trusts.",
    morning: [
      "Pipeline monitoring — check what failed overnight, why, and whether anything downstream silently served stale data.",
      "ETL/ELT development: ingesting a new source, or reshaping an existing one without breaking every model built on it.",
      "Data quality checks — freshness, row counts, nulls, uniqueness. The tests are the product as much as the pipeline is.",
    ],
    afternoon: [
      "Warehouse architecture in BigQuery or Snowflake: partitioning, clustering, and cost, which is mostly a modelling problem.",
      "Writing clean Python and SQL, and reviewing it — pipelines are long-lived code, not scripts.",
      "Working with analysts on what a table should actually contain, ideally before it is built rather than after.",
    ],
    pillars: [
      {
        name: "Pipelines and orchestration",
        what: "Moving data reliably and knowing the moment it stops.",
        skills: [
          "Orchestration with Airflow or Prefect — dependencies, retries, backfills.",
          "dbt for transformation, testing and lineage.",
          "Streaming with Kafka when batch is genuinely not good enough.",
        ],
      },
      {
        name: "Warehouse and cloud",
        what: "Where the data lands and what it costs to keep asking it questions.",
        skills: [
          "BigQuery, Snowflake or equivalent — partitioning, clustering, cost control.",
          "A cloud platform (AWS/GCP/Azure) and its storage and IAM model.",
          "Modelling for consumption: the shape analysts need, not the shape the source happened to have.",
        ],
      },
      {
        name: "Software engineering",
        what: "Treating data code as production code, which is what separates a data engineer from an analyst who writes Python.",
        skills: [
          "Python and SQL written to be read and tested.",
          "Version control, CI, and code review as normal practice.",
          "Data quality, security and access control at scale.",
        ],
      },
    ],
    levels: [
      { level: "Junior", years: "0–2", focus: "Maintain existing pipelines, add sources, fix failures with guidance." },
      { level: "Mid-level", years: "2–5", focus: "Design pipelines end to end, own warehouse models, set up testing and monitoring." },
      { level: "Senior / Staff", years: "5+", focus: "Platform architecture, cost and reliability at scale, standards other engineers build against." },
    ],
    inside: "Python, SQL, dbt, an orchestrator and a cloud console — plus a lot of time reading logs.",
    outside:
      "They decide whether the company's data can be trusted at all. Every dashboard, model and metric above them inherits their reliability, and nobody notices the work until it breaks.",
    hiring_signal: [
      "Ask how they know a pipeline succeeded but produced wrong data. Silent corruption is the real failure mode.",
      "Ask about a backfill that went badly.",
      "Ask what they do when an upstream team changes a schema without telling them — the answer reveals whether they have contracts or hope.",
      "Ask how they reduced warehouse cost, and whether they measured it.",
    ],
  },

  github_actions_expert: {
    title: "GitHub Actions Expert",
    aka: ["github expert", "ci cd engineer", "cicd engineer", "devops engineer", "github actions", "release engineer", "dataops engineer"],
    cluster: "cloud_infra",
    bottom_line:
      "Owns the path from a developer's laptop to production, and makes it safe, automatic and boring. Bridges dev and " +
      "ops (DevOps, or DataOps when the artefact is a data model). Success looks like nobody thinking about deployment.",
    morning: [
      "Pipeline work — writing and fixing YAML workflows that build, test and deploy without a human in the loop.",
      "Triaging failed runs, and separating real failures from flaky ones. Tolerated flakiness is how a team learns to ignore red builds.",
      "Branching strategy: GitFlow or trunk-based, and enforcing it with branch protection rather than documentation.",
    ],
    afternoon: [
      "Secrets and environment management — rotating tokens, scoping them per environment, keeping them out of logs.",
      "Auditing repository access and permissions, especially third-party apps and outside collaborators.",
      "Speeding up the pipeline: caching, matrix builds, right-sized runners. Slow CI quietly changes how often people push.",
    ],
    pillars: [
      {
        name: "Git and workflow design",
        what: "The human process the automation enforces.",
        skills: [
          "Advanced Git CLI — rebase, bisect, reflog, and untangling a bad merge.",
          "Branching strategies chosen to fit team size and release cadence.",
          "Pull request standards, required checks, and protected branches.",
        ],
      },
      {
        name: "CI/CD automation",
        what: "The pipelines themselves.",
        skills: [
          "GitHub Actions: workflows, reusable actions, matrix builds, self-hosted runners.",
          "Automated testing gates that block a merge instead of merely reporting.",
          "Deployment strategies with a rollback path that has actually been tested.",
        ],
      },
      {
        name: "Security and infrastructure",
        what: "CI holds the keys to production, which makes it a prime target.",
        skills: [
          "Secrets management, OIDC over long-lived keys, least-privilege tokens.",
          "Infrastructure-as-code so environments are reproducible.",
          "Webhooks and integrations wiring the toolchain together.",
        ],
      },
    ],
    levels: [
      { level: "Junior", years: "0–2", focus: "Maintain existing workflows, fix failing builds, follow the branching model." },
      { level: "Mid-level", years: "2–5", focus: "Design pipelines for a team, manage secrets and environments, own release process." },
      { level: "Senior / Platform", years: "5+", focus: "Org-wide CI/CD standards, reusable workflows, supply-chain security, runner infrastructure." },
    ],
    inside: "YAML, the Actions run log, and repository settings — plus scripts nobody sees that save everyone an hour a week.",
    outside:
      "They set how fast and how safely a company can ship. A good pipeline means a junior developer can deploy on their first week; a bad one means every release needs the person who knows the ritual.",
    hiring_signal: [
      "Ask how they handle secrets in CI. If the answer stops at 'repository secrets', keep going.",
      "Ask about a deploy that had to be rolled back, and whether the rollback worked.",
      "Ask what they did about a flaky test — tolerating it is the wrong answer.",
      "Ask how long their pipeline takes and what they did about it.",
    ],
  },

  looker_architect: {
    title: "Looker Architect",
    aka: [
      "end to end looker architect", "looker process expert", "looker architect process",
      "lookml architect", "looker end to end", "looker lifecycle",
    ],
    cluster: "data_bi",
    bottom_line:
      "Rare, because it requires both halves: the business conversation AND the developer-operations machinery. They take " +
      "a messy verbal request and land it in production through a repeatable lifecycle — the value is that the SAME " +
      "sequence runs every time, so quality does not depend on who picked up the ticket.",
    morning: [
      "Running the current request through the lifecycle below — which phase it is in, and what is blocking it.",
      "LookML development in Dev Mode, validating generated SQL in SQL Runner before anything is committed.",
      "Reviewing peers' pull requests, since the CI gate catches syntax and broken Explores but not bad modelling.",
    ],
    afternoon: [
      "Stakeholder sessions to pin down definitions — the phase that prevents the most rework.",
      "Coordinating with Data Engineering for new raw data, and with governance for anything sensitive.",
      "Improving the pipeline itself: better tests, faster CI, clearer PR templates.",
    ],
    lifecycle: [
      {
        phase: "Requirements gathering",
        what:
          "Sit with stakeholders and define the metric. Not 'what data do you want' but 'what decision are you trying to make' — " +
          "the second question changes the answer and usually shrinks the request.",
        artifact: "Business definitions written down in Confluence, e.g. 'Active User = logged in within 30 days'.",
      },
      {
        phase: "Design and approvals",
        what:
          "Map the logic BEFORE writing code. New raw data needs the Data Engineer's sign-off; sensitive financial or personal " +
          "data needs a governance and privacy review. Both are far cheaper here than after the build.",
        artifact: "An agreed model design, plus explicit sign-offs from data engineering and governance.",
      },
      {
        phase: "Development mode",
        what:
          "Flip Looker into Dev Mode — a personal Git sandbox. Write DRY LookML: create the views, define dimensions and " +
          "measures, join them into an Explore, then check the generated SQL in SQL Runner. Reading the SQL Looker produces " +
          "is the step that catches fanouts and wrong joins.",
        artifact: "Working LookML in a feature branch, with the generated SQL verified by hand.",
      },
      {
        phase: "Validation and push",
        what:
          "Run the native LookML Validator for syntax and reference errors. When clean, commit in Looker and push to GitHub, " +
          "which opens a Pull Request.",
        artifact: "A green LookML Validator run and an open PR.",
      },
      {
        phase: "CI/CD and deploy",
        what:
          "Opening the PR triggers a GitHub Actions workflow automatically. It runs a tool such as Spectacles to test every " +
          "Explore against the live database, proving no existing dashboard or view is broken by the change. Green tests plus " +
          "a senior peer review, then merge to production — and the change is live for everyone at once.",
        artifact: "Passing CI, an approved review, and a merge to the production branch.",
      },
    ],
    pillars: [
      {
        name: "The business half",
        what: "Getting the definition right, which no amount of engineering rescues later.",
        skills: [
          "Interviewing stakeholders for the decision behind the request.",
          "Documenting canonical definitions where the company will find them.",
          "Resolving two departments who mean different things by the same word.",
        ],
      },
      {
        name: "The LookML half",
        what: "Everything a Looker Developer does, held to a higher standard because they set it.",
        skills: [
          "DRY LookML with extends and refinements; views, Explores, PDTs.",
          "Reading the generated SQL rather than trusting the model.",
          "Instance-level governance: access grants, row-level security, model separation.",
        ],
      },
      {
        name: "The DevOps half",
        what: "The part that makes it repeatable instead of heroic.",
        skills: [
          "Git branching and PR discipline inside Looker's Git integration.",
          "GitHub Actions running Spectacles or equivalent against the live warehouse.",
          "Treating a broken production dashboard as a failed test, not a support ticket.",
        ],
      },
    ],
    levels: [
      { level: "Senior Looker Developer", years: "4–6", focus: "Runs the lifecycle for their own work, strong in two of the three halves." },
      { level: "Looker Architect", years: "6+", focus: "Owns the lifecycle itself, the CI gate, and the modelling standards others follow." },
      { level: "Analytics Platform Lead", years: "8+", focus: "Multi-model architecture, governance across departments, tool selection." },
    ],
    inside: "Looker IDE in Dev Mode, SQL Runner, the Validator, GitHub PRs and Actions logs — the full path from branch to production.",
    outside:
      "They are why a data request takes a predictable week instead of an unpredictable month, and why a change to a shared metric does not quietly break forty dashboards. The lifecycle is the deliverable.",
    hiring_signal: [
      "Ask them to walk the lifecycle from request to production. If any phase is missing, that is where their org gets burned.",
      "Ask what their CI actually tests. 'It validates LookML' is syntax only — Explores must be tested against the live database.",
      "Ask about a change that passed CI and still broke something.",
      "Ask how they get privacy sign-off, and whether it happens before or after the code is written.",
    ],
  },

  sql_expert: {
    title: "SQL Expert",
    aka: ["database master", "sql developer", "sql", "database engineer", "dba", "query optimization", "database administrator"],
    cluster: "data_bi",
    bottom_line:
      "Most professionals write queries; an SQL expert knows what the database DOES with them. The distinguishing " +
      "skill is reading an execution plan — everything else follows from it. They are the final authority on data " +
      "retrieval, which in practice means they are the person called when something that used to take 2 seconds " +
      "now takes 4 minutes.",
    morning: [
      "Writing genuinely hard queries: window functions, recursive CTEs, dynamic SQL for shapes that cannot be known in advance.",
      "Auditing slow queries across the company — reading EXPLAIN plans to find the real cause rather than the obvious one.",
      "Index work: adding what is missing, and removing what is costing more on write than it saves on read.",
    ],
    afternoon: [
      "Schema design — tables, views, partitioning — deciding where normalisation helps and where it hurts.",
      "Reviewing other people's SQL before it reaches production, which is mostly catching accidental cross joins and non-sargable predicates.",
      "Explaining to a team why their query got slow when the data grew, and what to do about it structurally.",
    ],
    pillars: [
      {
        name: "Advanced SQL",
        what: "The language past the point most people stop learning.",
        skills: [
          "Window functions — running totals, rankings, gaps and islands, without a self-join.",
          "Recursive CTEs for hierarchies and graph walks.",
          "Dynamic SQL where the shape genuinely cannot be known ahead of time — and knowing it is an injection surface.",
        ],
      },
      {
        name: "Optimisation and internals",
        what: "The actual differentiator. Everything here is about what the engine does, not what the query says.",
        skills: [
          "Reading EXPLAIN / execution plans — spotting the scan that should be a seek, and the estimate that is wildly off.",
          "Index management: covering indexes, composite column order, and when an index is dead weight.",
          "Sargability — why a function wrapped around a column silently disables the index on it.",
          "Statistics and cardinality estimation, because a bad row estimate is the root of most bad plans.",
        ],
      },
      {
        name: "Dialects and modelling",
        what: "SQL is a standard the way English is a standard.",
        skills: [
          "T-SQL, PL/SQL and pgSQL differ in real ways — window frames, procedural syntax, and optimiser behaviour.",
          "Normalisation for integrity, denormalisation for read speed, and the judgment to know which the workload needs.",
          "Partitioning strategy — and knowing that partitioning the wrong column makes everything slower.",
        ],
      },
    ],
    levels: [
      { level: "Working knowledge", years: "0–2", focus: "Joins, aggregation, subqueries; can get the right answer." },
      { level: "Strong", years: "2–5", focus: "Window functions and CTEs; reads plans; designs sensible schemas." },
      { level: "Expert", years: "5+", focus: "Optimiser internals, partitioning strategy, cross-dialect fluency; the escalation point." },
    ],
    inside: "A query editor, an execution plan, and the statistics behind it — often the same query re-run twenty times with one thing changed.",
    outside:
      "They set the ceiling on what everyone else can build. A well-modelled, well-indexed warehouse makes every analyst and BI developer above it faster; a badly modelled one means all of them are firefighting forever.",
    hiring_signal: [
      "Ask them to walk through an execution plan. This one question separates real experts from people with years of query-writing.",
      "Ask when they would DENORMALISE. If normalisation is always the answer, they have only read the textbook.",
      "Ask about an index they removed and why.",
      "Ask what makes a predicate non-sargable — it is the single most common cause of an unused index.",
    ],
  },

  claude_architect: {
    title: "Claude Architect",
    aka: ["ai systems designer", "ai architect", "anthropic architect", "llm architect", "ai infrastructure architect"],
    cluster: "ai_engineering_ops",
    bottom_line:
      "Designs the infrastructure, security boundary and integrations for deploying Claude at enterprise scale. " +
      "The job is mostly TRADE-OFFS, not code: which model for which job, where data is allowed to flow, and what " +
      "it costs at a million requests instead of ten.",
    morning: [
      "Model selection per workload — the current lineup is Claude Opus 5 (the default for hard work), Claude Sonnet 5 (high-volume production), Claude Haiku 4.5 (fast, cheap, simple tasks), and Claude Fable 5 at the top for the most demanding reasoning. The decision is made on context window, latency and cost per task, not on a favourite.",
      "Designing secure data routing so private corporate data is not exposed where it should not be, and the boundary is documented rather than assumed.",
      "RAG architecture: chunking, embedding, retrieval quality, and honest evaluation of whether retrieval is actually helping.",
    ],
    afternoon: [
      "Enterprise API infrastructure — first-party Claude API, Claude Platform on AWS, Amazon Bedrock, Google Vertex AI, or Microsoft Foundry. They differ in auth, available features and model-ID format, and picking wrongly is expensive to undo.",
      "Cost management: prompt caching (a cache read is roughly a tenth of a fresh read), batch processing for anything not latency-sensitive, and effort/thinking settings tuned per route.",
      "Compliance and trust-and-safety review — data retention posture, region, and what the contract actually says.",
    ],
    pillars: [
      {
        name: "Model and cost architecture",
        what: "Choosing correctly, then making it affordable.",
        skills: [
          "Matching model tier to task — capability against latency and cost, measured rather than assumed.",
          "Prompt caching design: keeping the stable prefix first, because any byte change invalidates everything after it.",
          "Batch processing for non-interactive work, and token accounting good enough to see what is actually being spent.",
        ],
      },
      {
        name: "Retrieval and data architecture",
        what: "Getting the right context in front of the model.",
        skills: [
          "Vector databases (Pinecone, Milvus, pgvector) and the honest question of whether you need one.",
          "RAG design — chunking strategy, hybrid search, and evaluating retrieval quality separately from generation quality.",
          "Data routing and residency: what leaves the boundary, and what provably does not.",
        ],
      },
      {
        name: "Enterprise platform and security",
        what: "Making it deployable inside a company with real rules.",
        skills: [
          "Cloud platform choice and its consequences for auth, features and model IDs.",
          "Secrets, key rotation and least privilege — an AI system holds credentials like any other system.",
          "Retention, audit and the compliance story, ideally written before legal asks for it.",
        ],
      },
    ],
    levels: [
      { level: "Senior engineer moving in", years: "3–5", focus: "Designs a single production workload end to end." },
      { level: "Claude Architect", years: "5+", focus: "Multi-workload platform, cost governance, security boundary, model policy." },
      { level: "Principal / Head of AI Platform", years: "8+", focus: "Org-wide standards, vendor strategy, build-vs-buy." },
    ],
    inside: "Architecture diagrams, cost models, IAM policy, and a lot of measurement — token counts, latency percentiles, cache hit rates.",
    outside:
      "They decide whether AI at the company is a controlled capability or an ungoverned expense. The good ones are known for the thing that did not happen: no data incident, no runaway bill.",
    hiring_signal: [
      "Ask how they choose between model tiers. A real answer names the measurement; a weak one names a favourite model.",
      "Ask what their prompt cache hit rate is and how they know — if the answer is a shrug, nothing is being measured.",
      "Ask what data is allowed to leave the boundary and how that is enforced, not just stated.",
      "Ask about a cost surprise and what they changed structurally afterwards.",
    ],
  },

  claude_developer: {
    title: "Claude Developer",
    aka: ["ai application builder", "llm developer", "anthropic developer", "ai app developer", "claude api developer"],
    cluster: "ai_engineering_ops",
    bottom_line:
      "Writes the application code that turns a model into a working feature. The hard part is rarely the happy " +
      "path — it is streaming, retries, rate limits, structured output that must actually parse, and the failure " +
      "modes a demo never shows you.",
    morning: [
      "Backend code in Python, TypeScript or Node against the Anthropic SDK — the official SDK rather than hand-rolled HTTP, because the SDK already handles retries and backoff.",
      "System prompt and tool-definition work. Tool descriptions are where most tool-use bugs actually live: be prescriptive about WHEN to call a tool, not just what it does.",
      "Structured output via the schema-constrained format, rather than the old pattern of prompting for JSON and hoping it parses.",
    ],
    afternoon: [
      "Streaming responses so long outputs do not hit request timeouts and the user sees progress.",
      "Fail-safes: rate-limit handling, timeouts, and graceful degradation. Note the SDKs already auto-retry 429s and 5xx with backoff — reimplementing that badly is a common own-goal.",
      "Orchestration — the agentic loop. The SDK's tool runner handles request → execute → loop for tools you define; hand-writing that loop is now the exception, not the default.",
    ],
    pillars: [
      {
        name: "The API surface",
        what: "Knowing what the platform already does, so you do not rebuild it worse.",
        skills: [
          "Messages API: streaming, tool use, structured outputs, prompt caching, token counting.",
          "Typed exception handling — catch the specific error class, never string-match an error message.",
          "Knowing which surface fits: a single call, a workflow you orchestrate, or a hosted agent.",
        ],
      },
      {
        name: "Application engineering",
        what: "Ordinary backend skill, which is most of the job.",
        skills: [
          "Async programming — concurrency, backpressure, and not blocking on a slow call.",
          "REST APIs, auth, and secret handling that keeps keys out of source and out of logs.",
          "Parsing and validating model output at the boundary rather than trusting it downstream.",
        ],
      },
      {
        name: "Reliability and cost",
        what: "The difference between a demo and a product.",
        skills: [
          "Retry and fallback strategy, including what to do when a request is declined rather than failed.",
          "Prompt caching applied correctly — stable content first, volatile content last.",
          "Evals: a small set built from real failures, because you cannot improve what you do not measure.",
        ],
      },
    ],
    levels: [
      { level: "Junior", years: "0–2", focus: "Wire up API calls, basic prompts, ship a contained feature." },
      { level: "Mid-level", years: "2–5", focus: "Streaming, tool use, structured output, error handling, cost awareness." },
      { level: "Senior", years: "5+", focus: "Agentic architecture, evals, multi-model routing, production reliability." },
    ],
    inside: "Backend code, SDK calls, prompt files, tool schemas, and a logging setup that captures what the model actually returned.",
    outside:
      "They are the ones who turn 'the AI can do that' into something a customer can click. They also carry the honest news about what it cannot reliably do yet, which is the harder half of the job.",
    hiring_signal: [
      "Ask how they get reliable JSON. If the answer is prompt-and-pray plus a regex, they have not met structured outputs.",
      "Ask what they do on a rate limit — the good answer notes the SDK already retries and asks what happens after that.",
      "Ask how they evaluate a prompt change. 'It looked better' is not an evaluation.",
      "Ask about a production failure caused by trusting model output without validating it.",
    ],
  },

  claude_code_expert: {
    title: "Claude Code Expert",
    aka: ["ai augmented engineer", "claude code", "agentic coding", "ai pair programmer", "claude cli"],
    cluster: "ai_engineering_ops",
    bottom_line:
      "An already-strong software engineer who is fluent with agentic developer tools — the Claude Code CLI, IDE " +
      "extensions, and the Agent SDK. The leverage is real, but it rests on ordinary engineering judgment: the " +
      "bottleneck moves from writing code to REVIEWING it, and someone who cannot review fast and well gets no gain.",
    morning: [
      "Driving agentic tools directly against a repository — reading whole codebases, diagnosing bugs, running large refactors from the terminal.",
      "Writing and maintaining the project's agent configuration so the tool has the context it needs without being told twice.",
      "Reviewing generated changes properly. This is the actual skill; volume of generated code is not an achievement on its own.",
    ],
    afternoon: [
      "Test-driven work — having the agent write comprehensive tests, then verifying the tests are meaningful rather than tautological.",
      "Being the internal champion: showing colleagues what works, and being honest about what does not.",
      "Prompt technique. Worth knowing: XML tagging still helps for structure, but 'think step by step' is largely obsolete on current thinking models — reasoning depth is now a setting, not an incantation.",
    ],
    pillars: [
      {
        name: "Software engineering fundamentals",
        what: "Listed first deliberately. The tools amplify judgment; they do not supply it.",
        skills: [
          "Advanced Git — branching, bisect, untangling a bad merge, and reviewing a large diff without losing the thread.",
          "Debugging: forming a hypothesis and testing it, rather than asking for another attempt.",
          "TDD, and the taste to tell a real test from one that only asserts the code does what it does.",
        ],
      },
      {
        name: "Agentic tool fluency",
        what: "The tools themselves, and where their edges are.",
        skills: [
          "Command-line operation of agentic tools against real repositories.",
          "Large-scale refactoring and codebase-wide reading — the tasks with the clearest payoff.",
          "Knowing when NOT to use the agent: a one-line change you can make in five seconds does not need delegating.",
        ],
      },
      {
        name: "Prompt and context engineering",
        what: "Getting a good result on the first attempt rather than the fourth.",
        skills: [
          "Structuring context: what the model needs, where to put it, what to leave out.",
          "XML tagging and clear task specification — a well-specified first request beats three vague follow-ups.",
          "Knowing which older techniques are now dead weight; prompts written for older models often make current ones worse.",
        ],
      },
    ],
    levels: [
      { level: "Adopter", years: "—", focus: "Uses the tool for contained tasks; reviews everything closely." },
      { level: "Fluent", years: "1+ with the tools", focus: "Multi-file refactors, test generation, tuned project config." },
      { level: "Champion / Platform", years: "2+", focus: "Sets team practice, builds custom agents, measures whether it is actually helping." },
    ],
    inside: "A terminal, a repository, and a diff — plus the project's agent configuration, which is a real artefact worth maintaining.",
    outside:
      "They set how a team adopts these tools — and whether adoption raises throughput or just raises the volume of code nobody has properly read. The honest ones report the ceiling as well as the wins.",
    hiring_signal: [
      "Ask what they DON'T use the agent for. Everyone has a boundary; someone who claims none has not looked.",
      "Ask how they review generated code, since that is where the time actually goes now.",
      "Ask about a change the agent got confidently wrong and how they caught it.",
      "Ask what is in their project's agent config and why — a thoughtful answer shows they treat it as engineering, not magic.",
    ],
  },
};

const norm = (s: string) => s.toLowerCase().trim().replace(/[\s\-_/]+/g, "");

/** Resolve a query to a per-title role, if one exists. */
export function resolveRole(query: string): Role | undefined {
  const q = norm(query);
  if (!q) return undefined;
  for (const r of Object.values(ROLES)) {
    if (norm(r.title) === q || r.aka.some((a) => norm(a) === q)) return r;
  }
  // Looser: the query CONTAINS the title or a known alias ("what does a looker
  // developer actually do all day").
  //
  // LONGEST match wins, not the first one found. Returning the first hit made
  // the answer depend on declaration order, which broke as soon as two roles
  // shared a word: "end to end looker architect" matched the alias `looker` on
  // Looker Developer — declared earlier — and never reached Looker Architect.
  // Scoring by matched length makes the more specific role win regardless of
  // where it sits in the map, so adding a role can never silently steal
  // another's queries.
  // The loose pass must match on WORD BOUNDARIES, not on a raw substring of a
  // whitespace-stripped string. It did the latter, and `em` — an alias for
  // Engineering Manager — is two letters that occur inside ordinary English:
  //
  //   "how do I remember things better"   -> r-EM-ember      -> Engineering Manager
  //   "what is the temperature of the sun"-> t-EM-perature   -> Engineering Manager
  //   "help me with my email"             -> -EM-ail         -> Engineering Manager
  //   "explain quantum entanglement"      -> entangl-EM-ent  -> Engineering Manager
  //   day_in_the_life("systems_support")  -> syst-EM-ssupport-> Engineering Manager
  //
  // The last one is a cluster key the tool's own help text prints. Because this
  // fallback only fires when nothing else matched, its entire effect was to
  // replace an honest "couldn't tell which specialist this is" with a confident
  // wrong answer — the failure AGENTS.md forbids outright.
  //
  // So: match against the SPACED form with \b anchors, and require >= 4 chars.
  // Short aliases (em, pgm, tpm) stay reachable through the exact-match pass
  // above, which is the only place a two-letter alias can be meant literally.
  const spaced = query.toLowerCase().trim().replace(/[\s\-_/]+/g, " ");
  let best: Role | undefined;
  let bestLen = 0;
  for (const r of Object.values(ROLES)) {
    for (const candidate of [r.title, ...r.aka]) {
      const c = candidate.toLowerCase().trim().replace(/[\s\-_/]+/g, " ");
      if (c.length < 4 || c.length <= bestLen) continue;
      const anchored = new RegExp(`(^|\\W)${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`);
      if (anchored.test(spaced)) {
        best = r;
        bestLen = c.length;
      }
    }
  }
  return best;
}

export function renderRole(r: Role): string {
  return [
    `${r.title.toUpperCase()} — a day in the life`,
    `BOTTOM LINE: ${r.bottom_line}`,
    ``,
    `MORNING — code and optimisation:`,
    ...r.morning.map((m) => `  • ${m}`),
    ``,
    `AFTERNOON — collaboration and strategy:`,
    ...r.afternoon.map((m) => `  • ${m}`),
    ``,
    `THE THREE PILLARS — all three are required; most candidates have two:`,
    ...r.pillars.flatMap((p) => [
      ``,
      `  ▸ ${p.name}`,
      `    ${p.what}`,
      ...p.skills.map((s) => `      - ${s}`),
    ]),
    ``,
    `EXPERIENCE LEVELS:`,
    `  Level                Years   Focus`,
    ...r.levels.map((l) => `  ${l.level.padEnd(19)}  ${l.years.padEnd(6)}  ${l.focus}`),
    ``,
    ...(r.lifecycle?.length
      ? [
          ``,
          `THE LIFECYCLE THEY RUN EVERY TIME — this sequence IS the role:`,
          ...r.lifecycle.flatMap((p, i) => [
            ``,
            `  ${i + 1}. ${p.phase}`,
            `     ${p.what}`,
            ...(p.artifact ? [`     Artifact: ${p.artifact}`] : []),
          ]),
        ]
      : []),
    ``,
    `INSIDE THE TOOL: ${r.inside}`,
    ``,
    `OUTSIDE THE TOOL: ${r.outside}`,
    ``,
    `WHAT SEPARATES A REAL ONE FROM A RESUME:`,
    ...r.hiring_signal.map((h) => `  • ${h}`),
    ``,
    `Practice family: ${r.cluster} — ask for that cluster name to see the wider family this role sits in.`,
  ].join("\n");
}
