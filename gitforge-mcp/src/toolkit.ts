// how_to / debug / myth_vs_reality for Git & GitHub. Deterministic and offline.
// how_to maps a plain-language goal to the exact commands (with the safe variant
// called out); debug maps a symptom to cause + fix in order; myth_vs_reality
// debunks the folklore that scares people away from Git's most useful features.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

// ── how_to ──────────────────────────────────────────────────────────────────
interface Recipe {
  match: (t: string) => boolean;
  title: string;
  steps: string[];
  note?: string;
}

const RECIPES: Recipe[] = [
  {
    match: (t) => has(t, "undo last commit", "undo my last commit", "undo commit", "uncommit", "remove last commit"),
    title: "Undo the last commit",
    steps: [
      "Keep the changes (just un-commit): `git reset --soft HEAD~1` — the work stays staged.",
      "Keep changes but unstage them: `git reset HEAD~1` (default --mixed).",
      "Discard the commit AND the changes (careful): `git reset --hard HEAD~1`.",
      "If it's ALREADY PUSHED, don't reset — undo safely with a new commit: `git revert HEAD`.",
    ],
    note: "reset rewrites history (only for local/unshared commits); revert is the safe undo for pushed commits.",
  },
  {
    match: (t) => has(t, "amend", "fix last commit message", "change commit message", "wrong commit message"),
    title: "Fix the last commit (message or contents)",
    steps: [
      "Message only: `git commit --amend` (opens editor) or `git commit --amend -m \"new message\"`.",
      "Forgot a file: stage it (`git add <file>`) then `git commit --amend --no-edit`.",
      "If already pushed, amending rewrites history → you'll need `git push --force-with-lease` (only if the branch is yours).",
    ],
  },
  {
    match: (t) => has(t, "recover", "lost work", "lost my", "lost commit", "deleted commit", "gone after reset", "get back"),
    title: "Recover lost commits",
    steps: [
      "STOP making changes. Run `git reflog` — it lists every position HEAD has been, with hashes.",
      "Find the hash from before the mistake, then: `git reset --hard <hash>` (or `git checkout <hash>` to inspect, then branch).",
      "For a lost branch tip: `git branch <name> <hash>` recreates it.",
    ],
    note: "This works for COMMITTED work (kept ~90 days). Uncommitted changes wiped by reset --hard are the one thing reflog can't recover.",
  },
  {
    match: (t) => has(t, "open a pr", "pull request", "create pr", "submit pr", "propose change"),
    title: "Open a pull request",
    steps: [
      "Branch + commit: `git switch -c my-change` → make changes → `git commit -m \"...\"`.",
      "Push the branch: `git push -u origin my-change`.",
      "Open the PR: on GitHub click 'Compare & pull request', or from the terminal `gh pr create --fill`.",
      "Keep it small and single-purpose so it's actually reviewable.",
    ],
  },
  {
    match: (t) => has(t, "merge conflict", "fix conflict", "resolve conflict", "conflict marker"),
    title: "Resolve a merge conflict",
    steps: [
      "`git status` lists the conflicted files. Open each one.",
      "Find the markers `<<<<<<<`, `=======`, `>>>>>>>`; edit to the FINAL intended result and delete all three markers.",
      "Stage the resolved file: `git add <file>`. Repeat for each.",
      "Finish: `git merge --continue` (or `git rebase --continue`). To bail entirely: `git merge --abort`.",
    ],
    note: "Always search for `<<<<<<<` before committing — the code won't compile with markers left in.",
  },
  {
    match: (t) => has(t, "wrong branch", "committed to main", "committed on the wrong", "move commit to another branch"),
    title: "Move a commit made on the wrong branch",
    steps: [
      "Create/point the right branch at your current state: `git branch correct-branch`.",
      "Reset the wrong branch back: `git reset --hard HEAD~1` (removes the commit from here — do this only if it's unpushed).",
      "Switch over and continue: `git switch correct-branch`.",
      "Alternative: `git switch correct-branch && git cherry-pick <hash>` then remove it from the wrong branch.",
    ],
  },
  {
    match: (t) => has(t, "stash", "switch branch mid", "save work in progress", "shelve"),
    title: "Shelve half-done work to switch branches",
    steps: [
      "`git stash push -m \"wip: what it is\"` — saves uncommitted changes, cleans the tree.",
      "Do the other thing, then come back and `git stash pop` to re-apply.",
      "`git stash list` shows the stack; `git stash show -p` previews one.",
    ],
  },
  {
    match: (t) => has(t, "sync fork", "update fork", "fork behind", "upstream"),
    title: "Sync a fork with upstream",
    steps: [
      "Add the original once: `git remote add upstream <original-repo-url>`.",
      "Fetch + integrate: `git fetch upstream` then `git merge upstream/main` (or `git rebase upstream/main`).",
      "Push to your fork: `git push origin main`. (Or use GitHub's 'Sync fork' button / `gh repo sync`.)",
    ],
  },
  {
    match: (t) => has(t, "undo a pushed", "revert", "undo a merge", "undo published"),
    title: "Safely undo an already-pushed commit",
    steps: [
      "`git revert <hash>` creates a NEW commit that undoes it — safe on shared history, no rewrite.",
      "Undo a pushed merge: `git revert -m 1 <merge-hash>` (the -m picks the mainline parent).",
      "Push the revert normally: `git push`.",
    ],
    note: "Prefer revert over reset for anything already pushed — reset + force-push disrupts everyone who pulled.",
  },
  {
    match: (t) => has(t, "ignore", "gitignore", "stop tracking", "untrack"),
    title: "Ignore files / stop tracking something already committed",
    steps: [
      "Add the pattern to `.gitignore` (e.g. `node_modules/`, `.env`, `dist/`).",
      "If it's already tracked, ignore won't retroactively apply — untrack it: `git rm --cached <file>` then commit.",
      "Verify nothing sensitive remains in history; a committed secret must be ROTATED (history is forever).",
    ],
  },
];

