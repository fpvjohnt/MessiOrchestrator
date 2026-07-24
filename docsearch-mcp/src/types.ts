// The indexed unit is a CHUNK: one citable passage (a page, section, sheet, row
// range, or slide) plus the full source metadata required by the spec so every
// hit can be attributed and access-controlled at QUERY time.

export interface IndexInput {
  sourceId: string; // stable id for the source (URL, path, or caller-supplied)
  title: string;
  url?: string; // link/reference back to the original
  sourceType: string; // pdf | word | spreadsheet | presentation | html | image | ci | ...
  mimeType: string;
  author?: string;
  createdAt?: string; // source timestamp when known (ISO)
  aclScope?: string; // access-control scope; default "default"
  chunks: Array<{ citation: string; text: string }>; // citation = "page 3" / "sheet Q1" / "slide 5" / "rows 2-40"
}

export interface Chunk {
  id: string; // `${sourceId}#${n}`
  sourceId: string;
  title: string;
  url?: string;
  sourceType: string;
  mimeType: string;
  citation: string;
  text: string;
  author?: string;
  createdAt?: string;
  indexedAt: string;
  aclScope: string;
  // index-internal (kept on the persisted record so load is O(n), no re-embed):
  tf: Record<string, number>;
  len: number; // token count (for BM25 length norm)
  vec: number[]; // L2-normalized dense vector
}

export interface SearchFilters {
  sourceType?: string;
  sourceId?: string;
  author?: string;
  since?: string; // ISO — only chunks with createdAt/indexedAt >= since
  mime?: string;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
  lexRank: number | null;
  vecRank: number | null;
  why: string; // relevance explanation
}
