/**
 * The AI recommendation for a screening evaluation (F08 BR-6, Owner decision on #194, 2026-10-16) — advice only,
 * never a decision. The score sets the band: ≥ 85 strong advance, 70–84 advance, 50–69 review, 30–49 hold,
 * < 30 do not advance. Gates come first: not eligible → do not advance; too little coverage → review; an
 * unresolved high-severity concern, or eligibility that still needs verifying, caps it at review. Every page
 * calls this one function with the same inputs, so they can't disagree.
 */
export type InferredRecommendation = "strong_advance" | "advance" | "review" | "hold" | "do_not_advance";

export type RecommendationInput = {
  eligibilityStatus?: string;
  evaluationStatus?: string;
  overall: number | null;
};

/** Concerns as far as the rule needs them. */
export type ConcernForRule = { severity: string; status: string };

export type RecommendationCap = "not_eligible" | "insufficient_coverage" | "open_high_concern" | "needs_verification";

const ORDER: InferredRecommendation[] = ["do_not_advance", "hold", "review", "advance", "strong_advance"];

export function scoreBand(overall: number): InferredRecommendation {
  if (overall >= 85) return "strong_advance";
  if (overall >= 70) return "advance";
  if (overall >= 50) return "review";
  if (overall >= 30) return "hold";
  return "do_not_advance";
}

/** High or blocker severity, not yet confirmed, dismissed or accepted as a risk. */
export function isOpenHighConcern(concern: ConcernForRule): boolean {
  return concern.status === "open" && (concern.severity === "high" || concern.severity === "blocker");
}

export function recommend(
  ev: RecommendationInput | null | undefined,
  concerns: ConcernForRule[] = [],
): { outcome: InferredRecommendation; cappedBy: RecommendationCap[] } | null {
  if (!ev) return null;
  if (ev.eligibilityStatus === "not_eligible") return { outcome: "do_not_advance", cappedBy: ["not_eligible"] };
  if (ev.evaluationStatus === "insufficient_evidence" || ev.overall == null) return { outcome: "review", cappedBy: ["insufficient_coverage"] };
  const band = scoreBand(ev.overall);
  const caps: RecommendationCap[] = [
    ...(concerns.some(isOpenHighConcern) ? (["open_high_concern"] as const) : []),
    ...(ev.eligibilityStatus === "needs_verification" ? (["needs_verification"] as const) : []),
  ];
  if (caps.length && ORDER.indexOf(band) > ORDER.indexOf("review")) return { outcome: "review", cappedBy: caps };
  return { outcome: band, cappedBy: [] };
}

/**
 * How a page shows the recommendation, from the rule's result alone so every page shows the same: the outcome's
 * badge, worded "Review (insufficient evidence)" only when too little coverage is what made it a review — a
 * candidate who is not eligible is "do not advance" even when the evidence is also thin (#194 review).
 */
export function recommendationDisplay(
  rec: { outcome: InferredRecommendation; cappedBy: RecommendationCap[] } | null,
): { outcome: InferredRecommendation; insufficientEvidence: boolean } | null {
  if (!rec) return null;
  return { outcome: rec.outcome, insufficientEvidence: rec.cappedBy.includes("insufficient_coverage") };
}

export function inferRecommendation(ev: RecommendationInput | null | undefined, concerns: ConcernForRule[] = []): InferredRecommendation | null {
  return recommend(ev, concerns)?.outcome ?? null;
}

export const CAP_REASON: Record<RecommendationCap, string> = {
  not_eligible: "Not eligible — a hard requirement is not met.",
  insufficient_coverage: "Too little of the criteria could be evaluated to go further than review.",
  open_high_concern: "Capped at review: a high-severity concern is still open.",
  needs_verification: "Capped at review: eligibility still needs verifying.",
};
