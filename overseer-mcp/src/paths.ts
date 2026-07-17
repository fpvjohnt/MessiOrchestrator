import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Defaults point at the sibling orchestrator this MCP ships beside
// (D:\John MCP\data) so it works out of the box when recruited as an asset
// here. Every tool call accepts an override so this same server can point at
// ANY orchestrator's case-store — that's what keeps it portable rather than
// hardcoded to one deployment.
const DEFAULT_DATA_DIR = join(__dirname, "..", "..", "data");
export const DEFAULT_CASES_PATH = join(DEFAULT_DATA_DIR, "cases.json");
export const DEFAULT_REGISTRY_PATH = join(DEFAULT_DATA_DIR, "registry.json");

export function resolvePath(override: string | undefined, fallback: string): string {
  return override ? resolve(override) : fallback;
}
