import { applyServerState } from "../db";
import type { Decision, DecisionOutcome } from "../fixtures/decisions";
import type { PersonId } from "../fixtures/people";
import { apiFetch } from "./shared";

export type NextStepTarget = "record_only" | "send_assessment" | "move_to_interview";

export interface RecordDecisionInput {
  outcome: DecisionOutcome;
  reason: string;
  decidedBy: PersonId;
  nextStepTarget: NextStepTarget;
  overrideAi?: boolean;
  exceptionApproved?: boolean;
  expectedEvaluationId: string;
  expectedEvaluationVersion: number;
  expectedDecisionId: string | null;
}

/** The shared decision-recording core — used both by the single-application
 * Decision page and by Compare's bulk "submit next steps." Each candidate is
 * still handled independently: a failure for one never affects the others. */
export async function recordDecision(applicationId: string, input: RecordDecisionInput): Promise<{ decision: Decision; replayed?: boolean }> {
  const result = await apiFetch<{ decision: Decision; replayed?: boolean }>(`/applications/${applicationId}/decisions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  applyServerState({ applicationId, decision: result.decision, screeningStatus: "decided" });
  return result;
}

/**
 * Withdraws the active decision (issue #23). Refused with HANDOFF_ALREADY_SENT once the handoff has
 * reached Interview / Written; otherwise the application goes back to awaiting a decision.
 */
export async function withdrawDecision(applicationId: string, decisionId: string, reason: string): Promise<Decision> {
  const result = await apiFetch<{ decision: Decision }>(`/applications/${applicationId}/decisions/${decisionId}/withdraw`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  applyServerState({ applicationId, decision: null, screeningStatus: "review_pending" });
  return result.decision;
}

export async function sendDeclineNotice(applicationId: string): Promise<void> {
  await apiFetch(`/applications/${applicationId}/decline-notice`, { method: "POST" });
}
