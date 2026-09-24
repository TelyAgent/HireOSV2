import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { assertVersion, findIdempotent, notFound, storeIdempotency, type RequestMeta } from '../records';
import { writeAudit } from '../audit/audit.service';
import { writeOutbox } from '../outbox/outbox.service';

const createSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(80).optional(),
  ownerId: z.string().trim().min(1).optional(),
  source: z.string().trim().max(80).optional(),
});

const patchSchema = createSchema.partial().extend({
  status: z.enum(['provisional', 'active', 'merged', 'archived', 'deleted']).optional(),
  retentionPolicy: z.string().trim().max(100).optional(),
  expectedVersion: z.number().int().positive().optional(),
  reason: z.string().trim().max(500).optional(),
});

@Injectable()
export class CandidatesService {
  constructor(private readonly db: PrismaService) {}

  async create(identity: Identity, raw: unknown, meta: RequestMeta) {
    const input = createSchema.parse(raw);
    const operation = 'candidate.create';
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, operation, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      const candidate = await tx.candidate.create({
        data: {
          workspaceId: identity.workspaceId,
          displayName: input.displayName,
          email: input.email,
          phone: input.phone,
          ownerId: input.ownerId || identity.actorId,
        },
      });
      const result = serialize(candidate);
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
      await writeAudit(tx, identity, meta, {
        action: 'candidate.created',
        objectType: 'Candidate',
        objectId: candidate.id,
        afterVersion: candidate.version,
        payload: { source: input.source || 'api' },
      });
      await writeOutbox(tx, identity, meta, {
        eventType: 'candidate.created',
        aggregateType: 'Candidate',
        aggregateId: candidate.id,
        aggregateVersion: candidate.version,
        payload: { candidateId: candidate.id, displayName: candidate.displayName },
      });
      return result;
    });
  }

  async get(identity: Identity, id: string) {
    const candidate = await this.db.candidate.findFirst({
      where: { id, workspaceId: identity.workspaceId },
      include: { applications: true, materials: true },
    });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND' });
    return {
      ...serialize(candidate),
      applicationIds: candidate.applications.map((item) => item.id),
      materialIds: candidate.materials.map((item) => item.id),
    };
  }

  async patch(identity: Identity, id: string, raw: unknown, meta: RequestMeta) {
    const input = patchSchema.parse(raw);
    const current = await this.db.candidate.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!current) return notFound();
    const reason = input.reason;
    const changes = { ...input };
    delete changes.expectedVersion;
    delete changes.reason;
    if (!Object.keys(changes).length) throw new BadRequestException({ code: 'EMPTY_PATCH' });
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, `candidate.patch:${id}`, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      assertVersion(input.expectedVersion, current.version);
      const changed = await tx.candidate.updateMany({
        where: { id, workspaceId: identity.workspaceId, version: current.version },
        data: { ...changes, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      const updated = await tx.candidate.findUniqueOrThrow({ where: { id } });
      if (input.status && input.status !== current.status) {
        await tx.candidateStatusHistory.create({
          data: {
            workspaceId: identity.workspaceId,
            candidateId: id,
            fromStatus: current.status,
            toStatus: input.status,
            reason: reason || 'status_changed',
            actorId: identity.actorId,
          },
        });
      }
      const result = serialize(updated);
      await writeAudit(tx, identity, meta, {
        action: 'candidate.updated',
        objectType: 'Candidate',
        objectId: id,
        beforeVersion: current.version,
        afterVersion: updated.version,
        reason,
        payload: { changes: Object.keys(changes) },
      });
      await writeOutbox(tx, identity, meta, {
        eventType: 'candidate.updated',
        aggregateType: 'Candidate',
        aggregateId: id,
        aggregateVersion: updated.version,
        payload: { candidateId: id, changes: Object.keys(changes) },
      });
      await storeIdempotency(tx, identity, `candidate.patch:${id}`, prior.key, prior.hash, result, 200);
      return result;
    });
  }

  async history(identity: Identity, id: string) {
    const exists = await this.db.candidate.findFirst({ where: { id, workspaceId: identity.workspaceId }, select: { id: true } });
    if (!exists) return notFound();
    const [audit, status] = await Promise.all([
      this.db.auditRecord.findMany({ where: { workspaceId: identity.workspaceId, objectType: 'Candidate', objectId: id }, orderBy: { createdAt: 'desc' } }),
      this.db.candidateStatusHistory.findMany({ where: { workspaceId: identity.workspaceId, candidateId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { audit, status };
  }
}

function serialize(candidate: {
  id: string;
  workspaceId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  identityStatus: string;
  ownerId: string;
  status: string;
  retentionPolicy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: candidate.id,
    workspaceId: candidate.workspaceId,
    displayName: candidate.displayName,
    email: candidate.email || undefined,
    phone: candidate.phone || undefined,
    identityStatus: candidate.identityStatus,
    ownerId: candidate.ownerId,
    status: candidate.status,
    retentionPolicy: candidate.retentionPolicy,
    version: candidate.version,
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
  };
}
