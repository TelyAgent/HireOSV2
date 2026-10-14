/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';

@Injectable()
export class DeliveriesService {
  constructor(private readonly db: PrismaService) {}

  async list(identity: Identity) {
    const packages = await this.db.handoffPackage.findMany({
      where: { workspaceId: identity.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        application: { include: { candidate: { select: { displayName: true } }, job: { select: { title: true } } } },
        attempts: { orderBy: { attemptNo: 'desc' }, take: 1, include: { receipt: true } },
      },
    });
    return packages.map(serializePackage);
  }

  async get(identity: Identity, id: string) {
    const pkg = await this.findPackage(identity.workspaceId, id);
    return serializePackage(pkg);
  }

  async send(identity: Identity, id: string) {
    const pkg = await this.findPackage(identity.workspaceId, id);
    const attempt = latestAttempt(pkg);
    if (!attempt || !['prepared', 'failed', 'awaiting_confirmation'].includes(attempt.status)) {
      throw new ConflictException({ code: 'DELIVERY_NOT_SENDABLE', status: attempt?.status || pkg.status });
    }
    return this.progressAttempt(identity, pkg.id, attempt.id);
  }

  async retry(identity: Identity, id: string) {
    const pkg = await this.findPackage(identity.workspaceId, id);
    const previous = latestAttempt(pkg);
    if (!previous || !['failed', 'awaiting_confirmation'].includes(previous.status)) {
      throw new ConflictException({ code: 'DELIVERY_NOT_RETRYABLE', status: previous?.status || pkg.status });
    }
    const nextNo = previous.attemptNo + 1;
    const attempt = await this.db.deliveryAttempt.create({
      data: {
        workspaceId: identity.workspaceId,
        packageId: pkg.id,
        attemptNo: nextNo,
        status: 'prepared',
        transport: pkg.transport,
        targetLabel: pkg.targetLabel,
        history: json(appendHistory([], 'package_ready')),
      },
    });
    return this.progressAttempt(identity, pkg.id, attempt.id);
  }

  async recordReceipt(identity: Identity, id: string, body: { externalRef?: string; imported?: boolean }) {
    const pkg = await this.findPackage(identity.workspaceId, id);
    const attempt = latestAttempt(pkg);
    if (!attempt) throw new ConflictException({ code: 'DELIVERY_ATTEMPT_NOT_FOUND' });
    if (!['awaiting_confirmation', 'delivered'].includes(attempt.status)) {
      throw new ConflictException({ code: 'DELIVERY_NOT_RECEIVABLE', status: attempt.status });
    }
    await this.db.$transaction([
      this.db.receipt.upsert({
        where: { deliveryAttemptId: attempt.id },
        create: {
          workspaceId: identity.workspaceId,
          deliveryAttemptId: attempt.id,
          status: body.imported ? 'imported' : 'received',
          externalRef: body.externalRef || null,
          receivedAt: new Date(),
          importedAt: body.imported ? new Date() : null,
        },
        update: {
          status: body.imported ? 'imported' : 'received',
          externalRef: body.externalRef || null,
          receivedAt: new Date(),
          importedAt: body.imported ? new Date() : null,
        },
      }),
      this.db.deliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status: body.imported ? 'imported' : 'received',
          history: appendHistory(attempt.history, body.imported ? 'received_imported' : 'received'),
        },
      }),
      this.db.handoffPackage.update({
        where: { id: pkg.id },
        data: { status: body.imported ? 'imported' : 'received' },
      }),
    ]);
    return this.get(identity, pkg.id);
  }

  async download(identity: Identity, id: string) {
    const pkg = await this.findPackage(identity.workspaceId, id);
    return {
      packageId: pkg.id,
      fileName: `${pkg.id}-package.json`,
      format: 'application/json',
      payload: redactRestricted(pkg.payload),
    };
  }

  private async progressAttempt(identity: Identity, packageId: string, attemptId: string) {
    const attempt = await this.db.deliveryAttempt.findFirst({
      where: { id: attemptId, packageId, workspaceId: identity.workspaceId },
    });
    if (!attempt) throw new NotFoundException({ code: 'NOT_FOUND' });
    const now = new Date().toISOString();
    const history = appendHistory(attempt.history, 'queued');
    const submitted = appendHistory(history, 'submitted');
    const awaiting = appendHistory(submitted, 'delivered_awaiting_confirmation');
    await this.db.$transaction([
      this.db.deliveryAttempt.update({
        where: { id: attempt.id },
        data: { status: 'awaiting_confirmation', history: awaiting },
      }),
      this.db.handoffPackage.update({
        where: { id: packageId },
        data: { status: 'awaiting_confirmation' },
      }),
      this.db.auditRecord.create({
        data: {
          workspaceId: identity.workspaceId,
          actorId: identity.actorId,
          action: 'delivery_attempt_submitted',
          objectType: 'DeliveryAttempt',
          objectId: attempt.id,
          payload: json({ packageId, submittedAt: now }),
        },
      }),
    ]);
    return this.get(identity, packageId);
  }

  private async findPackage(workspaceId: string, id: string) {
    const pkg = await this.db.handoffPackage.findFirst({
      where: { id, workspaceId },
      include: {
        application: { include: { candidate: { select: { displayName: true } }, job: { select: { title: true } } } },
        attempts: { orderBy: { attemptNo: 'asc' }, include: { receipt: true } },
      },
    });
    if (!pkg) throw new NotFoundException({ code: 'NOT_FOUND' });
    return pkg;
  }
}

