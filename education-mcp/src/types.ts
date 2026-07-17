export type Confidence = "high" | "medium" | "low";

/**
 * A live-sensitive fact stored as this MCP's "source of truth", carrying
 * everything the orchestrator+research loop needs to verify it against the
 * authoritative source: what it says, when it was captured, who says so, the exact
 * URL to re-check, and how long before it should be re-verified.
 */
export interface ReferenceRecord {
  key: string;
  label: string;
  value: string;
  as_of: string; // ISO date the value was captured/confirmed
  source: string; // human-readable source name
  verify_url: string; // the AUTHORITATIVE url research should fetch to re-check
  staleness_days: number; // re-verify if older than this
  confidence: Confidence;
  notes?: string;
  history?: Array<{ value: string; as_of: string; source: string; replaced_on: string }>;
}
