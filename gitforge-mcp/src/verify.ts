// check_practice / practice_verdict for the GitHub product surface. Git core is
// stable and answered directly; but GitHub Actions syntax, gh CLI flags, and new
// GitHub features move — so a "current syntax / current feature" question is the
// one thing this asset verifies via research instead of recalling.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

const SOURCES = [
  "git-scm.com/docs — the official Git reference and Pro Git book (Git core is stable; this is the source of truth for command behavior).",
  "docs.github.com — GitHub's own docs for Actions, the API, gh CLI, and security features (the product surface that actually changes).",
  "The GitHub Changelog (github.blog/changelog) — what shipped/changed recently; features and defaults move.",
  "cli.github.com/manual — current gh CLI commands and flags.",
  "The Actions marketplace / an action's own repo — the current version and inputs of a reusable action (pin the version).",
];

const RED_FLAGS = [
  "A tutorial using `git checkout` for everything — modern Git split it into `switch` (branches) and `restore` (files); old posts predate that.",
  "Actions YAML from an old blog treated as current — `on:` triggers, runner images, and node/action versions change; check the docs.",
  "`actions/checkout@v2`-era pins copied blindly — verify the current major version.",
  "Advice to `git push --force` on shared branches — a red flag for outdated or careless guidance; the safe form is `--force-with-lease`.",
  "Any 'delete the secret to fix the leak' advice — wrong; the answer is rotate. Distrust the source.",
];

export function checkPractice(rawTopic: string): string {
  const topic = clean(rawTopic);
  const year = new Date().getFullYear();
  return [
    `PRACTICE CHECK — "${topic}"`,
    `BOTTOM LINE: Git core behavior is stable and can be answered directly, but the GitHub product surface (Actions, gh CLI, features, defaults) moves — verify this against the sources below, then call practice_verdict.`,
    ``,
    `CHECK THESE SOURCES:`,
    ...SOURCES.map((s) => `  - ${s}`),
    ``,
    `RESEARCH QUERIES TO RUN:`,
    `  • "${topic}" site:docs.github.com`,
    `  • "${topic}" GitHub Actions syntax ${year}`,
    `  • "${topic}" deprecated OR breaking change GitHub`,
    `  • "${topic}" gh cli current command`,
    ``,
    `RED FLAGS to watch for in what comes back:`,
    ...RED_FLAGS.map((r) => `  - ${r}`),
    ``,
    `Once research reports back, call practice_verdict(topic, findings) for the graded, honest answer.`,
  ].join("\n");
}

export function practiceVerdict(rawTopic: string, findings: string): string {
  const topic = clean(rawTopic);
  const notes = clean(findings);
  return [
    `PRACTICE VERDICT — "${topic}"`,
    `BOTTOM LINE: grade how CURRENT and well-documented this is from what research found — separate official/current docs from stale blog syntax. Prefer the simplest correct command.`,
    ``,
    `Findings reported: ${notes || "(none provided — pass what research found)"}`,
    ``,
    `Evidence tiers, strongest to weakest:`,
    `  1. Official + current — git-scm.com or docs.github.com confirm the exact command/syntax/feature as current. Trust it.`,
    `  2. Official but version-specific — correct for a stated version; confirm it matches YOUR Git/Actions version.`,
    `  3. Community, plausible — a reputable write-up consistent with the docs; fine, but prefer the doc's phrasing.`,
    `  4. Stale — a tutorial using deprecated forms (bare \`checkout\`, old action majors, old runner images). Update it.`,
    `  5. Wrong/unsafe — force-push-on-shared or delete-the-secret advice. Don't follow it.`,
    ``,
    `Label the answer VERIFIED (docs confirm current), UPDATED (research found the current syntax differs from what was assumed — give the corrected command + source), or UNVERIFIED (couldn't confirm — say so). Git-core answers rarely need this; GitHub-surface answers usually do.`,
  ].join("\n");
}
