// SSRF-checked, IP-PINNED single request. Closes the DNS-rebinding TOCTOU that
// plain fetch() leaves open: assertPublicUrl resolves+validates the host, and we
// pin the socket to THAT ip via node http/https `lookup`, while keeping the
// hostname as `servername` so TLS SNI/cert validation still passes. Built-ins
// only (undici isn't importable here). One response, no auto-redirect — the
// caller re-validates each hop. Size-capped, timed out, gzip/deflate/br aware.
import http from "node:http";
import https from "node:https";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";
import { assertPublicUrl } from "./ssrf-guard.js";

export interface PinnedResponse {
  status: number;
  headers: Map<string, string>;
  finalUrl: string;
  hostname: string;
  body: Buffer;
  truncated: boolean;
}

export async function pinnedFetch(
  rawUrl: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number } = {}
): Promise<PinnedResponse> {
  const { url, ip } = await assertPublicUrl(rawUrl);
  const lib = url.protocol === "https:" ? https : http;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 15_000_000;

  return await new Promise<PinnedResponse>((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const fail = (e: unknown) => {
      clearTimeout(timer);
      reject(e instanceof Error ? e : new Error(String(e)));
    };

    const req = lib.request(
      url,
      {
        method: "GET",
        headers: { "Accept-Encoding": "gzip, deflate, br", ...(opts.headers ?? {}) },
        servername: url.protocol === "https:" ? url.hostname : undefined,
        // The pin: hand node the pre-validated IP instead of letting it resolve
        // the hostname a second time (which a 0-TTL rebind could answer with an
        // internal address).
        lookup: ((_host: string, options: { all?: boolean }, cb: (...a: unknown[]) => void) => {
          const family = ip.includes(":") ? 6 : 4;
          if (options && options.all) cb(null, [{ address: ip, family }]);
          else cb(null, ip, family);
        }) as never,
        signal: controller.signal,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        let truncated = false;
        res.on("data", (c: Buffer) => {
          if (truncated) return;
          if (total + c.length > maxBytes) {
            chunks.push(c.subarray(0, maxBytes - total));
            total = maxBytes;
            truncated = true;
            res.destroy();
            return;
          }
          chunks.push(c);
          total += c.length;
        });
        // `end` does NOT fire after res.destroy(), and there was no `close`
        // handler — so hitting maxBytes left this Promise permanently unsettled.
        // Not a 15s error: the abort fires and nothing listens, so the caller
        // hangs forever and leaks the socket. `truncated: true` was unreachable
        // dead code. research.ts auto-fetches every search result through
        // Promise.allSettled, so one oversized page wedged the fallback asset
        // that rides most of this system's traffic.
        //
        // `close` fires on BOTH paths — normal end and destroy — so settling
        // there covers both, and settle() guards against the double-call.
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          let body = Buffer.concat(chunks);
          const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
          if (!truncated) {
            try {
              // maxOutputLength or this is a decompression bomb: 194 KB of gzip
              // expands to 200 MB, comfortably inside the 1.5 MB wire cap that
              // was doing all the work here. These are the *Sync variants, so
              // the expansion also blocks the MCP server's event loop for its
              // whole duration. zlib enforces the cap and throws; the existing
              // catch then leaves the body raw, which is the right outcome.
              const opts = { maxOutputLength: maxBytes };
              if (enc.includes("br")) body = brotliDecompressSync(body, opts);
              else if (enc.includes("gzip")) body = gunzipSync(body, opts);
              else if (enc.includes("deflate")) body = inflateSync(body, opts);
            } catch {
              /* leave raw if decompression fails or exceeds the cap */
            }
          }
          const headers = new Map<string, string>();
          for (const [k, v] of Object.entries(res.headers)) headers.set(k.toLowerCase(), Array.isArray(v) ? v.join(", ") : String(v ?? ""));
          resolve({ status: res.statusCode ?? 0, headers, finalUrl: url.toString(), hostname: url.hostname, body, truncated });
        };
        res.on("end", settle);
        res.on("close", settle);
        res.on("error", fail);
      }
    );
    req.on("error", fail);
    req.end();
  });
}
