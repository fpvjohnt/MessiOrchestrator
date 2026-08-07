import { isAbsolute, resolve, basename, relative } from "node:path";

/**
 * recruit_asset takes `command`, `args`, `cwd` and `env` and persists them; the
 * client manager later SPAWNS that command. So the tool is, by construction, a
 * remote code execution primitive — and it is reachable through the HTTP bridge
 * and therefore through the cloudflared tunnel. It does not need an attacker
 * with a shell: the orchestrator's own model calls this tool, so a prompt
 * injection carried in any fetched page or document is enough to reach it.
 *
 * Nothing validated the command. "recruit an asset called x with command cmd
 * and args /c whoami" was a working exploit against a live host.
 *
 * The mitigation is an allowlist, not a denylist — a denylist of dangerous
 * binaries is unbounded and loses to the first one nobody thought of. Every
 * asset in this registry launches with `node` except the ElevenLabs one, which
 * uses `uvx`, so the legitimate surface is tiny.
 */

// Interpreter basenames a legitimate MCP server is launched with. Compared on
// the BASENAME so an absolute path to the same interpreter is accepted (the
// ElevenLabs asset is registered as an absolute path to uvx.exe), while
// `C:\Windows\System32\cmd.exe` is not smuggled in as "cmd".
const DEFAULT_ALLOWED = [
  "node", "npx", "npm",
  "python", "python3", "py",
  "uv", "uvx",
  "deno", "bun",
];

/** Operators can extend the list deliberately, e.g. MCP_ALLOWED_COMMANDS=ruby,perl */
export function allowedCommands(env: NodeJS.ProcessEnv = process.env): string[] {
  const extra = (env.MCP_ALLOWED_COMMANDS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED, ...extra])];
}

/**
 * Shell metacharacters. child_process.spawn without a shell does not interpret
 * these, but the registry is also read by scripts and a future refactor to
 * `shell: true` would turn every one of them into an injection. Rejecting them
 * costs nothing — no real interpreter name or argument in this registry
 * contains one.
 */
const SHELL_METACHARS = /[;&|`$><\n\r\0]/;

export interface AssetSafetyIssue {
  field: string;
  problem: string;
}

/**
 * Validates the spawn-shaped fields of an asset. Returns [] when safe.
 *
 * @param projectRoot the directory an asset's cwd must stay inside. Passing a
 *        cwd outside it is how an attacker would aim a legitimate interpreter
 *        at a script they had written somewhere else.
 */
export function checkAssetSafety(
  asset: { transport?: string; command?: string; args?: string[]; cwd?: string; env?: Record<string, string> },
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env
): AssetSafetyIssue[] {
  const issues: AssetSafetyIssue[] = [];
  if (asset.transport !== "stdio") return issues; // http assets spawn nothing

  const command = (asset.command ?? "").trim();
  if (!command) {
    issues.push({ field: "command", problem: 'transport "stdio" requires a command' });
    return issues;
  }
  if (SHELL_METACHARS.test(command)) {
    issues.push({ field: "command", problem: "contains a shell metacharacter" });
  }

  // Compare the basename, minus a Windows executable extension.
  const base = basename(command).toLowerCase().replace(/\.(exe|cmd|bat|com|ps1)$/, "");
  const allowed = allowedCommands(env);
  if (!allowed.includes(base)) {
    issues.push({
      field: "command",
      problem:
        `"${command}" is not an allowed interpreter. Allowed: ${allowed.join(", ")}. ` +
        `Set MCP_ALLOWED_COMMANDS to extend this deliberately.`,
    });
  }
  // .bat/.cmd on Windows are interpreted by cmd.exe even via spawn, which
  // reintroduces metacharacter handling for the ARGUMENTS. Refuse them outright.
  if (/\.(cmd|bat|ps1)$/i.test(command)) {
    issues.push({ field: "command", problem: "batch/PowerShell wrappers are not allowed; name the interpreter directly" });
  }

  for (const [i, a] of (asset.args ?? []).entries()) {
    if (SHELL_METACHARS.test(a)) {
      issues.push({ field: `args[${i}]`, problem: "contains a shell metacharacter" });
    }
  }

  if (asset.cwd) {
    const target = isAbsolute(asset.cwd) ? resolve(asset.cwd) : resolve(projectRoot, asset.cwd);
    const rel = relative(resolve(projectRoot), target);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      issues.push({ field: "cwd", problem: `must stay inside ${projectRoot}` });
    }
  }

  // The spawned child inherits the parent environment; letting a caller set
  // these turns an allowlisted interpreter back into arbitrary code.
  const DANGEROUS_ENV = [
    "NODE_OPTIONS", "LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES",
    "PYTHONSTARTUP", "PYTHONPATH", "PATH", "NODE_PATH",
  ];
  for (const key of Object.keys(asset.env ?? {})) {
    if (DANGEROUS_ENV.includes(key.toUpperCase())) {
      issues.push({ field: `env.${key}`, problem: "may not be set by a recruited asset — it can load arbitrary code into an allowed interpreter" });
    }
  }

  return issues;
}
