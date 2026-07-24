#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { search, excerpt } from "./engine.js";
import { toChunks, upsert, removeSource, sourceCount } from "./indexer.js";
import { loadChunks, saveChunks, loadStats, saveStats } from "./store.js";
import type { IndexInput, SearchResult } from "./types.js";

const server = new McpServer(
  { name: "docsearch", version: "0.1.0" },
  {
    instructions:
      "Hybrid search over previously-ingested content (docs, pages, spreadsheets, slides, CI records). " +
      "index_document adds/updates a source's chunks (call it after ingest_document from the docingest asset, " +
      "passing its sections as chunks). search does full-text + semantic + hybrid ranking with metadata filters " +
      "and QUERY-TIME authorization (authorized_scopes) — never returns content outside the caller's scopes. " +
      "Results are concise excerpts with citations, not whole documents. delete_source removes a source; " +
      "search_stats reports index freshness, latency, and empty-result rate.",
  }
);

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `BOTTOM LINE: ${message}` }], isError: true };
}

const chunkSchema = z.object({ citation: z.string().max(200), text: z.string().max(200_000) });

server.registerTool(
  "index_document",
  {
    title: "Index a Document for Hybrid Search",
    description:
      "Index (or re-index) one source's content for later full-text + semantic search. Pass a stable source_id, " +
      "title, source_type, mime_type, and its chunks (each with a citation like 'page 3' / 'sheet Q1' / 'slide 5' " +
      "and the chunk text) — the sections/tables a docingest ingest_document call returns map directly to these. " +
      "Optional author, created_at, and acl_scope (default 'default') are stored for citation and query-time " +
      "authorization. Re-indexing the same source_id REPLACES its old chunks (safe for updates).",
    inputSchema: {
      source_id: z.string().min(1).max(400),
      title: z.string().min(1).max(500),
      url: z.string().max(4000).optional(),
      source_type: z.string().max(60),
      mime_type: z.string().max(200),
      author: z.string().max(200).optional(),
      created_at: z.string().max(40).optional(),
      acl_scope: z.string().max(120).optional().describe("Access-control scope; searchers must hold it. Default 'default'."),
      chunks: z.array(chunkSchema).min(1).max(5000).describe("Citable passages; docingest sections/tables map here."),
    },
  },
  async (a) => {
    const stats = await loadStats();
    try {
      const input: IndexInput = {
        sourceId: a.source_id, title: a.title, url: a.url, sourceType: a.source_type, mimeType: a.mime_type,
        author: a.author, createdAt: a.created_at, aclScope: a.acl_scope, chunks: a.chunks,
      };
      const existing = await loadChunks();
      const fresh = toChunks(input, Date.now());
      if (!fresh.length) throw new Error("no non-empty chunks to index.");
      const next = upsert(existing, fresh, a.source_id);
      await saveChunks(next);
      stats.chunks = next.length;
      stats.sources = sourceCount(next);
      stats.lastIndexedAt = new Date().toISOString();
      await saveStats(stats);
      return textResult(`Indexed ${fresh.length} chunk(s) for "${a.title}" (source_id=${a.source_id}, scope=${a.acl_scope ?? "default"}).\nBOTTOM LINE: index now holds ${next.length} chunk(s) across ${stats.sources} source(s).`);
    } catch (err) {
      stats.ingestFailures++;
      await saveStats(stats).catch(() => {});
      return errorResult(err);
    }
  }
);

