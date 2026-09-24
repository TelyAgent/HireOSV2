import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { assertVersion, findIdempotent, notFound, storeIdempotency, type RequestMeta } from '../records';
import { writeAudit } from '../audit/audit.service';
import { writeOutbox } from '../outbox/outbox.service';

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  team: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  employmentType: z.string().trim().max(80).optional(),
  seniority: z.string().trim().max(80).optional(),
  openings: z.number().int().positive().max(10000).optional(),
  status: z.enum(['draft', 'open', 'paused', 'closed', 'archived']).optional(),
  requestKey: z.string().trim().min(1).max(200).optional(),
});

const patchSchema = createSchema.partial().extend({
  status: z.enum(['draft', 'open', 'paused', 'closed', 'archived']).optional(),
  expectedVersion: z.number().int().positive().optional(),
  reason: z.string().trim().max(500).optional(),
});

@Injectable()
export class JobsService {
  constructor(private readonly db: PrismaService) {}

  async create(identity: Identity, raw: unknown, meta: RequestMeta) {
    const input = createSchema.parse(raw);
    const operation = 'job.create';
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, operation, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      const job = await tx.job.create({
        data: {
          workspaceId: identity.workspaceId,
          title: input.title,
          team: input.team,
          location: input.location,
          employmentType: input.employmentType,
          seniority: input.seniority,
          status: input.status || 'draft',
          openings: input.openings || 1,
          createdBy: identity.actorId,
        },
      });
      const result = serialize(job);
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
      await writeAudit(tx, identity, meta, {
        action: 'job.created',
        objectType: 'Job',
        objectId: job.id,
        afterVersion: job.version,
        payload: { requestKey: input.requestKey },
      });
      await writeOutbox(tx, identity, meta, {
        eventType: 'job.created',
        aggregateType: 'Job',
        aggregateId: job.id,
        aggregateVersion: job.version,
        payload: { jobId: job.id, title: job.title, status: job.status },
      });
      return result;
    });
  }

  // Backs a cross-subsystem "pick an existing job" picker (e.g. Interview attaching to
  // a job whose JD already lives in the JD subsystem) -- no subsystem maintains its own
  // copy of the job list, so this is the one place to browse the master directory.
  async list(identity: Identity, query?: string) {
    const jobs = await this.db.job.findMany({
      where: {
        workspaceId: identity.workspaceId,
        ...(query?.trim() ? { title: { contains: query.trim(), mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return jobs.map(serialize);
  }

  async get(identity: Identity, id: string) {
    const job = await this.db.job.findFirst({
      where: { id, workspaceId: identity.workspaceId },
      include: { applications: true },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
    return { ...serialize(job), applicationIds: job.applications.map((item) => item.id) };
  }

  async patch(identity: Identity, id: string, raw: unknown, meta: RequestMeta) {
    const input = patchSchema.parse(raw);
    const current = await this.db.job.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!current) return notFound();
    const reason = input.reason;
    const changes = { ...input };
    delete changes.expectedVersion;
    delete changes.reason;
    delete changes.requestKey;
    if (!Object.keys(changes).length) throw new BadRequestException({ code: 'EMPTY_PATCH' });
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, `job.patch:${id}`, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      assertVersion(input.expectedVersion, current.version);
      const changed = await tx.job.updateMany({
        where: { id, workspaceId: identity.workspaceId, version: current.version },
        data: { ...changes, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      const updated = await tx.job.findUniqueOrThrow({ where: { id } });
      if (input.status && input.status !== current.status) {
        await tx.jobStatusHistory.create({
          data: {
            workspaceId: identity.workspaceId,
            jobId: id,
            fromStatus: current.status,
            toStatus: input.status,
            reason: reason || 'status_changed',
            actorId: identity.actorId,
          },
        });
      }
      const result = serialize(updated);
      await writeAudit(tx, identity, meta, {
        action: 'job.updated',
        objectType: 'Job',
        objectId: id,
        beforeVersion: current.version,
        afterVersion: updated.version,
        reason,
        payload: { changes: Object.keys(changes) },
      });
      await writeOutbox(tx, identity, meta, {
        eventType: 'job.updated',
        aggregateType: 'Job',
        aggregateId: id,
        aggregateVersion: updated.version,
        payload: { jobId: id, changes: Object.keys(changes) },
      });
      await storeIdempotency(tx, identity, `job.patch:${id}`, prior.key, prior.hash, result, 200);
      return result;
    });
  }

  // Hard delete: this app has no soft-delete convention (see `Candidate.status`'s unused 'deleted'
  // enum value — no endpoint ever sets it), and this Job's own status enum has no 'deleted' state
  // either, so a "delete" request means actually removing the row. `Application.job` is the one
  // `onDelete: Restrict` foreign key onto Job (JobStatusHistory/RoleDefinitionVersion/
  // JobRequirementSnapshot all cascade) — checked explicitly here so the failure is a clear
  // `JOB_HAS_APPLICATIONS` conflict instead of a raw Postgres FK-violation error.
  async delete(identity: Identity, id: string, meta: RequestMeta) {
    const current = await this.db.job.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!current) return notFound();
    const applicationCount = await this.db.application.count({ where: { jobId: id, workspaceId: identity.workspaceId } });
    if (applicationCount > 0) {
      throw new ConflictException({
        code: 'JOB_HAS_APPLICATIONS',
        message: 'This job has candidate applications and cannot be deleted.',
      });
    }
    return this.db.$transaction(async (tx) => {
      const operation = `job.delete:${id}`;
      const prior = await findIdempotent(tx, identity, operation, meta, {});
      if (prior.prior) return prior.prior.responseBody;
      await tx.job.delete({ where: { id } });
      const result = { id, deleted: true };
      await writeAudit(tx, identity, meta, {
        action: 'job.deleted',
        objectType: 'Job',
        objectId: id,
        beforeVersion: current.version,
        payload: { title: current.title },
      });
      await writeOutbox(tx, identity, meta, {
        eventType: 'job.deleted',
        aggregateType: 'Job',
        aggregateId: id,
        aggregateVersion: current.version,
        payload: { jobId: id },
      });
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result, 200);
      return result;
    });
  }

  async history(identity: Identity, id: string) {
    const exists = await this.db.job.findFirst({ where: { id, workspaceId: identity.workspaceId }, select: { id: true } });
    if (!exists) return notFound();
    const [audit, status] = await Promise.all([
      this.db.auditRecord.findMany({ where: { workspaceId: identity.workspaceId, objectType: 'Job', objectId: id }, orderBy: { createdAt: 'desc' } }),
      this.db.jobStatusHistory.findMany({ where: { workspaceId: identity.workspaceId, jobId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { audit, status };
  }
}

function serialize(job: {
  id: string;
  workspaceId: string;
  title: string;
  team: string | null;
  location: string | null;
  employmentType: string | null;
  seniority: string | null;
  status: string;
  openings: number;
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    workspaceId: job.workspaceId,
    title: job.title,
    team: job.team || undefined,
    location: job.location || undefined,
    employmentType: job.employmentType || undefined,
    seniority: job.seniority || undefined,
    status: job.status,
    openings: job.openings,
    createdBy: job.createdBy,
    version: job.version,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