export function howTo(rawGoal: string): string {
  const goal = clean(rawGoal).toLowerCase();
  const hit = RECIPES.find((r) => r.match(goal));
  if (!hit) {
    return [
      `HOW TO — "${clean(rawGoal)}"`,
      `No exact recipe matched. Common goals I have step-by-steps for:`,
      ...RECIPES.map((r) => `  • ${r.title}`),
      ``,
      `Rephrase toward one of those, or use 'explain_topic <topic>' for the concept. For the GitHub product surface (Actions YAML, gh flags), 'check_practice' verifies the current syntax.`,
    ].join("\n");
  }
  return [
    `HOW TO — ${hit.title}`,
    `BOTTOM LINE: the safe path first; the history-rewriting variant is called out where it matters.`,
    ``,
    `Steps:`,
    ...hit.steps.map((s) => `  ${s}`),
    ...(hit.note ? ["", `⚠ ${hit.note}`] : []),
    ``,
    `The golden rule underneath all of this: rewrite PRIVATE history freely; never rewrite history you've already pushed and shared — use revert there.`,
  ].join("\n");
}

// ── debug ─────────────────────────────────────────────────────────────────
interface Symptom {
  keys: string[];
  title: string;
  cause: string;
  fix: string[];
}

const SYMPTOMS: Symptom[] = [
  {
    keys: ["detached head", "detached", "not on a branch", "head detached"],
    title: "Detached HEAD",
    cause: "HEAD points directly at a commit instead of a branch (you checked out a hash/tag). Commits made here belong to no branch and can feel 'lost'.",
    fix: [
      "If you just want to look around: it's harmless — `git switch -` returns to your branch.",
      "If you made commits you want to keep: `git switch -c new-branch` right now to capture them before moving.",
      "If you already left and think you lost commits: `git reflog` → find the hash → branch from it.",
    ],
  },
  {
    keys: ["rejected", "push rejected", "failed to push", "non-fast-forward", "fetch first", "updates were rejected"],
    title: "Push rejected (non-fast-forward)",
    cause: "The remote has commits you don't have locally — someone pushed since you last pulled. Git won't overwrite them.",
    fix: [
      "Get their work first: `git pull --rebase` (replays your commits on top) or `git pull` (merges).",
      "Resolve any conflicts, then `git push`.",
      "NEVER 'fix' this with `git push --force` on a shared branch — you'd delete their commits. If you truly must force (your own branch after a rebase), use `--force-with-lease`.",
    ],
  },
  {
    keys: ["conflict", "merge conflict", "conflict marker", "both modified"],
    title: "Merge/rebase conflict",
    cause: "Two branches changed the same lines; Git can't decide and is asking you to. Not an error.",
    fix: [
      "`git status` → open each conflicted file → edit to the intended result → remove `<<<<<<< ======= >>>>>>>` markers → `git add`.",
      "`git merge --continue` / `git rebase --continue` to finish; `--abort` to bail out completely.",
      "Search for `<<<<<<<` before committing so no markers slip through.",
    ],
  },
  {
    keys: ["lost", "gone", "disappeared", "reset --hard", "deleted my", "recover", "hard reset"],
    title: "'I lost my work'",
    cause: "Usually a reset/rebase/branch-delete moved a pointer, not a real deletion — committed work is still in the object store.",
    fix: [
      "STOP. Run `git reflog` — it shows every recent HEAD position with hashes.",
      "Recover: `git reset --hard <good-hash>` or `git branch recovered <good-hash>`.",
      "Caveat: UNCOMMITTED changes destroyed by `git reset --hard` aren't in reflog — those may be truly gone. Commit/stash early next time.",
    ],
  },
  {
    keys: ["wrong branch", "committed to main", "on the wrong branch", "meant to commit"],
    title: "Committed to the wrong branch",
    cause: "You committed while HEAD was on main (or the wrong feature branch).",
    fix: [
      "Capture it on the right branch: `git branch correct-branch` (points it at your commit).",
      "Remove it from the wrong branch (if unpushed): `git reset --hard HEAD~1`.",
      "`git switch correct-branch` and continue. (Or `cherry-pick` the hash onto the right branch.)",
    ],
  },
  {
    keys: ["large file", "file too large", "gh001", "exceeds", "100 mb", "big file", "lfs"],
    title: "Push blocked by a large file",
    cause: "GitHub rejects files over its size limit; the file is likely baked into history, so removing it from the latest commit isn't enough.",
    fix: [
      "If it's only in the last commit: remove it, `git rm --cached <file>`, add to `.gitignore`, `git commit --amend`.",
      "If it's deep in history: use `git filter-repo` (or BFG) to purge it, then force-push (coordinate with the team).",
      "For legitimately large assets, use Git LFS (`git lfs track`).",
    ],
  },
  {
    keys: ["secret", "committed a secret", "leaked", "api key", "password", "token committed", "exposed"],
    title: "Committed a secret / API key",
    cause: "A credential is now in git history — and if pushed to a public repo, assume it's already scraped.",
    fix: [
      "ROTATE the secret immediately — invalidate it at the provider. Deleting the file does NOT undo exposure; history keeps it.",
      "Purge it from history with `git filter-repo`/BFG, then force-push (coordinate).",
      "Prevent recurrence: `.gitignore` the file, use secret scanning, and keep secrets in env/CI secrets, never in code.",
    ],
  },
];

