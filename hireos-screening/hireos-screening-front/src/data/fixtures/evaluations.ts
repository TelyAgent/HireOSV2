import { daysAgo } from "../../lib/daysAgo";
import { computeAggregate, aggregateEligibility, type EligibilityResultStatus, type EligibilityStatus } from "../../lib/scoring";
import { JOB_A_DIMENSIONS } from "./jobs";

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

function makeEval(
  id: string,
  applicationId: string,
  dims: DimensionScore[],
  elig: EligibilityResult[],
  opts: { confidence?: number; completedAt?: string; freshness?: Freshness } = {},
): Evaluation {
  const agg = computeAggregate(dims);
  const evaluationStatus: EvaluationStatus = agg.overall == null ? "insufficient_evidence" : "evaluated";
  return {
    id,
    applicationId,
    status: "completed",
    evaluationMode: "ai_assisted",
    aiStatus: "available",
    eligibilityStatus: aggregateEligibility(elig),
    eligibilityResults: elig,
    overall: agg.overall,
    coverage: agg.coverage,
    confidence: opts.confidence != null ? opts.confidence : 0.7,
    evaluationStatus,
    dimensionScores: dims,
    modelVersion: "screen-eval-v2.3.1 (sample)",
    completedAt: opts.completedAt || daysAgo(2),
    freshness: opts.freshness || "current",
  };
}

