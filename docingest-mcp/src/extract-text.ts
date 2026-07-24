// Plain text, Markdown, CSV/TSV, and email exports — all pure string work.
import type { SourceDoc, DocTable, DocSection } from "./types.js";
import { emptyDoc } from "./types.js";

export function extractText(bytes: Buffer, source: string, mimeType: string): SourceDoc {
  const doc = emptyDoc(source, mimeType, "text");
  doc.text = bytes.toString("utf8");
  doc.title = firstLine(doc.text) || source;
  doc.sections = [{ ref: "document", text: doc.text }];
  return doc;
}

export function extractMarkdown(bytes: Buffer, source: string): SourceDoc {
  const doc = emptyDoc(source, "text/markdown", "text");
  const md = bytes.toString("utf8");
  doc.text = md;
  // Section per heading so citations can point at "Heading: X".
  const sections: DocSection[] = [];
  let current = { ref: "top", lines: [] as string[] };
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      if (current.lines.length) sections.push({ ref: current.ref, text: current.lines.join("\n").trim() });
      current = { ref: `Heading: ${h[1].trim()}`, lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length) sections.push({ ref: current.ref, text: current.lines.join("\n").trim() });
  doc.sections = sections.filter((s) => s.text);
  doc.title = (md.match(/^#\s+(.*)$/m)?.[1] ?? firstLine(md)) || source;
  return doc;
}

export function extractDelimited(bytes: Buffer, source: string, tab: boolean): SourceDoc {
  const mime = tab ? "text/tab-separated-values" : "text/csv";
  const doc = emptyDoc(source, mime, "text");
  const rows = parseDelimited(bytes.toString("utf8"), tab ? "\t" : ",");
  const table: DocTable = {
    ref: "sheet 1",
    headers: rows[0],
    rows: rows.slice(1),
  };
  doc.tables = [table];
  doc.text = rows.map((r) => r.join(tab ? "\t" : ", ")).join("\n");
  doc.sections = [{ ref: "sheet 1", text: doc.text }];
  doc.title = source;
  return doc;
}

export function extractEmail(bytes: Buffer, source: string): SourceDoc {
  const doc = emptyDoc(source, "message/rfc822", "email");
  const raw = bytes.toString("utf8");
  const sep = raw.search(/\r?\n\r?\n/);
  const headerBlock = sep >= 0 ? raw.slice(0, sep) : raw;
  const body = sep >= 0 ? raw.slice(sep).trim() : "";
  const headers: Record<string, string> = {};
  for (const line of headerBlock.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2];
  }
  doc.title = headers["subject"] || "(no subject)";
  const meta = ["from", "to", "cc", "date", "subject"].filter((k) => headers[k]).map((k) => `${k}: ${headers[k]}`).join("\n");
  // Best-effort: strip a MIME preamble down to the first text part.
  const textBody = body.replace(/^--=?_?.*$/gm, "").replace(/Content-[^\n]*\n/gi, "").trim();
  doc.text = `${meta}\n\n${textBody}`;
  doc.sections = [
    { ref: "headers", text: meta },
    { ref: "body", text: textBody },
  ].filter((s) => s.text);
  return doc;
}

// A small RFC4180-ish parser: handles quoted fields, embedded delimiters, and
// doubled quotes. Good enough for real exports without a dependency.
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c === "\r") {
      // handled by the \n branch
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function firstLine(s: string): string {
  return (s.split(/\r?\n/).find((l) => l.trim()) ?? "").trim().slice(0, 120);
}
