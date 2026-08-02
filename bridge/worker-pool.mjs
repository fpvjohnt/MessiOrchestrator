// A pool of warm orchestrator processes, with least-busy routing across them.
//
// WHY THIS REPLACED ONE-CHILD-PER-SESSION
// The bridge used to spawn an orchestrator per HTTP session and keep it for the
// life of that session. Each warmed orchestrator holds its 21 asset servers at
// ~80MB apiece, so sessions were ~1.5GB each and 61 of them once accumulated in
// a single bridge lifetime. That forced an idle reaper, a session cap, and a
// handshake-grace timer — three mechanisms whose only job was to undo the
// damage of tying process lifetime to client behaviour.
//
// A fixed pool inverts it. Process count is decided here, not by how many times
// a phone reconnects, so memory is bounded by configuration instead of by luck.
// Workers stay warm, so no request pays a cold start.
//
// WHY THIS IS SAFE TO LOAD-BALANCE
// Routing consecutive calls to different workers is only safe if a worker holds
// no conversation state. It doesn't: case state lives in a JSON file guarded by
// withFileLock (src/case-store.ts), and the only module-level mutable value in
// the orchestrator is a `shuttingDown` flag. The client-manager's Map is a warm
// connection cache, not user state. The orchestrator also never initiates a
// request — no sampling, no elicitation, no notifications — which is what makes
// a request/response proxy lossless here.
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PROTOCOL_VERSION = "2025-06-18";

export class WorkerPool {
  /**
   * @param {object} opts
   * @param {number} opts.size          how many orchestrators to keep warm
   * @param {string} opts.command       node
   * @param {string[]} opts.args        [dist/index.js]
   * @param {string} opts.cwd
   * @param {(...a:any[])=>void} opts.log
   * @param {number} [opts.requestTimeoutMs]
   */
  constructor({ size, command, args, cwd, log, requestTimeoutMs = 10 * 60 * 1000 }) {
    this.size = Math.max(1, size);
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.log = log;
    this.requestTimeoutMs = requestTimeoutMs;
    this.workers = [];
    this.nextId = 1;
    this.serverInfo = null;    // initialize result, replayed to clients
    this.closing = false;
    this.totals = { dispatched: 0, failed: 0, restarts: 0 };
  }

  async start() {
    for (let i = 0; i < this.size; i++) await this.#spawn(i);
    if (!this.serverInfo) throw new Error("no worker completed its handshake");
    this.log(`worker pool ready: ${this.liveCount()}/${this.size} warm`);
  }

  liveCount() {
    return this.workers.filter((w) => w && w.ready).length;
  }

  stats() {
    return {
      size: this.size,
      live: this.liveCount(),
      inFlight: this.workers.reduce((n, w) => n + (w ? w.pending.size : 0), 0),
      perWorker: this.workers.map((w) => (w ? { id: w.id, ready: w.ready, inFlight: w.pending.size, served: w.served } : null)),
      ...this.totals,
    };
  }

  async #spawn(slot) {
    const transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      cwd: this.cwd,
      stderr: "inherit",
    });
    const worker = { id: slot, transport, ready: false, pending: new Map(), served: 0 };
    this.workers[slot] = worker;

    // Every message from a worker is a reply to something we sent, because the
    // orchestrator never initiates. Match it to its waiter by id and settle.
    transport.onmessage = (msg) => {
      if (msg?.id === undefined || msg.id === null) return;   // stray notification
      const waiter = worker.pending.get(msg.id);
      if (!waiter) return;
      worker.pending.delete(msg.id);
      clearTimeout(waiter.timer);
      waiter.resolve(msg);
    };
    transport.onerror = (err) => this.log(`worker ${slot} error:`, err?.message ?? err);
    transport.onclose = () => {
      worker.ready = false;
      for (const [, waiter] of worker.pending) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error("worker exited mid-request"));
      }
      worker.pending.clear();
      if (this.closing) return;
      this.totals.restarts++;
      this.log(`worker ${slot} exited — respawning`);
      // Delay so a worker that dies instantly on start cannot spin the CPU.
      setTimeout(() => { if (!this.closing) void this.#spawn(slot).catch((e) => this.log(`respawn ${slot} failed:`, e?.message ?? e)); }, 2000).unref();
    };

    await transport.start();

    const init = await this.#send(worker, {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "john-mcp-bridge", version: "2" },
      },
    });
    if (init.error) throw new Error(`worker ${slot} refused initialize: ${init.error.message}`);
    await transport.send({ jsonrpc: "2.0", method: "notifications/initialized" });

    worker.ready = true;
    // Every worker runs the same binary, so the first result speaks for all.
    if (!this.serverInfo) this.serverInfo = init.result;
    this.log(`worker ${slot} warm`);
  }

  /** Send one already-id'd message to one worker and await its reply. */
  #send(worker, message) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.pending.delete(message.id);
        reject(new Error(`worker ${worker.id} did not answer within ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);
      timer.unref?.();
      worker.pending.set(message.id, { resolve, reject, timer });
      worker.transport.send(message).catch((err) => {
        worker.pending.delete(message.id);
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Least in-flight wins, so one slow research call cannot queue the next
   * request behind it while another worker sits idle. Ties break on the worker
   * that has served least, which spreads warm-up evenly after a restart.
   */
  #pick() {
    const live = this.workers.filter((w) => w && w.ready);
    if (!live.length) return null;
    return live.reduce((best, w) => {
      if (w.pending.size !== best.pending.size) return w.pending.size < best.pending.size ? w : best;
      return w.served < best.served ? w : best;
    });
  }

  /**
   * Route one JSON-RPC REQUEST (it must have an id) and return the response,
   * with the caller's own id restored. Ids are rewritten on the way out because
   * two unrelated HTTP clients may both legitimately use id 1.
   */
  async request(message) {
    const worker = this.#pick();
    if (!worker) throw new Error("no warm orchestrator available");
    const clientId = message.id;
    const bridgeId = this.nextId++;
    worker.served++;
    this.totals.dispatched++;
    try {
      const reply = await this.#send(worker, { ...message, id: bridgeId });
      return { ...reply, id: clientId };
    } catch (err) {
      this.totals.failed++;
      throw err;
    }
  }

  /** Fire-and-forget a notification at one worker. */
  async notify(message) {
    const worker = this.#pick();
    if (!worker) return;
    await worker.transport.send(message).catch((err) => this.log("notify failed:", err?.message ?? err));
  }

  async close() {
    this.closing = true;
    await Promise.all(this.workers.map((w) => w?.transport.close().catch(() => {})));
  }
}
