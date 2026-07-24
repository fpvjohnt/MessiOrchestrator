// Orchestrates one ingestion: fetch (or accept connector bytes) → detect the
// real type → route to the right extractor → apply the content-security pass.
// Every path returns a normalized SourceDoc; nothing throws past the tool layer
// except genuinely unreachable/blocked URLs.
import { fetchFile, AuthRequiredError } from "./fetch.js";
import { detectType } from "./detect.js";
import { extractPdf } from "./extract-pdf.js";
import { extractOffice } from "./extract-office.js";
import { extractText, extractMarkdown, extractDelimited, extractEmail } from "./extract-text.js";
import { extractHtml } from "./extract-html.js";
import { extractImage } from "./extract-image.js";
import { sanitizeDoc } from "./security.js";
import { emptyDoc } from "./types.js";
import type { SourceDoc } from "./types.js";

export function extractBytes(bytes: Buffer, source: string, contentType = "", nameHint = ""): SourceDoc {
  const det = detectType(bytes, contentType, nameHint);
  let doc: SourceDoc;
  switch (det.format) {
    case "pdf": doc = extractPdf(bytes, source); break;
    case "png": case "jpeg": case "webp": case "heic":
      doc = extractImage(bytes, source, det.format, det.mimeType); break;
    case "zip-office": doc = extractOffice(bytes, source); break;
    case "ole2": doc = legacyOle(source); break;
    case "html": doc = extractHtml(bytes, source); break;
    case "csv": doc = extractDelimited(bytes, source, false); break;
    case "tsv": doc = extractDelimited(bytes, source, true); break;
    case "markdown": doc = extractMarkdown(bytes, source); break;
    case "eml": doc = extractEmail(bytes, source); break;
    case "text": doc = extractText(bytes, source, det.mimeType); break;
    default: doc = unsupported(source, det.mimeType);
  }
  return sanitizeDoc(doc);
}

export async function ingestUrl(url: string): Promise<SourceDoc> {
  let fetched;
  try {
    fetched = await fetchFile(url);
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      const d = emptyDoc(url, "application/octet-stream", "unknown");
      d.warnings.push("auth-required");
      d.text = err.message;
      return d;
    }
    throw err; // AccessError / SSRF / redirect-loop → surfaced by the tool as isError
  }
  const doc = extractBytes(fetched.bytes, fetched.finalUrl, fetched.contentType, url);
  if (fetched.truncated && !doc.warnings.includes("size-limited")) doc.warnings.push("size-limited");
  return doc;
}

function legacyOle(source: string): SourceDoc {
  const d = emptyDoc(source, "application/x-ole-storage", "unknown");
  d.warnings.push("unsupported-format");
  d.text =
    "Legacy binary Office format (.doc/.xls/.ppt/.msg, OLE2 compound file). This deterministic " +
    "extractor reads the modern zip-based .docx/.xlsx/.pptx only. Re-save as the modern format, or " +
    "hand the file to a client with an OLE reader.";
  d.sections = [{ ref: "note", text: d.text }];
  return d;
}

function unsupported(source: string, mimeType: string): SourceDoc {
  const d = emptyDoc(source, mimeType, "unknown");
  d.warnings.push("unsupported-format");
  d.text = `Unsupported or unrecognized file type (${mimeType}). No extractor matched its signature.`;
  d.sections = [{ ref: "note", text: d.text }];
  return d;
}
