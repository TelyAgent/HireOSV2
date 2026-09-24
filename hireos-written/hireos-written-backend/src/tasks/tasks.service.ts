import { Injectable } from '@nestjs/common';
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
  constructor(private readonly db: PrismaService) {}

  async list(identity: Identity): Promise<WrittenTaskDto[]> {
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
      caseStatus: t.case.status,
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
