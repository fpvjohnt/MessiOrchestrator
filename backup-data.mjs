// Backs up the personal/generated data files nothing else protects. Each one
// is gitignored on purpose (see .gitignore's "Personal & work data" and
// "OAuth server state" sections) and today has exactly one copy, on one
// drive: data/cases.json (months of case history), data/registry.json, saved
// profiles/work-context, and the phone bridge's OAuth client registrations.
//
// Copies whatever currently exists into a timestamped run folder, keeping the
// most recent N runs.
//
// Destination defaults to ./backups — still on THIS drive, so it protects
// against accidental deletion/corruption, not drive failure. For real
// disaster recovery, point --dest (or the MCP_BACKUP_DIR env var) at a
// cloud-synced folder (OneDrive/Dropbox) or a different drive.
//
// Run:  node backup-data.mjs [--dest=<path>] [--keep=14]
import { mkdir, copyFile, readdir, stat, rm, readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./bridge/load-env.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

// run-backup.cmd launches this with a BARE environment (like the bridge chain),
// so MCP_BACKUP_DIR set in .env was silently ignored and every scheduled run
// wrote to the on-drive default. Load .env here so the off-drive destination
// actually takes effect. Already-exported vars still win (--dest / a one-off).
await loadEnvFile(ROOT);

// Relative to ROOT. Mirrors .gitignore's personal-data entries.
const FILES = [
  "data/registry.json",
  "data/cases.json",
  "data/cases-archive.json",
  "homebuyer-mcp/data/profile.json",
  "jobhunt-mcp/data/profile.json",
  "polymath-mcp/data/work-context.json",
  "bridge/oauth-state.json",
];

const args = process.argv.slice(2);
const destArg = args.find((a) => a.startsWith("--dest="));
const keepArg = args.find((a) => a.startsWith("--keep="));
const defaultDest = process.env.MCP_BACKUP_DIR ?? "backups";
const destRoot = resolve(ROOT, destArg ? destArg.slice("--dest=".length) : defaultDest);
const keep = keepArg ? Number(keepArg.slice("--keep=".length)) : 14;
if (!Number.isFinite(keep) || keep <= 0) {
  console.error(`Invalid --keep value. Usage: node backup-data.mjs [--dest=<path>] [--keep=14]`);
  process.exit(1);
}

// Files whose CONTENT is validated before we trust a copy. A truncated or
// emptied cases.json copied faithfully, then multiplied over 14 daily runs,
// would silently evict every good backup and leave only empty ones. So a
// critical file that does not parse as non-empty JSON is NOT copied, the run is
// marked failed, and retention is skipped so the last known-good survives.
const CRITICAL = new Set(["data/registry.json", "data/cases.json", "data/cases-archive.json"]);

// Non-empty = a JSON array with entries, or an object with keys. An empty [] or
// {} for one of these files is the corruption signature we are guarding against.
function nonEmptyJson(text) {
  const v = JSON.parse(text); // throws on malformed — caller treats as invalid
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v).length > 0;
  return false;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = join(destRoot, stamp);
await mkdir(runDir, { recursive: true });

let copied = 0;
const integrityFailures = [];
for (const rel of FILES) {
  const src = join(ROOT, rel);
  try {
    await stat(src);
  } catch {
    continue; // doesn't exist yet on this machine — nothing to back up
  }
  // Validate content before copying anything critical.
  if (CRITICAL.has(rel)) {
    try {
      const text = await readFile(src, "utf-8");
      if (!nonEmptyJson(text)) {
        integrityFailures.push(`${rel}: parsed but EMPTY`);
        console.error(`INTEGRITY: ${rel} is empty — refusing to back it up (protects last known-good).`);
        continue;
      }
    } catch (err) {
      integrityFailures.push(`${rel}: ${err.message}`);
      console.error(`INTEGRITY: ${rel} failed to parse — refusing to back it up (protects last known-good). ${err.message}`);
      continue;
    }
  }
  const destPath = join(runDir, rel.replace(/[\\/]/g, "__"));
  await copyFile(src, destPath);
  copied += 1;
}

console.log(`Backed up ${copied} file(s) to ${runDir}`);
if (resolve(destRoot) === resolve(ROOT, "backups")) {
  console.log(
    `Note: this is still on the same drive as the originals — protects against accidental deletion/corruption, ` +
      `not drive failure. Point --dest (or MCP_BACKUP_DIR) at a cloud-synced folder or another drive for real disaster recovery.`
  );
}

// Retention: keep only the most recent N run folders (by name — the ISO
// timestamp format sorts chronologically as a string).
// Only TIMESTAMPED run folders participate in retention. A hand-made directory
// like "registry-pre-hygiene" sorts after every "2026-…" name, so it was
// permanently treated as the newest backup and permanently occupied one of the
// N slots — silently reducing real retention by one, forever.
// If a critical file was bad this run, DO NOT prune. This run's folder is
// incomplete, and pruning would count it toward retention and evict a good
// older run — the exact erosion this guard exists to prevent.
if (integrityFailures.length) {
  console.error(
    `\nINTEGRITY FAILURE — ${integrityFailures.length} critical file(s) were not backed up this run:\n` +
      integrityFailures.map((f) => `  - ${f}`).join("\n") +
      `\nSkipping retention/prune so the last known-good backups are preserved. ` +
      `Investigate the source file(s) before the next run.`
  );
  process.exit(1);
}

const TIMESTAMPED = /^\d{4}-\d{2}-\d{2}T/;
const entries = await readdir(destRoot, { withFileTypes: true });
const runDirs = entries
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => TIMESTAMPED.test(name))
  .sort();
const stale = runDirs.slice(0, Math.max(0, runDirs.length - keep));
for (const name of stale) {
  await rm(join(destRoot, name), { recursive: true, force: true });
}
if (stale.length) console.log(`Pruned ${stale.length} backup run(s) older than the most recent ${keep}.`);
