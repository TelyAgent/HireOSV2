import { translate } from "../data/i18n";
import type { Lang } from "../store/types";

/** Deterministic score aggregation, ported verbatim from the prototype
 * (Interface Spec §5.2): coverage-gated overall score, "Unknown" stays
 * `null` rather than being guessed at below the coverage threshold. */
export interface DimensionForAggregate {
  weight: number;
  status: "evaluated" | "unknown" | "not_evaluated" | "not_applicable";
  score: number | null;
}
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function computeAggregate(
  dims: DimensionForAggregate[],
  minCoverage?: number,
): { coverage: number; overall: number | null } {
  const min = minCoverage == null ? 0.7 : minCoverage;
  const applicable = dims.filter((d) => d.status !== "not_applicable");
  const totalW = applicable.reduce((s, d) => s + d.weight, 0) || 1;
  const evaluated = applicable.filter((d) => d.status === "evaluated" && typeof d.score === "number");
  const evalW = evaluated.reduce((s, d) => s + d.weight, 0);
  const coverage = totalW ? evalW / totalW : 0;
  let overall: number | null = null;
  if (coverage >= min && evalW > 0) {
    overall = evaluated.reduce((s, d) => s + d.weight * (d.score as number), 0) / evalW;
  }
  return { coverage: round2(coverage), overall: overall == null ? null : round1(overall) };
}

export type EligibilityResultStatus = "met" | "not_met" | "unknown" | "conflicting" | "provisionally_met";
export type EligibilityStatus = "eligible" | "likely_eligible" | "needs_verification" | "not_eligible";

/** Confidence display per Patch 1 rule: reuse the overall/coverage engine, no
 * percentages, coverage-gated buckets. */
export function confidenceLabel(
  r: { eligibility?: EligibilityStatus; proposalSource?: string; confidence: number | null },
  lang: Lang,
): string {
  if (r.eligibility === "not_eligible") return translate(lang, "Not eligible — confidence not shown");
  if (r.proposalSource === "manual") return translate(lang, "Manually added — no AI confidence score");
  if (r.confidence == null) return translate(lang, "Insufficient evidence to estimate confidence");
  const p = Math.round(r.confidence * 100);
  if (p >= 70) return translate(lang, "Strong match signal");
  if (p >= 40) return translate(lang, "Some match signal");
  return translate(lang, "Limited match signal");
}

/** Inferred AI recommendation badge for a screening evaluation — a display
 * derivation only, never itself an approval/rejection action. Ported
 * verbatim from the prototype's `inferRecommendation`. */
export type InferredRecommendation = "strong_advance" | "advance" | "review" | "do_not_advance";
export function inferRecommendation(
  ev: { eligibilityStatus?: EligibilityStatus; evaluationStatus?: string; overall: number | null } | null | undefined,
): InferredRecommendation | null {
  if (!ev) return null;
  if (ev.eligibilityStatus === "not_eligible") return "do_not_advance";
  if (ev.evaluationStatus === "insufficient_evidence") return "review";
  if (ev.overall == null) return "review";
  if (ev.overall >= 80 && ev.eligibilityStatus === "eligible") return "strong_advance";
  if (ev.overall >= 65) return "advance";
  return "review";
}
