import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { MailAccountsService } from '../mail-accounts/mail-accounts.service';
import { AiEvaluatorService } from '../ai/ai-evaluator.service';
import { CaseLifecycleService } from '../cases/case-lifecycle.service';
import type { CreateInvitationDto, QuestionSnapshotDto } from './create-invitation.dto';
import type { SubmitAnswersDto } from './submit-answers.dto';
import type { FinalizeEvaluationDto, ReleaseResultDto } from './case-result.dto';
import { invitationEmail, invitationLetter } from './invitation-letter';
import { assertCaseOpen, assertDraftSendable, nextRoundNumber } from './rounds';

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly mailAccounts: MailAccountsService,
    private readonly config: ConfigService,
    private readonly evaluator: AiEvaluatorService,
    private readonly lifecycle: CaseLifecycleService,
  ) {}

  async create(identity: Identity, caseId: string, dto: CreateInvitationDto) {
    const kase = await this.db.case.findFirst({ where: { id: caseId, workspaceId: identity.workspaceId }, include: { candidate: true, job: true } });
    if (!kase) throw new NotFoundException({ code: 'CASE_NOT_FOUND' });
    assertCaseOpen(kase.status);

    // #48: this send turns the case's draft round into round N -- its questions are frozen with it.
    // A concurrent second send computes the same round number and hits the (caseId, round) unique
    // index; that is reported as a 409, not a 500.
    const invitation = await this.db.$transaction(async (tx) => {
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
        },
      });
      await tx.planItem.updateMany({ where: { id: { in: draftItems.map((i) => i.id) } }, data: { invitationId: created.id } });
      await tx.case.update({ where: { id: caseId }, data: { draftRoundOpen: false } });
      return created;
    }).catch((error: unknown) => {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException({ code: 'ROUND_ALREADY_SENT', message: 'This round was just sent. Refresh to see it.' });
      }
      throw error;
    });
    // A supplemental round re-enters the normal flow: sent -> awaiting submission -> review (AC-7).
    await this.lifecycle.advance(caseId, 'invited');

    const appBaseUrl = this.config.get<string>('PUBLIC_APP_BASE_URL', 'http://127.0.0.1:5178/written/').replace(/\/$/, '');
    const link = `${appBaseUrl}/apply/${invitation.token}`;
    const sender = await this.mailAccounts.senderAccount(identity.workspaceId);
    const { subject, text, html } = invitationEmail(
      { candidateName: kase.candidate.name, jobTitle: kase.job.title, senderName: sender?.name ?? null, mode: invitation.mode, durationMin: invitation.durationMin, deadline: invitation.deadline },
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
    if (submission.finalizedAt) throw new ConflictException({ code: 'ALREADY_FINALIZED' });
    const updated = await this.db.submission.update({
      where: { id: submission.id },
      data: {
        finalEvaluation: { overall: dto.overall, criteria: dto.criteria } as unknown as object,
        finalizedBy: dto.finalizedBy,
        finalizedAt: new Date(),
      },
    });
    if (isLatestRound) await this.lifecycle.advance(caseId, 'finalized');
    return { finalizedAt: updated.finalizedAt!.toISOString() };
  }

  async releaseResult(identity: Identity, caseId: string, dto: ReleaseResultDto) {
    const { submission, isLatestRound } = await this.roundSubmission(identity, caseId, dto.invitationId);
    if (!submission.finalizedAt) throw new ConflictException({ code: 'NOT_FINALIZED' });
    if (submission.releasedAt) throw new ConflictException({ code: 'ALREADY_RELEASED' });
    const updated = await this.db.submission.update({
      where: { id: submission.id },
      data: { release: { overall: dto.overall, showScore: dto.showScore, outcomeText: dto.outcomeText, feedbackText: dto.feedbackText, nextStepText: dto.nextStepText } as unknown as object, releasedAt: new Date() },
    });
    if (isLatestRound) await this.lifecycle.advance(caseId, 'released');
    return { releasedAt: updated.releasedAt!.toISOString() };
  }

  async getPublic(token: string) {
    const invitation = await this.db.invitation.findUnique({
      where: { token },
      include: { submission: true, case: { include: { candidate: true, job: true } } },
    });
    if (!invitation) throw new NotFoundException({ code: 'INVITATION_NOT_FOUND' });

    if (invitation.status === 'sent') {
      await this.db.invitation.update({ where: { id: invitation.id }, data: { status: 'opened', openedAt: new Date() } });
      await this.lifecycle.advance(invitation.caseId, 'awaiting_submission');
    }

    const sender = await this.mailAccounts.senderAccount(invitation.workspaceId);
    return {
      candidateName: invitation.case.candidate.name,
      jobTitle: invitation.case.job.title,
      // Same greeting, introduction and HR sign-off as the invitation email.
      letter: invitationLetter({
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
      status: invitation.status === 'sent' ? 'opened' : invitation.status,
      submission: invitation.submission
        ? { answers: invitation.submission.answers, submittedAt: invitation.submission.submittedAt.toISOString() }
        : null,
    };
  }

  async submit(token: string, dto: SubmitAnswersDto) {
    const invitation = await this.db.invitation.findUnique({ where: { token }, include: { submission: true } });
    if (!invitation) throw new NotFoundException({ code: 'INVITATION_NOT_FOUND' });
    if (invitation.submission) throw new ConflictException({ code: 'ALREADY_SUBMITTED' });

    const [submission] = await this.db.$transaction([
      this.db.submission.create({
        data: { invitationId: invitation.id, answers: dto.answers as unknown as object },
      }),
      this.db.invitation.update({ where: { id: invitation.id }, data: { status: 'submitted' } }),
    ]);
    await this.lifecycle.advance(invitation.caseId, 'review_pending');

    // Best-effort, right after the candidate's real answer lands -- never blocks the submission
    // itself (a candidate's reply must be accepted regardless of whether the AI is configured or
    // available). Failures are logged and simply leave `evaluation` null for a human to score by
    // hand later, same fallback shape the AI question generator already uses elsewhere.
    try {
      const questions = invitation.questions as unknown as QuestionSnapshotDto[];
      const result = await this.evaluator.evaluate({ questions, answers: dto.answers });
      await this.db.submission.update({ where: { id: submission.id }, data: { evaluation: result as unknown as object } });
    } catch (error) {
      this.logger.warn(`Auto-evaluation failed for invitation ${invitation.id}: ${error instanceof Error ? error.message : error}`);
    }

    return { status: 'submitted' };
  }
}
