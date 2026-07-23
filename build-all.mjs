// Parallel, incremental build of the root orchestrator + every sub-MCP package.
//
// Replaces the 22-deep sequential `tsc && tsc && …` chain that ran ~29s on
// EVERY `npm run verify`/`check`, even for a one-line change. The packages are
// independent (no asset imports another), so they compile concurrently here,
// N-at-a-time across cores. Combined with per-package `incremental: true`
// (tsconfig), unchanged packages are near-instant on a warm rebuild.
//
// A sequential, readable fallback remains as `npm run build:all:seq`.
import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cpus } from "node:os";

const ROOT = dirname(fileURLToPath(import.meta.url));
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");

async function findPackages() {
  const dirs = ["."]; // root builds src -> dist
  for (const e of await readdir(ROOT, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === "node_modules" || e.name.startsWith(".")) continue;
    try {
      await stat(join(ROOT, e.name, "tsconfig.json"));
      dirs.push(e.name);
    } catch {
      /* not a TS package */
    }
  }
  return dirs;
}

function build(dir) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [TSC, "-p", "tsconfig.json"], {
      cwd: join(ROOT, dir),
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ dir, code, out }));
  });
}

const packages = await findPackages();
const queue = [...packages];
const results = [];
const POOL = Math.max(2, cpus().length - 1);

async function worker() {
  let dir;
  while ((dir = queue.shift()) !== undefined) {
    const r = await build(dir);
    results.push(r);
    process.stdout.write(r.code === 0 ? "." : "x");
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: Math.min(POOL, queue.length) }, worker));
process.stdout.write("\n");

const failed = results.filter((r) => r.code !== 0);
for (const f of failed) console.error(`\n[build FAILED] ${f.dir}\n${f.out}`);
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `Built ${results.length - failed.length}/${results.length} packages in ${secs}s` +
    (failed.length ? ` — ${failed.length} FAILED` : " — all OK")
);
process.exit(failed.length ? 1 : 0);
