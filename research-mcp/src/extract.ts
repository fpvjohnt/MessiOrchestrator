import { assertPublicUrl } from "./ssrf-guard.js";

const USER_AGENT = "research-mcp/0.1 (+local MCP server)";
const FETCH_TIMEOUT_MS = 15_000;
// Read at most this many bytes off the wire so a huge or malicious page
// can't balloon memory; extraction happens on this window only.
const MAX_DOWNLOAD_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;

export interface PageExtract {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  truncated: boolean;
}

/**
 * Fetches a URL and reduces it to readable text: drops script/style/nav
 * chrome, strips tags, collapses whitespace. Deliberately dependency-free —
 * good enough for research excerpts, not a full readability engine.
 *
 * Redirects are followed manually so every hop is re-checked against the
 * SSRF guard — a public URL that 302s to 169.254.169.254 or localhost is
 * refused at the hop, not blindly followed.
 */
export async function fetchPage(url: string, maxChars = 20_000): Promise<PageExtract> {
  let current = url;
  let res: Response | undefined;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { url: validated } = await assertPublicUrl(current);
    const response = await fetch(validated, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain,*/*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      const location = response.headers.get("location")!;
      current = new URL(location, validated).toString();
      await response.body?.cancel().catch(() => {});
      continue;
    }
    res = response;
    break;
  }

  if (!res) {
    throw new Error(`Too many redirects (>${MAX_REDIRECTS}) starting from ${url}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${new URL(current).host}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  // Allow a blank/missing content-type (some servers omit it) but reject
  // anything explicitly non-textual (images, pdfs, octet-stream).
  if (contentType && !/text\/|json|xml|xhtml/.test(contentType)) {
    throw new Error(`Unsupported content-type "${contentType}" — only text-like pages can be extracted.`);
  }

  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();
  let html = "";
  const reader = res.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder(charset && isSupportedCharset(charset) ? charset : "utf-8");
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Slice the final chunk to the exact remaining budget so a single
      // giant chunk can't overshoot the cap — the loop bounds memory, not
      // just iteration count.
      const remaining = MAX_DOWNLOAD_BYTES - bytes;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      bytes += chunk.byteLength;
      html += decoder.decode(chunk, { stream: true });
      if (bytes >= MAX_DOWNLOAD_BYTES) break;
    }
    html += decoder.decode(); // flush any trailing partial multi-byte char
    await reader.cancel().catch(() => {});
  } else {
    html = await res.text();
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? clean(titleMatch[1]) : "";

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    // [\s>] after the tag name so <header-widget> isn't mistaken for <header>.
    .replace(/<(nav|header|footer|aside)[\s>][\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Prefer <main>/<article> content when the page marks it up.
  const mainMatch = body.match(/<(main|article)[\s>][\s\S]*?>([\s\S]*?)<\/\1>/i);
  if (mainMatch) body = mainMatch[2];

  const text = clean(
    body.replace(/<(p|div|br|li|h[1-6]|tr)[\s/>]/gi, "\n$&").replace(/<[^>]*>/g, " ")
  );

  const truncated = text.length > maxChars;
  return {
    url,
    finalUrl: current,
    title,
    text: truncated ? text.slice(0, maxChars) : text,
    truncated,
  };
}

function isSupportedCharset(charset: string): boolean {
  try {
    new TextDecoder(charset);
    return true;
  } catch {
    return false;
  }
}

// Order matters: &amp; must be decoded LAST so "&amp;lt;" -> "&lt;" (literal),
// not mis-decoded into "<".
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function clean(text: string): string {
  return decodeEntities(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
