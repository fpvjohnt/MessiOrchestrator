import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// dist/paths.js sits one level under the project root, so data/ is a sibling of dist/.
export const DATA_DIR = join(__dirname, "..", "data");
export const REFERENCE_PATH = join(DATA_DIR, "reference-2026.json");
