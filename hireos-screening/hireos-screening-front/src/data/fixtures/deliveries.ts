export type DeliveryKind = "review_only" | "create_assessment" | "create_interview";
export type DeliveryStatus = "prepared" | "queued" | "submitted" | "delivered" | "awaiting_confirmation" | "failed" | "received";

export interface DeliveryHistoryEntry {
  at: string;
  state: string;
}
export interface Delivery {
  id: string;
  applicationId?: string;
  historical?: boolean;
  candidateLabel?: string;
  jobLabel?: string;
  kind: DeliveryKind;
  transport?: string;
  targetLabel: string;
  reviewStatus?: string;
  status: DeliveryStatus;
  createdAt: string;
  history: DeliveryHistoryEntry[];
  /** The package preview's promised contents (#22), returned by the detail endpoint. */
  requestedAction?: DeliveryKind;
  evaluationSnapshot?: DeliveryEvaluationSnapshot | null;
  accessLimitations?: Array<"contact_details_excluded" | "internal_ranking_excluded" | "restricted_evidence_redacted">;
}

/** The evaluation as it was when the package was created — a later re-screen doesn't change it. */
export interface DeliveryEvaluationSnapshot {
  evaluationId: string | null;
  version: number | null;
  overall: number | null;
  coverage: number;
  eligibilityStatus: string | null;
  dimensionScores: Array<{ dimensionId?: string; name: string; score: number | null; status: string }>;
  generatedAt: string | null;
}
