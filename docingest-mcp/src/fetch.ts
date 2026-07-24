// Authorized, bounded file retrieval. Every outbound request goes through:
//   1. SSRF guard (assertPublicUrl) — never internal/loopback/link-local.
//   2. An optional operator ALLOWLIST of domain suffixes (DOCINGEST_ALLOWLIST).
//   3. A hard size cap and timeout, streamed so an oversized body is abandoned.
//   4. Manual redirect handling, re-validating EVERY hop (a public URL that
//      302s to an internal one, or off the allowlist, is refused mid-chain).
//
// It NEVER bypasses a login: credentials are only ever the operator's own
// server-side tokens (DOCINGEST_AUTH, keyed by host), applied automatically and
// never echoed back. A 401/403 is reported as auth-required, not worked around.
import { assertPublicUrl } from "./ssrf-guard.js";

const MAX_BYTES = Number(process.env.DOCINGEST_MAX_BYTES ?? 15_000_000); // 15 MB
const TIMEOUT_MS = Number(process.env.DOCINGEST_TIMEOUT_MS ?? 20_000);
const MAX_REDIRECTS = 5;

export interface FetchedFile {
  bytes: Buffer;
  contentType: string;
  finalUrl: string;
  truncated: boolean;
  status: number;
}

export class AuthRequiredError extends Error {}
export class AccessError extends Error {}

// Optional allowlist: comma-separated host suffixes. Empty = allow any PUBLIC
// host (the SSRF guard still blocks internal targets). A match is a suffix
// match on the registrable-ish domain, so "confluence.acme.com" is covered by
// "acme.com".
function allowlist(): string[] {
  return (process.env.DOCINGEST_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function hostAllowed(host: string): boolean {
  const list = allowlist();
  if (list.length === 0) return true; // policy = public-only (SSRF), no domain lock
  const h = host.toLowerCase();
  return list.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

// Server-side auth only. DOCINGEST_AUTH is JSON {"host":"Bearer …"} or
// {"host":"token …"}; applied by host, never taken from tool arguments, never
// returned. This is how a connector's authorized session is honored without the
// model ever seeing or forwarding a raw credential.
function authHeaderFor(host: string): string | undefined {
  try {
    const map = JSON.parse(process.env.DOCINGEST_AUTH ?? "{}") as Record<string, string>;
    return map[host.toLowerCase()];
  } catch {
    return undefined;
  }
}

export async function fetchFile(rawUrl: string): Promise<FetchedFile> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { url } = await assertPublicUrl(current);
    if (!hostAllowed(url.hostname)) {
      throw new AccessError(`Host "${url.hostname}" is not on the document-ingestion allowlist.`);
    }

    const headers: Record<string, string> = { Accept: "*/*", "User-Agent": "docingest-mcp/0.1" };
    const auth = authHeaderFor(url.hostname);
    if (auth) headers.Authorization = auth;

    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new AccessError(`Could not fetch ${url.hostname}: ${err instanceof Error ? err.message : "network error"}`);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue; // re-validate the new target on the next loop
    }

    if (res.status === 401 || res.status === 403) {
      throw new AuthRequiredError(
        `Access to this file requires authorization (HTTP ${res.status}). This server will not bypass a login or paywall — supply an authorized connector/token via DOCINGEST_AUTH for ${url.hostname}.`
      );
    }
    if (!res.ok) throw new AccessError(`Server returned HTTP ${res.status} for ${url.hostname}.`);

    // Stream with a hard cap so a giant file never lands whole in memory.
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          if (total + value.length > MAX_BYTES) {
            chunks.push(value.subarray(0, MAX_BYTES - total));
            total = MAX_BYTES;
            truncated = true;
            await reader.cancel().catch(() => {});
            break;
          }
          chunks.push(value);
          total += value.length;
        }
      }
    }
    return { bytes: Buffer.concat(chunks), contentType, finalUrl: url.toString(), truncated, status: res.status };
  }

  throw new AccessError(`Too many redirects (>${MAX_REDIRECTS}) starting from ${rawUrl}.`);
}
