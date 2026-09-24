import { daysAgo } from "../../lib/daysAgo";

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

export const RECOMMENDATIONS: CandidateJobRecommendation[] = [
  { id: "rec-alex-a", candidateId: "cand-alex", jobId: "job-a", status: "confirmed", createdAt: daysAgo(19), confidence: 0.86, rationale: "Strong technical and experience match on core backend requirements for Job A.", gaps: ["Compensation expectation not yet provided"] },
  { id: "rec-alex-b", candidateId: "cand-alex", jobId: "job-b", status: "proposed", createdAt: daysAgo(2), confidence: 0.71, rationale: "Technical depth is a good fit for Engineering Lead, but no direct people-management evidence found yet.", gaps: ["No people-management experience found in resume"] },
  { id: "rec-jordan-a", candidateId: "cand-jordan", jobId: "job-a", status: "confirmed", createdAt: daysAgo(15), confidence: 0.79, rationale: "Strong 0→1 ownership evidence; technical depth claims not yet independently verified.", gaps: ["Technical claims are self-reported; no assessment yet"] },
  { id: "rec-jordan-b", candidateId: "cand-jordan", jobId: "job-b", status: "proposed", createdAt: daysAgo(1), confidence: 0.58, rationale: "Founding-engineer ownership is relevant, but no formal people-management experience found.", gaps: ["No people-management experience found in resume", "Compensation range is below Job B’s posted range"] },
  { id: "rec-jordan-c", candidateId: "cand-jordan", jobId: "job-c", status: "proposed", createdAt: daysAgo(9), confidence: 0.63, rationale: "Data-adjacent infrastructure experience overlaps with Data Platform Engineer needs.", gaps: ["Limited direct data-pipeline experience"], staleReason: "Job C closed after this proposal was generated." },
  { id: "rec-casey-a", candidateId: "cand-casey", jobId: "job-a", status: "confirmed", createdAt: daysAgo(13), confidence: 0.52, rationale: "Communication evidence is strong; hands-on technical depth could not be confirmed from available material.", gaps: ["Years of backend experience unclear", "Technical depth unconfirmed"] },
  { id: "rec-riley-a", candidateId: "cand-riley", jobId: "job-a", status: "confirmed", createdAt: daysAgo(6), confidence: 0.74, rationale: "Solid, consistent backend experience with a services-ownership track record.", gaps: [] },
  { id: "rec-morganb-a", candidateId: "cand-morganb", jobId: "job-a", status: "confirmed", createdAt: daysAgo(9), confidence: 0.41, rationale: "Some backend overlap, but work-authorization constraint may block eligibility.", gaps: ["Requires employer visa sponsorship; role does not sponsor"] },
  { id: "rec-priya-b", candidateId: "cand-priya", jobId: "job-b", status: "proposed", createdAt: daysAgo(2), confidence: 0.83, rationale: "Direct people-management experience plus relevant backend background is a strong fit for Engineering Lead.", gaps: [] },
  { id: "rec-devonp-d", candidateId: "cand-devonp", jobId: "job-d", status: "proposed", createdAt: daysAgo(2), confidence: 0.81, rationale: "Direct growth PM experience with strong experimentation track record matches the role closely.", gaps: [] },
  { id: "rec-avag-d", candidateId: "cand-avag", jobId: "job-d", status: "proposed", createdAt: daysAgo(3), confidence: 0.68, rationale: "Strong general PM background; growth-specific experimentation experience is lighter than other candidates in this pool.", gaps: ["Limited direct growth/experimentation evidence"] },
  { id: "rec-leom-f", candidateId: "cand-leom", jobId: "job-f", status: "proposed", createdAt: daysAgo(3), confidence: 0.85, rationale: "Enterprise account ownership and renewal track record directly match this role.", gaps: [] },
];
