import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// dist/paths.js lives one level under the project root, so data/ is a sibling of dist/.
export const DATA_DIR = join(__dirname, "..", "data");
export const REGISTRY_PATH = join(DATA_DIR, "registry.json");
export const CASES_PATH = join(DATA_DIR, "cases.json");
