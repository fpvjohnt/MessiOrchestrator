// GIT & GITHUB — the version-control craft, everything included. Two lenses:
//   git    — the tool: the object model, branching, merge/rebase, undo/recovery,
//            history archaeology, conflicts, and the workflows teams actually run.
//   github — the platform on top of git: repos, pull requests, Actions/CI,
//            releases, the API + gh CLI, and repository security.
//
// SCOPE LINE: this asset owns Git and GitHub as a CRAFT — the commands, the
// mental model, the recovery moves, and the honest traps. It does NOT own
// generic "developer productivity as a career" (that's 'polymath'), CI as agent
// automation architecture (that's 'loop'), or how to WRITE the code being
// committed (that's 'aiforge'/'openai'/'polymath'). Git internals are rock-
// stable so they're stated plainly; fast-moving GitHub product surface (Actions
// syntax, new features, gh flags) is verified via check_practice → practice_verdict.
//
// Same reverse-index shape as aiforge's topics.ts, so "ask by any name" works and
// the regression harness auto-covers every topic.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type Area = "git" | "github";

export const AREA_LABELS: Record<Area, string> = {
  git: "Git — the tool",
  github: "GitHub — the platform",
};

export interface Topic {
  label: string;
  keys: string[];
  area: Area;
  what: string; // one-line, the BOTTOM LINE
  why: string;
  key_ideas: string[];
  how: string[]; // concrete commands / moves
  pitfalls: string[];
  handoff: string;
}

