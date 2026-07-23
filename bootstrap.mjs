// One-command setup for the whole system: install deps + build every package
// (orchestrator + all 8 assets). Replaces the ~18 manual steps needed to bring
// this up on a fresh machine. Reports per-package status and fails loudly if
// any package doesn't install/build, instead of dying silently halfway.
//
//   Run:  npm run setup
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

// "." is the orchestrator root; the rest are the asset packages (all 17).
const PACKAGES = [
  ".",
  "research-mcp",
  "homebuyer-mcp",
  "nestegg-mcp",
  "lawguide-mcp",
  "jobhunt-mcp",
  "polymath-mcp",
  "healthguide-mcp",
  "overseer-mcp",
  "curiosity-mcp",
  "education-mcp",
  "communication-mcp",
  "sports-mcp",
  "government-mcp",
  "linguistics-mcp",
  "faiths-mcp",
  "loop-mcp",
  "openai-mcp",
  "aiforge-mcp",
  "gitforge-mcp",
  "promptcraft-mcp",
  "apiforge-mcp",
];

function run(cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: "pipe" });
    return { ok: true };
  } catch (e) {
    const out = `${e.stdout?.toString() ?? ""}${e.stderr?.toString() ?? ""}`.trim();
    return { ok: false, tail: out.split("\n").slice(-4).join("\n") };
  }
}

console.log(`BOOTSTRAP — installing + building ${PACKAGES.length} packages\n`);
const results = [];
for (const pkg of PACKAGES) {
  const label = pkg === "." ? "orchestrator (root)" : pkg;
  if (!existsSync(`${pkg}/package.json`)) {
    console.log(`  SKIP  ${label} — no package.json`);
    results.push({ label, skipped: true });
    continue;
  }
  const install = run("npm install", pkg);
  const build = install.ok ? run("npm run build", pkg) : { ok: false, tail: "(skipped — install failed)" };
  const ok = install.ok && build.ok;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}`);
  if (!install.ok) console.log(`         install failed:\n${install.tail.replace(/^/gm, "           ")}`);
  if (install.ok && !build.ok) console.log(`         build failed:\n${build.tail.replace(/^/gm, "           ")}`);
  results.push({ label, ok });
}

const failed = results.filter((r) => !r.skipped && !r.ok);
const built = results.filter((r) => r.ok).length;
console.log(`\n${built}/${results.filter((r) => !r.skipped).length} packages installed + built.`);
if (failed.length) {
  console.log(`FAILED: ${failed.map((f) => f.label).join(", ")}`);
  process.exit(1);
}
console.log(`Ready. Next: wire the orchestrator into Claude Desktop (see README), then 'npm run health' to confirm all assets are up.`);
process.exit(0);
