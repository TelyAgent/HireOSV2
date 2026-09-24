import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import type { ScreeningHandoffDto } from './screening-handoff.dto';

@Injectable()
export class ScreeningHandoffService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Idempotent by design — hireos-screening's dispatcher retries at-least-once on failure, and the
   * same decision could in principle be redelivered. Upserting on (workspaceId, coreCandidateId) /
   * (workspaceId, coreJobId) / (workspaceId, candidateId, jobId) means a retry updates the same rows
   * instead of creating duplicates. The Task itself is intentionally left alone on repeat delivery
   * (`update: {}`) — if someone has already started working the task, a redelivered handoff shouldn't
   * silently reopen or retitle it out from under them.
   */
  async ingest(identity: Identity, dto: ScreeningHandoffDto) {
    return this.db.$transaction(async (tx) => {
      const candidate = await tx.candidate.upsert({
        where: { workspaceId_coreCandidateId: { workspaceId: identity.workspaceId, coreCandidateId: dto.coreCandidateId } },
        create: {
          workspaceId: identity.workspaceId, coreCandidateId: dto.coreCandidateId,
          name: dto.candidateName, email: dto.candidateEmail, phone: dto.candidatePhone,
        },
        update: { name: dto.candidateName, email: dto.candidateEmail, phone: dto.candidatePhone },
      });

      const job = await tx.job.upsert({
        where: { workspaceId_coreJobId: { workspaceId: identity.workspaceId, coreJobId: dto.coreJobId } },
        create: {
          workspaceId: identity.workspaceId, coreJobId: dto.coreJobId, title: dto.jobTitle,
          department: dto.jobDepartment, location: dto.jobLocation, level: dto.jobLevel, jdText: dto.jdText,
        },
        update: { title: dto.jobTitle, department: dto.jobDepartment, location: dto.jobLocation, level: dto.jobLevel, jdText: dto.jdText },
      });

      const kase = await tx.case.upsert({
        where: { workspaceId_candidateId_jobId: { workspaceId: identity.workspaceId, candidateId: candidate.id, jobId: job.id } },
        create: {
          workspaceId: identity.workspaceId, candidateId: candidate.id, jobId: job.id, status: 'linked',
          coreMaterialId: dto.coreMaterialId, resumeText: dto.resumeText, matchScore: dto.matchScore, matchRecommendation: dto.matchRecommendation,
        },
        update: { coreMaterialId: dto.coreMaterialId, resumeText: dto.resumeText, matchScore: dto.matchScore, matchRecommendation: dto.matchRecommendation },
      });

      const task = await tx.task.upsert({
        where: { caseId: kase.id },
        create: {
          workspaceId: identity.workspaceId, caseId: kase.id,
          title: `${dto.candidateName} — plan ready, test not yet sent`,
          type: 'invite_pending', status: 'open',
        },
        update: {},
      });

      return { candidateId: candidate.id, jobId: job.id, caseId: kase.id, taskId: task.id };
    });
  }
}
