import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Zero-dependency .env loader. Reads research-mcp/.env (if present) and sets any
// KEY=value pairs into process.env WITHOUT overwriting vars already set in the
// real environment. Lets the user drop the optional search API keys
// (BRAVE_API_KEY, TAVILY_API_KEY, GOOGLE_API_KEY, GOOGLE_CSE_ID) in a file
// instead of exporting them in a shell. Runs on import — keep this the FIRST
// import in index.ts so keys are set before the providers read process.env.
function loadEnvFile(): void {
  try {
    const here = dirname(fileURLToPath(import.meta.url)); // dist/
    const raw = readFileSync(join(here, "..", ".env"), "utf-8"); // research-mcp/.env
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // No .env (or unreadable) — fine, all these keys are optional.
  }
}

loadEnvFile();