export function debug(rawSymptom: string): string {
  const s = clean(rawSymptom).toLowerCase();
  const matches = SYMPTOMS.filter((sym) => sym.keys.some((k) => s.includes(k)));
  const header = [
    `DEBUG — "${clean(rawSymptom)}"`,
    `BOTTOM LINE: most Git 'disasters' are a moved pointer, not lost data. Likely cause and the fix, in order:`,
    ``,
  ];
  if (!matches.length) {
    return [
      ...header,
      `No exact match. The reflex that solves most scary Git moments:`,
      `  1. Run \`git status\` — it almost always tells you what's wrong and suggests the command.`,
      `  2. If work seems lost, run \`git reflog\` BEFORE anything destructive — the commit is likely still there.`,
      `  3. Never \`git push --force\` on a shared branch; use \`--force-with-lease\` and only on your own.`,
      ``,
      `Known symptoms: ${SYMPTOMS.map((x) => x.title).join("; ")}. Describe the exact message for a targeted read.`,
    ].join("\n");
  }
  const body = matches.flatMap((sym) => [
    `▸ ${sym.title}`,
    `  Likely cause: ${sym.cause}`,
    `  Fix, in order:`,
    ...sym.fix.map((f) => `    ${f}`),
    ``,
  ]);
  return [...header, ...body, `GitHub-product specifics (Actions, gh) change — verify current syntax via check_practice → practice_verdict.`].join("\n");
}

