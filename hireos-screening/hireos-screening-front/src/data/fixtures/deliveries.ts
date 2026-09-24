import { daysAgo } from "../../lib/daysAgo";

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

export const DELIVERIES: Delivery[] = [
  {
    id: "deliv-morganb-1",
    applicationId: "app-morganb-a",
    kind: "review_only",
    targetLabel: "Report on file (not routed — review only)",
    reviewStatus: "human_reviewed",
    status: "prepared",
    createdAt: daysAgo(8),
    history: [{ at: daysAgo(8), state: "Package ready" }],
  },
  {
    id: "deliv-hist-1",
    historical: true,
    candidateLabel: "Jamie Osei",
    jobLabel: "Senior Backend Engineer (previous cycle)",
    kind: "create_assessment",
    transport: "email",
    targetLabel: "assessments-intake@partner-vendor.demo",
    status: "delivered",
    createdAt: daysAgo(30),
    history: [
      { at: daysAgo(30), state: "Package ready" },
      { at: daysAgo(30), state: "Queued" },
      { at: daysAgo(29), state: "Submitted" },
      { at: daysAgo(29), state: "Delivered" },
      { at: daysAgo(28), state: "Received / Imported" },
    ],
  },
  {
    id: "deliv-hist-2",
    historical: true,
    candidateLabel: "Drew Sato",
    jobLabel: "Senior Backend Engineer (previous cycle)",
    kind: "create_interview",
    transport: "email",
    targetLabel: "interviews@partner-agency.demo",
    status: "failed",
    createdAt: daysAgo(2),
    history: [
      { at: daysAgo(2), state: "Package ready" },
      { at: daysAgo(2), state: "Queued" },
      { at: daysAgo(2), state: "Submitted" },
      { at: daysAgo(1), state: "Failed — bounced (mailbox not found)" },
    ],
  },
  {
    id: "deliv-hist-3",
    historical: true,
    candidateLabel: "Chris Nakamura",
    jobLabel: "Engineering Lead (previous cycle)",
    kind: "create_assessment",
    transport: "email",
    targetLabel: "assessments-intake@partner-vendor.demo",
    status: "awaiting_confirmation",
    createdAt: daysAgo(4),
    history: [
      { at: daysAgo(4), state: "Package ready" },
      { at: daysAgo(4), state: "Queued" },
      { at: daysAgo(4), state: "Submitted" },
      { at: daysAgo(4), state: "Delivered (no receipt yet — awaiting confirmation)" },
    ],
  },
];
