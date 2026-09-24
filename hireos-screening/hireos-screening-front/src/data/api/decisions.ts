import { db, getApplication } from "../db";
import type { Decision, DecisionOutcome } from "../fixtures/decisions";
import type { PersonId } from "../fixtures/people";
import type { Delivery } from "../fixtures/deliveries";
import { apiFetch } from "./shared";

export type NextStepTarget = "record_only" | "send_assessment" | "move_to_interview";

export interface RecordDecisionInput {
  outcome: DecisionOutcome;
  reason: string;
  decidedBy: PersonId;
  nextStepTarget: NextStepTarget;
  overrideAi?: boolean;
  exceptionApproved?: boolean;
}

/** The shared decision-recording core — used both by the single-application
 * Decision page and by Compare's bulk "submit next steps." Each candidate is
 * still handled independently: a failure for one never affects the others. */
export async function recordDecision(applicationId: string, input: RecordDecisionInput): Promise<{ decision: Decision; delivery: Delivery | null }> {
  const result = await apiFetch<{ decision: Decision; delivery: Delivery | null }>(`/applications/${applicationId}/decisions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  db.decisions[applicationId] = result.decision;
  const application = getApplication(applicationId);
  if (application) application.screeningStatus = "decided";
  if (result.delivery) db.deliveries.push(result.delivery);
  return result;
}

export async function generateReviewOnlyReport(applicationId: string): Promise<Delivery> {
  const delivery = await apiFetch<Delivery>(`/applications/${applicationId}/review-report`, { method: "POST" });
  db.deliveries.push(delivery);
  return delivery;
}

export async function sendDeclineNotice(applicationId: string): Promise<void> {
  await apiFetch(`/applications/${applicationId}/decline-notice`, { method: "POST" });
}
