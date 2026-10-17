/**
 * A recorded decision's process state, shown apart from its outcome (#214): the backend's `approved` only means
 * "in effect", so it never reads as an approval of the candidate. English keys, translated by the caller.
 */
export type DecisionStateInput = {
  status: string;
  nextStepTarget?: "record_only" | "send_assessment" | "move_to_interview";
  handoffStatus?: "none" | "queued" | "sent" | "failed";
};

export function decisionStateLabel(decision: DecisionStateInput): string {
  if (decision.status === "withdrawn") return "Withdrawn";
  if (decision.status === "pending_approval") return "Awaiting exception approval";
  if (decision.status === "superseded" || decision.status === "revoked") return "No longer in effect";
  const target = decision.nextStepTarget === "send_assessment" ? "Written Test" : "Interview";
  switch (decision.handoffStatus) {
    case "sent":
      return target === "Interview" ? "Handed off to Interview" : "Handed off to Written Test";
    case "queued":
      return target === "Interview" ? "Handoff to Interview queued" : "Handoff to Written Test queued";
    case "failed":
      return "Handoff failed — retrying stopped";
    default:
      return "Decision recorded";
  }
}
