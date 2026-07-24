// Images (JPEG/PNG/WebP/HEIC). A deterministic MCP server has no OCR engine and
// no vision model, so it does not pretend to read them. It normalizes what it
// CAN know (format, dimensions when cheap) and hands the image off to the client
// — which has vision — to OCR and describe it. Honest degradation, consistent
// with how the orchestrator treats research as the reasoning layer.
import type { SourceDoc } from "./types.js";
import { emptyDoc } from "./types.js";
import type { Format } from "./detect.js";

export function extractImage(bytes: Buffer, source: string, format: Format, mimeType: string): SourceDoc {
  const doc = emptyDoc(source, mimeType, "image");
  const dims = dimensions(bytes, format);
  doc.title = source.split("/").pop() || source;
  doc.text = `[${format.toUpperCase()} image${dims ? `, ${dims.w}×${dims.h}` : ""}]`;
  doc.warnings.push("ocr-needed");
  doc.clientHandoff = {
    reason:
      format === "heic"
        ? "HEIC image — text/description requires the client's vision (and some clients can't render HEIC; convert to JPEG/PNG if needed)"
        : "image — OCR and visual description require the client's vision",
    mimeType,
  };
  doc.sections = [{ ref: "image", text: doc.text }];
  return doc;
}

// Cheap header-only dimension reads (best-effort; skipped for HEIC/complex WebP).
function dimensions(b: Buffer, format: Format): { w: number; h: number } | null {
  try {
    if (format === "png" && b.length >= 24) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (format === "jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        // SOF0..SOF15 (except DHT/DAC/RST) carry dimensions.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch {
    /* ignore — dimensions are a nicety */
  }
  return null;
}
