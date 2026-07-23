// Moves closed cases older than a cutoff out of the live data/cases.json into
// data/cases-archive.json. Every task_asset call does a full read-modify-write
// of cases.json (src/case-store.ts) — an ever-growing file makes that slower
// forever with no ceiling. This gives it one.
//
// The default cutoff used to be 90 days, and that made this script a no-op on
// the only system it runs on. Measured at 17 days of use: 143 cases, 1.5 MB,
// 94% of it task-log payloads, growing ~90 KB/day. The oldest closed case was
// 17 days old, so --days=90 selected nothing and would have kept selecting
// nothing until day 90 — through exactly the period the bound is needed. Cases
// here close within hours, not months. 14 days keeps roughly two weeks of live
// history and archives the rest; archived cases stay fully queryable (see
// below), so the cutoff trades nothing away but file size.
//
// Safe to run anytime, including while an orchestrator process (Desktop
// stdio, or a bridge session) is live — it goes through the same
// cross-process lock (src/file-lock.ts) every other writer of cases.json
// uses, so it can't race a concurrent task_asset call.
//
// overseer's tools (replay_case, audit_report, detect_drift, ...) all accept
// a cases_path argument — point one at data/cases-archive.json to inspect
// archived history. They read ONE file at a time, not live+archive merged, so
// query whichever file has what you're looking for.
//
// Installed as a daily scheduled task by bridge/install-archive-task.cmd.
//
// Run:  node archive-cases.mjs [--days=14] [--dry-run]
import { dirname, join } from "node:path";
import { CASES_PATH } from "./dist/paths.js";
import { loadJsonArray, saveJsonArray } from "./dist/json-store.js";
import { withFileLock } from "./dist/file-lock.js";
import { analyzeStore, mergeArchive, suggestCutoffs } from "./archive-logic.mjs";

const ARCHIVE_PATH = join(dirname(CASES_PATH), "cases-archive.json");
const DEFAULT_DAYS = 14;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const daysArg = args.find((a) => a.startsWith("--days="));
const cutoffDays = daysArg ? Number(daysArg.slice("--days=".length)) : DEFAULT_DAYS;
if (!Number.isFinite(cutoffDays) || cutoffDays <= 0) {
  console.error(`Invalid --days value. Usage: node archive-cases.mjs [--days=${DEFAULT_DAYS}] [--dry-run]`);
  process.exit(1);
}
const nowMs = Date.now();
const cutoffMs = nowMs - cutoffDays * 24 * 60 * 60 * 1000;
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

await withFileLock(CASES_PATH, async () => {
  const live = await loadJsonArray(CASES_PATH);
  const stats = analyzeStore(live, { nowMs, cutoffMs, idleOpenDays: cutoffDays });
  const cutoffLabel = new Date(cutoffMs).toISOString().slice(0, 10);

  // Always state the size. The whole reason this script exists is to bound it,
  // so a run that reports success without mentioning it is reporting on the
  // wrong thing.
  console.log(
    `cases.json: ${kb(stats.bytes)}, ${stats.total} case(s) - ${stats.openCount} open, ${stats.closedCount} closed.`
  );

  if (stats.archivableCount === 0) {
    // "Nothing to archive" on its own reads as a healthy run. If the file is
    // growing and the cutoff simply cannot reach it, say so and say what would.
    console.log(`Nothing matched: no closed case is older than ${cutoffDays}d (closed before ${cutoffLabel}).`);
    if (stats.oldestClosedDays !== null) {
      console.log(`  Oldest closed case is ${stats.oldestClosedDays}d old, so this cutoff can never match it.`);
      const options = suggestCutoffs(live, nowMs).filter((o) => o.count > 0);
      if (options.length) {
        console.log(`  Cutoffs that would move something: ${options.map((o) => `--days=${o.days} (${o.count})`).join(", ")}`);
      }
    }
  } else {
    console.log(`${stats.archivableCount} case(s) closed before ${cutoffLabel} move to ${ARCHIVE_PATH}.`);
    console.log(`cases.json goes from ${stats.total} to ${stats.keepCount} case(s).`);
  }

  // Weight that no cutoff can ever reach. Reported, never auto-archived: an
  // open case may be genuinely pending, and closing one on the user's behalf
  // would be inventing an outcome the system never observed.
  if (stats.idleOpen.length) {
    const heaviest = stats.idleOpen.slice(0, 5).map((o) => `${o.id} (${o.days}d)`).join(", ");
    console.log(
      `Note: ${stats.idleOpen.length} case(s) still OPEN for ${cutoffDays}d or more will never be archived at any cutoff - ` +
        `close them with close_case if they are finished. Oldest: ${heaviest}`
    );
  }
  if (stats.undateableCount) {
    console.log(
      `Note: ${stats.undateableCount} closed case(s) have no usable closedAt and are invisible to every cutoff.`
    );
  }

  if (stats.archivableCount === 0) return;

  if (dryRun) {
    console.log(`Dry run - nothing written. Re-run without --dry-run to apply.`);
    return;
  }

  const existingArchive = await loadJsonArray(ARCHIVE_PATH);
  const { merged, added, skipped } = mergeArchive(existingArchive, stats.toArchive);
  // Archive first, live file second. A crash in between leaves cases in BOTH
  // files rather than neither; mergeArchive's id dedup is what makes that
  // recoverable on the next run instead of permanently duplicating them.
  await saveJsonArray(ARCHIVE_PATH, merged);
  await saveJsonArray(CASES_PATH, stats.toKeep);
  console.log(
    `Archived ${added} case(s)${skipped ? ` (${skipped} already present, skipped)` : ""}. ` +
      `${ARCHIVE_PATH} now has ${merged.length}; cases.json has ${stats.toKeep.length}.`
  );
});
