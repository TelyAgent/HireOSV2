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

export const VERIFICATION_ITEMS: Record<string, VerificationItem> = {
  "vi-alex-1": { id: "vi-alex-1", applicationId: "app-alex-a", question: "What is your compensation expectation (base salary, currency, period)?", method: "candidate_question", targetStage: "screening", priority: "medium", status: "open", acceptance: "A stated range or figure with currency and period." },
  "vi-jordan-1": { id: "vi-jordan-1", applicationId: "app-jordan-a", question: "Can you walk through a specific distributed-systems design decision you made and the tradeoffs involved?", method: "assessment", targetStage: "assessment", priority: "medium", status: "open", acceptance: "A specific, verifiable technical design example." },
  "vi-casey-1": { id: "vi-casey-1", applicationId: "app-casey-a", question: "Please describe a project you owned independently from design through delivery.", method: "interview", targetStage: "interview", priority: "high", status: "open", acceptance: "A concrete example of independent end-to-end ownership." },
  "vi-casey-2": { id: "vi-casey-2", applicationId: "app-casey-a", question: "Please confirm total years of backend-focused engineering experience.", method: "candidate_question", targetStage: "screening", priority: "high", status: "open", acceptance: "A clear stated number of years with role breakdown." },
};
