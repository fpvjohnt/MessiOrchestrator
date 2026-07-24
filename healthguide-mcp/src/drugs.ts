// openFDA drug lookup — the one LIVE call in the otherwise-offline healthguide
// asset. Keyless public API (api.fda.gov). Fixed host, so no SSRF surface; still
// timed out and it extracts NAMED fields rather than echoing raw JSON (a
// third-party response is untrusted input). Degrades to the offline
// research/verify path on any failure, so regression stays network-free and a
// dropped connection never breaks the tool. Public FDA data, NOT medical advice.
const API = "https://api.fda.gov";
const TIMEOUT_MS = 8000;

function offline(name: string, why: string): string {
  return (
    `Could not fetch live FDA data for "${name}" (${why}).\n` +
    `Use check_the_science -> science_verdict, or the research asset, to verify a drug fact instead.\n` +
    `BOTTOM LINE: no live FDA data available right now — verify via research rather than guessing.`
  );
}

interface Label {
  openfda?: { brand_name?: string[]; generic_name?: string[]; manufacturer_name?: string[] };
  indications_and_usage?: string[];
  warnings?: string[];
  boxed_warning?: string[];
}
interface Recall {
  recall_initiation_date?: string;
  reason_for_recall?: string;
  classification?: string;
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const trunc = (arr: string[] | undefined, n = 400): string => {
  const s = arr?.[0];
  if (!s) return "";
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n)} …` : one;
};

export async function drugLookup(name: string): Promise<string> {
  const q = (name ?? "").trim();
  if (!q) return offline(String(name ?? ""), "no drug name given");
  const enc = encodeURIComponent(`"${q}"`);

  const labelJson = await getJson(`${API}/drug/label.json?search=openfda.brand_name:${enc}+openfda.generic_name:${enc}&limit=1`);
  const recallJson = await getJson(`${API}/drug/enforcement.json?search=product_description:${enc}&limit=3&sort=recall_initiation_date:desc`);
  if (labelJson === null && recallJson === null) return offline(q, "openFDA unreachable");

  const label = (labelJson?.results as Label[] | undefined)?.[0];
  const recalls = (recallJson?.results as Recall[] | undefined) ?? [];
  if (!label && !recalls.length) return offline(q, "no matching FDA record (try the generic name)");

  const of = label?.openfda ?? {};
  const lines: string[] = [`FDA data for "${q}" (openFDA — public label/recall data):`];
  if (of.brand_name?.length || of.generic_name?.length) {
    lines.push(`  brand: ${of.brand_name?.join(", ") || "-"} | generic: ${of.generic_name?.join(", ") || "-"}${of.manufacturer_name?.length ? ` | maker: ${of.manufacturer_name[0]}` : ""}`);
  }
  if (label?.boxed_warning?.length) lines.push(`  BOXED WARNING: ${trunc(label.boxed_warning, 300)}`);
  if (label?.indications_and_usage?.length) lines.push(`  indications: ${trunc(label.indications_and_usage)}`);
  if (label?.warnings?.length) lines.push(`  warnings: ${trunc(label.warnings)}`);
  if (recalls.length) {
    lines.push(`  RECENT RECALLS (${recalls.length}):`);
    for (const r of recalls.slice(0, 3)) {
      lines.push(`    - ${r.recall_initiation_date ?? "?"}: ${(r.reason_for_recall ?? "").replace(/\s+/g, " ").slice(0, 140)} [${r.classification ?? "?"}]`);
    }
  } else {
    lines.push(`  recalls: none found recently`);
  }
  lines.push(``, `This is public FDA label data, NOT medical advice. Confirm anything actionable with a clinician or research.`);
  lines.push(
    label?.boxed_warning?.length
      ? `BOTTOM LINE: "${q}" carries an FDA BOXED WARNING — read it and consult a clinician; do not act on a label summary alone.`
      : `BOTTOM LINE: pulled live FDA label${recalls.length ? "/recall" : ""} data for "${q}" — reference data, not advice; verify specifics with a clinician.`
  );
  return lines.join("\n");
}
