// Selection logic for archive-cases.mjs, kept pure and separate so
// regression.mjs can prove it without touching the real cases.json.
//
// This code decides which of your cases move out of the live store. A mistake
// here is silent data movement, so the properties that matter most are the
// boring ones: nothing is lost, nothing is duplicated, and an open case is
// never archived no matter how old it is.

/**
 * A case can be archived only if it is closed AND its closedAt is a real date
 * older than the cutoff.
 *
 * A closed case with a missing or unparseable closedAt is deliberately NOT
 * archivable — we cannot know it is old enough. analyzeStore reports those
 * separately so they don't just silently pile up in the live file forever.
 */
export function isArchivable(c, cutoffMs) {
  if (c?.status !== "closed") return false;
  const closedAt = c.closedAt ? Date.parse(c.closedAt) : NaN;
  return Number.isFinite(closedAt) && closedAt < cutoffMs;
}

/**
 * Splits the live store into what moves and what stays.
 *
 * Single pass, so a case lands in exactly one side by construction. The
 * original did this as two independent .filter() calls over the same
 * predicate — correct, but only as long as both stayed in sync, and the cost
 * of them drifting apart is a case that is either dropped from both files or
 * written to both.
 */
export function partitionCases(cases, cutoffMs) {
  const toArchive = [];
  const toKeep = [];
  for (const c of cases) (isArchivable(c, cutoffMs) ? toArchive : toKeep).push(c);
  return { toArchive, toKeep };
}

/**
 * Merges newly-archived cases into the existing archive, skipping ids already
 * there.
 *
 * The write order in archive-cases.mjs is archive-first, then the shrunken
 * live file, so that a crash in between duplicates cases rather than losing
 * them — the recoverable direction. But "recoverable" only holds if the next
 * run actually recovers: without this dedup, the re-archived cases would be
 * appended a second time and the duplicates would become permanent.
 */
export function mergeArchive(existing, incoming) {
  const seen = new Set(existing.map((c) => c?.id).filter((id) => id !== undefined));
  const added = [];
  for (const c of incoming) {
    if (c?.id !== undefined && seen.has(c.id)) continue;
    if (c?.id !== undefined) seen.add(c.id);
    added.push(c);
  }
  return { merged: [...existing, ...added], added: added.length, skipped: incoming.length - added.length };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Everything the report needs, computed once.
 *
 * The point of this is the case where nothing is archivable. The script used
 * to print "Nothing to archive" and exit 0 — indistinguishable from a healthy
 * run, while cases.json grew without limit. It needs to say WHY nothing
 * matched and what would change that.
 */
export function analyzeStore(cases, { nowMs, cutoffMs, idleOpenDays = 14 }) {
  const { toArchive, toKeep } = partitionCases(cases, cutoffMs);
  const closed = cases.filter((c) => c?.status === "closed");
  const open = cases.filter((c) => c?.status !== "closed");

  const closedAges = closed
    .map((c) => Date.parse(c?.closedAt ?? ""))
    .filter(Number.isFinite)
    .map((t) => Math.floor((nowMs - t) / DAY_MS));

  // Closed but undateable: invisible to every cutoff, so they accumulate.
  const undateable = closed.filter((c) => !Number.isFinite(Date.parse(c?.closedAt ?? "")));

  // Open cases are never archivable at any cutoff. One left open by accident
  // is permanent weight in the file, and nothing else would ever mention it.
  const idleOpen = open
    .map((c) => ({ id: c?.id, days: Math.floor((nowMs - Date.parse(c?.openedAt ?? "")) / DAY_MS) }))
    .filter((o) => Number.isFinite(o.days) && o.days >= idleOpenDays)
    .sort((a, b) => b.days - a.days);

  return {
    total: cases.length,
    openCount: open.length,
    closedCount: closed.length,
    archivableCount: toArchive.length,
    keepCount: toKeep.length,
    oldestClosedDays: closedAges.length ? Math.max(...closedAges) : null,
    newestClosedDays: closedAges.length ? Math.min(...closedAges) : null,
    undateableCount: undateable.length,
    idleOpen,
    bytes: Buffer.byteLength(JSON.stringify(cases)),
    toArchive,
    toKeep,
  };
}

/**
 * The cutoffs that would actually move something, so a run that archived
 * nothing still tells you what to pass instead of leaving you to guess.
 */
export function suggestCutoffs(cases, nowMs, candidates = [7, 14, 30, 60, 90]) {
  return candidates.map((days) => ({
    days,
    count: cases.filter((c) => isArchivable(c, nowMs - days * DAY_MS)).length,
  }));
}