export const EVALUATIONS: Record<string, Evaluation> = {
  "app-alex-a": makeEval(
    "eval-alex-a",
    "app-alex-a",
    [
      { id: "dim-tech", name: JOB_A_DIMENSIONS[0].name, weight: 0.3, status: "evaluated", score: 88, confidence: 0.82, reason: "Directly led a service-oriented migration handling 40M requests/day; consistent with senior-level systems design.", supporting: ["ev-alex-1"], counter: [] },
      { id: "dim-exp", name: JOB_A_DIMENSIONS[1].name, weight: 0.25, status: "evaluated", score: 84, confidence: 0.8, reason: "6+ years of backend-focused roles closely matching this scope.", supporting: ["ev-alex-2"], counter: [] },
      { id: "dim-own", name: JOB_A_DIMENSIONS[2].name, weight: 0.2, status: "evaluated", score: 76, confidence: 0.6, reason: "Owned a latency-reduction initiative end to end; partially self-reported, not yet independently verified.", supporting: ["ev-alex-3"], counter: [] },
      { id: "dim-comm", name: JOB_A_DIMENSIONS[3].name, weight: 0.15, status: "evaluated", score: 72, confidence: 0.55, reason: "Writing in application materials is clear and structured; no direct collaboration evidence yet.", supporting: ["ev-alex-4"], counter: [] },
      { id: "dim-comp", name: JOB_A_DIMENSIONS[4].name, weight: 0.1, status: "unknown", score: null, confidence: null, reason: "Compensation expectation was not provided in intake or resume.", supporting: [], counter: [] },
    ],
    [
      { requirementId: "req-auth", status: "met", reason: "Resume and profile confirm US citizenship.", evidence: ["ev-alex-1"] },
      { requirementId: "req-exp", status: "met", reason: "6+ years of backend engineering experience documented.", evidence: ["ev-alex-2"] },
    ],
    { confidence: 0.75, completedAt: daysAgo(3), freshness: "stale" },
  ),

  "app-jordan-a": makeEval(
    "eval-jordan-a",
    "app-jordan-a",
    [
      { id: "dim-tech", name: JOB_A_DIMENSIONS[0].name, weight: 0.3, status: "evaluated", score: 65, confidence: 0.5, reason: "Technical scope described in resume is credible but self-reported; no independent verification yet.", supporting: ["ev-jordan-1"], counter: [] },
      { id: "dim-exp", name: JOB_A_DIMENSIONS[1].name, weight: 0.25, status: "evaluated", score: 70, confidence: 0.65, reason: "5+ years across founding-engineer and backend roles.", supporting: ["ev-jordan-2"], counter: [] },
      { id: "dim-own", name: JOB_A_DIMENSIONS[2].name, weight: 0.2, status: "evaluated", score: 90, confidence: 0.85, reason: "Built and shipped an analytics platform from 0 to production solo — strong, specific 0→1 evidence.", supporting: ["ev-jordan-3"], counter: [] },
      { id: "dim-comm", name: JOB_A_DIMENSIONS[3].name, weight: 0.15, status: "evaluated", score: 68, confidence: 0.55, reason: "Application materials are clear; limited direct collaboration evidence available.", supporting: ["ev-jordan-4"], counter: [] },
      { id: "dim-comp", name: JOB_A_DIMENSIONS[4].name, weight: 0.1, status: "evaluated", score: 90, confidence: 0.7, reason: "Stated compensation expectation ($150k–$175k) is within the posted range; location matches.", supporting: ["ev-jordan-5"], counter: [] },
    ],
    [
      { requirementId: "req-auth", status: "met", reason: "Confirmed US permanent resident.", evidence: ["ev-jordan-2"] },
      { requirementId: "req-exp", status: "met", reason: "5+ years across two roles.", evidence: ["ev-jordan-2"] },
    ],
    { confidence: 0.68, completedAt: daysAgo(1) },
  ),

  "app-casey-a": makeEval(
    "eval-casey-a",
    "app-casey-a",
    [
      { id: "dim-tech", name: JOB_A_DIMENSIONS[0].name, weight: 0.3, status: "not_evaluated", score: null, confidence: null, reason: "Resume does not describe specific technical contributions in enough depth to evaluate.", supporting: [], counter: [] },
      { id: "dim-exp", name: JOB_A_DIMENSIONS[1].name, weight: 0.25, status: "evaluated", score: 65, confidence: 0.55, reason: "4 years in a backend-adjacent engineering role.", supporting: ["ev-casey-1"], counter: [] },
      { id: "dim-own", name: JOB_A_DIMENSIONS[2].name, weight: 0.2, status: "evaluated", score: 60, confidence: 0.4, reason: "Some project involvement described, but independent ownership of a delivery is unclear from available material.", supporting: ["ev-casey-2"], counter: [] },
      { id: "dim-comm", name: JOB_A_DIMENSIONS[3].name, weight: 0.15, status: "evaluated", score: 85, confidence: 0.8, reason: "Reference notes describe consistently clear, well-structured technical presentations to stakeholders.", supporting: ["ev-casey-3"], counter: [] },
      { id: "dim-comp", name: JOB_A_DIMENSIONS[4].name, weight: 0.1, status: "unknown", score: null, confidence: null, reason: "Compensation expectation was not provided.", supporting: [], counter: [] },
    ],
    [
      { requirementId: "req-auth", status: "met", reason: "Resume confirms US citizenship.", evidence: ["ev-casey-1"] },
      { requirementId: "req-exp", status: "unknown", reason: "Total years of backend-specific experience is not clearly stated in available material.", evidence: [] },
    ],
    { confidence: 0.5, completedAt: daysAgo(3) },
  ),

  "app-riley-a": makeEval(
    "eval-riley-a",
    "app-riley-a",
    [
      { id: "dim-tech", name: JOB_A_DIMENSIONS[0].name, weight: 0.3, status: "evaluated", score: 70, confidence: 0.65, reason: "Owns a moderately complex service with a strong reliability track record.", supporting: ["ev-riley-1"], counter: [] },
      { id: "dim-exp", name: JOB_A_DIMENSIONS[1].name, weight: 0.25, status: "evaluated", score: 68, confidence: 0.7, reason: "5 years in a single, closely-matched backend role.", supporting: ["ev-riley-1"], counter: [] },
      { id: "dim-own", name: JOB_A_DIMENSIONS[2].name, weight: 0.2, status: "evaluated", score: 66, confidence: 0.6, reason: "Owns a production service, though scope is narrower than other candidates in this pool.", supporting: ["ev-riley-1"], counter: [] },
      { id: "dim-comm", name: JOB_A_DIMENSIONS[3].name, weight: 0.15, status: "evaluated", score: 74, confidence: 0.6, reason: "Application materials are clear and well organized.", supporting: [], counter: [] },
      { id: "dim-comp", name: JOB_A_DIMENSIONS[4].name, weight: 0.1, status: "evaluated", score: 80, confidence: 0.7, reason: "Compensation expectation and location both align with the posted range.", supporting: [], counter: [] },
    ],
    [
      { requirementId: "req-auth", status: "met", reason: "Resume confirms US citizenship.", evidence: [] },
      { requirementId: "req-exp", status: "met", reason: "5 years of backend engineering experience.", evidence: [] },
    ],
    { confidence: 0.65, completedAt: daysAgo(1) },
  ),

  "app-morganb-a": makeEval(
    "eval-morganb-a",
    "app-morganb-a",
    [
      { id: "dim-tech", name: JOB_A_DIMENSIONS[0].name, weight: 0.3, status: "evaluated", score: 40, confidence: 0.5, reason: "Limited evidence of distributed-systems depth.", supporting: ["ev-morganb-1"], counter: [] },
      { id: "dim-exp", name: JOB_A_DIMENSIONS[1].name, weight: 0.25, status: "evaluated", score: 45, confidence: 0.55, reason: "3 years, primarily internal tooling.", supporting: ["ev-morganb-1"], counter: [] },
      { id: "dim-own", name: JOB_A_DIMENSIONS[2].name, weight: 0.2, status: "evaluated", score: 50, confidence: 0.5, reason: "Maintenance-oriented ownership; limited 0→1 evidence.", supporting: [], counter: [] },
      { id: "dim-comm", name: JOB_A_DIMENSIONS[3].name, weight: 0.15, status: "evaluated", score: 60, confidence: 0.5, reason: "Adequate written communication in materials.", supporting: [], counter: [] },
      { id: "dim-comp", name: JOB_A_DIMENSIONS[4].name, weight: 0.1, status: "evaluated", score: 35, confidence: 0.6, reason: "Requires employer-sponsored visa transfer; role is not budgeted to sponsor.", supporting: ["ev-morganb-2"], counter: [] },
    ],
    [
      { requirementId: "req-auth", status: "not_met", reason: "Candidate requires H-1B sponsorship; this requisition is not approved to sponsor.", evidence: ["ev-morganb-2"] },
      { requirementId: "req-exp", status: "met", reason: "3 years of backend-adjacent engineering experience.", evidence: ["ev-morganb-1"] },
    ],
    { confidence: 0.6, completedAt: daysAgo(9) },
  ),
};
