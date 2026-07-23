// Decision logic for the supervisor, kept pure and separate from supervisor.mjs
// so regression.mjs can prove it without spawning a bridge, killing a process,
// or waiting out a 30-minute repeat window.
//
// Two problems live here, and they are the reason this file exists at all:
//
//   1. LIVENESS, NOT EXISTENCE. The old supervisor asked "is something
//      listening on 8787?" (netstat) and "is cloudflared.exe in the task
//      list?" (tasklist). Both answer yes for a process that has stopped
//      doing its job: a wedged node still holds its listening socket, and a
//      cloudflared whose connections to the edge have all dropped is still a
//      running executable. The supervisor would report healthy forever while
//      the phone got nothing. interpretBridge/interpretTunnel below ask the
//      process to actually answer, and treat "answered wrongly" as down.
//
//   2. NO ALERTING. Nothing ever told the user a thing had broken. But naive
//      alerting is its own failure: a 30-second loop that alerts on every
//      failed probe produces 120 notifications an hour and gets muted, which
//      is the same as having no alerting. createHealthTracker is the state
//      machine that turns a stream of probes into the few messages a human
//      should actually see — on transition, on restart, and on a slow repeat
//      while still broken.

export const UP = "up";
export const DOWN = "down";
// Answering, so restarting it would be destructive — but reporting something
// that will become an outage if ignored. Alerts, never restarts.
export const DEGRADED = "degraded";

/**
 * Turn a raw /healthz probe into a verdict.
 *
 * `probe` is { reachable, status, body, error } — see probeJson in
 * supervisor.mjs. Kept as plain data so tests can hand-build every case,
 * including ones that are hard to produce on demand against a real bridge.
 */
export function interpretBridge(probe, { sessionIdleMs } = {}) {
  if (!probe.reachable) return { state: DOWN, reason: probe.error ?? "no response" };
  if (probe.status !== 200) return { state: DOWN, reason: `HTTP ${probe.status}` };
  // A wedged-but-listening bridge accepts the TCP connection and then never
  // answers; that surfaces as a timeout above. This catches the subtler case
  // where it answers with something that isn't the health document.
  if (!probe.body || probe.body.ok !== true) return { state: DOWN, reason: "healthz did not report ok" };

  // oldestIdleMin climbing past the reap TTL means the reaper has stopped —
  // the exact failure that accumulated 61 sessions and 2.46GB before anyone
  // noticed. Doubled because the sweep runs on its own interval and a session
  // can legitimately sit slightly past the TTL between passes.
  if (sessionIdleMs) {
    const oldestMs = (probe.body.oldestIdleMin ?? 0) * 60_000;
    if (oldestMs > sessionIdleMs * 2) {
      return {
        state: DEGRADED,
        reason: `session idle ${probe.body.oldestIdleMin}min exceeds ${Math.round(sessionIdleMs / 60_000)}min reap TTL - reaper may have stopped`,
      };
    }
  }
  return { state: UP, reason: `${probe.body.sessions} session(s)` };
}

/**
 * Turn a cloudflared metrics /ready probe into a verdict.
 *
 * readyConnections is the whole point: it is the count of live connections to
 * Cloudflare's edge. Zero means the process is running and the tunnel is
 * carrying nothing — a dead phone path that every process-existence check in
 * the world reports as healthy.
 */
export function interpretTunnel(probe) {
  if (!probe.reachable) return { state: DOWN, reason: probe.error ?? "metrics endpoint unreachable" };
  if (probe.status !== 200) return { state: DOWN, reason: `HTTP ${probe.status}` };
  const ready = probe.body?.readyConnections;
  if (typeof ready !== "number") return { state: DOWN, reason: "no readyConnections in /ready" };
  if (ready < 1) return { state: DOWN, reason: "0 connections to the Cloudflare edge" };
  return { state: UP, reason: `${ready} edge connection(s)` };
}

// Alert rendering. Pure, and here rather than inline in supervisor.mjs because
// these strings ARE the outage record — logs/alerts.log and the webhook body
// are what you read at 3am, and a template that silently loses its
// substitutions still writes a plausible-looking line. That is not
// hypothetical: a careless bulk edit once reduced the log line to
// "[ERROR]  - ", which is well-formed, alerts nothing, and passes every test
// that only checks the state machine. These two have assertions.
export function formatAlertLine(timestamp, alert) {
  return `${timestamp} [${alert.level.toUpperCase()}] ${alert.title} - ${alert.message}`;
}

/** Single-line form for webhook shapes that take one text field (slack, discord). */
export function formatAlertText(host, alert) {
  return `[${host}] ${alert.title} - ${alert.message}`;
}

