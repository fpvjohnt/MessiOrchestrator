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

export function withFileLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  let mutex = locks.get(key);
  if (!mutex) {
    mutex = new Mutex();
    locks.set(key, mutex);
  }
  return mutex.run(task);
}
