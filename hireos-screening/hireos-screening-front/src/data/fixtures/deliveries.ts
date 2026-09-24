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
}
