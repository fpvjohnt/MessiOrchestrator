import { PROFILE_PATH } from "./paths.js";
import { withFileLock } from "./file-lock.js";
import { loadJsonObject, saveJson } from "./json-store.js";
import type { BuyerProfile } from "./types.js";

export async function getProfile(): Promise<BuyerProfile> {
  return loadJsonObject<BuyerProfile>(PROFILE_PATH, {});
}

export async function updateProfile(patch: Partial<BuyerProfile>, now: Date): Promise<BuyerProfile> {
  return withFileLock(PROFILE_PATH, async () => {
    const current = await loadJsonObject<BuyerProfile>(PROFILE_PATH, {});
    // Only overwrite provided fields; undefined leaves the existing value intact.
    const merged: BuyerProfile = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
    }
    merged.updated_at = now.toISOString();
    await saveJson(PROFILE_PATH, merged);
    return merged;
  });
}

export async function clearProfile(): Promise<void> {
  await withFileLock(PROFILE_PATH, async () => {
    await saveJson(PROFILE_PATH, {});
  });
}