server.registerTool(
  "search",
  {
    title: "Hybrid Search (full-text + semantic)",
    description:
      "Search indexed content. mode 'hybrid' (default) fuses exact BM25 lexical matching (names, IDs, error codes, " +
      "filenames, code symbols) with semantic vector similarity; 'lexical' or 'semantic' force one. Filter by " +
      "source_type/source_id/author/mime and since (ISO date); authorized_scopes gates results by access scope " +
      "(default ['default']) — content in other scopes is NEVER returned. Returns concise cited excerpts with a " +
      "relevance explanation and link, not whole documents.",
    inputSchema: {
      query: z.string().min(1).max(1000),
      k: z.number().int().positive().max(25).optional(),
      mode: z.enum(["hybrid", "lexical", "semantic"]).optional(),
      source_type: z.string().max(60).optional(),
      source_id: z.string().max(400).optional(),
      author: z.string().max(200).optional(),
      mime: z.string().max(200).optional(),
      since: z.string().max(40).optional().describe("ISO date; only content at/after this."),
      authorized_scopes: z.array(z.string().max(120)).optional().describe("Scopes the caller may see. Default ['default']."),
    },
  },
  async (a) => {
    const stats = await loadStats();
    const started = Date.now();
    try {
      const chunks = await loadChunks();
      const results = search(chunks, a.query, {
        k: a.k,
        mode: a.mode,
        filters: { sourceType: a.source_type, sourceId: a.source_id, author: a.author, mime: a.mime, since: a.since },
        authorizedScopes: a.authorized_scopes,
      });
      const ms = Date.now() - started;
      stats.searches++;
      stats.lastSearchMs = ms;
      stats.sumSearchMs += ms;
      if (!results.length) stats.emptyResults++;
      await saveStats(stats).catch(() => {});
      return textResult(render(a.query, results, ms));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "delete_source",
  {
    title: "Delete a Source from the Index",
    description: "Remove all indexed chunks for a source_id (use when a document is deleted or must be forgotten).",
    inputSchema: { source_id: z.string().min(1).max(400) },
  },
  async ({ source_id }) => {
    try {
      const existing = await loadChunks();
      const next = removeSource(existing, source_id);
      const removed = existing.length - next.length;
      await saveChunks(next);
      const stats = await loadStats();
      stats.chunks = next.length;
      stats.sources = sourceCount(next);
      await saveStats(stats);
      return textResult(`Removed ${removed} chunk(s) for source_id=${source_id}.\nBOTTOM LINE: index now holds ${next.length} chunk(s).`);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "search_stats",
  {
    title: "Index & Search Observability",
    description: "Report index freshness (chunk/source counts, last indexed), search latency (avg/last), empty-result rate, and ingestion-failure count.",
    inputSchema: {},
  },
  async () => {
    try {
      const s = await loadStats();
      const avg = s.searches ? (s.sumSearchMs / s.searches).toFixed(1) : "n/a";
      const emptyRate = s.searches ? `${((s.emptyResults / s.searches) * 100).toFixed(0)}%` : "n/a";
      return textResult(
        [
          `INDEX: ${s.chunks} chunk(s) across ${s.sources} source(s); last indexed ${s.lastIndexedAt ?? "never"}.`,
          `SEARCH: ${s.searches} run(s); latency avg ${avg}ms, last ${s.lastSearchMs ?? "n/a"}ms.`,
          `QUALITY: empty-result rate ${emptyRate}; ingestion failures ${s.ingestFailures}.`,
          `BOTTOM LINE: ${s.chunks === 0 ? "index is empty — ingest + index_document first." : `index healthy; ${emptyRate} of searches returned nothing.`}`,
        ].join("\n")
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

function render(query: string, results: SearchResult[], ms: number): string {
  if (!results.length) return `No matches for "${query}".\nBOTTOM LINE: 0 results (${ms}ms) — try different terms, a broader mode, or check authorized_scopes.`;
  const lines = [`RESULTS for "${query}" (${results.length}, ${ms}ms):`];
  for (const r of results) {
    const c = r.chunk;
    lines.push(``, `▸ ${c.title} — ${c.sourceType} [${c.citation}]`);
    lines.push(`  ${excerpt(c.text, query)}`);
    lines.push(`  why: ${r.why}${c.author ? ` · author ${c.author}` : ""}`);
    if (c.url) lines.push(`  source: ${c.url}`);
  }
  lines.push(``, `BOTTOM LINE: top ${results.length} cited excerpt(s) — open the source link for the full passage; ask to expand a specific hit if needed.`);
  return lines.join("\n");
}

const transport = new StdioServerTransport();
await server.connect(transport);
