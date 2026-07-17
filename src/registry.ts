import { REGISTRY_PATH } from "./paths.js";
import { withFileLock } from "./file-lock.js";
import { loadJsonArray, saveJsonArray } from "./json-store.js";
import type { AssetConfig } from "./types.js";

export async function loadRegistry(): Promise<AssetConfig[]> {
  return loadJsonArray<AssetConfig>(REGISTRY_PATH);
}

async function saveRegistry(assets: AssetConfig[]): Promise<void> {
  await saveJsonArray(REGISTRY_PATH, assets);
}

export type AddAssetOutcome = "created" | "reactivated";

/**
 * Adds a new asset. If an asset with the same name already exists but is
 * retired, it is replaced (so a name doesn't stay permanently blocked once
 * its holder is retired). Active assets with the same name are rejected —
 * use updateAsset to edit one in place.
 */
export async function addAsset(asset: AssetConfig): Promise<AddAssetOutcome> {
  return withFileLock(REGISTRY_PATH, async () => {
    const assets = await loadRegistry();
    const idx = assets.findIndex((a) => a.name === asset.name);
    if (idx === -1) {
      assets.push(asset);
      await saveRegistry(assets);
      return "created";
    }
    if (assets[idx].status === "active") {
      throw new Error(
        `Asset "${asset.name}" is already active. Use update_asset to change its configuration, or retire_asset first.`
      );
    }
    assets[idx] = asset;
    await saveRegistry(assets);
    return "reactivated";
  });
}

export async function getAsset(name: string): Promise<AssetConfig | undefined> {
  const assets = await loadRegistry();
  return assets.find((a) => a.name === name);
}

export async function listAssets(): Promise<AssetConfig[]> {
  return loadRegistry();
}

export async function retireAsset(name: string): Promise<AssetConfig> {
  return withFileLock(REGISTRY_PATH, async () => {
    const assets = await loadRegistry();
    const asset = assets.find((a) => a.name === name);
    if (!asset) {
      throw new Error(`No asset named "${name}" is registered.`);
    }
    asset.status = "retired";
    await saveRegistry(assets);
    return asset;
  });
}

export type AssetPatch = Partial<
  Pick<AssetConfig, "description" | "tags" | "transport" | "command" | "args" | "cwd" | "env" | "url" | "fallback">
> & { reactivate?: boolean };

export async function updateAsset(name: string, patch: AssetPatch): Promise<AssetConfig> {
  return withFileLock(REGISTRY_PATH, async () => {
    const assets = await loadRegistry();
    const asset = assets.find((a) => a.name === name);
    if (!asset) {
      throw new Error(`No asset named "${name}" is registered.`);
    }
    if (patch.description !== undefined) asset.description = patch.description;
    if (patch.tags !== undefined) asset.tags = patch.tags;
    if (patch.transport !== undefined) asset.transport = patch.transport;
    if (patch.command !== undefined) asset.command = patch.command;
    if (patch.args !== undefined) asset.args = patch.args;
    if (patch.cwd !== undefined) asset.cwd = patch.cwd;
    if (patch.env !== undefined) asset.env = patch.env;
    if (patch.url !== undefined) asset.url = patch.url;
    if (patch.fallback !== undefined) asset.fallback = patch.fallback;
    if (patch.reactivate) asset.status = "active";
    await saveRegistry(assets);
    return asset;
  });
}