function latestAttempt(pkg: any) {
  return [...pkg.attempts].sort((a, b) => b.attemptNo - a.attemptNo)[0];
}

function serializePackage(pkg: any) {
  const attempt = latestAttempt(pkg);
  return {
    id: pkg.id,
    applicationId: pkg.applicationId,
    kind: pkg.kind,
    transport: pkg.transport || undefined,
    targetLabel: pkg.targetLabel,
    reviewStatus: pkg.reviewStatus || undefined,
    status: attempt?.status === 'prepared' ? 'prepared' : attempt?.status || pkg.status,
    createdAt: pkg.createdAt.toISOString(),
    history: serializeHistory(attempt?.history),
    candidateLabel: pkg.application?.candidate?.displayName,
    jobLabel: pkg.application?.job?.title,
    packageStatus: pkg.status,
    attemptNo: attempt?.attemptNo || 0,
    receipt: attempt?.receipt ? {
      status: attempt.receipt.status,
      externalRef: attempt.receipt.externalRef,
      receivedAt: attempt.receipt.receivedAt?.toISOString(),
      importedAt: attempt.receipt.importedAt?.toISOString(),
    } : undefined,
  };
}

/**
 * Delivery timeline steps (#26): stored and returned as an enum `key` the client localizes; the English
 * `state` text is kept alongside for older readers.
 */
export const DELIVERY_HISTORY_STATES = {
  package_ready: 'Package ready',
  queued: 'Queued',
  submitted: 'Submitted',
  delivered_awaiting_confirmation: 'Delivered (no receipt yet — awaiting confirmation)',
  received: 'Received',
  received_imported: 'Received / Imported',
} as const;
export type DeliveryHistoryKey = keyof typeof DELIVERY_HISTORY_STATES;

function appendHistory(value: unknown, key: DeliveryHistoryKey) {
  const history = Array.isArray(value) ? value : [];
  return [...history, { at: new Date().toISOString(), key, state: DELIVERY_HISTORY_STATES[key] }];
}

/** Entries written before keys existed only have the English `state`; recover their key from it. */
export function serializeHistory(value: unknown): Array<{ at: string; key: DeliveryHistoryKey | null; state: string }> {
  if (!Array.isArray(value)) return [];
  const byText = new Map(Object.entries(DELIVERY_HISTORY_STATES).map(([key, text]) => [text, key as DeliveryHistoryKey]));
  return value.map((entry: any) => ({
    at: entry.at,
    key: entry.key && entry.key in DELIVERY_HISTORY_STATES ? entry.key : byText.get(entry.state) ?? null,
    state: entry.state,
  }));
}

function redactRestricted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactRestricted);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'restricted' || key === 'restrictedReason') continue;
    result[key] = redactRestricted(child);
  }
  return result;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
