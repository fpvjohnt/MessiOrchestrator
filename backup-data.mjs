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
import { mkdir, copyFile, readdir, stat, rm } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

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

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = join(destRoot, stamp);
await mkdir(runDir, { recursive: true });

let copied = 0;
for (const rel of FILES) {
  const src = join(ROOT, rel);
  try {
    await stat(src);
  } catch {
    continue; // doesn't exist yet on this machine — nothing to back up
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
