import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { AssetConfig } from "./types.js";
import { describeUnknownTool } from "./tool-suggest.js";

// Caches the PENDING promise, not the resolved client, so two concurrent
// first calls for the same asset share one connection attempt instead of
// each spawning a child process (the loser of that race would leak, and
// its later exit would evict the winner's healthy entry).
const connections = new Map<string, Promise<Client>>();
const CONNECT_TIMEOUT_MS = 15_000;

function connect(asset: AssetConfig): Promise<Client> {
  const existing = connections.get(asset.name);
  if (existing) return existing;

  const pending = establishConnection(asset, () => {
    // Evict only if this entry still owns the slot — a stale connection's
    // late close must not evict a newer replacement.
    if (connections.get(asset.name) === pending) {
      connections.delete(asset.name);
    }
  });

  connections.set(asset.name, pending);
  pending.catch(() => {
    if (connections.get(asset.name) === pending) {
      connections.delete(asset.name);
    }
  });
  return pending;
}

async function establishConnection(asset: AssetConfig, evict: () => void): Promise<Client> {
  const client = new Client({ name: `orchestrator-to-${asset.name}`, version: "0.1.0" });
  client.onclose = evict;
  client.onerror = evict;

  const connectPromise = (async () => {
    if (asset.transport === "stdio") {
      if (!asset.command) {
        throw new Error(`Asset "${asset.name}" uses stdio transport but has no command configured.`);
      }
      // Harden GUI launches (Claude Desktop): a bare "node" command relies on
      // "node" being on the spawned process's PATH, which is not guaranteed when
      // the app is started from Explorer/Start Menu. process.execPath is the
      // absolute path to the very node binary already running this orchestrator,
      // so every child launches with the same runtime regardless of PATH.
      const command =
        asset.command === "node" || asset.command === "node.exe"
          ? process.execPath
          : asset.command;
      const transport = new StdioClientTransport({
        command,
        args: asset.args ?? [],
        cwd: asset.cwd,
        // Pass through PATH etc. so children that DO shell out still resolve
        // tools; StdioClientTransport otherwise starts from a minimal env.
        env: { ...getDefaultEnvironment(), ...(asset.env ?? {}) },
      });
      await client.connect(transport);
    } else {
      if (!asset.url) {
        throw new Error(`Asset "${asset.name}" uses http transport but has no url configured.`);
      }
      const transport = new StreamableHTTPClientTransport(new URL(asset.url));
      await client.connect(transport);
    }
  })();

  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out connecting to asset "${asset.name}" after ${CONNECT_TIMEOUT_MS}ms.`)),
      CONNECT_TIMEOUT_MS
    );
  });

  try {
    await Promise.race([connectPromise, timedOut]);
  } catch (err) {
    // If the timeout won but the connect later succeeds anyway, close the
    // orphan so its child process doesn't run unreachable forever. The
    // trailing catch also marks connectPromise's rejection as handled, so a
    // routine failed connect can't take the whole server down as an
    // unhandled rejection.
    connectPromise.then(() => client.close()).catch(() => {});
    throw err;
  } finally {
    clearTimeout(timer);
  }
  return client;
}

export async function listAssetTools(asset: AssetConfig) {
  const client = await connect(asset);
  const result = await client.listTools();
  return result.tools;
}

// Liveness probe for the health check: connect, count tools, and read the
// server's self-reported version. Reuses the shared connection cache, so this
// exercises the SAME process a real task would hit.
export async function introspectAsset(asset: AssetConfig): Promise<{ toolCount: number; version?: string }> {
  const client = await connect(asset);
  const result = await client.listTools();
  const info = client.getServerVersion?.();
  return { toolCount: result.tools.length, version: info?.version };
}

/** The text of a tool result, for inspecting an error the SDK returned rather
 * than threw. Shape is `{ content: [{ type: "text", text }], isError }`. */
function resultText(result: unknown): string {
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return "";
  return content.map((c) => (c as { text?: string })?.text ?? "").join(" ");
}

const NOT_FOUND = /tool\s+.*\s+not found/i;

export async function callAssetTool(asset: AssetConfig, toolName: string, args: unknown) {
  const client = await connect(asset);
  try {
    const result = await client.callTool({ name: toolName, arguments: (args ?? {}) as Record<string, unknown> });
    // An unknown tool comes back as an error RESULT, not a thrown error — the
    // first version of this fix only caught the throw and did nothing for the
    // path that actually occurs. Replaying a real logged call is what showed
    // it. Both paths are handled now; the throw path is still real for
    // transports that surface it that way.
    if ((result as { isError?: boolean })?.isError && NOT_FOUND.test(resultText(result))) {
      try {
        const available = (await client.listTools()).tools.map((t) => t.name);
        return {
          content: [{ type: "text" as const, text: describeUnknownTool(asset.name, toolName, available) }],
          isError: true,
        };
      } catch {
        return result; // listing failed too — the original error is the honest answer
      }
    }
    return result;
  } catch (err) {
    // "Tool X not found" tells the caller only what ISN'T true. It happened 13
    // times in the real case log, always on a near-miss guess, and every one
    // was a dead end. Answer the question they actually have — what IS it
    // called — by listing the real tools and pointing at the closest match.
    // Only this one error is enriched; everything else propagates untouched.
    const message = err instanceof Error ? err.message : String(err);
    if (!NOT_FOUND.test(message)) throw err;
    let available: string[] = [];
    try {
      available = (await client.listTools()).tools.map((t) => t.name);
    } catch {
      // The listing is a courtesy. If it fails too, the original error is
      // still the honest answer — don't mask a dead connection as a typo.
      throw err;
    }
    throw new Error(describeUnknownTool(asset.name, toolName, available));
  }
}

export async function disconnect(name: string): Promise<void> {
  const pending = connections.get(name);
  if (!pending) return;
  connections.delete(name);
  try {
    const client = await pending;
    await client.close();
  } catch {
    // Connection never succeeded — nothing to close.
  }
}

export async function disconnectAll(): Promise<void> {
  const names = [...connections.keys()];
  await Promise.all(names.map((name) => disconnect(name)));
}