export const TOPICS: Record<string, Topic> = {
  // ── Git — the tool ────────────────────────────────────────────────────────
  git_basics: {
    label: "Git basics — the three trees",
    keys: ["gitbasics", "git", "commit", "staging", "stage", "add", "index", "workingtree", "repo", "repository", "status"],
    area: "git",
    what: "Git tracks snapshots of your project through three areas: the working tree (your files), the staging area/index (what you've marked to commit), and the repository (committed history).",
    why: "Almost every confusing Git moment ('why isn't my change in the commit?') dissolves once you can see which of the three trees a file is in.",
    key_ideas: [
      "Working tree → (git add) → staging/index → (git commit) → repository. A commit snapshots what's STAGED, not what's in your working tree.",
      "A commit is an immutable snapshot with a parent pointer, an author, and a message — history is a graph of these.",
      "`git status` is the map: it tells you what's staged, what's modified-but-unstaged, and what's untracked. Read it constantly.",
    ],
    how: [
      "`git status` (where is everything) → `git add <file>` (stage) → `git commit -m \"msg\"` (snapshot) → `git log` (see history).",
      "`git diff` shows unstaged changes; `git diff --staged` shows what's about to be committed — check before you commit.",
      "Write commit messages as an imperative summary line ('Add X', 'Fix Y') under ~50 chars, blank line, then why-not-what detail.",
    ],
    pitfalls: [
      "Editing a file after `git add` and expecting the new edit to be in the commit — it isn't; only what was staged is committed. Re-add.",
      "`git commit -am` only stages already-TRACKED files; brand-new files still need an explicit `git add`.",
      "Committing generated junk (node_modules, dist, secrets) — set up a `.gitignore` first.",
    ],
    handoff: "The GitHub side (push, PRs) → 'github_repos_prs' (this asset). What the object model IS underneath → 'git_internals' (this asset).",
  },
  git_branching: {
    label: "Branching — parallel lines of work",
    keys: ["branch", "branching", "branches", "checkout", "switch", "headref"],
    area: "git",
    what: "A branch is just a movable pointer to a commit. Branching lets you develop a feature in isolation, then merge it back — cheap, fast, and the heart of Git workflow.",
    why: "Branches are how teams work in parallel without stepping on each other. Understanding they're 'just pointers' removes most of the fear.",
    key_ideas: [
      "A branch is a lightweight, movable label on a commit; creating one is instant (no copying).",
      "HEAD is 'where you are' — usually pointing at a branch, which points at a commit.",
      "Merging brings another branch's commits into yours; a fast-forward just moves the pointer, a real merge creates a merge commit.",
    ],
    how: [
      "`git switch -c feature-x` (create + switch; modern form of `git checkout -b`). Do your work, commit.",
      "`git switch main` then `git merge feature-x` to integrate. Delete the merged branch: `git branch -d feature-x`.",
      "`git branch` lists; `git switch -` jumps back to the previous branch.",
    ],
    pitfalls: [
      "Committing on the wrong branch (or on a detached HEAD) — check `git status`/`git branch` before committing. (Recovery → git_undo_recovery.)",
      "Long-lived branches that drift far from main → painful merges. Integrate often.",
      "Confusing `switch` (change branch) with `restore` (discard file changes) — the old overloaded `checkout` did both, which is why they were split.",
    ],
    handoff: "Merge vs rebase and the golden rule → 'git_merge_rebase' (this asset). Team branching strategy → 'git_workflows' (this asset).",
  },
  git_merge_rebase: {
    label: "Merge vs rebase",
    keys: ["rebase", "merge", "mergevsrebase", "fastforward", "squash", "interactive", "rebasing", "integrate"],
    area: "git",
    what: "Two ways to combine branches: MERGE preserves history exactly and adds a merge commit; REBASE replays your commits on top of another branch for a linear history — but rewrites those commits.",
    why: "This is the most-argued Git topic. Knowing the trade and the ONE safety rule keeps you out of the worst self-inflicted messes.",
    key_ideas: [
      "Merge = truthful, non-destructive, but history has merge commits and can look tangled. Rebase = clean linear history, but it REWRITES commit hashes.",
      "THE GOLDEN RULE OF REBASE: never rebase commits you've already pushed and others may have based work on. Rebase local/private history only.",
      "Interactive rebase (`git rebase -i`) is the cleanup tool: squash, reword, reorder, drop commits before sharing them.",
      "Squash-merge (common on GitHub) collapses a PR's commits into one on main — tidy main, but you lose the granular history.",
    ],
    how: [
      "Integrate main into your feature safely: `git merge main` (preserves) OR `git rebase main` (linear, only if your branch isn't shared).",
      "Clean up your local commits before a PR: `git rebase -i main` → mark commits `squash`/`reword`.",
      "If a rebase goes wrong mid-way: `git rebase --abort` returns you to exactly where you started.",
    ],
    pitfalls: [
      "Rebasing shared/pushed history, then force-pushing — you rewrite commits teammates have, creating duplicate-commit chaos. The golden rule exists for this.",
      "`git push --force` after a rebase clobbering others' work — use `git push --force-with-lease`, which refuses if someone else pushed.",
      "Believing 'rebase is dangerous' as a blanket rule — it's safe and great on PRIVATE history; only shared history is the hazard.",
    ],
    handoff: "Recovering from a bad rebase/force-push → 'git_undo_recovery' (this asset). PR merge strategies on GitHub → 'github_repos_prs' (this asset).",
  },
  git_undo_recovery: {
    label: "Undo & recovery — reflog, reset, revert, restore",
    keys: ["undo", "recovery", "reflog", "reset", "revert", "restore", "lostcommit", "recover", "amend", "unstage", "hardreset"],
    area: "git",
    what: "Git almost never truly loses committed work. The recovery toolkit — reflog, reset, revert, restore — gets you out of nearly any mess, including 'I ran reset --hard and lost everything'.",
    why: "This is the most valuable Git knowledge there is: the confidence that a mistake is recoverable turns Git from scary into safe.",
    key_ideas: [
      "`git reflog` is the safety net: it records where HEAD has been, so 'lost' commits after a bad reset/rebase are still reachable by hash for ~90 days.",
      "reset moves your branch pointer: `--soft` (keep changes staged), `--mixed`/default (keep changes unstaged), `--hard` (discard changes — the dangerous one).",
      "revert makes a NEW commit that undoes an old one — the safe, shareable undo for already-pushed history (doesn't rewrite).",
      "restore/checkout discards uncommitted file changes; amend fixes the LAST commit's message or contents.",
    ],
    how: [
      "Undo last commit but keep the work: `git reset --soft HEAD~1`. Undo a PUSHED commit safely: `git revert <hash>`.",
      "Recover after `reset --hard`: `git reflog` → find the pre-reset hash → `git reset --hard <hash>` (or `git checkout <hash>`).",
      "Fix the last commit message: `git commit --amend`. Unstage a file: `git restore --staged <file>`. Discard a file's edits: `git restore <file>`.",
    ],
    pitfalls: [
      "`git reset --hard` discards uncommitted changes with no reflog entry for them — UNCOMMITTED work is the one thing Git can't always recover. Commit or stash first.",
      "Using reset (rewrites history) on shared branches instead of revert (safe) — reset shared history and you're back in force-push trouble.",
      "Panicking and running more destructive commands — STOP, run `git reflog`, the commit is almost certainly still there.",
    ],
    handoff: "Why reflog can find 'deleted' commits (they're still objects) → 'git_internals' (this asset). Force-push safety → 'git_merge_rebase' (this asset).",
  },
  git_history: {
    label: "History archaeology — log, diff, blame, bisect",
    keys: ["log", "history", "blame", "bisect", "diff", "show", "pickaxe", "whochanged", "whenbroke"],
    area: "git",
    what: "The tools for answering 'what changed, when, why, and who' — and 'which commit introduced this bug': log, diff, show, blame, and the binary-search superpower, bisect.",
    why: "Reading history well is how you understand an inherited codebase and hunt regressions without guessing.",
    key_ideas: [
      "`git log` with the right flags is a query engine: by file, by author, by date, by content (`-S`/pickaxe finds when a string appeared/vanished).",
      "`git blame <file>` shows who last touched each line and in which commit — the entry point for 'why is this here?'.",
      "`git bisect` binary-searches history to find the exact commit that broke something — O(log n) commits instead of eyeballing.",
    ],
    how: [
      "Explore: `git log --oneline --graph --all` (the shape), `git log -p <file>` (a file's evolution), `git log -S\"someText\"` (when text changed).",
      "`git show <hash>` inspects any single commit. `git blame -L 40,60 <file>` blames just those lines.",
      "Find a regression: `git bisect start` → `git bisect bad` (now) → `git bisect good <old-hash>` → test each checkout, mark good/bad → Git names the culprit.",
    ],
    pitfalls: [
      "Blaming the person in `git blame` — it shows who last TOUCHED the line (often a reformat/move), not who wrote the logic. It's a pointer to a commit, not a verdict.",
      "Bisecting without a reliable good/bad test — a flaky test misleads the search. Automate it with `git bisect run <script>` when you can.",
      "Forgetting `git bisect reset` when done, leaving yourself on a detached checkout.",
    ],
    handoff: "The GitHub UI for the same (blame view, PR history) → 'github_repos_prs' (this asset). Debugging the code itself → 'aiforge debug' / 'polymath'.",
  },
  git_conflicts_stash: {
    label: "Merge conflicts & stashing",
    keys: ["conflict", "conflicts", "mergeconflict", "stash", "resolve", "conflictmarkers", "wip", "shelve"],
    area: "git",
    what: "A conflict happens when two branches change the same lines and Git can't auto-merge — you resolve by choosing/combining. Stash shelves half-done work so you can switch context cleanly.",
    why: "Conflicts panic beginners but are mechanical once you understand the markers. Stash is the escape hatch for 'I need to switch branches but I'm mid-change'.",
    key_ideas: [
      "Conflict markers `<<<<<<<`, `=======`, `>>>>>>>` bracket the two sides (yours vs theirs). You edit to the final desired result, remove the markers, then stage.",
      "A conflict is not an error — it's Git asking you to make a decision it can't make safely.",
      "`git stash` saves your uncommitted changes and reverts to a clean tree; `git stash pop` re-applies them. A LIFO stack of shelved work.",
    ],
    how: [
      "Resolve: open each conflicted file, edit to the intended result, remove all markers, `git add <file>`, then `git merge --continue` (or `rebase --continue`).",
      "Bail out of a bad merge: `git merge --abort`. Use a mergetool for big conflicts: `git mergetool`.",
      "Shelve work to switch tasks: `git stash push -m \"wip\"` → do the other thing → `git stash pop`. `git stash list` shows the stack.",
    ],
    pitfalls: [
      "Committing with conflict markers still in the file — always search for `<<<<<<<` before staging; the code won't even compile with them.",
      "`git stash pop` onto a different branch causing new conflicts, or forgetting stashed work (`git stash list`) and losing track of it.",
      "Resolving by blindly 'accept theirs'/'accept mine' without reading — you can silently drop a needed change.",
    ],
    handoff: "Merge vs rebase (which produces fewer conflicts for you) → 'git_merge_rebase' (this asset). Resolving PR conflicts on GitHub → 'github_repos_prs' (this asset).",
  },
  git_internals: {
    label: "Git internals — objects, refs, HEAD",
    keys: ["internals", "objects", "blob", "tree", "sha", "hash", "refs", "detachedhead", "plumbing", "contentaddressable"],
    area: "git",
    what: "Under the porcelain, Git is a tiny content-addressable database of four object types (blob, tree, commit, tag) plus refs (branch/tag pointers). Knowing this demystifies everything above it.",
    why: "Every confusing behavior — detached HEAD, why reflog recovers commits, why rebase makes new hashes — is obvious once you see the object model.",
    key_ideas: [
      "Objects, all keyed by the SHA of their content: BLOB (file contents), TREE (a directory listing of blobs/trees), COMMIT (a tree snapshot + parent(s) + author + message), TAG (a named pointer).",
      "Because objects are content-addressed, identical content = identical hash, and nothing is ever edited in place — changes create NEW objects (old ones linger, which is why reflog can recover them).",
      "Refs are just files holding a hash: a branch (`refs/heads/main`), a tag, HEAD. Moving a branch = rewriting that pointer.",
      "'Detached HEAD' = HEAD points directly at a commit instead of at a branch. Commits you make there aren't on any branch and can be 'lost' (but reflog remembers).",
    ],
    how: [
      "Peek: `git cat-file -p <hash>` prints any object; `git rev-parse HEAD` shows where you are; `.git/refs/` and `.git/HEAD` are just text files.",
      "When you see 'detached HEAD', create a branch to keep the work: `git switch -c <name>` before moving.",
      "Trust the model: a rebase makes NEW commit objects (new hashes) because a commit's hash depends on its parent + content — that's why shared rebases are disruptive.",
    ],
    pitfalls: [
      "Fearing detached HEAD — it's fine to look around in one; just make a branch before you commit work you want to keep.",
      "Assuming a rebased/amended commit is 'the same commit' — it's a new object with a new hash; anything referencing the old hash now diverges.",
      "Manually editing files in `.git/` — almost never necessary and easy to corrupt; use the porcelain commands.",
    ],
    handoff: "How this enables recovery → 'git_undo_recovery' (this asset). Merge/rebase hash-rewriting → 'git_merge_rebase' (this asset).",
  },
  git_workflows: {
    label: "Team workflows & commit hygiene",
    keys: ["workflow", "workflows", "gitflow", "trunkbased", "featurebranch", "commithygiene", "conventionalcommits", "branchstrategy", "smallcommits"],
    area: "git",
    what: "The conventions teams agree on so history stays legible and releases stay sane: a branching strategy (feature-branch, trunk-based, GitFlow) plus commit hygiene.",
    why: "Git's mechanics are neutral; the workflow is what makes a team fast or tangled. Picking a simple one and keeping commits clean pays off forever.",
    key_ideas: [
      "Feature-branch + PR (the GitHub default): branch off main, open a PR, review, merge. Simple and universal.",
      "Trunk-based: everyone commits to main frequently behind feature flags; favored for continuous delivery. Minimal long-lived branches.",
      "GitFlow: heavyweight (develop/release/hotfix branches) — fits scheduled releases, overkill for most web/product teams.",
      "Commit hygiene: small, focused commits with clear messages; one logical change per commit; don't mix a refactor with a feature.",
    ],
    how: [
      "Default to feature-branch + PR unless you have a reason not to; keep branches short-lived and rebase/merge main in often.",
      "Clean up messy local commits before opening the PR (`git rebase -i`); consider Conventional Commits (`feat:`/`fix:`) if you automate changelogs.",
      "Protect main (require PRs + review + green CI) so the workflow is enforced, not just hoped for → 'github_security'.",
    ],
    pitfalls: [
      "Adopting GitFlow's full ceremony for a small team that ships continuously — process cost with no payoff.",
      "Giant 'misc fixes' commits and PRs — impossible to review or revert cleanly. Keep them small and scoped.",
      "Long-lived divergent branches → merge hell. Integrate early and often.",
    ],
    handoff: "Enforcing the workflow (branch protection, required reviews) → 'github_security' (this asset). CI on every PR → 'github_actions' (this asset).",
  },

  // ── GitHub — the platform ─────────────────────────────────────────────────
  github_repos_prs: {
    label: "Repos, forks & pull requests",
    keys: ["github", "pullrequest", "pr", "prs", "fork", "forks", "review", "codereview", "push", "clone", "remote", "origin", "upstream"],
    area: "github",
    what: "GitHub hosts your git repo and adds collaboration: pull requests (propose + review + merge a branch), forks (your own copy of someone else's repo), and code review.",
    why: "The PR is the unit of collaboration on GitHub — how change gets reviewed and merged. Forks are how open-source contribution works.",
    key_ideas: [
      "Git is the tool (local, distributed); GitHub is a HOSTING PLATFORM built on git. They are not the same thing — git works fine with no GitHub.",
      "A pull request proposes merging one branch into another, with review, discussion, and CI attached. Merge options: merge commit, squash, or rebase.",
      "Fork + PR is the open-source flow: fork the repo, branch, push to your fork, open a PR to upstream. Keep your fork synced with upstream.",
      "`origin` is your remote (usually your fork/repo); `upstream` is the original you forked from.",
    ],
    how: [
      "`git clone <url>` → branch → commit → `git push -u origin <branch>` → open a PR on GitHub (or `gh pr create`).",
      "Keep a fork current: add `upstream` remote, `git fetch upstream`, `git merge upstream/main` (or rebase).",
      "Review well: read the diff not the description, run it if you can, comment on specific lines, approve/request-changes.",
    ],
    pitfalls: [
      "Thinking 'push' = 'PR' — pushing a branch just uploads commits; a PR is a separate, explicit proposal to merge.",
      "PRs too big to review meaningfully — keep them small and single-purpose (ties to commit hygiene).",
      "Committing straight to main and bypassing review — set branch protection so PRs are required → 'github_security'.",
    ],
    handoff: "Automating PR creation/review from the terminal → 'github_api_cli' (this asset). Local branch mechanics → 'git_branching' (this asset).",
  },
  github_actions: {
    label: "GitHub Actions — CI/CD",
    keys: ["actions", "githubactions", "ci", "cd", "cicd", "pipeline", "runner", "yaml", "build", "deploy"],
    area: "github",
    what: "GitHub Actions runs automated workflows (test, build, deploy) on events like push and pull_request, defined in YAML under `.github/workflows/`, executed on runners.",
    why: "It's how you get automatic testing on every PR and automated releases/deploys — the CI/CD backbone for anything hosted on GitHub.",
    key_ideas: [
      "A workflow (`.github/workflows/*.yml`) has triggers (`on:`), jobs (run in parallel by default), and steps (run sequentially); steps use `run:` (shell) or `uses:` (a reusable action).",
      "Runners are the machines that execute jobs (GitHub-hosted Ubuntu/Windows/macOS, or self-hosted). Each job starts on a fresh runner.",
      "Secrets (API keys, tokens) live in repo/org settings and are injected as `${{ secrets.NAME }}` — never hard-coded in the YAML.",
      "Common shape: on pull_request → checkout → set up runtime → install → test; on push to a tag → build → publish.",
    ],
    how: [
      "Start from a template in the repo's Actions tab, or write `.github/workflows/ci.yml` with `on: [pull_request]` and a test job.",
      "Pin action versions (`actions/checkout@v4`) and cache dependencies to keep runs fast.",
      "Gate merges on green CI via branch protection (→ github_security). Store credentials as encrypted secrets, scope tokens minimally.",
    ],
    pitfalls: [
      "Printing secrets to logs, or using a secret in a workflow triggered by untrusted forks (`pull_request_target` misuse) — a real exfiltration risk.",
      "Unpinned third-party actions (`@main`) — you're running whatever they push next; pin to a version/SHA.",
      "Actions syntax and available runners/features change — verify current YAML against docs → check_practice.",
    ],
    handoff: "CI as part of an autonomous agent LOOP (automations/heartbeat) → 'loop building_blocks'. Securing the pipeline → 'github_security' (this asset).",
  },
  github_releases_issues: {
    label: "Releases, tags, issues & projects",
    keys: ["release", "releases", "tag", "tags", "semver", "issue", "issues", "milestone", "project", "projects", "changelog", "label"],
    area: "github",
    what: "The project-management surface: tags + releases (versioned, downloadable snapshots), issues (bugs/tasks/discussion), and Projects (boards that organize them).",
    why: "This is how work is tracked and how versions are published. Tags/releases especially are the durable, citable markers of 'what shipped when'.",
    key_ideas: [
      "A tag marks a commit (usually a version, `v1.2.0` — semantic versioning: MAJOR.MINOR.PATCH). A GitHub Release wraps a tag with notes and assets.",
      "Issues are the unit of work/discussion; labels, milestones, and assignees organize them. They cross-link to PRs ('Fixes #123' auto-closes on merge).",
      "Projects are boards (kanban/table) that pull issues + PRs into a planning view.",
      "Release notes / changelogs can be auto-generated from merged PRs (especially with Conventional Commits).",
    ],
    how: [
      "Tag + release: `git tag -a v1.2.0 -m \"...\"` → `git push --tags` → draft a Release on GitHub (or `gh release create v1.2.0`).",
      "Link work: put 'Fixes #123' in a PR description so merging closes the issue automatically.",
      "Use milestones for 'what's in this version' and labels (`bug`, `good first issue`) for triage.",
    ],
    pitfalls: [
      "Moving/retagging a published tag — people may have pulled it; treat released tags as immutable (cut a new version instead).",
      "Inconsistent version bumps that break semver expectations (a breaking change in a PATCH release).",
      "Issue sprawl with no labels/triage — a graveyard nobody reads.",
    ],
    handoff: "Automating releases in CI → 'github_actions' (this asset). Version-bump conventions from commits → 'git_workflows' (this asset).",
  },
  github_api_cli: {
    label: "The GitHub API & gh CLI",
    keys: ["api", "ghcli", "gh", "restapi", "graphql", "automation", "webhook", "webhooks", "token", "pat", "octokit"],
    area: "github",
    what: "Everything GitHub does in the UI is scriptable: the `gh` CLI for the terminal, plus the REST and GraphQL APIs for full automation, driven by tokens.",
    why: "For repetitive or programmatic work — bulk operations, bots, CI glue, dashboards — the API/CLI turns clicking into code.",
    key_ideas: [
      "`gh` (official CLI) covers the common flows: `gh pr create/checkout/view`, `gh issue`, `gh release`, `gh repo clone`, `gh run` — authenticated once with `gh auth login`.",
      "Two APIs: REST (simple, resource-oriented) and GraphQL (ask for exactly the fields you want in one call — great for complex reads).",
      "Auth is via tokens: a fine-grained Personal Access Token or, better inside Actions, the auto-provided `GITHUB_TOKEN` (short-lived, scoped).",
      "Webhooks push events (a PR opened, a push) to your endpoint — the event-driven complement to polling the API.",
    ],
    how: [
      "Terminal-first: `gh auth login`, then `gh pr create`, `gh pr checkout <n>`, `gh run watch`. Scriptable and fast.",
      "For programmatic access use a fine-grained PAT with the MINIMUM scopes needed; in Actions prefer `GITHUB_TOKEN` over a personal PAT.",
      "Reach for GraphQL when a REST call would need many round-trips; REST for simple one-offs.",
    ],
    pitfalls: [
      "Leaking a token — never commit one or print it in logs; scope it minimally and rotate if exposed. (This is exactly the 'don't paste your key' rule.)",
      "Ignoring rate limits on the API — batch, cache, and use conditional requests; GraphQL to cut call count.",
      "gh flags and API endpoints evolve — verify current syntax → check_practice.",
    ],
    handoff: "Token/secret handling as a security matter → 'github_security' (this asset). Testing/automating any HTTP API (incl. GitHub's) with Postman → 'apiforge'.",
  },
  github_security: {
    label: "Repository security & branch protection",
    keys: ["security", "branchprotection", "secrets", "dependabot", "codescanning", "secretscanning", "signedcommits", "2fa", "codeowners", "supplychain"],
    area: "github",
    what: "The guardrails that keep a repo safe: branch protection (require PRs/reviews/green CI), secret management, and automated scanning (Dependabot, code/secret scanning).",
    why: "A repo is an attack surface — leaked secrets, malicious dependencies, unreviewed pushes to main. These features are how you enforce safety instead of hoping for it.",
    key_ideas: [
      "Branch protection on main: require a PR, require review + passing CI, disallow force-push — turns your workflow into an enforced rule.",
      "Secrets belong in encrypted repo/org/environment settings and are injected at runtime; NEVER in the code or the YAML. Secret scanning catches leaks.",
      "Dependabot flags/updates vulnerable dependencies; code scanning (CodeQL) finds vulnerable patterns in your code.",
      "CODEOWNERS auto-requests the right reviewers; signed commits + 2FA raise the bar on identity.",
    ],
    how: [
      "Protect main: Settings → Branches → require PR + review + status checks + no force-push. Add a CODEOWNERS file for auto-review routing.",
      "Enable Dependabot alerts + security updates and secret scanning in repo settings; add a CodeQL workflow for code scanning.",
      "If a secret is ever committed: rotate it immediately (assume it's compromised — history is forever), then purge if needed.",
    ],
    pitfalls: [
      "Assuming deleting a committed secret from the latest commit removes it — it's still in history (and likely already scraped). ROTATE it, don't just delete.",
      "Protecting main but letting Actions run untrusted fork PRs with secrets — a known exfiltration path (→ github_actions).",
      "Over-broad tokens/permissions — grant the least privilege that works.",
    ],
    handoff: "Token scoping for automation → 'github_api_cli' (this asset). Enforcing PR review as a workflow → 'git_workflows' (this asset). The 'never paste your key' rule generally → 'apiforge'.",
  },
};

