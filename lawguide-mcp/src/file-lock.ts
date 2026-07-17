/**
 * Serializes read-modify-write cycles against a given key (file path) within
 * this process so two concurrent tool calls can't clobber each other's writes.
 */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
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
