// Moves closed cases older than a cutoff out of the live data/cases.json into
// data/cases-archive.json. Every task_asset call does a full read-modify-write
// of cases.json (src/case-store.ts) — an ever-growing file makes that slower
// forever with no ceiling. This gives it one: run periodically (manually, or
// wire it to a scheduled task the same way bridge/start-all.cmd is wired to
// Windows logon) to keep the live file bounded to recent + open activity.
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
// Run:  node archive-cases.mjs [--days=90] [--dry-run]
import { dirname, join } from "node:path";
import { CASES_PATH } from "./dist/paths.js";
import { loadJsonArray, saveJsonArray } from "./dist/json-store.js";
import { withFileLock } from "./dist/file-lock.js";

const ARCHIVE_PATH = join(dirname(CASES_PATH), "cases-archive.json");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const daysArg = args.find((a) => a.startsWith("--days="));
const cutoffDays = daysArg ? Number(daysArg.slice("--days=".length)) : 90;
if (!Number.isFinite(cutoffDays) || cutoffDays <= 0) {
  console.error(`Invalid --days value. Usage: node archive-cases.mjs [--days=90] [--dry-run]`);
  process.exit(1);
}
const cutoffMs = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;

function isArchivable(c) {
  if (c.status !== "closed") return false;
  const closedAt = c.closedAt ? Date.parse(c.closedAt) : NaN;
  return Number.isFinite(closedAt) && closedAt < cutoffMs;
}

await withFileLock(CASES_PATH, async () => {
  const live = await loadJsonArray(CASES_PATH);
  const toArchive = live.filter(isArchivable);
  const toKeep = live.filter((c) => !isArchivable(c));

  const cutoffLabel = new Date(cutoffMs).toISOString().slice(0, 10);

  if (toArchive.length === 0) {
    console.log(
      `Nothing to archive — no closed cases older than ${cutoffDays}d (before ${cutoffLabel}). ` +
        `(${live.length} case(s) currently in cases.json.)`
    );
    return;
  }

  console.log(`${toArchive.length} case(s) closed before ${cutoffLabel} would move to ${ARCHIVE_PATH}.`);
  console.log(`cases.json would go from ${live.length} to ${toKeep.length} case(s).`);

  if (dryRun) {
    console.log(`Dry run — nothing written. Re-run without --dry-run to apply.`);
    return;
  }

  const existingArchive = await loadJsonArray(ARCHIVE_PATH);
  await saveJsonArray(ARCHIVE_PATH, [...existingArchive, ...toArchive]);
  await saveJsonArray(CASES_PATH, toKeep);
  console.log(
    `Archived. ${ARCHIVE_PATH} now has ${existingArchive.length + toArchive.length} case(s); ` +
      `cases.json has ${toKeep.length}.`
  );
});