// ── myth_vs_reality ──────────────────────────────────────────────────────────
const MYTHS: Array<{ myth: string; reality: string }> = [
  {
    myth: "Git and GitHub are the same thing.",
    reality: "Git is the version-control TOOL — local, distributed, works with no internet and no account. GitHub is one HOSTING PLATFORM built on Git (GitLab, Bitbucket, and a bare server are alternatives). You can use Git for a lifetime without GitHub.",
  },
  {
    myth: "Rebase is dangerous, never use it.",
    reality: "Rebase is safe and excellent on PRIVATE, unpushed history — it's how you clean up messy local commits before a PR. The ONLY hazard is rebasing history you've already shared. Learn the golden rule, not a blanket fear.",
  },
  {
    myth: "A `reset --hard` deletes commits forever.",
    reality: "It moves your branch pointer; the commits themselves live on in the object store and reflog for ~90 days — recover with `git reflog`. The one true casualty is UNCOMMITTED work, which was never an object. Commit or stash before risky moves.",
  },
  {
    myth: "Force-push is always bad.",
    reality: "Force-push on a SHARED branch is bad (you erase others' commits). But after rebasing your OWN feature branch it's normal and expected — just use `--force-with-lease`, which refuses if someone else pushed in the meantime.",
  },
  {
    myth: "Deleting a secret file and committing removes the leak.",
    reality: "History is forever — the secret is still in old commits, and on a public repo it's likely already harvested by bots. The only real fix is to ROTATE the credential; purging history is cleanup, not remediation.",
  },
  {
    myth: "More commits / a perfect commit history is what matters.",
    reality: "What matters is legible, revertible history: small focused commits with clear messages, one logical change each. A tidy graph helps humans review and helps you bisect; commit COUNT is meaningless.",
  },
  {
    myth: "You must pull before you can work / Git needs the server.",
    reality: "Git is distributed — every clone is a full repo with complete history. You can commit, branch, diff, and view history entirely offline; pushing/pulling is just syncing with a remote when you choose.",
  },
  {
    myth: "`git blame` tells you who's responsible for a bug.",
    reality: "It tells you who last TOUCHED each line — often a formatter, a move, or a rename, not the author of the logic. It's a pointer to a commit to go read, not an accusation.",
  },
];

export function mythVsReality(): string {
  return [
    `GIT & GITHUB MYTHS vs REALITY`,
    `BOTTOM LINE: most Git fear is misinformation. The tool is safer and more recoverable than its reputation — knowing the real edges (shared vs private history, committed vs uncommitted) is what makes you fast.`,
    ``,
    ...MYTHS.flatMap(({ myth, reality }, i) => [`${i + 1}. MYTH: "${myth}"`, `   REALITY: ${reality}`, ``]),
    `The through-line: rewrite private history freely, treat shared history as append-only, commit early so reflog can save you, and rotate any secret that ever touched a commit.`,
  ].join("\n");
}
