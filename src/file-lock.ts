import { open, unlink, stat, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

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
const LOCK_RETRY_MS = 50;
const LOCK_TIMEOUT_MS = 5_000;
// A process that crashes while holding the lock leaves the lock file behind
// forever; past this age, treat it as abandoned rather than wedging every
// other process on this store indefinitely.
const STALE_LOCK_MS = 10_000;

async function acquireCrossProcessLock(key: string): Promise<() => Promise<void>> {
  const lockPath = `${key}.lock`;
  await mkdir(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      // Exclusive create: fails with EEXIST iff another process already holds
      // the lock. Atomic at the OS level, unlike a stat-then-write check.
      const handle = await open(lockPath, "wx");
      await handle.close();
      return () => unlink(lockPath).catch(() => {});
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      try {
        const s = await stat(lockPath);
        if (Date.now() - s.mtimeMs > STALE_LOCK_MS) {
          await unlink(lockPath).catch(() => {});
          continue; // retry the exclusive create immediately
        }
      } catch {
        continue; // lock vanished between our failed open and this stat — retry
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for cross-process lock on ${key} (held > ${LOCK_TIMEOUT_MS}ms).`);
      }
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
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
