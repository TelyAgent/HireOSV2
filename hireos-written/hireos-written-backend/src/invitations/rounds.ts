import { BadRequestException, ConflictException } from '@nestjs/common';
import { TERMINAL_STATUSES } from '../cases/case-lifecycle.service';
import { invalidSchema } from '../http/invalid-schema';

// Issue #48 -- an assessment is organised in rounds: every invitation (send) is one round, and the
// questions not yet sent form the case's single draft round. These are the rules every write obeys.

/** The draft round exists before anything was sent, after "Add supplemental test", or while it holds questions. */
export function hasDraftRound(state: { roundsSent: number; draftRoundOpen: boolean; draftItems: number }): boolean {
  return state.roundsSent === 0 || state.draftRoundOpen || state.draftItems > 0;
}

/** Round numbers are 1, 2, ... in send order. */
export function nextRoundNumber(existingRounds: number[]): number {
  return existingRounds.length ? Math.max(...existingRounds) + 1 : 1;
}

/** Handed-off / closed cases take no new rounds or questions. */
export function assertCaseOpen(status: string): void {
  if (TERMINAL_STATUSES.includes(status)) throw new ConflictException({ code: 'CASE_ENDED', status });
}

/** A question that was sent is frozen with its round (AC-1). */
export function assertPlanItemEditable(item: { invitationId: string | null }): void {
  if (item.invitationId) throw new ConflictException({ code: 'PLAN_ITEM_LOCKED', message: 'This question was already sent and can no longer be changed.' });
}

/** Sending needs an open draft round with at least one question. */
export function assertDraftSendable(state: { roundsSent: number; draftRoundOpen: boolean; draftItems: number }): void {
  if (!hasDraftRound(state)) throw new ConflictException({ code: 'NO_DRAFT_ROUND', message: 'Open a supplemental round before sending again.' });
  if (state.roundsSent > 0 && state.draftItems === 0) {
    throw new BadRequestException({ code: 'DRAFT_ROUND_EMPTY', message: 'Add at least one question to this round before sending.' });
  }
}

/** Answers may arrive this long after the deadline and still count: covers a submit clicked just before it. */
export const DEADLINE_GRACE_MS = 60_000;

/** A round's answers are accepted only until its deadline (plus a short grace for the request in flight). */
export function assertBeforeDeadline(deadline: Date | null, now: Date = new Date()): void {
  if (deadline && now.getTime() > deadline.getTime() + DEADLINE_GRACE_MS) {
    throw new ConflictException({ code: 'DEADLINE_PASSED', deadline: deadline.toISOString(), message: 'The submission deadline has passed.' });
  }
}

/**
 * When a round's answers are due (#129): the round's deadline, and — in timed mode — the stated duration counted
 * from when the candidate first opened the questions, whichever is earlier. The start is recorded once, the first
 * time the link is opened, so reloading or opening it on another device doesn't restart the clock. Before it is
 * opened (or for an invitation without a duration) only the deadline applies.
 */
export function effectiveDeadline(invitation: { mode: string; durationMin: number | null; deadline: Date | null; openedAt: Date | null }): Date | null {
  const timed = invitation.mode === 'timed' && invitation.durationMin && invitation.openedAt
    ? new Date(invitation.openedAt.getTime() + invitation.durationMin * 60_000)
    : null;
  if (timed && invitation.deadline) return timed.getTime() < invitation.deadline.getTime() ? timed : invitation.deadline;
  return timed ?? invitation.deadline;
}

/**
 * The answers must be the round's questions, each answered once (#136): no question that wasn't asked, none twice,
 * none left out or blank — the same rule the candidate page applies before it lets the form be sent. Refused
 * before anything is stored or scored.
 */
export function assertAnswersMatchQuestions(questions: { questionId: string }[], answers: { questionId: string; answerText: string }[]): void {
  const asked = new Set(questions.map((q) => q.questionId));
  const seen = new Set<string>();
  const fieldErrors: Record<string, string[]> = {};
  answers.forEach((answer, index) => {
    if (!asked.has(answer.questionId)) fieldErrors[`answers.${index}.questionId`] = ['This question is not part of this test.'];
    else if (seen.has(answer.questionId)) fieldErrors[`answers.${index}.questionId`] = ['This question is answered more than once.'];
    else if (!answer.answerText.trim()) fieldErrors[`answers.${index}.answerText`] = ['Answer this question before submitting.'];
    seen.add(answer.questionId);
  });
  const missing = [...asked].filter((id) => !seen.has(id));
  if (missing.length) fieldErrors.answers = [`Every question needs an answer; missing: ${missing.join(', ')}.`];
  if (Object.keys(fieldErrors).length) throw invalidSchema(fieldErrors);
}
