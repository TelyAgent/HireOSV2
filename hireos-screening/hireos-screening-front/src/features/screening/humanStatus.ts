/**
 * The person's side of a screening, kept apart from the AI's (#187 #196). Until someone records a decision the
 * human status is "Awaiting next step" (F07 PRD FR-4 / AC-4, Owner decision 2026-10-16) — whatever the AI
 * screening is doing; the AI recommendation is advice and is shown as such. When the two point in different
 * directions, the page says so and that the person's decision is the one in effect.
 */
export type DecisionLike = { outcome: string; decidedBy?: string; decidedAt?: string; withdrawnAt?: string };

export const DECISION_LABEL: Record<string, string> = {
  strong_advance: "Strong advance",
  advance: "Advance",
  hold: "Hold",
  do_not_advance: "Do not advance",
  request_information: "Request information",
};

export const AWAITING_NEXT_STEP = "Awaiting next step";
export const AWAITING_NEXT_STEP_DETAIL = "Linked — a person still has to decide the next step.";

/** A withdrawn decision no longer counts; the candidate is waiting for one again. */
export function effectiveDecision<T extends DecisionLike>(decision: T | null | undefined): T | null {
  return decision && !decision.withdrawnAt ? decision : null;
}

export function humanStatus(decision: DecisionLike | null | undefined): { decided: boolean; label: string; detail: string } {
  const current = effectiveDecision(decision);
  if (!current) return { decided: false, label: AWAITING_NEXT_STEP, detail: AWAITING_NEXT_STEP_DETAIL };
  return { decided: true, label: DECISION_LABEL[current.outcome] ?? current.outcome, detail: "Decided by a person — this is the decision in effect." };
}

const DIRECTION: Record<string, number> = {
  strong_advance: 1,
  advance: 1,
  review: 0,
  hold: 0,
  request_information: 0,
  do_not_advance: -1,
};

/** Whether the AI recommendation and the person's decision point in different directions. */
export function decisionDiffersFromAi(aiOutcome: string | null | undefined, decision: DecisionLike | null | undefined): boolean {
  const current = effectiveDecision(decision);
  if (!aiOutcome || !current) return false;
  const [a, h] = [DIRECTION[aiOutcome], DIRECTION[current.outcome]];
  return a !== undefined && h !== undefined && a !== h;
}
