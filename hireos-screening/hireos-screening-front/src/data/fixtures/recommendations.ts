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
}
