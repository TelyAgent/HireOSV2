import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { json, type RequestMeta } from '../records';

@Injectable()
export class AuditService {
  constructor(private readonly db: PrismaService) {}

  async record(
    identity: Identity,
    meta: RequestMeta,
    input: {
      action: string;
      objectType: string;
      objectId: string;
      beforeVersion?: number;
      afterVersion?: number;
      reason?: string;
      payload?: unknown;
    },
  ) {
    return this.db.auditRecord.create({
      data: {
        workspaceId: identity.workspaceId,
        actorId: identity.actorId,
        action: input.action,
        objectType: input.objectType,
        objectId: input.objectId,
        beforeVersion: input.beforeVersion,
        afterVersion: input.afterVersion,
        reason: input.reason,
        requestId: meta.requestId,
        correlationId: meta.correlationId,
        payload: json(input.payload ?? {}),
      },
    });
  }

  async list(identity: Identity) {
    return this.db.auditRecord.findMany({
      where: { workspaceId: identity.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}

export async function writeAudit(
  tx: Prisma.TransactionClient,
  identity: Identity,
  meta: RequestMeta,
  input: {
    action: string;
    objectType: string;
    objectId: string;
    beforeVersion?: number;
    afterVersion?: number;
    reason?: string;
    payload?: unknown;
  },
) {
  return tx.auditRecord.create({
    data: {
      workspaceId: identity.workspaceId,
      actorId: identity.actorId,
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId,
      beforeVersion: input.beforeVersion,
      afterVersion: input.afterVersion,
      reason: input.reason,
      requestId: meta.requestId,
      correlationId: meta.correlationId,
      payload: json(input.payload ?? {}),
    },
  });
}
