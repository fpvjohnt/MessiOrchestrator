// Mirrors orchestrator-mcp's case-store/registry shape (src/types.ts there).
// Any orchestrator whose cases.json/registry.json matches this contract can
// be pointed at by this MCP — that's what keeps it generic instead of tied
// to one deployment.

export interface CaseTaskLog {
  asset: string;
  tool: string;
  arguments: unknown;
  result?: unknown;
  error?: string;
  timestamp: string;
  durationMs?: number;
}

export type CaseStatus = "open" | "closed";
export type CaseOutcome = "resolved" | "partial" | "unresolved" | "misrouted";

export interface Case {
  id: string;
  objective: string;
  assignedAssets: string[];
  status: CaseStatus;
  openedAt: string;
  closedAt?: string;
  summary?: string;
  outcome?: CaseOutcome;
  log: CaseTaskLog[];
}

export type AssetStatus = "active" | "retired";

export interface AssetConfig {
  name: string;
  description: string;
  tags: string[];
  status: AssetStatus;
  fallback?: boolean;
}
