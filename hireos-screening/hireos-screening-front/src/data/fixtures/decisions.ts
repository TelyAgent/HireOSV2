import type { PersonId } from "./people";

export type DecisionOutcome = "strong_advance" | "advance" | "hold" | "do_not_advance" | "request_information";
export type DecisionStatus = "pending_approval" | "approved" | "superseded" | "revoked" | "withdrawn";

export interface Decision {
  id: string;
  applicationId: string;
  outcome: DecisionOutcome;
  reason: string;
  decidedBy: PersonId;
  decidedAt: string;
  status: DecisionStatus;
  overrideAi: boolean;
  nextStepTarget?: "record_only" | "send_assessment" | "move_to_interview";
  exceptionRef?: string;
  /** Set once the decision was withdrawn (issue #23); a withdrawn decision stays readable as history. */
  withdrawnAt?: string;
  withdrawnBy?: string;
  withdrawReason?: string;
}
