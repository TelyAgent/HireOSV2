import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { MailAccountsService } from '../mail-accounts/mail-accounts.service';
import type { CreateInvitationDto } from './create-invitation.dto';
import type { SubmitAnswersDto } from './submit-answers.dto';

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly mailAccounts: MailAccountsService,
    private readonly config: ConfigService,
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
        ? { answers: inv.submission.answers, submittedAt: inv.submission.submittedAt.toISOString() }
        : null,
    }));
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

    await this.db.$transaction([
      this.db.submission.create({
        data: { invitationId: invitation.id, answers: dto.answers as unknown as object },
      }),
      this.db.invitation.update({ where: { id: invitation.id }, data: { status: 'submitted' } }),
    ]);
    return { status: 'submitted' };
  }
}
