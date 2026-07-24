// Turn a failed job's raw log into an actionable, REDACTED diagnosis. All pure
// string work so it can be tested against literal log samples with no network.
import type { FailureSummary } from "./types.js";

// Redact anything credential-shaped BEFORE it can appear in a summary
// (requirement 7). GitHub Actions masks its own secrets as "***", but a log can
// still echo a token a script printed, or one in an error message.
const SECRET_PATTERNS: RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, // fine-grained PAT
  /\bbearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi,
  /\b(authorization|cookie)\s*[:=]\s*\S+/gi,
  /\bsk-[A-Za-z0-9]{16,}\b/g,
  /\bsk_[A-Za-z0-9_-]{16,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/gi,
  /\b(api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[:=]\s*\S+/gi,
];

export function redact(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (m) => (/[:=]/.test(m) ? m.replace(/([:=]\s*)\S+/, "$1[REDACTED]") : "[REDACTED]"));
  }
  return out;
}

// GitHub Actions log lines are prefixed with an ISO timestamp; drop it.
export function stripTimestamps(log: string): string {
  return log.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/gm, "");
}

const ERROR_LINE = /##\[error\]|(^|\s)(error|failed|failure)\b|Error:|AssertionError|Traceback|npm ERR!|error TS\d+|Cannot find module|ModuleNotFoundError|not ok\b|✕|✗|process completed with exit code [1-9]/i;

// Pull the most relevant error region: prefer the LAST ##[error] (the final
// failure), else the last cluster of error-ish lines. Bounded output.
export function extractError(log: string, maxChars = 1200): string {
  const clean = stripTimestamps(log);
  const lines = clean.split(/\r?\n/);
  const hitIdx: number[] = [];
  lines.forEach((l, i) => {
    if (ERROR_LINE.test(l)) hitIdx.push(i);
  });
  if (!hitIdx.length) {
    // No obvious error line — return the tail (failures usually surface at the end).
    return redact(lines.slice(-12).join("\n")).trim().slice(-maxChars);
  }
  const anchor = hitIdx[hitIdx.length - 1];
  const start = Math.max(0, anchor - 4);
  const end = Math.min(lines.length, anchor + 8);
  return redact(lines.slice(start, end).join("\n")).replace(/\n{3,}/g, "\n\n").trim().slice(0, maxChars);
}

interface Cause {
  test: RegExp;
  cause: string;
  next: string;
}
const CAUSES: Cause[] = [
  { test: /error TS\d+|tsc\b/i, cause: "a TypeScript compile error", next: "fix the type error in the named file, then rebuild." },
  { test: /Cannot find module|ModuleNotFoundError|MODULE_NOT_FOUND|ImportError/i, cause: "a missing module/dependency", next: "check the import path, or install/declare the dependency." },
  { test: /AssertionError|expect\(|toBe|toEqual|assert\b|not ok\b|✕/i, cause: "a test assertion failed", next: "read the failing assertion and fix the code or the test." },
  { test: /eslint|lint\b/i, cause: "a lint error", next: "run the linter locally and fix (or autofix) the reported rule." },
  { test: /npm ERR!|yarn error|pnpm.*ERR/i, cause: "an npm/build script failed", next: "run the failing script locally to reproduce, then fix it." },
  { test: /permission denied|EACCES|403|unauthorized|forbidden/i, cause: "a permissions/credentials error", next: "check the step's token/permissions and repository access." },
  { test: /timed out|timeout|cancell?ed/i, cause: "the step timed out or was cancelled", next: "look for a hang, or raise the step timeout." },
  { test: /process completed with exit code [1-9]|exit code [1-9]/i, cause: "a step exited non-zero", next: "inspect the failing step's command and its output above." },
];

export function classifyCause(errorText: string): { cause: string; next: string } {
  for (const c of CAUSES) if (c.test.test(errorText)) return { cause: c.cause, next: c.next };
  return { cause: "the run failed (cause not auto-classified)", next: "open the run at the link and read the failing step." };
}

const FILE_RE = /\b((?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]+)(?::\d+|\(\d+,\d+\)|", line \d+)?/g;

export function impactedFiles(errorText: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = FILE_RE.exec(errorText)) !== null) {
    const f = m[1];
    if (!/^https?:/.test(f) && !f.startsWith("node_modules/")) found.add(f);
    if (found.size >= 8) break;
  }
  return [...found];
}

export function summarizeFailure(input: { jobName: string; log: string; author?: string; runUrl?: string }): FailureSummary {
  const excerpt = extractError(input.log);
  const { cause, next } = classifyCause(excerpt);
  return {
    what: `${input.jobName} failed`,
    likelyCause: cause,
    impactedFiles: impactedFiles(excerpt),
    nextStep: next,
    errorExcerpt: excerpt,
    owner: input.author,
  };
}

export function renderFailure(f: FailureSummary): string {
  const lines = [
    `WHAT FAILED: ${f.what}`,
    `LIKELY CAUSE: ${f.likelyCause}`,
  ];
  if (f.impactedFiles.length) lines.push(`IMPACTED: ${f.impactedFiles.join(", ")}`);
  if (f.owner) lines.push(`LIKELY OWNER: ${f.owner}`);
  lines.push(`SUGGESTED NEXT STEP: ${f.nextStep}`);
  lines.push(``, `ERROR (redacted):`, f.errorExcerpt.split("\n").map((l) => `  ${l}`).join("\n"));
  return lines.join("\n");
}
