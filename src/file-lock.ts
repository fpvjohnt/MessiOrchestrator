import { open, unlink, stat, mkdir, readFile, utimes } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Serializes read-modify-write cycles against a given key (typically a file
 * path) within this process. Without this, two concurrent tool calls that
 * both load a JSON store, mutate it, and save it back can race — the second
 * save silently clobbers the first (a classic lost update).
 */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    // Swallow rejections in the chain itself so one failed task doesn't
    // permanently wedge the queue for tasks after it.
    this.tail = result.catch(() => {});
    return result;
  }
}

const locks = new Map<string, Mutex>();

// The in-process Mutex above only serializes callers inside ONE Node process.
// It does nothing for two separate orchestrator processes writing the same
// data/*.json — e.g. Claude Desktop's stdio orchestrator running alongside a
// bridge/server.mjs session's own spawned orchestrator child. Both are real,
// concurrent OS processes today, so a second layer — an on-disk advisory lock
// — closes the cross-process gap the in-memory Mutex can't reach.
//
// Read at call time rather than at module load so the stale and heartbeat
// paths are testable without sitting through the production timings (same
// reason the bridge's session reaper takes its TTL from the environment).
function envMs(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const lockRetryMs = () => envMs("MCP_LOCK_RETRY_MS", 50);
const lockTimeoutMs = () => envMs("MCP_LOCK_TIMEOUT_MS", 5_000);
// A process that crashes while holding the lock leaves the lock file behind
// forever; past this age with no heartbeat, treat it as abandoned rather than
// wedging every other process on this store indefinitely.
const staleLockMs = () => envMs("MCP_LOCK_STALE_MS", 10_000);
const heartbeatMs = () => envMs("MCP_LOCK_HEARTBEAT_MS", 2_000);

type LockFileState = { token: string; mtimeMs: number };

async function readLockFile(lockPath: string): Promise<LockFileState | null> {
  try {
    const [token, s] = await Promise.all([readFile(lockPath, "utf-8"), stat(lockPath)]);
    return { token, mtimeMs: s.mtimeMs };
  } catch {
    return null; // gone, or being replaced right now
  }
}

/**
 * Acquires the on-disk advisory lock for `key`, returning its release function.
 *
 * Exported for the cross-process tests only — a single process cannot reach
 * this path through withFileLock, because the in-memory Mutex there serializes
 * same-key callers before they ever touch the disk. withFileLock is the API.
 */
export async function acquireCrossProcessLock(key: string): Promise<() => Promise<void>> {
  const lockPath = `${key}.lock`;
  await mkdir(dirname(lockPath), { recursive: true });
  // Identifies THIS acquisition, not this process: one process legitimately
  // takes and releases the same lock many times, and release must only remove
  // the file it personally created.
  const token = `${process.pid}:${randomUUID()}`;
  const stale = staleLockMs();
  const deadline = Date.now() + lockTimeoutMs();

  for (;;) {
    try {
      // Exclusive create: fails with EEXIST iff another process already holds
      // the lock. Atomic at the OS level, unlike a stat-then-write check.
      const handle = await open(lockPath, "wx");
      try {
        await handle.writeFile(token, "utf-8");
      } finally {
        await handle.close();
      }
      return makeRelease(lockPath, token);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;

      const held = await readLockFile(lockPath);
      if (!held) continue; // vanished between our failed open and this read

      if (Date.now() - held.mtimeMs > stale) {
        // Re-read immediately before deleting. Between judging this lock stale
        // and acting on it, the holder may have released and a NEW process
        // taken the lock; deleting that one would hand the store to two
        // writers at once. Identical token AND mtime means nothing moved in
        // between.
        const again = await readLockFile(lockPath);
        if (again && again.token === held.token && again.mtimeMs === held.mtimeMs) {
          await unlink(lockPath).catch(() => {});
        }
        continue; // retry the exclusive create
      }

      if (Date.now() > deadline) {
        throw new Error(
          `Timed out waiting for cross-process lock on ${key} (held > ${lockTimeoutMs()}ms by ${held.token}).`
        );
      }
      await new Promise((r) => setTimeout(r, lockRetryMs()));
    }
  }
}

function makeRelease(lockPath: string, token: string): () => Promise<void> {
  // Touch the lock while the task runs. Staleness is meant to detect a holder
  // that DIED, but mtime was only ever written at creation — so any operation
  // slower than the stale window had its lock stolen out from under it while it
  // was still mid-write. With a heartbeat, "stale" means the holder stopped
  // running, which is what it was always supposed to mean.
  const beat = setInterval(() => {
    void (async () => {
      const held = await readLockFile(lockPath);
      // If this acquisition no longer owns the file, stop touching it:
      // refreshing a different holder's lock would keep it looking alive after
      // that holder died, and nothing would ever reclaim it.
      if (!held || held.token !== token) {
        clearInterval(beat);
        return;
      }
      const now = new Date();
      await utimes(lockPath, now, now).catch(() => {});
    })();
  }, heartbeatMs());
  beat.unref();

  return async () => {
    clearInterval(beat);
    // Only remove the lock if it is still OURS.
    //
    // This is the bug this function exists to prevent: release used to unlink
    // unconditionally. If a stale sweep had decided this holder was dead and
    // handed the lock on, the late release would delete the NEW holder's lock
    // and let a third writer into the store alongside it — one slow write
    // turning into two concurrent read-modify-write cycles on cases.json, with
    // nothing logged anywhere.
    //
    // A steal landing between this read and the unlink is still possible in
    // principle. The heartbeat above is what makes that require a holder that
    // is simultaneously alive and judged dead, which is the case this check
    // exists to survive rather than to prove impossible.
    const held = await readLockFile(lockPath);
    if (!held || held.token !== token) return;
    await unlink(lockPath).catch(() => {});
  };
}

export function withFileLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  let mutex = locks.get(key);
  if (!mutex) {
    mutex = new Mutex();
    locks.set(key, mutex);
  }
  // In-process queueing first (cheap, no disk I/O for the common single-process
  // case), then the cross-process lock around the actual read-modify-write.
  return mutex.run(async () => {
    const release = await acquireCrossProcessLock(key);
    try {
      return await task();
    } finally {
      await release();
    }
  });
}
