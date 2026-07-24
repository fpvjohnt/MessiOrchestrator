// Office Open XML extraction (docx / xlsx / pptx) over the pure-Node ZIP
// reader. Text is pulled with targeted regexes rather than a full XML parser —
// no dependency, and robust for the standard shapes these programs emit.
import type { SourceDoc, DocTable, DocSection } from "./types.js";
import { emptyDoc } from "./types.js";
import { ZipArchive } from "./zip.js";
import type { DocKind } from "./types.js";

// Which office format a PK zip actually is, by the parts it contains.
export function officeKind(zip: ZipArchive): "word" | "spreadsheet" | "presentation" | "unknown" {
  if (zip.has("word/document.xml")) return "word";
  if (zip.has("xl/workbook.xml")) return "spreadsheet";
  if (zip.has("ppt/presentation.xml")) return "presentation";
  return "unknown";
}

const MIME: Record<string, string> = {
  word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  spreadsheet: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  presentation: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

// Pull text from a run of <w:t>/<a:t> nodes, honoring tabs and breaks. The tag
// match must be EXACT — `<w:t>` or `<w:t attr…>` — and never `<w:tc>`/`<w:tr>`/
// `<w:tbl>`, which all start with the same three characters. Requiring a `>` or
// whitespace immediately after the tag name enforces that.
function runText(xml: string, tag: "w:t" | "a:t"): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<a:br\b[^>]*\/>/g, "\n")
    .match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))
    ?.map((m) => decodeXml(m.replace(new RegExp(`^<${tag}(?:\\s[^>]*)?>|</${tag}>$`, "g"), "")))
    .join("") ?? "";
}

export function extractOffice(bytes: Buffer, source: string): SourceDoc {
  let zip: ZipArchive;
  try {
    zip = new ZipArchive(bytes);
  } catch {
    const d = emptyDoc(source, "application/zip", "unknown");
    d.warnings.push("malformed-file");
    return d;
  }
  const kind = officeKind(zip);
  if (kind === "unknown") {
    const d = emptyDoc(source, "application/zip", "unknown");
    d.warnings.push("unsupported-format");
    return d;
  }
  const doc = emptyDoc(source, MIME[kind], kind as DocKind);
  if (kind === "word") return fillWord(doc, zip);
  if (kind === "spreadsheet") return fillSheet(doc, zip);
  return fillDeck(doc, zip);
}

function fillWord(doc: SourceDoc, zip: ZipArchive): SourceDoc {
  const xml = zip.readText("word/document.xml") ?? "";
  const sections: DocSection[] = [];
  const tables: DocTable[] = [];

  // Tables first (and remove them so their cells aren't double-counted as prose).
  let tableIdx = 0;
  const body = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    tableIdx++;
    const rows = (tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).map((tr) =>
      (tr.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? []).map((tc) => runText(tc, "w:t").trim())
    );
    if (rows.length) tables.push({ ref: `table ${tableIdx}`, headers: rows[0], rows: rows.slice(1) });
    return "";
  });

  const paras = body.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
  const lines: string[] = [];
  for (const p of paras) {
    const text = runText(p, "w:t").trim();
    if (!text) continue;
    const heading = p.match(/<w:pStyle\s+w:val="(Heading\d|Title)"/i);
    if (heading) sections.push({ ref: `Heading: ${text}`, text });
    lines.push(text);
  }

  const comments = zip.readText("word/comments.xml");
  if (comments) {
    const cs = (comments.match(/<w:comment\b[\s\S]*?<\/w:comment>/g) ?? []).map((c) => runText(c, "w:t").trim()).filter(Boolean);
    if (cs.length) sections.push({ ref: "comments", text: cs.map((c) => `• ${c}`).join("\n") });
  }

  doc.text = lines.join("\n");
  doc.title = (sections.find((s) => s.ref.startsWith("Heading"))?.text ?? lines[0] ?? doc.source).slice(0, 120);
  doc.sections = [{ ref: "body", text: doc.text }, ...sections.filter((s) => s.ref !== "body")];
  doc.tables = tables;
  if (!doc.text && !tables.length) doc.warnings.push("partial-extraction");
  return doc;
}

