import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { MailAccountsService } from '../mail-accounts/mail-accounts.service';
import { AiEvaluatorService } from '../ai/ai-evaluator.service';
import type { CreateInvitationDto, QuestionSnapshotDto } from './create-invitation.dto';
import type { SubmitAnswersDto } from './submit-answers.dto';
import type { FinalizeEvaluationDto, ReleaseResultDto } from './case-result.dto';

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
  ) {}

  async create(identity: Identity, caseId: string, dto: CreateInvitationDto) {
    const kase = await this.db.case.findFirst({ where: { id: caseId, workspaceId: identity.workspaceId }, include: { candidate: true, job: true } });
    if (!kase) throw new NotFoundException({ code: 'CASE_NOT_FOUND' });

    const invitation = await this.db.invitation.create({
      data: {
        workspaceId: identity.workspaceId,
        caseId,
        token: generateToken(),
        questions: dto.questions as unknown as object,
        mode: dto.mode,
        durationMin: dto.mode === 'timed' ? dto.durationMin : undefined,
        deadline: new Date(dto.deadline),
        disclosurePolicy: dto.disclosurePolicy,
      },
    });

    const appBaseUrl = this.config.get<string>('PUBLIC_APP_BASE_URL', 'http://127.0.0.1:5178/written/').replace(/\/$/, '');
    const link = `${appBaseUrl}/apply/${invitation.token}`;
    const subject = `${kase.job.title} · 测评邀请`;
    const text = `${kase.candidate.name}，您好：\n\n您已被邀请完成「${kase.job.title}」岗位的测评，请点击以下链接查看题目并提交作答：\n${link}\n\n此邮件由系统自动发送。`;
    const html = `<p>${kase.candidate.name}，您好：</p><p>您已被邀请完成「${kase.job.title}」岗位的测评，请点击以下链接查看题目并提交作答：</p><p><a href="${link}">${link}</a></p><p style="color:#888">此邮件由系统自动发送。</p>`;
    const result = await this.mailAccounts.sendFromWorkspaceAccount(identity, { to: dto.recipientEmail, subject, text, html });

    return { id: invitation.id, token: invitation.token, emailSent: result.sent, emailError: result.error };
  }

  async listForCase(identity: Identity, caseId: string) {
    const kase = await this.db.case.findFirst({ where: { id: caseId, workspaceId: identity.workspaceId } });
    if (!kase) throw new NotFoundException({ code: 'CASE_NOT_FOUND' });

    const invitations = await this.db.invitation.findMany({
      where: { caseId, workspaceId: identity.workspaceId },
      include: { submission: true },
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((inv) => ({
      id: inv.id,
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

  /** The submission a case's review acts on: the one on its latest submitted invitation. */
  private async latestSubmission(identity: Identity, caseId: string) {
    const invitation = await this.db.invitation.findFirst({
      where: { caseId, workspaceId: identity.workspaceId, submission: { isNot: null } },
      include: { submission: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!invitation?.submission) throw new NotFoundException({ code: 'SUBMISSION_NOT_FOUND' });
    return invitation.submission;
  }

  async finalizeEvaluation(identity: Identity, caseId: string, dto: FinalizeEvaluationDto) {
    const submission = await this.latestSubmission(identity, caseId);
    if (submission.finalizedAt) throw new ConflictException({ code: 'ALREADY_FINALIZED' });
    const updated = await this.db.submission.update({
      where: { id: submission.id },
      data: {
        finalEvaluation: { overall: dto.overall, criteria: dto.criteria } as unknown as object,
        finalizedBy: dto.finalizedBy,
        finalizedAt: new Date(),
      },
    });
    return { finalizedAt: updated.finalizedAt!.toISOString() };
  }

  async releaseResult(identity: Identity, caseId: string, dto: ReleaseResultDto) {
    const submission = await this.latestSubmission(identity, caseId);
    if (!submission.finalizedAt) throw new ConflictException({ code: 'NOT_FINALIZED' });
    if (submission.releasedAt) throw new ConflictException({ code: 'ALREADY_RELEASED' });
    const updated = await this.db.submission.update({
      where: { id: submission.id },
      data: { release: { ...dto } as unknown as object, releasedAt: new Date() },
    });
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
    }

    return {
      candidateName: invitation.case.candidate.name,
      jobTitle: invitation.case.job.title,
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
