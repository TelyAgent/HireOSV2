export type ConcernSeverity = "low" | "medium" | "high" | "blocker";
export type ConcernStatus = "open" | "dismissed" | "confirmed" | "accepted_risk";
export type ConcernBasis = "missing_information" | "hypothesis" | "observed_mismatch";

export interface Concern {
  id: string;
  type: string;
  title: string;
  severity: ConcernSeverity;
  confidence: number | null;
  basis: ConcernBasis;
  status: ConcernStatus;
  requirementIds: string[];
  verificationItemIds: string[];
  restricted?: boolean;
  resolution?: string;
}

/** Keyed by applicationId. */
export const CONCERNS: Record<string, Concern[]> = {
  "app-alex-a": [
    { id: "con-alex-1", type: "compensation", title: "Compensation expectation not provided", severity: "medium", confidence: null, basis: "missing_information", status: "open", requirementIds: ["req-loc"], verificationItemIds: ["vi-alex-1"] },
  ],
  "app-jordan-a": [
    { id: "con-jordan-1", type: "skill_gap", title: "Technical depth claims not independently verified", severity: "low", confidence: 0.5, basis: "hypothesis", status: "open", requirementIds: ["req-dist"], verificationItemIds: ["vi-jordan-1"] },
  ],
  "app-casey-a": [
    { id: "con-casey-1", type: "experience_gap", title: "Hands-on ownership evidence is insufficient to score this dimension", severity: "medium", confidence: null, basis: "missing_information", status: "open", requirementIds: ["req-own"], verificationItemIds: ["vi-casey-1"] },
    { id: "con-casey-2", type: "missing_information", title: "Total years of backend-specific experience unclear", severity: "medium", confidence: null, basis: "missing_information", status: "open", requirementIds: ["req-exp"], verificationItemIds: ["vi-casey-2"] },
  ],
  "app-riley-a": [],
  "app-morganb-a": [
    { id: "con-morganb-1", type: "authorization", title: "Requires employer-sponsored visa transfer; role is not approved to sponsor", severity: "blocker", confidence: 0.9, basis: "observed_mismatch", status: "confirmed", restricted: true, requirementIds: ["req-auth"], verificationItemIds: [] },
  ],
};
