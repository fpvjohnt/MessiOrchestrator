import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Loads a JSON-array store, creating it (and its directory) on first use.
 * A zero-byte/whitespace-only file is healed to an empty array (a crash
 * during initial creation can leave one behind). Anything else that fails
 * to parse — or parses to a non-array — produces an error that names the
 * file, so a hand-edit typo reads as "fix this file", not a bare
 * "Unexpected token" with no clue which store is broken.
 */
export async function loadJsonArray<T>(path: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "[]\n", "utf-8");
      return [];
    }
    throw err;
  }

  if (raw.trim() === "") {
    return [];
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
 * truncated.
 */
export async function saveJsonArray<T>(path: string, items: T[]): Promise<void> {
  const tmpPath = `${path}.${process.pid}.tmp`;
  await writeFile(tmpPath, JSON.stringify(items, null, 2) + "\n", "utf-8");
  await rename(tmpPath, path);
}
