import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

/** Loads a JSON file, healing a missing/empty file to `fallback`. Names the
 * file in parse errors so a hand-edit typo is diagnosable. */
async function loadJson<T>(path: string, fallback: T, expect: "array" | "object"): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(fallback, null, 2) + "\n", "utf-8");
      return fallback;
    }
    throw err;
  }
  if (raw.trim() === "") return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${path} contains invalid JSON (${message}). Fix or delete the file, then retry.`);
  }
  const ok = expect === "array" ? Array.isArray(parsed) : parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  if (!ok) {
    throw new Error(`${path} must contain a JSON ${expect}. Fix or delete the file, then retry.`);
  }
  return parsed as T;
}

export function loadJsonArray<T>(path: string): Promise<T[]> {
  return loadJson<T[]>(path, [], "array");
}

export function loadJsonObject<T extends object>(path: string, fallback: T): Promise<T> {
  return loadJson<T>(path, fallback, "object");
}

/** Writes via temp file + rename so a crash mid-write can't truncate the store. */
export async function saveJson(path: string, value: unknown): Promise<void> {
  const tmpPath = `${path}.${process.pid}.tmp`;
  await writeFile(tmpPath, JSON.stringify(value, null, 2) + "\n", "utf-8");
  await rename(tmpPath, path);
}
