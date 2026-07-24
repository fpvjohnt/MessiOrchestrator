// HTML / webpage / Confluence-page extraction (requirement 4): pull the main
// readable content, and DISCOVER downloadable attachments and embedded
// spreadsheet links so the caller can then ingest those files directly. Pure
// string work — no headless browser, no dependency.
import type { SourceDoc } from "./types.js";
import { emptyDoc } from "./types.js";

const ATTACHMENT_EXT = /\.(pdf|docx?|xlsx?|pptx?|csv|tsv|txt|md|rtf|odt|ods|odp|eml|msg|jpe?g|png|webp|heic)(\?|#|$)/i;
const CONFLUENCE_HINT = /\/(download\/attachments|wiki\/download|attachments)\//i;

export function extractHtml(bytes: Buffer, source: string): SourceDoc {
  const doc = emptyDoc(source, "text/html", "html");
  const html = bytes.toString("utf8");

  doc.title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim()) || source;

  // Main content: prefer <main>/<article>, else <body>, else the whole doc.
  const main =
    section(html, "main") ?? section(html, "article") ?? section(html, "body") ?? html;
  doc.text = htmlToText(main);
  doc.sections = [{ ref: "page content", text: doc.text }];

  // Attachment / embedded-file discovery over the WHOLE document (links often
  // live in a sidebar outside <main>).
  const attachments: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  const linkRe = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].trim();
    if (href.startsWith("javascript:") || href.startsWith("#")) continue;
    if (!ATTACHMENT_EXT.test(href) && !CONFLUENCE_HINT.test(href)) continue;
    let abs: string;
    try {
      abs = new URL(href, source).toString();
    } catch {
      continue;
    }
    if (seen.has(abs)) continue;
    seen.add(abs);
    attachments.push({ url: abs, title: decode(htmlToText(m[2])).slice(0, 120) || abs.split("/").pop() || abs });
  }
  if (attachments.length) {
    doc.attachments = attachments;
    doc.sections.push({
      ref: "attachments",
      text: attachments.map((a) => `- ${a.title} → ${a.url}`).join("\n"),
    });
  }
  return doc;
}

function section(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : null;
}

function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|nav|header|footer|noscript)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, " - ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
