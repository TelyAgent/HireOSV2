/**
 * How a job recommendation reads, the same on the candidate profile and the recommendations page (F06):
 * its status — a stale one says it was replaced by a newer match run (#182) — in the interface language (#184),
 * and whether a confidence level may be shown at all: never for a stale recommendation or one the résumé
 * explicitly rules out (#181).
 */
export type RecommendationLike = {
  status: string;
  staleReason?: string;
  eligibility?: "eligible" | "not_eligible";
};

export const RECOMMENDATION_STATUS: Record<string, { label: string; tone: string }> = {
  proposed: { label: "Pending confirmation", tone: "badge-info" },
  confirmed: { label: "Confirmed — linked to role", tone: "badge-success" },
  dismissed: { label: "Dismissed", tone: "badge-outline" },
  deferred: { label: "Deferred", tone: "badge-neutral" },
  stale: { label: "Expired — replaced by a newer match", tone: "badge-outline" },
};

/** Stale reasons the backend records, as sentences that have translations. */
const STALE_REASON: Record<string, string> = {
  "Replaced by a newer discovery run.": "A newer matching run replaced this recommendation.",
};

export function recommendationStatus(rec: RecommendationLike) {
  return RECOMMENDATION_STATUS[rec.status] ?? { label: "Unknown status", tone: "badge-outline" };
}

export function staleReason(rec: RecommendationLike): string | null {
  if (rec.status !== "stale") return null;
  return (rec.staleReason && STALE_REASON[rec.staleReason]) || "A newer matching run replaced this recommendation.";
}

export function showsConfidence(rec: RecommendationLike): boolean {
  return rec.status !== "stale" && rec.eligibility !== "not_eligible";
}

/** Only a current recommendation can still be acted on. */
export function isActionable(rec: RecommendationLike): boolean {
  return rec.status === "proposed" || rec.status === "deferred";
}
