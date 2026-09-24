export type VerificationMethod = "candidate_question" | "assessment" | "interview";
export type VerificationTargetStage = "screening" | "assessment" | "interview";
export type VerificationStatus = "open" | "assigned" | "in_progress" | "resolved" | "inconclusive" | "cancelled";

export interface VerificationItem {
  id: string;
  applicationId: string;
  question: string;
  method: VerificationMethod;
  targetStage: VerificationTargetStage;
  priority: "high" | "medium" | "low";
  status: VerificationStatus;
  acceptance: string;
  owner?: string;
  outcome?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}
