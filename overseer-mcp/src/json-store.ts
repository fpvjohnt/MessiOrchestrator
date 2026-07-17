import { readFile } from "node:fs/promises";

/** Read-only loader — overseer only ever inspects a case-store, never writes
 * to it, so there's no lock/atomic-write machinery here (unlike the asset
 * servers, which own their data). Names the file in errors so a bad path or
 * hand-edit typo is diagnosable instead of a bare parse exception. */
export async function loadJsonArray<T>(path: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`No file at "${path}". Point cases_path/registry_path at an orchestrator's data directory.`);
    }
    throw err;
  }
  if (raw.trim() === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${path} contains invalid JSON (${message}).`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${path} must contain a JSON array.`);
  }
  return parsed as T[];
}
