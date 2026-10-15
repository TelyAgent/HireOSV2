import { Injectable, Logger } from '@nestjs/common';
import { CoreRecordClient } from '../core-record/core-record.client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';

/**
 * Denormalized on purpose: the frontend merges these straight into its existing fixture-shaped
 * CASES/CORE_CANDIDATES/CORE_JOBS/TASKS dictionaries (see hireos-written-front's
 * `useLoadRealWrittenTasks`), so every field a task row needs to render is already flattened here
 * rather than requiring three more round trips per task.
 */
export interface WrittenTaskDto {
  id: string;
  title: string;
  type: string;
  status: string;
  assignee: string | null;
  dueAt: string | null;
  createdAt: string;
  caseId: string;
  caseStatus: string;
  closeReason: string | null;
  closedAt: string | null;
  handedOffAt: string | null;
  interviewTaskId: string | null;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  jobId: string;
  jobTitle: string;
  jobDepartment: string | null;
  jobLocation: string | null;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly db: PrismaService, private readonly coreRecord: CoreRecordClient) {}

  /**
   * Keeps local jobs' title / department / location / level in step with Core Record -- e.g. the
   * edits made to the job in HireOS JD after the case was created here. One directory call per
   * list load; Core Record being unreachable just leaves the local copies as they are.
   */
  private async syncJobsFromCore(identity: Identity) {
    let coreJobs: Awaited<ReturnType<CoreRecordClient['listJobs']>>;
    try {
      coreJobs = await this.coreRecord.listJobs(identity);
    } catch (error) {
      this.logger.warn(`Skipping Core Record job sync: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const byId = new Map(coreJobs.map((job) => [job.id, job]));
    if (!byId.size) return;
    const local = await this.db.job.findMany({
      where: { workspaceId: identity.workspaceId, coreJobId: { in: [...byId.keys()] } },
      select: { id: true, coreJobId: true, title: true, department: true, location: true, level: true },
    });
    for (const job of local) {
      const core = byId.get(job.coreJobId)!;
      const synced = { title: core.title, department: core.team ?? null, location: core.location ?? null, level: core.seniority ?? null };
      if ((Object.keys(synced) as (keyof typeof synced)[]).some((key) => job[key] !== synced[key])) {
        await this.db.job.update({ where: { id: job.id }, data: synced });
      }
    }
  }

  async list(identity: Identity): Promise<WrittenTaskDto[]> {
    await this.syncJobsFromCore(identity);
    const tasks = await this.db.task.findMany({
      where: { workspaceId: identity.workspaceId },
      include: { case: { include: { candidate: true, job: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      status: t.status,
      assignee: t.assignee,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      caseId: t.caseId,
      // Persisted at every transition by CaseLifecycleService -- see its state-machine comment.
      caseStatus: t.case.status,
      closeReason: t.case.closeReason,
      closedAt: t.case.closedAt?.toISOString() ?? null,
      handedOffAt: t.case.handedOffAt?.toISOString() ?? null,
      interviewTaskId: t.case.interviewTaskId,
      candidateId: t.case.candidate.id,
      candidateName: t.case.candidate.name,
      candidateEmail: t.case.candidate.email,
      jobId: t.case.job.id,
      jobTitle: t.case.job.title,
      jobDepartment: t.case.job.department,
      jobLocation: t.case.job.location,
    }));
  }
}
