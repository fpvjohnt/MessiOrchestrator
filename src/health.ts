import type { AssetConfig } from "./types.js";

// Platform-level liveness + staleness check. overseer watches case DATA; this
// watches the PROCESSES: is each registered asset actually reachable, how many
// tools does it expose, what version does it report, and — the recurring pain
// this whole session — is the running code STALE (its built entry file is newer
// than when this orchestrator started, i.e. it was rebuilt and needs a restart
// to take effect).
//
// Pure core with injected deps (introspect, entryMtime) so it unit-tests
// without spawning processes or touching the filesystem.

export interface AssetHealth {
  name: string;
  reachable: boolean;
  toolCount?: number;
  version?: string;
  builtAt?: string; // entry-file mtime, ISO
  stale: boolean; // built after the orchestrator started -> restart to load
  error?: string;
}

export interface HealthDeps {
  orchestratorStartedAt: Date;
  introspect: (asset: AssetConfig) => Promise<{ toolCount: number; version?: string }>;
  entryMtime: (asset: AssetConfig) => Promise<Date | undefined>;
  /**
   * mtime of the ORCHESTRATOR's own built entry file.
   *
   * The blind spot this closes, observed on 2026-08-05: health_check watched
   * every asset's build and never its own, so after a change under `src/` it
   * reported a confident "30/30 reachable, no stale" while the process serving
   * that very answer was running code from before the change. The one component
   * that cannot see the problem is the one being asked. It took a live routing
   * probe to notice, which is not a thing anyone should have to think to do.
   *
   * Optional so existing callers and tests keep working unchanged.
   */
  selfMtime?: () => Promise<Date | undefined>;
}

export interface SelfHealth {
  builtAt?: string;
  stale: boolean;
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function checkAssets(assets: AssetConfig[], deps: HealthDeps): Promise<AssetHealth[]> {
  const active = assets.filter((a) => a.status === "active");
  return Promise.all(
    active.map(async (asset): Promise<AssetHealth> => {
      let builtAt: Date | undefined;
      try {
        builtAt = await deps.entryMtime(asset);
      } catch {
        builtAt = undefined;
      }
      const stale = builtAt !== undefined && builtAt.getTime() > deps.orchestratorStartedAt.getTime();
      try {
        const info = await deps.introspect(asset);
        return { name: asset.name, reachable: true, toolCount: info.toolCount, version: info.version, builtAt: builtAt?.toISOString(), stale };
      } catch (err) {
        return { name: asset.name, reachable: false, stale, builtAt: builtAt?.toISOString(), error: msg(err) };
      }
    })
  );
}

/** Is the orchestrator itself running code older than what is built on disk? */
export async function checkSelf(deps: HealthDeps): Promise<SelfHealth> {
  if (!deps.selfMtime) return { stale: false };
  let builtAt: Date | undefined;
  try {
    builtAt = await deps.selfMtime();
  } catch {
    return { stale: false };
  }
  return {
    builtAt: builtAt?.toISOString(),
    stale: builtAt !== undefined && builtAt.getTime() > deps.orchestratorStartedAt.getTime(),
  };
}

export function renderHealth(results: AssetHealth[], startedAt: Date, self?: SelfHealth): string {
  const up = results.filter((r) => r.reachable).length;
  const staleCount = results.filter((r) => r.stale).length;
  const down = results.filter((r) => !r.reachable);

  const lines = results.map((r) => {
    if (!r.reachable) return `  ${r.name}: DOWN — ${r.error ?? "unreachable"}${r.stale ? "  (also: built after orchestrator start)" : ""}`;
    const bits = [`${r.toolCount} tools`];
    if (r.version) bits.push(`v${r.version}`);
    if (r.builtAt) bits.push(`built ${r.builtAt.slice(0, 16).replace("T", " ")}`);
    const staleTag = r.stale ? "  [STALE — rebuilt after orchestrator start; restart to load new code]" : "";
    return `  ${r.name}: UP  ${bits.join("  ")}${staleTag}`;
  });

  // The self-check goes ABOVE the roster, not below it. A reader who sees
  // "30/30 reachable" at the top has already drawn their conclusion; a warning
  // printed after the list arrives too late to change it.
  const selfBlock = self?.stale
    ? [
        `⚠ THIS ORCHESTRATOR IS STALE — its own build (${self.builtAt?.slice(0, 16).replace("T", " ")}) is NEWER than the`,
        `  running process. Everything below is reported BY the out-of-date code, so the`,
        `  roster can read perfectly healthy while routing, synthesis and every tool`,
        `  description still behave the old way. Restart the orchestrator (and the bridge,`,
        `  whose pool workers are spawned once at bridge startup) before trusting this.`,
        ``,
      ]
    : [];

  return [
    `ASSET HEALTH (orchestrator up since ${startedAt.toISOString().slice(0, 16).replace("T", " ")})`,
    ...selfBlock,
    `${up}/${results.length} reachable${staleCount ? `, ${staleCount} stale` : ""}${down.length ? `, ${down.length} DOWN` : ""}.`,
    ...(self && !self.stale && self.builtAt
      ? [`Orchestrator's own build: ${self.builtAt.slice(0, 16).replace("T", " ")} — current (older than this process).`]
      : []),
    ``,
    ...lines,
    ...(staleCount
      ? [``, `Stale = the asset's built code is newer than this orchestrator process. Fully restart the orchestrator (relaunch the app) to run the new code.`]
      : []),
    ...(down.length ? [``, `DOWN assets aren't answering — check their build (npm run build in that package) and the registry command/path.`] : []),
  ].join("\n");
}
