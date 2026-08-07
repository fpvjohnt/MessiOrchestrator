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
  // Ranges that are nominally "special use" but carry real, reachable internal
  // endpoints on common gear — each was measured passing this guard:
  //   192.0.0.0/24   IETF protocol assignments. 192.0.0.1 is the live DS-Lite
  //                  AFTR address on some consumer CPE.
  //   198.18.0.0/15  benchmarking. Zscaler and some Cisco kit put real internal
  //                  services here, so "nobody routes it" is not true in practice.
  //   192.88.99.0/24 6to4 relay anycast — deprecated, still answered in places.
  if (a === 192 && b === 0 && p[2] === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 192 && b === 88 && p[2] === 99) return true;
  if (a >= 224) return true; // multicast / reserved / broadcast
  return false;
}

/**
 * Expand any valid IPv6 text form to its 16 bytes. Necessary because the
 * previous version of this guard pattern-matched the STRING, and strings lie:
 * `new URL()` normalises `[::ffff:127.0.0.1]` to the compressed hex form
 * `::ffff:7f00:1` before the guard ever sees it, and `dns.lookup` returns hex
 * for AAAA records too. So the dotted-quad branch that was supposed to catch
 * IPv4-mapped addresses was dead code for every real URL, and
 * `http://[::ffff:127.0.0.1]:8787/` reached loopback while plain `127.0.0.1`
 * was correctly refused. Same hole let `[::ffff:a9fe:a9fe]` reach
 * 169.254.169.254 — the metadata endpoint this file's header names as the
 * thing it exists to protect. Compare bytes, never text.
 */
function ipv6Bytes(ip: string): number[] | null {
  let text = ip.toLowerCase().split("%")[0]; // drop any zone id (fe80::1%eth0)

  // A trailing dotted quad (::ffff:127.0.0.1) is legal in the text form —
  // rewrite it to two hex groups so the rest of the parse is uniform.
  const dotted = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const q = dotted[1].split(".").map(Number);
    if (q.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hex = `${((q[0] << 8) | q[1]).toString(16)}:${((q[2] << 8) | q[3]).toString(16)}`;
    text = text.slice(0, dotted.index) + hex;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(":").map((g) => parseInt(g, 16)) : []);
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if ([...head, ...tail].some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;

  const groups =
    halves.length === 2
      ? [...head, ...Array(8 - head.length - tail.length).fill(0), ...tail]
      : head;
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of groups) bytes.push((g >> 8) & 0xff, g & 0xff);
  return bytes;
}

function ipv6Blocked(ip: string): boolean {
  const b = ipv6Bytes(ip);
  if (!b) return true; // unparseable — refuse rather than guess

  const allZero = (upTo: number) => b.slice(0, upTo).every((x) => x === 0);
  const embeddedV4 = (offset: number) => ipv4Blocked(b.slice(offset, offset + 4).join("."));

  // ::1 loopback and :: unspecified
  if (allZero(15) && (b[15] === 1 || b[15] === 0)) return true;
  // ::ffff:a.b.c.d — IPv4-mapped. THE bypass. Judge the embedded v4.
  if (allZero(10) && b[10] === 0xff && b[11] === 0xff) return embeddedV4(12);
  // ::a.b.c.d — deprecated IPv4-compatible, same trick.
  if (allZero(12)) return embeddedV4(12);
  // 64:ff9b::/96 NAT64 and 64:ff9b:1::/48 — also carry a v4 destination.
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return embeddedV4(12);
  // 2002::/16 6to4 — the v4 address is bytes 2-5.
  if (b[0] === 0x20 && b[1] === 0x02) return ipv4Blocked(b.slice(2, 6).join("."));
  // 2001::/32 Teredo — the CLIENT's v4 address is bytes 12-15, stored inverted.
  // The 6to4 branch above inspected its embedded v4 and this one did not, so a
  // Teredo address wrapping a private client address passed unexamined.
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) {
    const client = b.slice(12, 16).map((x) => x ^ 0xff);
    return ipv4Blocked(client.join("."));
  }

  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (b[0] === 0xff) return true; // ff00::/8 multicast
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
  // Public-IP-only already bounds the blast radius, but with no port rule this
  // fetcher is a port scanner for any public host: http://8.8.8.8:22/ and
  // :6379 both passed. Web content lives on a handful of ports; an allowlist
  // costs nothing and removes the primitive entirely.
  if (url.port !== "" && !["80", "443", "8080", "8443"].includes(url.port)) {
    throw new Error(`Blocked non-web port ${url.port} — only 80, 443, 8080 and 8443 are allowed.`);
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
      // ALL addresses, not just the first. A host that publishes both a public
      // A record and a private one would otherwise validate on whichever the
      // resolver happened to return first, and then connect to the other.
      const resolved = await lookup(host, { all: true, verbatim: true });
      if (!resolved.length) throw new Error("no addresses");
      const bad = resolved.find((r) => ipInBlockedRange(r.address));
      if (bad) {
        throw new Error(
          `Blocked request to non-public address (${host} -> ${bad.address}). ` +
            `This server refuses to fetch internal/loopback/link-local hosts.`
        );
      }
      ip = resolved[0].address;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Blocked")) throw err;
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