function fillSheet(doc: SourceDoc, zip: ZipArchive): SourceDoc {
  // Shared strings table.
  const ssXml = zip.readText("xl/sharedStrings.xml") ?? "";
  const shared = (ssXml.match(/<si>[\s\S]*?<\/si>/g) ?? []).map((si) =>
    (si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => decodeXml(t.replace(/<\/?t[^>]*>/g, ""))).join("")
  );

  // Sheet names in workbook order.
  const wb = zip.readText("xl/workbook.xml") ?? "";
  const names = (wb.match(/<sheet\b[^>]*name="([^"]*)"[^>]*\/>/g) ?? []).map((s) => decodeXml(s.match(/name="([^"]*)"/)?.[1] ?? "sheet"));

  const tables: DocTable[] = [];
  const textParts: string[] = [];
  const sheetFiles = zip.list().filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(byNum);

  sheetFiles.forEach((file, i) => {
    const xml = zip.readText(file) ?? "";
    const sheetName = names[i] ?? `Sheet${i + 1}`;
    const rowsXml = xml.match(/<row\b[\s\S]*?<\/row>/g) ?? [];
    const rows: string[][] = [];
    const formulas: Record<string, string> = {};
    for (const rowXml of rowsXml) {
      const cells = rowXml.match(/<c\b[\s\S]*?(?:\/>|<\/c>)/g) ?? [];
      const row: string[] = [];
      for (const c of cells) {
        const ref = c.match(/r="([A-Z]+\d+)"/)?.[1];
        const f = c.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1];
        if (f && ref) formulas[ref] = decodeXml(f);
        const isShared = /t="s"/.test(c);
        const isInline = /t="(inlineStr|str)"/.test(c);
        let val = c.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
        if (isInline) val = c.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? val;
        let cell = decodeXml(val);
        if (isShared) cell = shared[Number(val)] ?? "";
        row.push(cell);
      }
      if (row.some((x) => x.trim() !== "")) rows.push(row);
    }
    if (rows.length) {
      tables.push({ ref: `sheet ${sheetName}`, name: sheetName, headers: rows[0], rows: rows.slice(1), formulas: Object.keys(formulas).length ? formulas : undefined });
      textParts.push(`### ${sheetName}\n` + rows.map((r) => r.join(", ")).join("\n"));
    }
  });

  doc.text = textParts.join("\n\n");
  doc.tables = tables;
  doc.sections = tables.map((t) => ({ ref: t.ref, text: `${t.name}\n` + [t.headers ?? [], ...t.rows].map((r) => r.join(", ")).join("\n") }));
  doc.title = names.length ? `Workbook (${names.join(", ")})` : doc.source;
  if (!tables.length) doc.warnings.push("partial-extraction");
  return doc;
}

function fillDeck(doc: SourceDoc, zip: ZipArchive): SourceDoc {
  const slideFiles = zip.list().filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(byNum);
  const sections: DocSection[] = [];
  const textParts: string[] = [];
  slideFiles.forEach((file, i) => {
    const n = i + 1;
    const slideText = runText(zip.readText(file) ?? "", "a:t").replace(/\n{2,}/g, "\n").trim();
    const notesFile = `ppt/notesSlides/notesSlide${fileNum(file)}.xml`;
    let notes = zip.has(notesFile) ? runText(zip.readText(notesFile) ?? "", "a:t").trim() : "";
    // Notes slides include the slide-number placeholder; drop a lone trailing number.
    notes = notes.replace(/\b\d+\s*$/, "").trim();
    const parts = [slideText && `slide ${n}: ${slideText}`, notes && `notes ${n}: ${notes}`].filter(Boolean).join("\n");
    if (parts) {
      sections.push({ ref: `slide ${n}`, text: [slideText, notes && `[speaker notes] ${notes}`].filter(Boolean).join("\n") });
      textParts.push(parts);
    }
  });
  doc.text = textParts.join("\n\n");
  doc.sections = sections;
  doc.title = (sections[0]?.text.split("\n")[0] ?? doc.source).slice(0, 120);
  if (!sections.length) doc.warnings.push("partial-extraction");
  return doc;
}

function fileNum(path: string): number {
  return Number(path.match(/(\d+)\.xml$/)?.[1] ?? 0);
}
function byNum(a: string, b: string): number {
  return fileNum(a) - fileNum(b);
}
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
