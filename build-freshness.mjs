// Warn loudly when compiled dist/ is older than its TypeScript sources — i.e.
// you are about to MEASURE code you have not rebuilt.
//
// golden.mjs and caselog-eval.mjs import from ./dist and are run standalone
// (npm run golden / npm run caselog) with no build step. Edit router.ts or
// synonyms.ts, run one of them directly, and you grade the OLD compiled code
// while believing you measured the change — the exact workflow this whole
// project revolves around. `npm run check`/`verify` build first and are safe;
// the standalone scripts were not.
//
// This does NOT rebuild for you — a measurement script surprising you with a
// compile is its own foot-gun. It only refuses to let the staleness be silent.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

async function newestMtime(dir, ext) {
  let newest = 0;
  let files;
  try {
    files = await readdir(dir);
  } catch {
    return 0; // dir missing — nothing to compare, stay quiet
  }
  for (const f of files) {
    if (!f.endsWith(ext)) continue;
    const s = await stat(join(dir, f));
    if (s.mtimeMs > newest) newest = s.mtimeMs;
  }
  return newest;
}

/**
 * Prints a prominent stderr banner (and returns true) when any src/*.ts is
 * newer than the newest dist/*.js under `root`. Checks the ROOT src/dist only —
 * router.ts and synonyms.ts, the files these harnesses actually depend on, live
 * there. Sub-MCP packages compile separately and are not imported here.
 */
export async function warnIfStaleBuild(root) {
  const src = await newestMtime(join(root, "src"), ".ts");
  const dist = await newestMtime(join(root, "dist"), ".js");
  if (src > 0 && dist > 0 && src > dist) {
    const bar = "=".repeat(74);
    console.error(
      `\n${bar}\n` +
        `WARNING: src/*.ts is NEWER than dist/*.js — you are measuring STALE code.\n` +
        `Run 'npm run build' before trusting these numbers (npm run check builds first).\n` +
        `${bar}\n`
    );
    return true;
  }
  return false;
}
