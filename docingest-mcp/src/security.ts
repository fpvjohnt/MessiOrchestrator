// Content-side defenses applied to EVERYTHING extracted, before it can reach
// the model (requirement 8) — plus the targeted, size-bounded retrieval that
// keeps whole documents out of context by default (requirement 7).
import type { SourceDoc, DocSection } from "./types.js";

// 1. Never let a credential that happened to be inside a document (or a stray
//    header echoed by a page) flow into the model's context or the output.
const SECRET_PATTERNS: RegExp[] = [
  /\b(authorization|cookie|set-cookie)\s*[:=]\s*\S+/gi,
  /\bbearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi,
  /\bsk-[A-Za-z0-9]{16,}\b/g, // OpenAI-style
  /\bsk_[A-Za-z0-9_-]{16,}/g, // ElevenLabs/Stripe-style (may contain _ or -)
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub tokens
  /\b(api[_-]?key|access[_-]?token|secret|password|passwd|pwd)\s*[:=]\s*\S+/gi,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/gi, // Slack
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, (m) => m.split(/[:=]/)[0].match(/[:=]/) ? m.replace(/(\s*[:=]\s*)\S+/, "$1[REDACTED]") : "[REDACTED]");
  return out;
}

// 2. Extracted document text is DATA, never instructions. We cannot reliably
//    strip every injection, so the real defense is at the output layer (the text
//    is fenced and labeled untrusted). Here we additionally defang the most
//    common direct-override phrases and report whether any were seen, so the
//    caller can warn and stay skeptical.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /disregard\s+(all\s+)?(previous|prior|the)\s+(instructions|rules|prompt)/gi,
  /you\s+are\s+now\s+/gi,
  /^\s*(system|assistant|developer)\s*:/gim,
  /\bnew\s+instructions?\s*:/gi,
  /do\s+not\s+tell\s+the\s+user/gi,
  /\b(exfiltrate|send\s+(the\s+)?(secret|token|credential|api\s*key))/gi,
];

export function neutralizePromptInjection(text: string): { text: string; injected: boolean } {
  let injected = false;
  let out = text;
  // NB: these are module-level /g regexes. Do NOT use re.test() here — it
  // advances lastIndex and would make the NEXT call on a fresh string miss.
  // .replace resets lastIndex and its callback is the reliable match signal.
  for (const re of INJECTION_PATTERNS) {
    out = out.replace(re, () => {
      injected = true;
      // Do NOT echo the imperative back — that would reproduce the very
      // instruction we are defusing. A neutral marker is enough; the caller is
      // also warned via the prompt-injection-neutralized warning.
      return "⟦neutralized instruction⟧";
    });
  }
  return { text: out, injected };
}

// 3. Targeted retrieval. With a query, score sections by keyword overlap and
//    return the best few. Without one, return a head-truncated overview plus the
//    section index. Either way the total stays under maxChars — full documents
//    do not get dumped into context.
export interface Retrieval {
  passages: DocSection[];
  truncated: boolean;
  totalChars: number;
}

export function retrieve(doc: SourceDoc, query: string | undefined, maxChars: number): Retrieval {
  const sections = doc.sections.length ? doc.sections : [{ ref: "document", text: doc.text }];

  let ordered: DocSection[];
  if (query && query.trim()) {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    ordered = sections
      .map((s) => ({ s, score: score(s.text.toLowerCase(), terms) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s);
    if (ordered.length === 0) ordered = sections; // no hit → fall back to overview
  } else {
    ordered = sections;
  }

  const passages: DocSection[] = [];
  let used = 0;
  let truncated = false;
  for (const s of ordered) {
    const remaining = maxChars - used;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const over = s.text.length > remaining;
    const raw = over ? s.text.slice(0, remaining) : s.text;
    if (over) truncated = true;
    passages.push({ ref: s.ref, text: over ? raw + " …" : raw });
    used += raw.length; // the " …" is decoration and does not count toward budget
  }
  return { passages, truncated, totalChars: used };
}

function score(hay: string, terms: string[]): number {
  let n = 0;
  for (const t of terms) {
    let idx = hay.indexOf(t);
    while (idx !== -1) {
      n++;
      idx = hay.indexOf(t, idx + t.length);
    }
  }
  return n;
}

// Apply the content defenses across a whole normalized doc in place.
export function sanitizeDoc(doc: SourceDoc): SourceDoc {
  const scrubSec = (s: DocSection): DocSection => {
    const red = redactSecrets(s.text);
    const { text, injected } = neutralizePromptInjection(red);
    if (injected && !doc.warnings.includes("prompt-injection-neutralized")) doc.warnings.push("prompt-injection-neutralized");
    return { ref: s.ref, text };
  };
  doc.text = (() => {
    const red = redactSecrets(doc.text);
    const { text, injected } = neutralizePromptInjection(red);
    if (injected && !doc.warnings.includes("prompt-injection-neutralized")) doc.warnings.push("prompt-injection-neutralized");
    return text;
  })();
  doc.sections = doc.sections.map(scrubSec);
  doc.tables = doc.tables.map((t) => ({
    ...t,
    rows: t.rows.map((r) => r.map((c) => neutralizePromptInjection(redactSecrets(c)).text)),
  }));
  return doc;
}