// Extra failed cycles required before each successive restart attempt. Without
// this, a component that cannot start (bad config, port stolen by something
// else, expired credential) gets killed and relaunched every 60s forever —
// burning CPU and filling the alert log with identical messages. Grows to ~16
// minutes between attempts at a 30s interval, then holds there so a machine
// that recovers on its own is still picked up within a quarter hour.
const DEFAULT_BACKOFF = [2, 4, 8, 16, 32];

/**
 * The alert/restart state machine.
 *
 * One tracker holds every component. record() is called once per probe and
 * returns what to DO — it performs no I/O itself, which is what makes the
 * dedup and backoff rules testable in microseconds instead of hours.
 */
export function createHealthTracker({
  failuresBeforeRestart = 2,
  repeatMs = 30 * 60 * 1000,
  backoff = DEFAULT_BACKOFF,
} = {}) {
  const components = new Map();

  function stateOf(name) {
    let s = components.get(name);
    if (!s) {
      // Starting at UP means a supervisor that starts while everything is
      // healthy stays silent. It also means the first probe of a component
      // that is already broken has to fail `failuresBeforeRestart` times
      // before acting — correct, because a probe issued while the machine is
      // still booting should not trigger a kill.
      s = {
        state: UP,
        failures: 0,
        restartAttempts: 0,
        failuresAtLastRestart: 0,
        lastAlertAt: 0,
        alerted: false,
        downSince: null,
      };
      components.set(name, s);
    }
    return s;
  }

  function backoffFor(attempts) {
    if (attempts === 0) return 0;
    return backoff[Math.min(attempts - 1, backoff.length - 1)];
  }

  return {
    /** Test/diagnostic view. Never mutate the returned object. */
    peek(name) {
      return { ...stateOf(name) };
    },

    /**
     * @returns {{restart: boolean, alerts: Array<{level: string, title: string, message: string}>}}
     */
    record(name, verdict, now = Date.now()) {
      const s = stateOf(name);
      const alerts = [];
      let restart = false;

      if (verdict.state === UP) {
        // Only announce a recovery if the user was told about the problem.
        // Otherwise a single dropped packet below the restart threshold
        // produces a cheerful "recovered" with nothing before it.
        if (s.alerted) {
          const downMin = s.downSince ? Math.round((now - s.downSince) / 60_000) : 0;
          alerts.push({
            level: "recovery",
            title: `${name} recovered`,
            message: `${name} is healthy again (${verdict.reason}) after ~${downMin}min and ${s.restartAttempts} restart attempt(s).`,
          });
        }
        s.state = UP;
        s.failures = 0;
        s.restartAttempts = 0;
        s.failuresAtLastRestart = 0;
        s.alerted = false;
        s.downSince = null;
        return { restart, alerts };
      }

      if (s.downSince === null) s.downSince = now;

      if (verdict.state === DEGRADED) {
        // Never restart on degraded: the component is answering, so a kill
        // would drop live sessions to fix something that is not yet an outage.
        const isTransition = s.state !== DEGRADED;
        if (isTransition || (s.alerted && now - s.lastAlertAt >= repeatMs)) {
          alerts.push({
            level: "warning",
            title: `${name} degraded`,
            message: `${name} is answering but unhealthy: ${verdict.reason}`,
          });
          s.lastAlertAt = now;
          s.alerted = true;
        }
        s.state = DEGRADED;
        return { restart, alerts };
      }

      // DOWN
      s.failures += 1;
      const dueForRestart =
        s.failures >= failuresBeforeRestart &&
        s.failures - s.failuresAtLastRestart >= backoffFor(s.restartAttempts);

      if (dueForRestart) {
        restart = true;
        s.restartAttempts += 1;
        s.failuresAtLastRestart = s.failures;
        alerts.push({
          level: s.restartAttempts > 1 ? "critical" : "error",
          title: `${name} is down`,
          message:
            s.restartAttempts > 1
              ? `${name} is still down after ${s.restartAttempts - 1} restart(s): ${verdict.reason}. Restarting again (attempt ${s.restartAttempts}).`
              : `${name} stopped responding: ${verdict.reason}. Restarting it.`,
        });
        s.lastAlertAt = now;
        s.alerted = true;
      } else if (s.alerted && now - s.lastAlertAt >= repeatMs) {
        // Still broken and waiting out the backoff. Say so on a slow cadence
        // so a days-long outage doesn't go quiet just because the retries did.
        const downMin = Math.round((now - s.downSince) / 60_000);
        alerts.push({
          level: "critical",
          title: `${name} still down`,
          message: `${name} has been down ~${downMin}min across ${s.restartAttempts} restart attempt(s): ${verdict.reason}`,
        });
        s.lastAlertAt = now;
      }

      s.state = DOWN;
      return { restart, alerts };
    },
  };
}
