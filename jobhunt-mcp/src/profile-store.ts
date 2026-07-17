import { PROFILE_PATH } from "./paths.js";
import { withFileLock } from "./file-lock.js";
import { loadJsonObject, saveJson } from "./json-store.js";

export interface CandidateProfile {
  current_role?: string;
  target_role?: string;
  years_experience?: number;
  education?: string; // e.g. "BA Business", "high school", "some college"
  certifications?: string[];
  skills?: string[];
  last_job?: string;
  achievements?: string[]; // wins, with numbers if possible
  location?: string; // county/city for living-wage + market
  salary_needed?: number; // annual take-you-need
  work_style?: string[]; // e.g. ["hands-on","solo","analytical"] — feeds career_match
  updated_at?: string;
}

export async function getProfile(): Promise<CandidateProfile> {
  return loadJsonObject<CandidateProfile>(PROFILE_PATH, {});
}

export async function updateProfile(patch: Partial<CandidateProfile>, now: Date): Promise<CandidateProfile> {
  return withFileLock(PROFILE_PATH, async () => {
    const current = await loadJsonObject<CandidateProfile>(PROFILE_PATH, {});
    const merged: CandidateProfile = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
    }
    merged.updated_at = now.toISOString();
    await saveJson(PROFILE_PATH, merged);
    return merged;
  });
}
