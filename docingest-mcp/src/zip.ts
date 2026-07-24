// Minimal pure-Node ZIP reader — enough to pull named XML/text entries out of
// Office Open XML files (docx/xlsx/pptx are ZIP containers of deflated XML).
// No dependency: Node's zlib does the deflate; we parse the container ourselves
// via the Central Directory (which always carries correct sizes, unlike a local
// header when a data descriptor is used).
import { inflateRawSync } from "node:zlib";

interface Entry {
  name: string;
  method: number; // 0 = stored, 8 = deflate
  compSize: number;
  uncompSize: number;
  localOffset: number;
}

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;

export class ZipArchive {
  private entries = new Map<string, Entry>();

  constructor(private buf: Buffer) {
    this.parseCentralDirectory();
  }

  private parseCentralDirectory(): void {
    // EOCD is within the last 64KB (comment ≤ 65535). Scan backward for it.
    const min = Math.max(0, this.buf.length - 65_557);
    let eocd = -1;
    for (let i = this.buf.length - 22; i >= min; i--) {
      if (this.buf.readUInt32LE(i) === EOCD_SIG) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("not a valid zip (no end-of-central-directory record)");

    const count = this.buf.readUInt16LE(eocd + 10);
    let p = this.buf.readUInt32LE(eocd + 16); // central directory offset

    for (let n = 0; n < count && p + 46 <= this.buf.length; n++) {
      if (this.buf.readUInt32LE(p) !== CD_SIG) break;
      const method = this.buf.readUInt16LE(p + 10);
      const compSize = this.buf.readUInt32LE(p + 20);
      const uncompSize = this.buf.readUInt32LE(p + 24);
      const nameLen = this.buf.readUInt16LE(p + 28);
      const extraLen = this.buf.readUInt16LE(p + 30);
      const commentLen = this.buf.readUInt16LE(p + 32);
      const localOffset = this.buf.readUInt32LE(p + 42);
      const name = this.buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
      this.entries.set(name, { name, method, compSize, uncompSize, localOffset });
      p += 46 + nameLen + extraLen + commentLen;
    }
  }

  list(): string[] {
    return [...this.entries.keys()];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  /** Returns the decompressed bytes for one entry, or null if absent/oversized. */
  read(name: string): Buffer | null {
    const e = this.entries.get(name);
    if (!e) return null;
    // Local header at localOffset; its name/extra lengths give the data start.
    const lh = e.localOffset;
    if (this.buf.readUInt32LE(lh) !== 0x04034b50) return null;
    const nameLen = this.buf.readUInt16LE(lh + 26);
    const extraLen = this.buf.readUInt16LE(lh + 28);
    const dataStart = lh + 30 + nameLen + extraLen;
    const raw = this.buf.subarray(dataStart, dataStart + e.compSize);
    try {
      if (e.method === 0) return Buffer.from(raw); // stored
      if (e.method === 8) return inflateRawSync(raw); // deflate
      return null; // unsupported compression
    } catch {
      return null;
    }
  }

  readText(name: string): string | null {
    const b = this.read(name);
    return b ? b.toString("utf8") : null;
  }
}
