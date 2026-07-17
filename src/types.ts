export type TransportKind = "stdio" | "http";

export type AssetStatus = "active" | "retired";

export interface AssetConfig {
  name: string;
  description: string;
  tags: string[];
  transport: TransportKind;
  // stdio transport
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // http transport
  url?: string;
  // When true, this asset is assigned as a first-line responder for any
  // objective that no other asset matches by tag/description — e.g. a
  // research asset that should field every plain-language question before
  // more specialized assets take over.
  fallback?: boolean;
  status: AssetStatus;
  registeredAt: string;
}

export interface CaseTaskLog {
  asset: string;
  tool: string;
  arguments: unknown;
  result?: unknown;
  error?: string;
  timestamp: string;
  durationMs?: number; // wall-clock of the asset call, for latency metrics
}

export type CaseStatus = "open" | "closed";

// The feedback signal the system never had: how a closed case actually turned
// out. Separates routing failure (misrouted — wrong asset) from answer failure
// (unresolved — right asset, no useful help) so the quality report can tell
// "we sent it to the wrong expert" apart from "the expert couldn't help".
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
