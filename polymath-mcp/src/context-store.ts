import { CONTEXT_PATH } from "./paths.js";
import { withFileLock } from "./file-lock.js";
import { loadJsonObject, saveJson } from "./json-store.js";

// Same pattern as jobhunt's profile-store: save the situation once so every
// consult personalizes without re-explaining. Only provided fields change.

export interface WorkContext {
  current_role?: string; // e.g. "Senior Systems Analyst at Nordstrom"
  work_stack?: string[]; // tools/systems at work, e.g. ["ServiceNow", "BigQuery", "Looker", "Tableau"]
  home_stack?: string[]; // home lab / personal projects, e.g. ["Windows 11 PC", "MCP servers in TypeScript"]
  constraints?: string[]; // e.g. ["no admin rights on work laptop", "no hardware access to cameras"]
  goals?: string[]; // e.g. ["move up to senior AI ops", "build sellable side projects"]
  updated_at?: string;
}

export async function getContext(): Promise<WorkContext> {
  return loadJsonObject<WorkContext>(CONTEXT_PATH, {});
}

export async function updateContext(patch: Partial<WorkContext>, now: Date): Promise<WorkContext> {
  return withFileLock(CONTEXT_PATH, async () => {
    const current = await loadJsonObject<WorkContext>(CONTEXT_PATH, {});
    const merged: WorkContext = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
    }
    merged.updated_at = now.toISOString();
    await saveJson(CONTEXT_PATH, merged);
    return merged;
  });
}

/** Render the saved context as display lines, or [] when nothing is saved. */
export function contextLines(ctx: WorkContext): string[] {
  const lines: string[] = [];
  if (ctx.current_role) lines.push(`Role: ${ctx.current_role}`);
  if (ctx.work_stack?.length) lines.push(`Work stack: ${ctx.work_stack.join(", ")}`);
  if (ctx.home_stack?.length) lines.push(`Home stack: ${ctx.home_stack.join(", ")}`);
  if (ctx.constraints?.length) lines.push(`Constraints: ${ctx.constraints.join(", ")}`);
  if (ctx.goals?.length) lines.push(`Goals: ${ctx.goals.join(", ")}`);
  return lines;
}
