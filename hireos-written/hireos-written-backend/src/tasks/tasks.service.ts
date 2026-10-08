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

/**
 * Case.status itself is only ever written once ('linked', at handoff) -- the real progress lives on
 * the case's invitations. Derive the status the task list shows from the latest invitation, in the
 * case-status vocabulary the frontend's writtenTaskStatus() already maps:
 *   no invitation -> case.status ('linked' -> Pending test)
 *   sent          -> 'invited'             (Test sent)
 *   opened        -> 'awaiting_submission' (Pending submission)
 *   submitted     -> 'review_pending'      (Pending result review -- the AI draft, or a manual score
 *                                           when auto-evaluation failed, still needs a human)
 *   submitted + result published -> 'released' (Written completed)
 */
function deriveCaseStatus(caseStatus: string, latestInvitationStatus: string | undefined, released: boolean): string {
  switch (latestInvitationStatus) {
    case undefined:
      return caseStatus;
    case 'sent':
      return 'invited';
    case 'opened':
      return 'awaiting_submission';
    case 'submitted':
      return released ? 'released' : 'review_pending';
    default:
      return caseStatus;
  }
}

@Injectable()
export class TasksService {
  constructor(private readonly db: PrismaService) {}

  async list(identity: Identity): Promise<WrittenTaskDto[]> {
    const tasks = await this.db.task.findMany({
      where: { workspaceId: identity.workspaceId },
      include: {
        case: {
          include: {
            candidate: true,
            job: true,
            invitations: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { status: true, submission: { select: { releasedAt: true } } },
            },
          },
        },
      },
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
      caseStatus: deriveCaseStatus(t.case.status, t.case.invitations[0]?.status, !!t.case.invitations[0]?.submission?.releasedAt),
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
