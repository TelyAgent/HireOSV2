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
