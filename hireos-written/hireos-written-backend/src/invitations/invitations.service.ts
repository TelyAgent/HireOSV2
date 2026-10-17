import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { MailAccountsService } from '../mail-accounts/mail-accounts.service';
import { AiEvaluatorService, buildRubric } from '../ai/ai-evaluator.service';
import { CaseLifecycleService } from '../cases/case-lifecycle.service';
import type { CreateInvitationDto, QuestionSnapshotDto } from './create-invitation.dto';
import type { SubmitAnswersDto } from './submit-answers.dto';
import type { FinalizeEvaluationDto, ReleaseResultDto } from './case-result.dto';
import { invitationEmail, invitationLetter } from './invitation-letter';
import { assertValidFinalScores } from './scores';
import { assertAnswersMatchQuestions, assertBeforeDeadline, assertCaseOpen, assertDraftSendable, effectiveDeadline, nextRoundNumber } from './rounds';

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Automatic scoring is tried this many times before it is left for a reviewer to score by hand (#121). */
const EVALUATION_MAX_ATTEMPTS = 3;
/** A scoring run this old is presumed lost (the process stopped) and is picked up again. */
const EVALUATION_STALE_MS = 10 * 60_000;
const EVALUATION_POLL_MS = 30_000;

@Injectable()
export class InvitationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvitationsService.name);
  private evaluationTimer?: ReturnType<typeof globalThis.setInterval>;

  constructor(
    private readonly db: PrismaService,
    private readonly mailAccounts: MailAccountsService,
    private readonly config: ConfigService,
    private readonly evaluator: AiEvaluatorService,
    private readonly lifecycle: CaseLifecycleService,
  ) {}

  // Picks up scoring that didn't finish — the process stopped mid-run, or a retry is due (#121).
  onModuleInit() {
    this.evaluationTimer = globalThis.setInterval(() => void this.resumeEvaluations().catch((error) => {
      this.logger.error(`Resuming automatic scoring failed: ${error instanceof Error ? error.message : String(error)}`);
    }), EVALUATION_POLL_MS);
    this.evaluationTimer.unref();
  }

  onModuleDestroy() {
    if (this.evaluationTimer) globalThis.clearInterval(this.evaluationTimer);
  }

  async create(identity: Identity, caseId: string, dto: CreateInvitationDto) {
    const kase = await this.db.case.findFirst({ where: { id: caseId, workspaceId: identity.workspaceId }, include: { candidate: true, job: true } });
    if (!kase) throw new NotFoundException({ code: 'CASE_NOT_FOUND' });
    assertCaseOpen(kase.status);

    // #48: this send turns the case's draft round into round N -- its questions are frozen with it.
    // A concurrent second send computes the same round number and hits the (caseId, round) unique
    // index; that is reported as a 409, not a 500.
    const invitation = await this.db.$transaction(async (tx) => {
      // The case can't be closed while its round is being sent, and a closed case sends nothing (#118 #130).
      const locked = await this.lifecycle.lockCase(tx, caseId);
      assertCaseOpen(locked?.status ?? 'closed');
      const sent = await tx.invitation.findMany({ where: { caseId, workspaceId: identity.workspaceId }, select: { round: true } });
      const draftItems = await tx.planItem.findMany({ where: { caseId, workspaceId: identity.workspaceId, invitationId: null }, select: { id: true } });
      assertDraftSendable({ roundsSent: sent.length, draftRoundOpen: kase.draftRoundOpen, draftItems: draftItems.length });
      const created = await tx.invitation.create({
        data: {
          workspaceId: identity.workspaceId,
          caseId,
          round: nextRoundNumber(sent.map((s) => s.round)),
          token: generateToken(),
          questions: dto.questions as unknown as object,
          mode: dto.mode,
          durationMin: dto.mode === 'timed' ? dto.durationMin : undefined,
          deadline: new Date(dto.deadline),
          disclosurePolicy: dto.disclosurePolicy,
          locale: dto.locale ?? 'zh',
        },
      });
      await tx.planItem.updateMany({ where: { id: { in: draftItems.map((i) => i.id) } }, data: { invitationId: created.id } });
      await tx.case.update({ where: { id: caseId }, data: { draftRoundOpen: false } });
      // A supplemental round re-enters the normal flow: sent -> awaiting submission -> review (AC-7). Same
      // transaction as the round itself, so a failure leaves neither (#118).
      await this.lifecycle.advance(caseId, 'invited', tx);
      return created;
    }).catch((error: unknown) => {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException({ code: 'ROUND_ALREADY_SENT', message: 'This round was just sent. Refresh to see it.' });
      }
      throw error;
    });

    const appBaseUrl = this.config.get<string>('PUBLIC_APP_BASE_URL', 'http://127.0.0.1:5178/written/').replace(/\/$/, '');
    const link = `${appBaseUrl}/apply/${invitation.token}`;
    const sender = await this.mailAccounts.senderAccount(identity.workspaceId);
    const { subject, text, html } = invitationEmail(
      { locale: invitation.locale === 'en' ? 'en' : 'zh', candidateName: kase.candidate.name, jobTitle: kase.job.title, senderName: sender?.name ?? null, mode: invitation.mode, durationMin: invitation.durationMin, deadline: invitation.deadline },
      link,
    );
    const result = await this.mailAccounts.sendFromWorkspaceAccount(identity, { to: dto.recipientEmail, subject, text, html });

    return { id: invitation.id, round: invitation.round, token: invitation.token, emailSent: result.sent, emailError: result.error };
  }

  async listForCase(identity: Identity, caseId: string) {
    const kase = await this.db.case.findFirst({ where: { id: caseId, workspaceId: identity.workspaceId } });
    if (!kase) throw new NotFoundException({ code: 'CASE_NOT_FOUND' });

    const invitations = await this.db.invitation.findMany({
      where: { caseId, workspaceId: identity.workspaceId },
      include: { submission: true },
      orderBy: { round: 'asc' },
    });
    // Oldest round first (#48: rounds are listed in send order).
    return invitations.map((inv) => ({
      id: inv.id,
      round: inv.round,
      token: inv.token,
      questions: inv.questions,
      mode: inv.mode,
      durationMin: inv.durationMin,
      deadline: inv.deadline?.toISOString() ?? null,
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
      submission: inv.submission
        ? {
            answers: inv.submission.answers,
            submittedAt: inv.submission.submittedAt.toISOString(),
            evaluation: inv.submission.evaluation,
            // Automatic scoring runs after the submission (#121): pending | running | done | failed | skipped.
            evaluationStatus: inv.submission.evaluationStatus,
            evaluationError: inv.submission.evaluationError,
            // The dimensions to score by hand when there is no automatic scoring.
            rubric: buildRubric(inv.questions as unknown as QuestionSnapshotDto[]),
            finalEvaluation: inv.submission.finalEvaluation,
            finalizedBy: inv.submission.finalizedBy,
            finalizedAt: inv.submission.finalizedAt?.toISOString() ?? null,
            release: inv.submission.release,
            releasedAt: inv.submission.releasedAt?.toISOString() ?? null,
          }
        : null,
    }));
  }

  /**
   * The submission a review acts on: the given round's (#48 -- every round is finalized and released
   * on its own), or the latest submitted one when no round is named. `isLatestRound` tells whether
   * acting on it should move the case status: an older round never drags a newer one's status back.
   */
  private async roundSubmission(identity: Identity, caseId: string, invitationId?: string) {
    const invitation = await this.db.invitation.findFirst({
      where: { caseId, workspaceId: identity.workspaceId, submission: { isNot: null }, ...(invitationId ? { id: invitationId } : {}) },
      include: { submission: true },
      orderBy: { round: 'desc' },
    });
    if (!invitation?.submission) throw new NotFoundException({ code: 'SUBMISSION_NOT_FOUND' });
    const latest = await this.db.invitation.findFirst({ where: { caseId, workspaceId: identity.workspaceId }, orderBy: { round: 'desc' }, select: { id: true } });
    return { submission: invitation.submission, isLatestRound: latest?.id === invitation.id };
  }

  async finalizeEvaluation(identity: Identity, caseId: string, dto: FinalizeEvaluationDto) {
    const { submission, isLatestRound } = await this.roundSubmission(identity, caseId, dto.invitationId);
    if (submission.finalizedAt) {
      // A retry after the scoring was saved but the case didn't move: bring the case along, then say so (#118).
      if (isLatestRound) await this.lifecycle.advance(caseId, 'finalized');
      throw new ConflictException({ code: 'ALREADY_FINALIZED' });
    }
    assertValidFinalScores(dto);
    const finalizedAt = new Date();
    // Only the first of two concurrent finalizations is saved (#132), together with the case's move (#118).
    const saved = await this.db.$transaction(async (tx) => {
      // Case row first, the order every transaction here takes its locks in, so none of them deadlock.
      await this.lifecycle.lockCase(tx, caseId);
      const { count } = await tx.submission.updateMany({
        where: { id: submission.id, finalizedAt: null },
        data: {
          finalEvaluation: { overall: dto.overall, criteria: dto.criteria } as unknown as object,
          // The authenticated actor, never the body's finalizedBy (#134).
          finalizedBy: identity.actorId,
          finalizedAt,
        },
      });
      if (count && isLatestRound) await this.lifecycle.advance(caseId, 'finalized', tx);
      return count > 0;
    });
    if (!saved) throw new ConflictException({ code: 'ALREADY_FINALIZED' });
    return { finalizedAt: finalizedAt.toISOString() };
  }

  async releaseResult(identity: Identity, caseId: string, dto: ReleaseResultDto) {
    const { submission, isLatestRound } = await this.roundSubmission(identity, caseId, dto.invitationId);
    if (!submission.finalizedAt) throw new ConflictException({ code: 'NOT_FINALIZED' });
    if (submission.releasedAt) {
      if (isLatestRound) await this.lifecycle.advance(caseId, 'released');
      throw new ConflictException({ code: 'ALREADY_RELEASED' });
    }
    const releasedAt = new Date();
    // Only the first of two concurrent publications is kept (#132), together with the case's move (#118).
    const saved = await this.db.$transaction(async (tx) => {
      // Case row first, the order every transaction here takes its locks in, so none of them deadlock.
      await this.lifecycle.lockCase(tx, caseId);
      const { count } = await tx.submission.updateMany({
        where: { id: submission.id, finalizedAt: { not: null }, releasedAt: null },
        data: { release: { overall: dto.overall, showScore: dto.showScore, outcomeText: dto.outcomeText, feedbackText: dto.feedbackText, nextStepText: dto.nextStepText } as unknown as object, releasedAt },
      });
      if (count && isLatestRound) await this.lifecycle.advance(caseId, 'released', tx);
      return count > 0;
    });
    if (!saved) throw new ConflictException({ code: 'ALREADY_RELEASED' });
    return { releasedAt: releasedAt.toISOString() };
  }

  async getPublic(token: string) {
    const invitation = await this.db.invitation.findUnique({
      where: { token },
      include: { submission: true, case: { include: { candidate: true, job: true } } },
    });
    if (!invitation) throw new NotFoundException({ code: 'INVITATION_NOT_FOUND' });

    // The first open — and only it — starts a timed round's clock and moves the case on (#119 #129). Conditional
    // on still being 'sent', so an open racing the submission can't turn 'submitted' back into 'opened'; the case
    // moves only from 'invited', so a late open never drags it back from review, and an older round's link
    // doesn't move it at all.
    if (invitation.status === 'sent') {
      const openedAt = new Date();
      await this.db.$transaction(async (tx) => {
        // The case row first, as a submission locks it: both take their locks in the same order, so an open racing
        // the submission waits its turn instead of deadlocking with it.
        await this.lifecycle.lockCase(tx, invitation.caseId);
        const { count } = await tx.invitation.updateMany({ where: { id: invitation.id, status: 'sent' }, data: { status: 'opened', openedAt } });
        if (!count) return;
        invitation.openedAt = openedAt;
        if (await this.isLatestRound(tx, invitation.caseId, invitation.round)) await this.lifecycle.advance(invitation.caseId, 'awaiting_submission', tx);
      });
    }
    const dueAt = effectiveDeadline(invitation);

    const sender = await this.mailAccounts.senderAccount(invitation.workspaceId);
    return {
      candidateName: invitation.case.candidate.name,
      jobTitle: invitation.case.job.title,
      // Same greeting, introduction and HR sign-off as the invitation email.
      // The page is written in the invitation's language, like the email (#229).
      locale: invitation.locale === 'en' ? 'en' : 'zh',
      letter: invitationLetter({
        locale: invitation.locale === 'en' ? 'en' : 'zh',
        candidateName: invitation.case.candidate.name,
        jobTitle: invitation.case.job.title,
        senderName: sender?.name ?? null,
        mode: invitation.mode,
        durationMin: invitation.durationMin,
        deadline: invitation.deadline,
      }),
      questions: invitation.questions,
      mode: invitation.mode,
      durationMin: invitation.durationMin,
      deadline: invitation.deadline?.toISOString() ?? null,
      // When answers are due for this candidate: the deadline, or sooner in timed mode (#129).
      openedAt: invitation.openedAt?.toISOString() ?? null,
      dueAt: dueAt?.toISOString() ?? null,
      status: invitation.status === 'sent' ? 'opened' : invitation.status,
      submission: invitation.submission
        ? { answers: invitation.submission.answers, submittedAt: invitation.submission.submittedAt.toISOString() }
        : null,
    };
  }

  async submit(token: string, dto: SubmitAnswersDto) {
    const invitation = await this.db.invitation.findUnique({ where: { token }, include: { submission: true } });
    if (!invitation) throw new NotFoundException({ code: 'INVITATION_NOT_FOUND' });
    if (invitation.submission) {
      // A retry after the answers were saved but the case didn't move: bring the case along, then say so (#118).
      if (await this.isLatestRound(this.db, invitation.caseId, invitation.round)) await this.lifecycle.advance(invitation.caseId, 'review_pending');
      throw new ConflictException({ code: 'ALREADY_SUBMITTED' });
    }
    // Timed mode counts from the first open; the deadline still applies (#129).
    assertBeforeDeadline(effectiveDeadline(invitation));
    const questions = invitation.questions as unknown as QuestionSnapshotDto[];
    assertAnswersMatchQuestions(questions, dto.answers);

    // One transaction for the answers, the invitation and the case (#118), with the case row locked so a close
    // can't slip in between: a case that has ended takes no answers, and nothing of them is kept (#130).
    const submission = await this.db.$transaction(async (tx) => {
      const locked = await this.lifecycle.lockCase(tx, invitation.caseId);
      assertCaseOpen(locked?.status ?? 'closed');
      const created = await tx.submission.create({ data: { invitationId: invitation.id, answers: dto.answers as unknown as object } });
      await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'submitted' } });
      if (await this.isLatestRound(tx, invitation.caseId, invitation.round)) await this.lifecycle.advance(invitation.caseId, 'review_pending', tx);
      return created;
    }).catch((error: unknown) => {
      if ((error as { code?: string })?.code === 'P2002') throw new ConflictException({ code: 'ALREADY_SUBMITTED' });
      throw error;
    });

    // The candidate is answered now; automatic scoring runs afterwards and is tracked on the submission, so a
    // slow or failing AI never delays or fails the submission (#121). A reviewer can score by hand meanwhile.
    void this.evaluate(submission.id);
    return { status: 'submitted' };
  }

  /** Whether `round` is the case's newest round: only that one moves the case (#48 — older rounds never drag it back). */
  private async isLatestRound(db: Pick<PrismaService, 'invitation'>, caseId: string, round: number) {
    const newest = await db.invitation.findFirst({ where: { caseId }, orderBy: { round: 'desc' }, select: { round: true } });
    return !newest || newest.round === round;
  }

  /**
   * One automatic scoring run for a submission (#121): claimed so two runs never overlap, retried a few times, and
   * never written over a reviewer's work — once the round is finalized, the run is skipped.
   */
  async evaluate(submissionId: string): Promise<void> {
    const staleBefore = new Date(Date.now() - EVALUATION_STALE_MS);
    const claimed = await this.db.submission.updateMany({
      where: {
        id: submissionId,
        finalizedAt: null,
        evaluationAttempts: { lt: EVALUATION_MAX_ATTEMPTS },
        OR: [{ evaluationStatus: { in: ['pending', 'failed'] } }, { evaluationStatus: 'running', evaluationStartedAt: { lt: staleBefore } }],
      },
      data: { evaluationStatus: 'running', evaluationStartedAt: new Date(), evaluationAttempts: { increment: 1 } },
    }).catch((error: unknown) => {
      this.logger.error(`Could not start automatic scoring for ${submissionId}: ${error instanceof Error ? error.message : String(error)}`);
      return { count: 0 };
    });
    if (!claimed.count) return;
    try {
      const submission = await this.db.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { invitation: true } });
      const questions = submission.invitation.questions as unknown as QuestionSnapshotDto[];
      const result = await this.evaluator.evaluate({ questions, answers: submission.answers as unknown as SubmitAnswersDto['answers'] });
      const saved = await this.db.submission.updateMany({
        where: { id: submissionId, finalizedAt: null },
        data: { evaluation: result as unknown as object, evaluationStatus: 'done', evaluationError: null },
      });
      if (!saved.count) await this.db.submission.updateMany({ where: { id: submissionId }, data: { evaluationStatus: 'skipped' } });
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      this.logger.warn(`Automatic scoring failed for submission ${submissionId}: ${message}`);
      await this.db.submission.updateMany({ where: { id: submissionId, evaluationStatus: 'running' }, data: { evaluationStatus: 'failed', evaluationError: message } })
        .catch(() => undefined);
    }
  }

  /** Scoring that is due again: failed with tries left, or running long enough to have been lost. */
  async resumeEvaluations(): Promise<void> {
    const staleBefore = new Date(Date.now() - EVALUATION_STALE_MS);
    const due = await this.db.submission.findMany({
      where: {
        finalizedAt: null,
        evaluationAttempts: { lt: EVALUATION_MAX_ATTEMPTS },
        OR: [
          { evaluationStatus: 'pending', submittedAt: { lt: new Date(Date.now() - EVALUATION_POLL_MS) } },
          { evaluationStatus: 'failed' },
          { evaluationStatus: 'running', evaluationStartedAt: { lt: staleBefore } },
        ],
      },
      select: { id: true },
      take: 10,
    });
    for (const { id } of due) await this.evaluate(id);
  }

}
