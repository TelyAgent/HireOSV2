import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { CoreRecordClient, mapRecruitingStatus } from '../core-record/core-record.client';
import { JdContentFacade, formatJdText } from '../core-record/jd-content.facade';
import { attachJobSchema, validate } from './contracts';
import type { Identity } from './workspace.guard';

@Injectable()
export class JobsService {
  constructor(
    private readonly db: PrismaService,
    private readonly coreRecord: CoreRecordClient,
    private readonly jdContent: JdContentFacade,
  ) {}

  /**
   * The lightweight "pick an existing job" entry point that replaced the old JD-upload
   * flow (see Job's schema comment): looks up the job's identity from Core Record and
   * its JD content from the JD subsystem, then upserts a local Job keyed by Core
   * Record's id. Idempotent -- re-attaching the same coreJobId just refreshes the
   * synced fields, never creates a duplicate. Résumés are added afterward through the
   * existing TasksService.create, unchanged.
   */
  async attach(identity: Identity, raw: unknown) {
    const { coreJobId } = validate(attachJobSchema, raw);
    const coreJob = await this.coreRecord.getJob(identity, coreJobId);
    const content = await this.jdContent.get(identity, coreJobId);
    const jdText = content ? formatJdText(content, coreJob.title) : coreJob.title;
    const recruitingStatus = mapRecruitingStatus(coreJob.status);
    const existing = await this.db.job.findUnique({ where: { coreJobId } });
    const jdChanged = existing ? existing.jdText !== jdText : true;
    const job = await this.db.job.upsert({
      where: { coreJobId },
      update: {
        title: coreJob.title,
        department: coreJob.team,
        location: coreJob.location,
        level: coreJob.seniority,
        recruitingStatus,
        jdText,
        ...(jdChanged ? { jdVersion: { increment: 1 } } : {}),
      },
      create: {
        workspaceId: identity.workspaceId,
        createdBy: identity.actorId,
        coreJobId,
        title: coreJob.title,
        department: coreJob.team,
        location: coreJob.location,
        level: coreJob.seniority,
        recruitingStatus,
        jdText,
      },
    });
    return this.get(identity.workspaceId, job.id);
  }

  /** Proxies Core Record's job directory for the "pick an existing job" picker --
   * Interview keeps no copy of the master list, per Core Record owning it. */
  search(identity: Identity, query?: string) {
    return this.coreRecord.listJobs(identity, query);
  }

  list(workspaceId: string) {
    return this.db.job.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, title: true, department: true, location: true, level: true, recruitingStatus: true, jdVersion: true, createdAt: true },
    });
  }

  async get(workspaceId: string, id: string) {
    const job = await this.db.job.findFirst({
      where: { id, workspaceId },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, status: true, matchScore: true, matchRecommendation: true, createdAt: true,
            candidate: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
    return job;
  }
}
