import type { EligibilityResultStatus, EligibilityStatus } from "../../lib/scoring";

export type DimensionScoreStatus = "evaluated" | "unknown" | "not_evaluated" | "not_applicable";
export interface DimensionScore {
  id: string;
  name: string;
  weight: number;
  status: DimensionScoreStatus;
  score: number | null;
  confidence: number | null;
  reason: string;
  supporting: string[];
  counter: string[];
}
export interface EligibilityResult {
  requirementId: string;
  status: EligibilityResultStatus;
  reason: string;
  evidence: string[];
}
export type EvaluationStatus = "evaluated" | "insufficient_evidence";
export type Freshness = "current" | "stale" | "restricted" | "withdrawn";

export interface Evaluation {
  id: string;
  applicationId: string;
  version?: number;
  status: "completed";
  evaluationMode: "ai_assisted" | "manual";
  aiStatus: "available" | "unavailable" | "not_requested";
  eligibilityStatus: EligibilityStatus;
  eligibilityResults: EligibilityResult[];
  overall: number | null;
  coverage: number;
  confidence: number | null;
  evaluationStatus: EvaluationStatus;
  dimensionScores: DimensionScore[];
  modelVersion: string | null;
  completedAt: string;
  freshness: Freshness;
}
