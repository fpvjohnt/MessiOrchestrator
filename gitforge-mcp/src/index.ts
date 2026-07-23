#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainTopic, startHere } from "./topics.js";
import { howTo, debug, mythVsReality } from "./toolkit.js";
import { checkPractice, practiceVerdict } from "./verify.js";

const server = new McpServer({ name: "gitforge", version: "0.1.0" });

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
const freeText = z.string().max(2000);
const lookupKey = z.string().max(200);

server.registerTool(
  "explain_topic",
  {
    title: "Explain a Git or GitHub Topic",
    description:
      "THE FRONT DOOR: name a topic across Git (the tool) and GitHub (the platform) — git basics/the three trees, branching, merge-vs-rebase, " +
      "undo & recovery (reflog/reset/revert/restore), history (log/blame/bisect), conflicts & stash, internals (objects/refs/HEAD), team " +
      "workflows; and GitHub repos/forks/pull-requests, Actions (CI/CD), releases/tags/issues, the API & gh CLI, repository security — and " +
      "get what it is, why it matters, the key ideas, the exact commands, and the pitfalls. Omit 'topic' for the full map.",
    inputSchema: { topic: lookupKey.optional() },
  },
  async ({ topic }) => {
    try {
      return textResult(explainTopic(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "how_to",
  {
    title: "How To Do a Specific Git/GitHub Task",
    description:
      "Name a goal in plain words and get the exact commands, safe path first: undo the last commit, fix/amend a commit, recover lost work, " +
      "open a pull request, resolve a merge conflict, move a commit off the wrong branch, stash work in progress, sync a fork, safely undo a " +
      "pushed commit, ignore/untrack files. The history-rewriting variants are flagged so you don't disrupt shared branches.",
    inputSchema: { goal: freeText },
  },
  async ({ goal }) => {
    try {
      return textResult(howTo(goal));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "debug",
  {
    title: "Debug a Git/GitHub Problem",
    description:
      "Describe the symptom and get the likely cause + the fix in order: detached HEAD, push rejected (non-fast-forward), merge/rebase " +
      "conflict, 'I lost my work' after a reset, committed to the wrong branch, push blocked by a large file, or committed a secret/API key. " +
      "Most Git 'disasters' are a moved pointer, not lost data — the fix is usually reflog, not panic.",
    inputSchema: { symptom: freeText },
  },
  async ({ symptom }) => {
    try {
      return textResult(debug(symptom));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "myth_vs_reality",
  {
    title: "Git & GitHub Myths vs Reality",
    description:
      "The folklore that scares people away from Git's best features, debunked honestly: 'Git and GitHub are the same', 'rebase is " +
      "dangerous', 'reset --hard deletes commits forever', 'force-push is always bad', 'deleting a secret file removes the leak', 'you need " +
      "the server to work', 'git blame names who's responsible'. The tool is safer and more recoverable than its reputation.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(mythVsReality());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "check_practice",
  {
    title: "Check a Current GitHub/Git Specific (via Research)",
    description:
      "For the fast-moving GitHub product surface — current GitHub Actions YAML/syntax, gh CLI commands/flags, new features or changed " +
      "defaults, an action's current version. Returns authoritative sources (git-scm.com, docs.github.com, the Changelog) + red flags + " +
      "research queries; then call practice_verdict. Git core behavior is stable and answered directly — this is for the GitHub surface that " +
      "actually changes.",
    inputSchema: { topic: freeText },
  },
  async ({ topic }) => {
    try {
      return textResult(checkPractice(topic));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "practice_verdict",
  {
    title: "Grade a GitHub/Git Finding from Research",
    description:
      "Second half of the verify loop: given what research found about a GitHub feature, Actions syntax, or gh command, grade how CURRENT " +
      "and official it is (official+current → stale blog → unsafe) and give the corrected command, labeled VERIFIED / UPDATED / UNVERIFIED. " +
      "Pass the topic and the findings.",
    inputSchema: { topic: freeText, findings: freeText },
  },
  async ({ topic, findings }) => {
    try {
      return textResult(practiceVerdict(topic, findings));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "start_here",
  {
    title: "Start Here",
    description: "New here? What the Git & GitHub expert covers, the two lenses, and the one rule that prevents the most pain.",
    inputSchema: {},
  },
  async () => textResult(startHere())
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("close", () => process.exit(0));

  // Parent-death watchdog: if our parent (the orchestrator) dies WITHOUT cleanly
  // closing our stdin — a hard kill, crash, or abrupt reboot — the stdin-EOF
  // handlers above may never fire and we would linger as an orphan. Poll the
  // parent's liveness and self-terminate when it is gone, so residual process
  // trees can't pile up across reboots. unref() so this timer never keeps us alive.
  const __parentPid = process.ppid;
  setInterval(() => {
    try {
      process.kill(__parentPid, 0); // signal 0 = liveness probe; throws if gone
    } catch {
      process.exit(0);
    }
  }, 5000).unref();
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => process.exit(0));
}
main().catch((err) => {
  console.error("Fatal error starting gitforge MCP server:", err);
  process.exit(1);
});
