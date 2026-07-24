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
        res.on("end", () => {
          clearTimeout(timer);
          let body = Buffer.concat(chunks);
          const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
          if (!truncated) {
            try {
              if (enc.includes("br")) body = brotliDecompressSync(body);
              else if (enc.includes("gzip")) body = gunzipSync(body);
              else if (enc.includes("deflate")) body = inflateSync(body);
            } catch {
              /* leave raw if decompression fails */
            }
          }
          const headers = new Map<string, string>();
          for (const [k, v] of Object.entries(res.headers)) headers.set(k.toLowerCase(), Array.isArray(v) ? v.join(", ") : String(v ?? ""));
          resolve({ status: res.statusCode ?? 0, headers, finalUrl: url.toString(), hostname: url.hostname, body, truncated });
        });
        res.on("error", fail);
      }
    );
    req.on("error", fail);
    req.end();
  });
}
