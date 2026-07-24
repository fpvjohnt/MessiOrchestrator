// Live team schedule/results via TheSportsDB — keyless (test key "3"). The one
// live call in the offline sports asset; degrades to the research path on any
// failure so regression stays network-free. Extracts named fields, not raw JSON.
const API = "https://www.thesportsdb.com/api/v1/json/3";
const TIMEOUT_MS = 8000;

function offline(team: string, why: string): string {
  return (
    `Could not fetch live sports data for "${team}" (${why}).\n` +
    `Use the research asset for current scores/standings instead.\n` +
    `BOTTOM LINE: no live sports data right now — verify via research.`
  );
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
    return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function teamScores(team: string): Promise<string> {
  const q = (team ?? "").trim();
  if (!q) return offline(String(team ?? ""), "no team name given");

  const s = await getJson(`${API}/searchteams.php?t=${encodeURIComponent(q)}`);
  const t = (s?.teams as Array<Record<string, string>> | null | undefined)?.[0];
  if (!t) return offline(q, "no matching team (try the full club name)");

  const id = t.idTeam;
  const [nextJson, lastJson] = await Promise.all([getJson(`${API}/eventsnext.php?id=${id}`), getJson(`${API}/eventslast.php?id=${id}`)]);
  const last = (lastJson?.results as Array<Record<string, string>> | undefined) ?? [];
  const next = (nextJson?.events as Array<Record<string, string>> | undefined) ?? [];

  const lines: string[] = [`${t.strTeam} (${t.strLeague ?? "?"}) — live via TheSportsDB:`];
  if (last.length) {
    lines.push(`  RECENT RESULTS:`);
    for (const e of last.slice(0, 5)) lines.push(`    ${e.dateEvent ?? "?"}  ${e.strEvent}: ${e.intHomeScore ?? "-"}-${e.intAwayScore ?? "-"}`);
  }
  if (next.length) {
    lines.push(`  NEXT FIXTURES:`);
    for (const e of next.slice(0, 5)) lines.push(`    ${e.dateEvent ?? "?"} ${e.strTime ?? ""}  ${e.strEvent}`);
  }
  if (!last.length && !next.length) lines.push(`  (no recent/upcoming events listed)`);
  lines.push(``, `BOTTOM LINE: live schedule/results for ${t.strTeam} — the free tier can lag on in-play scores; use research for a minute-by-minute live score.`);
  return lines.join("\n");
}
