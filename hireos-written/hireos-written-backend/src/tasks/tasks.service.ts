import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CoreRecordClient } from '../core-record/core-record.client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { invalidSchema, invalidSchemaFromZod } from '../http/invalid-schema';

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
  closeDecision: unknown;
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

/** One page of the task list (#412), newest first; `nextCursor` continues it, null at the end. */
export interface WrittenTaskPage {
  items: WrittenTaskDto[];
  nextCursor: string | null;
}

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).optional(),
}).strict();

const statsSchema = z.object({
  assignee: z.string().max(200).optional(),
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
}).strict();

const OPEN_STATUSES = ['open', 'in_progress', 'waiting'];
const REVIEW_TYPES = ['evaluation_review', 'result_release'];

type TaskRow = Prisma.TaskGetPayload<{ include: { case: { include: { candidate: true; job: true } } } }>;

type Cursor = { createdAt: string; id: string };
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(raw: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (typeof c.id === 'string' && typeof c.createdAt === 'string' && !Number.isNaN(Date.parse(c.createdAt))) return c as Cursor;
  } catch {
    // falls through to the error below
  }
  throw invalidSchema({ cursor: ['Not a cursor this list returned.'] });
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

  /**
   * The workspace's tasks a page at a time (#412), newest first (createdAt, then id), so the list costs the same
   * however many tasks a workspace has. The first page also brings job details up to date from Core Record.
   */
  async list(identity: Identity, raw: unknown = {}): Promise<WrittenTaskPage> {
    const parsed = pageSchema.safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const { limit, cursor } = parsed.data;
    const after = cursor ? decodeCursor(cursor) : null;
    if (!after) await this.syncJobsFromCore(identity);
    const rows = await this.db.task.findMany({
      where: {
        workspaceId: identity.workspaceId,
        ...(after ? { OR: [{ createdAt: { lt: new Date(after.createdAt) } }, { createdAt: new Date(after.createdAt), id: { lt: after.id } }] } : {}),
      },
      include: { case: { include: { candidate: true, job: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const tasks = rows.slice(0, limit);
    const last = tasks.at(-1);
    return {
      items: this.toDtos(tasks),
      nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  /**
   * The My Tasks figures counted in the database (#412), for every task rather than the pages loaded: an
   * assignee's open, in-progress, review and due-in-range tasks, and the workspace's tasks by case status.
   */
  async stats(identity: Identity, raw: unknown = {}) {
    const parsed = statsSchema.safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const { assignee, dueFrom, dueTo } = parsed.data;
    const workspaceId = identity.workspaceId;
    const mine = { workspaceId, assignee: assignee ?? null };
    const [total, byCase, open, inProgress, reviews, dueInRange] = await Promise.all([
      this.db.task.count({ where: { workspaceId } }),
      this.db.case.groupBy({ by: ['status'], where: { workspaceId, task: { isNot: null } }, _count: { _all: true } }),
      this.db.task.count({ where: { ...mine, status: { in: OPEN_STATUSES } } }),
      this.db.task.count({ where: { ...mine, status: 'in_progress' } }),
      this.db.task.count({ where: { ...mine, type: { in: REVIEW_TYPES }, status: { not: 'completed' } } }),
      dueFrom && dueTo ? this.db.task.count({ where: { ...mine, dueAt: { gte: new Date(dueFrom), lt: new Date(dueTo) } } }) : Promise.resolve(null),
    ]);
    return {
      total,
      byCaseStatus: Object.fromEntries(byCase.map((row) => [row.status, row._count._all])),
      assignee: { open, inProgress, reviewsAwaiting: reviews, dueInRange },
    };
  }

  private toDtos(tasks: TaskRow[]): WrittenTaskDto[] {
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
      closeDecision: t.case.closeDecision,
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
