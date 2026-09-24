import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { json, type RequestMeta } from '../records';

@Injectable()
export class OutboxService {
  constructor(private readonly db: PrismaService) {}

  async list(identity: Identity) {
    return this.db.outboxEvent.findMany({
      where: { workspaceId: identity.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}

export async function writeOutbox(
  tx: Prisma.TransactionClient,
  identity: Identity,
  meta: RequestMeta,
  input: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    aggregateVersion: number;
    payload: unknown;
  },
) {
  return tx.outboxEvent.create({
    data: {
      workspaceId: identity.workspaceId,
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      aggregateVersion: input.aggregateVersion,
      correlationId: meta.correlationId,
      payload: json(input.payload),
    },
  });
}
