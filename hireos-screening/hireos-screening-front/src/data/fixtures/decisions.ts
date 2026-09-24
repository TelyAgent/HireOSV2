import { daysAgo } from "../../lib/daysAgo";
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

/** Only Morgan Blake is pre-decided, for the Hold/Reject demo. */
export const DECISIONS: Record<string, Decision> = {
  "app-morganb-a": { id: "dec-morganb-1", applicationId: "app-morganb-a", outcome: "do_not_advance", reason: "Work authorization requirement not met; role is not approved to sponsor.", decidedBy: "daniel", decidedAt: daysAgo(8), status: "approved", overrideAi: false },
};