export function resolveTopic(input: string): string | undefined {
  const q = normalize(input);
  if (!q) return undefined;
  if (TOPICS[q]) return q;
  for (const [key, t] of Object.entries(TOPICS)) {
    if (normalize(key) === q) return key;
    if (normalize(t.label) === q) return key;
    if (t.keys.some((k) => normalize(k) === q)) return key;
  }
  const scored: Array<{ key: string; len: number }> = [];
  for (const [key, t] of Object.entries(TOPICS)) {
    for (const k of [key, ...t.keys]) {
      const nk = normalize(k);
      if (nk.length >= 3 && (q.includes(nk) || nk.includes(q))) scored.push({ key, len: nk.length });
    }
  }
  if (!scored.length) return undefined;
  scored.sort((a, b) => b.len - a.len);
  return scored[0].key;
}

function topicsByArea(area: Area): string[] {
  return Object.entries(TOPICS)
    .filter(([, t]) => t.area === area)
    .map(([k]) => k);
}

export function explainTopic(topic?: string): string {
  if (!topic) {
    const areas = Object.keys(AREA_LABELS) as Area[];
    return [
      `GIT & GITHUB — the version-control craft, everything included`,
      `BOTTOM LINE: Git is the TOOL (local, distributed, rock-stable); GitHub is a PLATFORM on top of it. Pick a topic — the 'pitfalls' are the part worth reading, and the recovery moves are the most valuable thing here.`,
      ``,
      ...areas.flatMap((area) => [
        `${AREA_LABELS[area]}:`,
        ...topicsByArea(area).map((k) => `  ▸ ${TOPICS[k].label} — 'explain_topic ${k}'`),
        ``,
      ]),
      `Other tools: how_to <goal> (the exact commands for a task), debug <symptom>, myth_vs_reality, and check_practice → practice_verdict for the fast-moving GitHub surface (Actions syntax, gh flags, new features).`,
      ``,
      `SCOPE: Git & GitHub as a craft. Writing the code you commit → 'aiforge'/'openai'/'polymath'. CI as agent-automation architecture → 'loop'. Dev-career questions → 'polymath'.`,
    ].join("\n");
  }
  const key = resolveTopic(topic);
  if (!key) {
    return `Not sure which Git/GitHub topic "${clean(topic)}" is. Topics: ${Object.values(TOPICS)
      .map((t) => t.label)
      .join(", ")}.`;
  }
  const t = TOPICS[key];
  return [
    `${t.label}  [${AREA_LABELS[t.area]}]${normalize(topic) !== normalize(key) ? ` (from "${clean(topic)}")` : ""}`,
    `BOTTOM LINE: ${t.what}`,
    ``,
    `Why it matters: ${t.why}`,
    ``,
    `The key ideas:`,
    ...t.key_ideas.map((k) => `  • ${k}`),
    ``,
    `How you actually do it:`,
    ...t.how.map((h) => `  → ${h}`),
    ``,
    `⚠ PITFALLS that burn people:`,
    ...t.pitfalls.map((p) => `  ✗ ${p}`),
    ``,
    `Handoff: ${t.handoff}`,
    ``,
    `Git internals are stable; the GitHub product surface (Actions, gh, features) moves — verify version-specific specifics via check_practice → practice_verdict, never recalled.`,
  ].join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is the Git & GitHub expert — everything included, from the object model to Actions. The single most valuable thing here is the RECOVERY toolkit: Git almost never truly loses committed work, and knowing that makes it safe instead of scary.`,
    ``,
    `TWO LENSES:`,
    `  • GIT (the tool) — basics/the three trees, branching, merge-vs-rebase, undo & recovery (reflog/reset/revert/restore), history archaeology (log/blame/bisect), conflicts & stash, internals (objects/refs/HEAD), team workflows → 'explain_topic git'.`,
    `  • GITHUB (the platform) — repos/forks/PRs, Actions (CI/CD), releases/tags/issues, the API & gh CLI, and repository security → 'explain_topic github'.`,
    ``,
    `THE TOOLS:`,
    `  • 'explain_topic <topic>' — the front door; no arg for the full map.`,
    `  • 'how_to <goal>' — the exact commands for a task ('undo my last commit', 'open a PR', 'fix a merge conflict', 'recover lost work').`,
    `  • 'debug <symptom>' — detached HEAD, push rejected, merge conflict, committed to the wrong branch, 'I lost my work'.`,
    `  • 'myth_vs_reality' — 'rebase is dangerous', 'force-push is always bad', 'Git and GitHub are the same', 'a reset --hard deletes commits forever'.`,
    `  • 'check_practice' → 'practice_verdict' — the fast-moving GitHub surface (Actions YAML, gh flags, new features), verified via research.`,
    ``,
    `THE ONE RULE THAT PREVENTS THE MOST PAIN: never rewrite history (rebase/reset/amend) that you've already pushed and others may have. Rewrite private/local history freely; treat shared history as append-only (use revert). And if you think you lost work — STOP and run 'git reflog' before anything else.`,
    ``,
    `SCOPE: Git & GitHub as a craft — not how to write the code (that's aiforge/openai/polymath), not CI-as-agent-architecture (loop), not dev careers (polymath).`,
  ].join("\n");
}
