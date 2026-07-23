import { readFile, mkdir, rename, open } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Loads a JSON-array store, creating it (and its directory) on first use.
 *
 * A zero-byte/whitespace-only file is NOT healed to an empty array. It used to
 * be, on the theory that a crash during initial creation could leave one
 * behind — but creation now goes through the same atomic write as every other
 * save, so an empty file can no longer be a legitimate first-run artifact.
 * What it still CAN be is the aftermath of an unclean shutdown, and healing
 * that silently was the worst data path in the system: the orchestrator would
 * read zero cases, report nothing wrong, and the very next write would replace
 * the whole history with a one-element file. Failing loudly costs a restart;
 * healing quietly costs everything.
 *
 * Anything else that fails to parse — or parses to a non-array — produces an
 * error that names the file, so a hand-edit typo reads as "fix this file", not
 * a bare "Unexpected token" with no clue which store is broken.
 */
export async function loadJsonArray<T>(path: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dirname(path), { recursive: true });
      await saveJsonArray<T>(path, []);
      return [];
    }
    throw err;
  }

  if (raw.trim() === "") {
    throw new Error(
      `${path} is empty. This store is written atomically, so an empty file means its ` +
        `previous contents were lost — most likely an unclean shutdown — and is NOT a fresh ` +
        `install. Restore it from backups/ before continuing; if you genuinely intend to ` +
        `start over, write [] into it deliberately.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${path} contains invalid JSON (${message}). Fix or delete the file, then retry.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${path} must contain a JSON array, found ${typeof parsed}. Fix or delete the file, then retry.`);
  }
  return parsed as T[];
}

/**
 * Writes via temp file + rename so a crash mid-write can't leave the store
 * truncated. The temp file is fsync'd before the rename: without that, NTFS
 * can commit the rename metadata while the payload is still in the write
 * cache, so a power loss lands a present-but-zero-length store — which
 * loadJsonArray now refuses rather than heals. The rename itself is atomic
 * (MoveFileEx with MOVEFILE_REPLACE_EXISTING), and the temp name carries the
 * pid so two processes can't collide on it.
 */
export async function saveJsonArray<T>(path: string, items: T[]): Promise<void> {
  const tmpPath = `${path}.${process.pid}.tmp`;
  const handle = await open(tmpPath, "w");
  try {
    await handle.writeFile(JSON.stringify(items, null, 2) + "\n", "utf-8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmpPath, path);
}
