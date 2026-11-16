/**
 * Events emitted by POST /api/ollama/pull as newline-delimited JSON.
 * Shared by the route handler and the client so both sides stay in sync.
 */
export type ModelPullEventType = "progress" | "done" | "error";

export interface ModelPullEvent {
  type: ModelPullEventType;
  model: string;
  /** Raw Ollama status such as "downloading" or "verifying sha256 digest". */
  status?: string;
  /** Digest of the layer this event belongs to. */
  digest?: string;
  /** Bytes downloaded for this layer (when total > 0). */
  completed?: number;
  /** Total bytes for this layer (when reported by Ollama). */
  total?: number;
  /** Percent complete for this layer. */
  percent?: number;
  /** Percent complete across every layer seen so far. */
  overallPercent?: number;
  /** Bytes downloaded across every layer seen so far. */
  overallCompleted?: number;
  /** Total bytes across every layer seen so far. */
  overallTotal?: number;
  error?: string;
}
