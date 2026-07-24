// Detect the ACTUAL file type from the Content-Type header and the file's
// magic-byte signature — never the filename alone (requirement 3). The filename
// (or URL path) is used only as a weak tiebreaker among text subtypes that share
// no signature (csv vs tsv vs markdown vs plain), and only after the bytes have
// already ruled out every binary format.
import type { DocKind } from "./types.js";

export type Format =
  | "pdf"
  | "png"
  | "jpeg"
  | "webp"
  | "heic"
  | "zip-office" // docx/xlsx/pptx — refined after unzip
  | "ole2" // legacy .doc/.xls/.ppt/.msg compound binary
  | "html"
  | "csv"
  | "tsv"
  | "markdown"
  | "eml"
  | "text"
  | "unknown";

export interface Detected {
  format: Format;
  kind: DocKind;
  mimeType: string;
}

function startsWith(b: Buffer, sig: number[], offset = 0): boolean {
  if (b.length < offset + sig.length) return false;
  return sig.every((v, i) => b[offset + i] === v);
}

function looksTextual(b: Buffer): boolean {
  // No NUL in the first KB and mostly printable/whitespace → treat as text.
  const n = Math.min(b.length, 1024);
  if (n === 0) return false;
  let printable = 0;
  for (let i = 0; i < n; i++) {
    const c = b[i];
    if (c === 0) return false;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127) || c >= 128) printable++;
  }
  return printable / n > 0.85;
}

function kindOf(format: Format): DocKind {
  switch (format) {
    case "pdf": return "pdf";
    case "png": case "jpeg": case "webp": case "heic": return "image";
    case "zip-office": return "unknown"; // refined by the office extractor
    case "ole2": return "unknown";
    case "html": return "html";
    case "eml": return "email";
    case "csv": case "tsv": case "markdown": case "text": return "text";
    default: return "unknown";
  }
}

const MIME: Record<Format, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  "zip-office": "application/zip",
  ole2: "application/x-ole-storage",
  html: "text/html",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  markdown: "text/markdown",
  eml: "message/rfc822",
  text: "text/plain",
  unknown: "application/octet-stream",
};

export function detectType(bytes: Buffer, contentType = "", nameHint = ""): Detected {
  // 1. Signatures win, unconditionally.
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return fmt("pdf"); // %PDF
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return fmt("png");
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return fmt("jpeg");
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return fmt("webp"); // RIFF….WEBP
  // ISO-BMFF: bytes 4-7 == "ftyp"; brand at 8 identifies HEIC/HEIF.
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = bytes.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "heif", "mif1", "hevc"].includes(brand)) return fmt("heic");
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) return fmt("zip-office"); // PK
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return fmt("ole2"); // OLE2 compound

  // 2. Textual: distinguish subtypes by content, then header, then name hint.
  if (looksTextual(bytes)) {
    const head = bytes.subarray(0, 2048).toString("utf8").trimStart();
    const lowerCT = contentType.toLowerCase();
    const lowerName = nameHint.toLowerCase();

    if (/^<(!doctype html|html|head|body|\?xml)/i.test(head) || lowerCT.includes("html")) return fmt("html");
    // Email export: RFC822 header block up top.
    if (/^(from|to|subject|date|received|message-id|mime-version):/im.test(head.slice(0, 400))) return fmt("eml");
    if (lowerCT.includes("markdown") || lowerName.endsWith(".md") || /^#{1,6}\s|\n#{1,6}\s|\n[-*]\s/.test(head)) return fmt("markdown");
    if (lowerCT.includes("tab-separated") || lowerName.endsWith(".tsv") || (head.includes("\t") && !head.includes(","))) return fmt("tsv");
    if (lowerCT.includes("csv") || lowerName.endsWith(".csv") || looksLikeCsv(head)) return fmt("csv");
    return fmt("text");
  }

  // 3. Nothing matched a signature and it isn't textual.
  return fmt("unknown");
}

function looksLikeCsv(head: string): boolean {
  const lines = head.split(/\r?\n/).filter(Boolean).slice(0, 5);
  if (lines.length < 2) return false;
  const commas = lines.map((l) => (l.match(/,/g) ?? []).length);
  return commas[0] > 0 && commas.every((c) => c === commas[0]);
}

function fmt(format: Format): Detected {
  return { format, kind: kindOf(format), mimeType: MIME[format] };
}
