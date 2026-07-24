// Persists the dedup state map between poll calls. One small JSON file, written
// atomically (temp + rename) so a crash mid-write can't corrupt it. Path is
// GHMONITOR_STATE_PATH, else ./data/state.json next to the package.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StateMap } from "./dedup.js";

function statePath(): string {
  if (process.env.GHMONITOR_STATE_PATH) return process.env.GHMONITOR_STATE_PATH;
  const here = dirname(dirname(fileURLToPath(import.meta.url))); // package root (out of dist/)
  return join(here, "data", "state.json");
}

export async function loadState(): Promise<StateMap> {
  try {
    const raw = await readFile(statePath(), "utf-8");
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as StateMap) : {};
  } catch {
    return {}; // missing/corrupt → start clean; the next save heals it
  }
}

export async function saveState(state: StateMap): Promise<void> {
  const path = statePath();
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
  await rename(tmp, path);
}
