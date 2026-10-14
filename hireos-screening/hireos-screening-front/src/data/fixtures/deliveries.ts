export type DeliveryKind = "review_only" | "create_assessment" | "create_interview";
export type DeliveryStatus = "prepared" | "queued" | "submitted" | "delivered" | "awaiting_confirmation" | "failed" | "received";

export type DeliveryHistoryKey = "package_ready" | "queued" | "submitted" | "delivered_awaiting_confirmation" | "received" | "received_imported";
export interface DeliveryHistoryEntry {
  at: string;
  /** Enum step the UI localizes (#26); null for entries the server couldn't classify. */
  key?: DeliveryHistoryKey | null;
  /** English text, kept for older entries. */
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
