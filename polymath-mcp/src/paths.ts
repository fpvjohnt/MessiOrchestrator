import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = join(__dirname, "..", "data");
export const REFERENCE_PATH = join(DATA_DIR, "reference-2026.json");
export const CONTEXT_PATH = join(DATA_DIR, "work-context.json");
