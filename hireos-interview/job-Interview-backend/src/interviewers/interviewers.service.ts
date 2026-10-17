import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { validate } from '../intake/contracts';
import type { Identity } from '../intake/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class InterviewersService {
  constructor(private readonly db: PrismaService, private readonly config: ConfigService) {}
  private assertAdmin(identity: Identity) {
    if (!identity.roles?.includes('admin')) throw new ForbiddenException({ code: 'ADMIN_REQUIRED' });
  }

  bindings(identity: Identity) {
    this.assertAdmin(identity);
    return this.db.interviewer.findMany({ where: { workspaceId: identity.workspaceId }, orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, title: true, accountBinding: { select: { accountId: true, boundBy: true, boundAt: true } } } });
  }

  async bind(identity: Identity, interviewerId: string, raw: unknown) {
    this.assertAdmin(identity);
    const { accountId } = validate(z.object({ accountId: z.string().trim().min(1).max(200) }), raw);
    const interviewer = await this.db.interviewer.findFirst({ where: { id: interviewerId, workspaceId: identity.workspaceId } });
    if (!interviewer) throw new NotFoundException({ code: 'NOT_FOUND' });
    const previous = await this.db.interviewerAccountBinding.findUnique({ where: { interviewerId } });
    if (previous) {
      if (previous.accountId !== accountId) throw new ConflictException({ code: 'INTERVIEWER_ALREADY_BOUND' });
      return previous;
    }
    const base = this.config.get<string>('IDENTITY_INTERNAL_URL');
    const token = this.config.get<string>('IDENTITY_INTERNAL_TOKEN');
    if (!base || !token) throw new ServiceUnavailableException({ code: 'IDENTITY_UNAVAILABLE' });
    let member: { active?: boolean; workspaceId?: string; userId?: string };
    try {
      const response = await fetch(`${base.replace(/\/+$/, '')}/internal/memberships/verify`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token },
        body: JSON.stringify({ workspaceId: identity.workspaceId, userId: accountId }), signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error('Membership verification failed');
      member = await response.json() as typeof member;
      if (!member || typeof member.active !== 'boolean') throw new Error('Invalid membership response');
    } catch { throw new ServiceUnavailableException({ code: 'IDENTITY_UNAVAILABLE' }); }
    if (!member.active || member.workspaceId !== identity.workspaceId || member.userId !== accountId) {
      throw new BadRequestException({ code: 'ACCOUNT_NOT_ACTIVE_MEMBER' });
    }
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Interviewer" WHERE id = ${interviewerId} AND "workspaceId" = ${identity.workspaceId} FOR UPDATE`;
      if (!await tx.interviewer.findFirst({ where: { id: interviewerId, workspaceId: identity.workspaceId } })) throw new NotFoundException({ code: 'NOT_FOUND' });
      const existing = await tx.interviewerAccountBinding.findUnique({ where: { interviewerId } });
      if (existing) {
        if (existing.accountId !== accountId) throw new ConflictException({ code: 'INTERVIEWER_ALREADY_BOUND' });
        return existing;
      }
      return tx.interviewerAccountBinding.create({ data: { interviewerId, workspaceId: identity.workspaceId, accountId, boundBy: identity.actorId } });
    });
  }
  list(workspaceId: string) {
    return this.db.interviewer.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, title: true, email: true },
    });
  }
}
