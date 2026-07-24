// Best-effort PDF text extraction with no dependency: decompress FlateDecode
// content streams and pull the strings shown by the text operators (Tj/TJ)
// inside BT…ET blocks. This reads ordinary text PDFs well; it does NOT do OCR.
// When a PDF yields little or no text but clearly has content (image XObjects),
// it is treated as SCANNED — flagged ocr-needed and handed to the client, which
// has vision, rather than silently returning nothing.
import { inflateSync, inflateRawSync } from "node:zlib";
import type { SourceDoc, DocSection } from "./types.js";
import { emptyDoc } from "./types.js";

export function extractPdf(bytes: Buffer, source: string): SourceDoc {
  const doc = emptyDoc(source, "application/pdf", "pdf");
  const latin = bytes.toString("latin1");

  const streams = extractContentStreams(bytes, latin);
  const sections: DocSection[] = [];
  let page = 0;
  for (const s of streams) {
    const text = textFromContentStream(s);
    if (text.trim()) {
      page++;
      sections.push({ ref: `page ${page}`, text: text.trim() });
    }
  }

  doc.text = sections.map((s) => s.text).join("\n\n");
  doc.sections = sections;
  doc.title = firstMeaningful(doc.text) || pdfTitle(latin) || source;

  const hasImages = /\/Subtype\s*\/Image/.test(latin) || /\/XObject/.test(latin);
  if (!doc.text.trim()) {
    // No extractable text. If it has image XObjects it is a scan → OCR path.
    doc.warnings.push(hasImages ? "ocr-needed" : "partial-extraction");
    if (hasImages) doc.clientHandoff = { reason: "scanned PDF — no embedded text; needs OCR / visual reading", mimeType: "application/pdf" };
  } else if (hasImages) {
    // Mixed: some text extracted, but image pages may hold more.
    doc.warnings.push("partial-extraction");
  }
  return doc;
}

// Pull each content stream's decompressed bytes. We look at the dict preceding
// `stream` to decide whether to inflate.
function extractContentStreams(bytes: Buffer, latin: string): string[] {
  const out: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin)) !== null) {
    const dictStart = latin.lastIndexOf("<<", m.index);
    const dict = dictStart >= 0 ? latin.slice(dictStart, m.index) : "";
    const dataStart = m.index + m[0].length;
    const end = latin.indexOf("endstream", dataStart);
    if (end < 0) continue;
    const raw = bytes.subarray(dataStart, end);
    if (/\/FlateDecode/.test(dict)) {
      const dec = tryInflate(raw);
      if (dec) out.push(dec.toString("latin1"));
    } else if (!/\/(DCTDecode|CCITTFaxDecode|JPXDecode|JBIG2Decode)/.test(dict)) {
      // Uncompressed content stream (image filters are skipped — they're not text).
      out.push(raw.toString("latin1"));
    }
  }
  return out;
}

function tryInflate(raw: Buffer): Buffer | null {
  try {
    return inflateSync(raw);
  } catch {
    try {
      return inflateRawSync(raw);
    } catch {
      return null;
    }
  }
}

// Extract shown text from a content stream: strings inside BT…ET, both literal
// (…) and hex <…>, including TJ arrays. Td/TD/T* imply line breaks.
function textFromContentStream(stream: string): string {
  const blocks = stream.match(/BT([\s\S]*?)ET/g) ?? (/(\(|\<)/.test(stream) ? [stream] : []);
  const lines: string[] = [];
  for (const block of blocks) {
    let line = "";
    const tokenRe = /\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f\s]*>|\bT[dD]\b|\bT\*\b|\bTj\b|\bTJ\b/g;
    let t: RegExpExecArray | null;
    while ((t = tokenRe.exec(block)) !== null) {
      const tok = t[0];
      if (tok === "Td" || tok === "TD" || tok === "T*") {
        if (line.trim()) { lines.push(line.trim()); line = ""; }
      } else if (tok.startsWith("(")) {
        line += decodePdfLiteral(tok.slice(1, -1));
      } else if (tok.startsWith("<")) {
        line += decodePdfHex(tok.slice(1, -1));
      }
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines.join("\n");
}

function decodePdfLiteral(s: string): string {
  return s.replace(/\\(n|r|t|b|f|\(|\)|\\|[0-7]{1,3})/g, (_, e) => {
    switch (e) {
      case "n": return "\n";
      case "r": return "\r";
      case "t": return "\t";
      case "b": return "\b";
      case "f": return "\f";
      case "(": return "(";
      case ")": return ")";
      case "\\": return "\\";
      default: return String.fromCharCode(parseInt(e, 8));
    }
  });
}

function decodePdfHex(s: string): string {
  const hex = s.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return out;
}

function pdfTitle(latin: string): string {
  const m = latin.match(/\/Title\s*\(((?:[^()\\]|\\.)*)\)/);
  return m ? decodePdfLiteral(m[1]).trim() : "";
}
function firstMeaningful(text: string): string {
  return (text.split(/\r?\n/).find((l) => l.trim().length > 2) ?? "").trim().slice(0, 120);
}
