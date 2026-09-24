import { Injectable } from '@nestjs/common';
import { screeningHandoffSchema, validate } from './contracts';
import { PrismaService } from '../persistence/prisma.service';
import { MaterialsService } from './materials.service';
import type { Identity } from './workspace.guard';

@Injectable()
export class ScreeningHandoffService {
  constructor(
    private readonly db: PrismaService,
    private readonly materials: MaterialsService,
  ) {}

  /**
   * Receives a "move to interview" hand-off from Screening's outbox dispatcher.
   * Job and Candidate are upserted by their Core Record id, and the InterviewTask by
   * its (jobId, candidateId) unique pair -- so a retried or duplicated delivery of the
   * same event is a no-op the second time, never a duplicate task. Rounds are not
   * created here; RoundsService.listForTask self-heals them on first view (see its
   * comment -- this exact hand-off path is why that self-heal exists).
   */
  async ingest(identity: Identity, raw: unknown) {
    const input = validate(screeningHandoffSchema, raw);
    const jdText = input.jdText || input.jobTitle;

    const existing = await this.db.job.findUnique({ where: { coreJobId: input.coreJobId } });
    const jdChanged = existing ? existing.jdText !== jdText : true;
    const job = await this.db.job.upsert({
      where: { coreJobId: input.coreJobId },
      update: {
        title: input.jobTitle,
        department: input.jobDepartment,
        location: input.jobLocation,
        level: input.jobLevel,
        ...(jdChanged ? { jdText, jdVersion: { increment: 1 } } : {}),
      },
      create: {
        workspaceId: identity.workspaceId,
        createdBy: identity.actorId,
        coreJobId: input.coreJobId,
        title: input.jobTitle,
        department: input.jobDepartment,
        location: input.jobLocation,
        level: input.jobLevel,
        jdText,
      },
    });

    const candidate = await this.db.candidate.upsert({
      where: { coreCandidateId: input.coreCandidateId },
      update: {
        name: input.candidateName,
        email: input.candidateEmail,
        phone: input.candidatePhone,
      },
      create: {
        workspaceId: identity.workspaceId,
        coreCandidateId: input.coreCandidateId,
        name: input.candidateName,
        email: input.candidateEmail,
        phone: input.candidatePhone,
      },
    });

    // Pulls the résumé Screening already has (via Core Record) instead of leaving the
    // task with no résumé until someone manually re-uploads one -- see
    // materials.service.ts's fromCoreMaterial for the extraction/idempotency details.
    let resumeId: string | undefined;
    if (input.coreMaterialId) {
      const material = await this.materials.fromCoreMaterial(identity, input.coreMaterialId);
      const resume = await this.db.resume.upsert({
        where: { materialId: material.id },
        update: {},
        create: { workspaceId: identity.workspaceId, candidateId: candidate.id, materialId: material.id },
      });
      resumeId = resume.id;
    }

    const task = await this.db.interviewTask.upsert({
      where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
      update: {
        matchScore: input.matchScore,
        matchRecommendation: input.matchRecommendation,
        screeningHandedOffAt: new Date(),
        ...(resumeId ? { resumeId } : {}),
      },
      create: {
        workspaceId: identity.workspaceId,
        createdBy: identity.actorId,
        jobId: job.id,
        candidateId: candidate.id,
        resumeId,
        matchScore: input.matchScore,
        matchRecommendation: input.matchRecommendation,
        screeningHandedOffAt: new Date(),
      },
    });

    return { taskId: task.id, jobId: job.id, candidateId: candidate.id };
  }
}
