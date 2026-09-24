import type { PersonId } from "./people";

export type DecisionOutcome = "strong_advance" | "advance" | "hold" | "do_not_advance" | "request_information";
export type DecisionStatus = "pending_approval" | "approved" | "superseded" | "revoked";

export interface Decision {
  id: string;
  applicationId: string;
  outcome: DecisionOutcome;
  reason: string;
  decidedBy: PersonId;
  decidedAt: string;
  status: DecisionStatus;
  overrideAi: boolean;
  exceptionRef?: string;
}
