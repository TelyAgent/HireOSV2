import { BadRequestException, ConflictException } from '@nestjs/common';
import { TERMINAL_STATUSES } from '../cases/case-lifecycle.service';

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
