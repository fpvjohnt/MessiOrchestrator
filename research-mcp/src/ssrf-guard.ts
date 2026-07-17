import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Blocks Server-Side Request Forgery. fetch_page and research fetch URLs that
 * originate from search results / LLM output, so without this a caller (or a
 * page that ranks well and then 302-redirects) could make this server hit
 * localhost, RFC1918 ranges, or the cloud metadata endpoint and echo the
 * response back into the model's context.
 */

function ipInBlockedRange(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Blocked(ip);
  if (v === 6) return ipv6Blocked(ip);
  return true; // not a parseable IP — refuse rather than guess
}

function ipv4Blocked(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a >= 224) return true; // multicast / reserved / broadcast
  return false;
}

function ipv6Blocked(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4.
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]);
  return false;
}

/**
 * Validates a URL is safe to fetch: http(s) only, and its host does not
 * resolve to a private/loopback/link-local address. Returns the resolved IP
 * so the caller can pin the connection to it (defeating DNS-rebinding /
 * redirect-to-internal between check and connect).
 */
export async function assertPublicUrl(rawUrl: string): Promise<{ url: URL; ip: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Blocked non-http(s) URL scheme "${url.protocol}".`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  let ip: string;
  if (isIP(host)) {
    ip = host;
  } else {
    if (/^(localhost|.*\.localhost)$/i.test(host)) {
      throw new Error(`Blocked request to localhost.`);
    }
    try {
      const resolved = await lookup(host);
      ip = resolved.address;
    } catch {
      throw new Error(`Could not resolve host "${host}".`);
    }
  }

  if (ipInBlockedRange(ip)) {
    throw new Error(
      `Blocked request to non-public address (${host} -> ${ip}). ` +
        `This server refuses to fetch internal/loopback/link-local hosts.`
    );
  }
  return { url, ip };
}
