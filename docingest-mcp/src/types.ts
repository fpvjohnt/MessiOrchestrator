// The common internal document format every extractor normalizes into
// (requirement 5). One shape, whatever the source or file type, so the tool
// layer and the security/summarization layers never branch on format.

export type DocKind =
  | "pdf"
  | "image"
  | "word"
  | "spreadsheet"
  | "presentation"
  | "html"
  | "text"
  | "email"
  | "unknown";

// A location reference so every extracted passage can cite back to where it
// came from (requirement 6): a PDF page, a spreadsheet sheet, a slide, or an
// HTML/section heading.
export interface DocSection {
  /** e.g. "page 3", "sheet Q1", "slide 5", "Heading: Risks" */
  ref: string;
  text: string;
}

export interface DocTable {
  ref: string; // where the table came from (sheet/page/section)
  name?: string;
  headers?: string[];
  rows: string[][];
  /** Formulas discovered alongside values, keyed by cell (spreadsheets). */
  formulas?: Record<string, string>;
}

export type DocWarning =
  | "ocr-used"
  | "ocr-needed" // scanned/binary content the deterministic asset can't read; hand to the client
  | "ocr-unavailable"
  | "partial-extraction"
  | "inaccessible-content"
  | "unsupported-format"
  | "auth-required"
  | "size-limited"
  | "prompt-injection-neutralized"
  | "malformed-file";

export interface SourceDoc {
  source: string; // original URL or connector reference
  title: string;
  mimeType: string;
  kind: DocKind;
  text: string; // full normalized text (pre-truncation)
  sections: DocSection[];
  tables: DocTable[];
  warnings: DocWarning[];
  /** Set when the content is binary/visual and the CLIENT (which has vision)
   * should read it — the deterministic asset cannot OCR or describe images. */
  clientHandoff?: { reason: string; mimeType: string };
  /** Downloadable files discovered on an HTML/Confluence page (requirement 4). */
  attachments?: { url: string; title: string }[];
}

export function emptyDoc(source: string, mimeType: string, kind: DocKind, title = ""): SourceDoc {
  return { source, title: title || source, mimeType, kind, text: "", sections: [], tables: [], warnings: [] };
}
