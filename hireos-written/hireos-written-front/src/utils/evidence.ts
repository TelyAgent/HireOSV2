import type { Criterion, Evaluation } from "../data/fixtures";

/**
 * What a criterion's evidence panel can show (#378). No imports beyond types, so it can be tested as is.
 * - ok: there is a rationale or an excerpt
 * - running / failed: the AI evaluation hasn't produced one
 * - manual: scored by hand without an AI evaluation
 * - none: the AI evaluation gave nothing for this criterion
 */
export function evidenceState(c: Criterion, aiStatus?: Evaluation["aiStatus"]): "ok" | "running" | "failed" | "manual" | "none" {
  if (c.evidence || (c.quotes && c.quotes.length)) return "ok";
  if (aiStatus === "pending" || aiStatus === "running") return "running";
  if (aiStatus === "failed") return "failed";
  if (c.manual || c.source === "Manual scoring") return "manual";
  return "none";
}
