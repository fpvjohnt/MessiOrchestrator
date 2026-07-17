import { REFERENCE_PATH } from "./paths.js";
import { withFileLock } from "./file-lock.js";
import { loadJsonArray, saveJson } from "./json-store.js";
import type { ReferenceRecord } from "./types.js";

export async function loadReferences(): Promise<ReferenceRecord[]> {
  return loadJsonArray<ReferenceRecord>(REFERENCE_PATH);
}

export async function getReference(key: string): Promise<ReferenceRecord | undefined> {
  const refs = await loadReferences();
  return refs.find((r) => r.key === key);
}

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return Infinity;
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export interface StalenessView extends ReferenceRecord {
  age_days: number;
  is_stale: boolean;
}

export async function withStaleness(now: Date): Promise<StalenessView[]> {
  const refs = await loadReferences();
  return refs.map((r) => {
    const raw = daysBetween(r.as_of, now);
    // Clamp a (slightly) future as_of to age 0; an unparseable date stays
    // Infinity, which correctly reads as stale.
    const age_days = raw === Infinity ? Infinity : Math.max(0, raw);
    return { ...r, age_days, is_stale: age_days > r.staleness_days };
  });
}

export interface UpdatePreview {
  applied: boolean;
  key: string;
  old_value: string;
  new_value: string;
  message: string;
}

/**
 * Flag-only by default: without confirm===true this returns a PREVIEW of what
 * would change and writes nothing. The stored source of truth is only rewritten
 * on an explicit confirmed call, and the prior value is kept in history. This
 * enforces the "verification flags, a human approves" rule structurally, not by
 * convention.
 */
export async function updateReference(
  key: string,
  newValue: string,
  source: string,
  asOf: string,
  confirm: boolean,
  now: Date
): Promise<UpdatePreview> {
  return withFileLock(REFERENCE_PATH, async () => {
    const refs = await loadReferences();
    const rec = refs.find((r) => r.key === key);
    if (!rec) throw new Error(`No reference with key "${key}".`);

    if (rec.value === newValue) {
      return {
        applied: false,
        key,
        old_value: rec.value,
        new_value: newValue,
        message: `No change: stored value already matches. Refreshing as_of would require confirm=true.`,
      };
    }

    if (!confirm) {
      return {
        applied: false,
        key,
        old_value: rec.value,
        new_value: newValue,
        message: `PREVIEW ONLY — not written. Stored "${rec.value}" (as of ${rec.as_of}) vs proposed "${newValue}" (${source}). Re-call with confirm=true to apply.`,
      };
    }

    rec.history = rec.history ?? [];
    rec.history.push({ value: rec.value, as_of: rec.as_of, source: rec.source, replaced_on: now.toISOString() });
    rec.history = rec.history.slice(-50); // bound growth
    const oldValue = rec.value;
    rec.value = newValue;
    rec.source = source;
    rec.as_of = asOf;
    await saveJson(REFERENCE_PATH, refs);
    return {
      applied: true,
      key,
      old_value: oldValue,
      new_value: newValue,
      message: `Updated "${key}" to "${newValue}" (${source}, as of ${asOf}). Prior value archived in history.`,
    };
  });
}
