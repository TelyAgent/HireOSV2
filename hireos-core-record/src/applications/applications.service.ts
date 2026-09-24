import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { assertVersion, findIdempotent, notFound, storeIdempotency, type RequestMeta } from '../records';
import { writeAudit } from '../audit/audit.service';
import { writeOutbox } from '../outbox/outbox.service';

const createSchema = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid(),
  cycleId: z.string().trim().min(1).max(100).optional(),
  origin: z.string().trim().max(80).optional(),
  linkReason: z.string().trim().min(1).max(500),
});

const patchSchema = z.object({
  status: z.enum(['active', 'on_hold', 'withdrawn', 'closed', 'archived']).optional(),
  expectedVersion: z.number().int().positive().optional(),
  reason: z.string().trim().max(500).optional(),
});

@Injectable()
export class ApplicationsService {
  constructor(private readonly db: PrismaService) {}

  async create(identity: Identity, raw: unknown, meta: RequestMeta) {
    const input = createSchema.parse(raw);
    const operation = 'application.create';
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, operation, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      const [candidate, job] = await Promise.all([
        tx.candidate.findFirst({ where: { id: input.candidateId, workspaceId: identity.workspaceId } }),
        tx.job.findFirst({ where: { id: input.jobId, workspaceId: identity.workspaceId } }),
      ]);
      if (!candidate || !job) throw new NotFoundException({ code: 'NOT_FOUND' });
      if (job.status === 'closed' || job.status === 'archived') {
        throw new ConflictException({ code: 'JOB_NOT_OPEN' });
      }
      const existing = await tx.application.findUnique({
        where: {
          workspaceId_candidateId_jobId_cycleId: {
            workspaceId: identity.workspaceId,
            candidateId: input.candidateId,
            jobId: input.jobId,
            cycleId: input.cycleId || 'cycle-1',
          },
        },
      });
      if (existing) {
        const result = serialize(existing);
        await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
        return result;
      }
      const application = await tx.application.create({
        data: {
          workspaceId: identity.workspaceId,
          candidateId: input.candidateId,
          jobId: input.jobId,
          cycleId: input.cycleId || 'cycle-1',
          origin: input.origin || 'sourced',
          linkReason: input.linkReason,
          linkedBy: identity.actorId,
        },
      });
      await tx.applicationStatusHistory.create({
        data: {
          workspaceId: identity.workspaceId,
          applicationId: application.id,
          toStatus: application.status,
          reason: 'application_created',
          actorId: identity.actorId,
        },
      });
      const result = serialize(application);
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
      await writeAudit(tx, identity, meta, {
        action: 'application.created',
        objectType: 'Application',
        objectId: application.id,
        afterVersion: application.version,
        reason: input.linkReason,
        payload: { candidateId: input.candidateId, jobId: input.jobId, cycleId: application.cycleId },
      });
      await writeOutbox(tx, identity, meta, {
        eventType: 'application.created',
        aggregateType: 'Application',
        aggregateId: application.id,
        aggregateVersion: application.version,
        payload: { applicationId: application.id, candidateId: input.candidateId, jobId: input.jobId },
      });
      return result;
    });
  }

  async get(identity: Identity, id: string) {
    const application = await this.db.application.findFirst({
      where: { id, workspaceId: identity.workspaceId },
      include: { candidate: true, job: true },
    });
    if (!application) throw new NotFoundException({ code: 'NOT_FOUND' });
    return {
      ...serialize(application),
      candidate: { id: application.candidate.id, displayName: application.candidate.displayName },
      job: { id: application.job.id, title: application.job.title, status: application.job.status },
    };
  }

  async patch(identity: Identity, id: string, raw: unknown, meta: RequestMeta) {
    const input = patchSchema.parse(raw);
    const current = await this.db.application.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!current) return notFound();
    if (!input.status) throw new BadRequestException({ code: 'STATUS_REQUIRED' });
    if (input.status === current.status) return serialize(current);
    const updated = await this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, `application.patch:${id}`, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      assertVersion(input.expectedVersion, current.version);
      const changed = await tx.application.updateMany({
        where: { id, workspaceId: identity.workspaceId, version: current.version },
        data: { status: input.status, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      const row = await tx.application.findUniqueOrThrow({ where: { id } });
      await tx.applicationStatusHistory.create({
        data: {
          workspaceId: identity.workspaceId,
          applicationId: id,
          fromStatus: current.status,
          toStatus: input.status!,
          reason: input.reason || 'status_changed',
          actorId: identity.actorId,
        },
      });
      await writeAudit(tx, identity, meta, {
        action: 'application.status_changed',
        objectType: 'Application',
        objectId: id,
        beforeVersion: current.version,
        afterVersion: row.version,
        reason: input.reason,
        payload: { fromStatus: current.status, toStatus: input.status },
      });
      await writeOutbox(tx, identity, meta, {
        eventType: 'application.status_changed',
        aggregateType: 'Application',
        aggregateId: id,
        aggregateVersion: row.version,
        payload: { applicationId: id, fromStatus: current.status, toStatus: input.status },
      });
      await storeIdempotency(tx, identity, `application.patch:${id}`, prior.key, prior.hash, serialize(row), 200);
      return serialize(row);
    });
    return updated;
  }

  async history(identity: Identity, id: string) {
    const exists = await this.db.application.findFirst({ where: { id, workspaceId: identity.workspaceId }, select: { id: true } });
    if (!exists) return notFound();
    const [audit, status] = await Promise.all([
      this.db.auditRecord.findMany({ where: { workspaceId: identity.workspaceId, objectType: 'Application', objectId: id }, orderBy: { createdAt: 'desc' } }),
      this.db.applicationStatusHistory.findMany({ where: { workspaceId: identity.workspaceId, applicationId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { audit, status };
  }
}

function serialize(application: {
  id: string;
  workspaceId: string;
  candidateId: string;
  jobId: string;
  cycleId: string;
  status: string;
  origin: string;
  linkReason: string;
  linkedAt: Date;
  linkedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: application.id,
    workspaceId: application.workspaceId,
    candidateId: application.candidateId,
    jobId: application.jobId,
    cycleId: application.cycleId,
    status: application.status,
    origin: application.origin,
    linkReason: application.linkReason,
    linkedAt: application.linkedAt.toISOString(),
    linkedBy: application.linkedBy,
    version: application.version,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}
