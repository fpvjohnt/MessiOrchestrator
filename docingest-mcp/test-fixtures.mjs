// Synthetic, offline fixtures for the doc-ingestion tests — no network, no real
// files on disk. A tiny STORED-method ZIP writer builds the Office fixtures
// (the reader in zip.ts handles stored + deflate); the PDFs and JPEG are
// hand-authored minimal-but-valid byte sequences.
import { Buffer } from "node:buffer";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

// entries: [{ name, data(string|Buffer) }] -> a valid stored-method zip Buffer.
export function makeZip(entries) {
  const files = entries.map((e) => ({
    name: Buffer.from(e.name, "utf8"),
    data: Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8"),
  }));
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const crc = crc32(f.data);
    const size = f.data.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(size, 18);
    lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(f.name.length, 26);
    parts.push(lh, f.name, f.data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(f.name.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, f.name);
    offset += 30 + f.name.length + size;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, eocd]);
}

export function makeDocx() {
  const doc = `<?xml version="1.0"?><w:document xmlns:w="http://x"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly Report</w:t></w:r></w:p>
<w:p><w:r><w:t>Revenue grew this quarter.</w:t></w:r></w:p>
<w:tbl>
<w:tr><w:tc><w:p><w:r><w:t>Region</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Sales</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>West</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1200</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl></w:body></w:document>`;
  const comments = `<?xml version="1.0"?><w:comments xmlns:w="http://x"><w:comment><w:p><w:r><w:t>Double-check West.</w:t></w:r></w:p></w:comment></w:comments>`;
  return makeZip([
    { name: "[Content_Types].xml", data: "<Types/>" },
    { name: "word/document.xml", data: doc },
    { name: "word/comments.xml", data: comments },
  ]);
}

export function makeXlsx() {
  const wb = `<?xml version="1.0"?><workbook xmlns:r="http://x"><sheets><sheet name="Q1" sheetId="1" r:id="rId1"/><sheet name="Q2" sheetId="2" r:id="rId2"/></sheets></workbook>`;
  const s1 = `<?xml version="1.0"?><worksheet><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>Region</t></is></c><c r="B1" t="inlineStr"><is><t>Sales</t></is></c><c r="C1" t="inlineStr"><is><t>Double</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>West</t></is></c><c r="B2"><v>100</v></c><c r="C2"><f>B2*2</f><v>200</v></c></row>
</sheetData></worksheet>`;
  const s2 = `<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Note</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Q2 pending</t></is></c></row></sheetData></worksheet>`;
  return makeZip([
    { name: "[Content_Types].xml", data: "<Types/>" },
    { name: "xl/workbook.xml", data: wb },
    { name: "xl/worksheets/sheet1.xml", data: s1 },
    { name: "xl/worksheets/sheet2.xml", data: s2 },
  ]);
}

export function makePptx() {
  const slide = `<?xml version="1.0"?><p:sld xmlns:a="http://x" xmlns:p="http://y"><p:cSld><p:spTree><a:p><a:r><a:t>Welcome to the Deck</a:t></a:r></a:p></p:spTree></p:cSld></p:sld>`;
  const notes = `<?xml version="1.0"?><p:notes xmlns:a="http://x" xmlns:p="http://y"><a:p><a:r><a:t>Remember to mention the budget.</a:t></a:r></a:p><a:p><a:r><a:t>1</a:t></a:r></a:p></p:notes>`;
  return makeZip([
    { name: "[Content_Types].xml", data: "<Types/>" },
    { name: "ppt/presentation.xml", data: "<p:presentation/>" },
    { name: "ppt/slides/slide1.xml", data: slide },
    { name: "ppt/notesSlides/notesSlide1.xml", data: notes },
  ]);
}

// Minimal valid text PDF: one uncompressed content stream showing text.
export function makeTextPdf() {
  return Buffer.from(
    `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/Contents 4 0 R>>endobj
4 0 obj<</Length 48>>stream
BT /F1 24 Tf 72 720 Td (Hello Ingestion World) Tj ET
endstream endobj
trailer<</Root 1 0 R>>
%%EOF`,
    "latin1"
  );
}

// Scanned PDF: a content stream that only draws an image XObject (no text), plus
// an image object with an image filter.
export function makeScannedPdf() {
  return Buffer.from(
    `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/Contents 4 0 R/Resources<</XObject<</Im1 5 0 R>>>>>>endobj
4 0 obj<</Length 30>>stream
q 200 0 0 200 0 0 cm /Im1 Do Q
endstream endobj
5 0 obj<</Type/XObject/Subtype/Image/Width 200/Height 200/Filter/DCTDecode/Length 3>>stream
xxx
endstream endobj
%%EOF`,
    "latin1"
  );
}

// Minimal JPEG: SOI + SOF0 (100x200) + EOI. Enough for signature + dimensions.
export function makeJpeg() {
  return Buffer.from([
    0xff, 0xd8, // SOI
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03,
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9, // EOI
  ]);
}

export function makeConfluenceHtml() {
  return Buffer.from(
    `<html><head><title>Q3 Planning</title></head><body>
<main><h1>Q3 Planning</h1><p>See the attached budget and the strategy deck for details.</p></main>
<aside class="attachments">
  <a href="/download/attachments/12345/budget.xlsx">Budget Q3</a>
  <a href="https://wiki.acme.com/files/strategy-deck.pptx">Strategy Deck</a>
  <a href="/wiki/download/attachments/999/meeting-notes.pdf">Meeting Notes</a>
  <a href="https://acme.com/other-page.html">Related page (not an attachment)</a>
</aside></body></html>`,
    "utf8"
  );
}
