export type RecommendationStatus = "proposed" | "confirmed" | "dismissed" | "deferred" | "stale" | "withdrawn";

export interface CandidateJobRecommendation {
  id: string;
  candidateId: string;
  jobId: string;
  status: RecommendationStatus;
  createdAt: string;
  confidence: number;
  rationale: string;
  gaps: string[];
  staleReason?: string;
  proposalSource?: "manual" | "local_rule" | "ai" | "imported_intent";
  applicationRef?: string;
  /** "not_eligible" only when the résumé explicitly rules the role out (#181); absent on older matches. */
  eligibility?: "eligible" | "not_eligible";
  /** The résumé statements that rule it out, quoted. */
  conflicts?: Array<{ requirement: string; quote: string }>;
  /** What the recommendation was based on (#183). */
  basis?: { profileVersion?: number; criteriaVersion?: number; discoveryRunId?: string; evaluatedAt?: string };
  /** Résumé quotes behind the rationale, and whether each was found in the text the match read. */
  evidence?: Array<{ requirementId: string; requirementLabel?: string; quote: string; sourceMaterialId?: string; verification: "found" | "not_found" | "unchecked" }>;
}
