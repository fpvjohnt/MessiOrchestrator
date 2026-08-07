import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// dist/paths.js lives one level under the project root, so data/ is a sibling of dist/.
// The project root — dist/paths.js sits one level under it. Used to confine a
// recruited asset's cwd; see asset-safety.ts.
export const PROJECT_ROOT = join(__dirname, "..");
export const DATA_DIR = join(__dirname, "..", "data");
export const REGISTRY_PATH = join(DATA_DIR, "registry.json");
export const CASES_PATH = join(DATA_DIR, "cases.json");
