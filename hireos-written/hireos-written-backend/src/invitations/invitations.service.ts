import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import type { CreateInvitationDto } from './create-invitation.dto';
import type { SubmitAnswersDto } from './submit-answers.dto';

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class InvitationsService {
  constructor(private readonly db: PrismaService) {}

  async create(identity: Identity, caseId: string, dto: CreateInvitationDto) {
    const kase = await this.db.case.findFirst({ where: { id: caseId, workspaceId: identity.workspaceId } });
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
    return { id: invitation.id, token: invitation.token };
  }

  async listForCase(identity: Identity, caseId: string) {
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
