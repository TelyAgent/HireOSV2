import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type ScreeningBatchItem } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { ScreeningService } from './screening.service';

const startSchema = z.object({ idempotencyKey: z.string().trim().min(1).max(128), applicationIds: z.array(z.string().min(1)).min(1).max(200) }).strict();
const retrySchema = z.object({ idempotencyKey: z.string().trim().min(1).max(128) }).strict();
const LEASE_MS = 120000;
const statuses = ['queued', 'running', 'completed', 'failed', 'cancelled', 'unknown'] as const;

@Injectable()
export class ScreeningBatchesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScreeningBatchesService.name);
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  private readonly active = new Set<Promise<void>>();
  constructor(private readonly db: PrismaService, private readonly screening: ScreeningService) {}

  onModuleInit() {
    this.timer = setInterval(() => { void this.tick().catch(() => this.logger.warn('Batch polling failed; persisted work retained.')); }, 2000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async lockWorkspace(tx: Prisma.TransactionClient, workspaceId: string) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`screening-batch:${workspaceId}`}, 0))::text`;
  }

  async start(identity: Identity, jobId: string, body: unknown) {
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_BATCH_REQUEST' });
    const applicationIds = [...new Set(parsed.data.applicationIds)].sort();
    const requestHash = createHash('sha256').update(JSON.stringify({ jobId, actorId: identity.actorId, applicationIds })).digest('hex');
    // Repeatable read freezes one consistent set of inputs for every member.
    const batch = await this.db.$transaction(async tx => {
      const existing = await tx.screeningBatch.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId: identity.workspaceId, idempotencyKey: parsed.data.idempotencyKey } } });
      if (existing) {
        if (existing.requestHash !== requestHash) throw new ConflictException({ code: 'BATCH_IDEMPOTENCY_CONFLICT' });
        return existing;
      }
      const job = await tx.job.findFirst({ where: { id: jobId, workspaceId: identity.workspaceId } });
      if (!job) throw new NotFoundException({ code: 'JOB_NOT_FOUND' });
      const items: Array<{ workspaceId: string; applicationId: string; snapshot: Prisma.InputJsonValue }> = [];
      for (const applicationId of applicationIds) {
        const application = await tx.application.findFirst({ where: { id: applicationId, workspaceId: identity.workspaceId, jobId } });
        if (!application) throw new BadRequestException({ code: 'BATCH_MEMBER_NOT_IN_JOB' });
        items.push({ workspaceId: identity.workspaceId, applicationId, snapshot: await this.screening.captureBatchInput(identity, applicationId, tx) });
      }
      return tx.screeningBatch.create({ data: { workspaceId: identity.workspaceId, jobId, actorId: identity.actorId,
        idempotencyKey: parsed.data.idempotencyKey, requestHash, items: { create: items } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 }).catch(async error => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2002', 'P2034'].includes(error.code)) throw error;
      const saved = await this.db.screeningBatch.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId: identity.workspaceId, idempotencyKey: parsed.data.idempotencyKey } } });
      if (!saved || saved.requestHash !== requestHash) throw new ConflictException({ code: 'BATCH_IDEMPOTENCY_CONFLICT' });
      return saved;
    });
    return this.get(identity, batch.id);
  }

  async list(identity: Identity, jobId: string) {
    if (!await this.db.job.findFirst({ where: { id: jobId, workspaceId: identity.workspaceId } })) throw new NotFoundException({ code: 'JOB_NOT_FOUND' });
    const batches = await this.db.screeningBatch.findMany({ where: { workspaceId: identity.workspaceId, jobId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true } });
    return Promise.all(batches.map(batch => this.get(identity, batch.id)));
  }

  async get(identity: Identity, id: string) {
    const batch = await this.db.screeningBatch.findFirst({ where: { id, workspaceId: identity.workspaceId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    if (!batch) throw new NotFoundException({ code: 'BATCH_NOT_FOUND' });
    const counts = Object.fromEntries(statuses.map(status => [status, batch.items.filter(item => item.status === status).length]));
    return { id: batch.id, jobId: batch.jobId, actorId: batch.actorId, createdAt: batch.createdAt, cancelledAt: batch.cancelledAt, counts,
      items: batch.items.map(({ snapshot: _snapshot, retryKeys: _keys, leaseToken: _token, leaseUntil: _lease, workspaceId: _workspace, ...item }) => item) };
  }

  async cancel(identity: Identity, id: string) {
    await this.db.$transaction(async tx => {
      await this.lockWorkspace(tx, identity.workspaceId);
      const batch = await tx.screeningBatch.findFirst({ where: { id, workspaceId: identity.workspaceId } });
      if (!batch) throw new NotFoundException({ code: 'BATCH_NOT_FOUND' });
      if (!batch.cancelledAt) await tx.screeningBatch.update({ where: { id }, data: { cancelledAt: new Date() } });
      await tx.screeningBatchItem.updateMany({ where: { batchId: id, workspaceId: identity.workspaceId, status: 'queued' }, data: { status: 'cancelled', completedAt: new Date() } });
    });
    return this.get(identity, id);
  }

  async retry(identity: Identity, id: string, itemId: string, body: unknown) {
    const parsed = retrySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_RETRY_REQUEST' });
    await this.db.$transaction(async tx => {
      await this.lockWorkspace(tx, identity.workspaceId);
      const item = await tx.screeningBatchItem.findFirst({ where: { id: itemId, batchId: id, workspaceId: identity.workspaceId }, include: { batch: true } });
      if (!item) throw new NotFoundException({ code: 'BATCH_ITEM_NOT_FOUND' });
      const key = `${identity.actorId}:${parsed.data.idempotencyKey}`;
      if (item.retryKeys.includes(key)) return;
      if (item.status !== 'failed' || item.batch.cancelledAt) throw new ConflictException({ code: 'BATCH_ITEM_NOT_RETRYABLE' });
      await tx.screeningBatchItem.update({ where: { id: itemId }, data: { status: 'queued', errorCode: null, leaseToken: null, leaseUntil: null, completedAt: null, retryKeys: { push: key } } });
    });
    return this.get(identity, id);
  }

  async reconcile(identity: Identity, id: string) {
    await this.get(identity, id);
    await this.recover(identity.workspaceId);
    return this.get(identity, id);
  }

  async recover(workspaceId: string) {
    await this.db.$transaction(async tx => {
      await this.lockWorkspace(tx, workspaceId);
      await tx.screeningBatchItem.updateMany({ where: { workspaceId, status: 'running', leaseUntil: { lt: new Date() } }, data: { status: 'unknown', errorCode: 'EXECUTION_INTERRUPTED' } });
      const unknown = await tx.screeningBatchItem.findMany({ where: { workspaceId, status: 'unknown' } });
      for (const item of unknown) {
        const result = await tx.screeningEvaluation.findFirst({ where: { workspaceId, applicationId: item.applicationId, status: 'completed', inputManifest: { path: ['batchItemId'], equals: item.id } } });
        if (result) await tx.screeningBatchItem.update({ where: { id: item.id }, data: { status: 'completed', evaluationId: result.id, completedAt: result.completedAt, leaseUntil: null, errorCode: null } });
      }
    });
  }

  async claim(workspaceId: string) {
    return this.db.$transaction(async tx => {
      await this.lockWorkspace(tx, workspaceId);
      // Unknown calls retain capacity: releasing it could exceed the cap while a provider still works.
      const occupied = await tx.screeningBatchItem.count({ where: { workspaceId, status: { in: ['running', 'unknown'] } } });
      if (occupied >= 2) return null;
      const busy = await tx.screeningBatchItem.findMany({ where: { workspaceId, status: { in: ['running', 'unknown'] } }, select: { applicationId: true } });
      const item = await tx.screeningBatchItem.findFirst({ where: { workspaceId, applicationId: { notIn: busy.map(row => row.applicationId) }, status: 'queued', batch: { cancelledAt: null } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      if (!item) return null;
      return tx.screeningBatchItem.update({ where: { id: item.id }, data: { status: 'running', attempt: { increment: 1 }, leaseToken: randomUUID(), leaseUntil: new Date(Date.now() + LEASE_MS), startedAt: new Date() }, include: { batch: true } });
    });
  }

  async execute(item: ScreeningBatchItem & { batch: { actorId: string } }) {
    const identity: Identity = { workspaceId: item.workspaceId, actorId: item.batch.actorId, roles: [] };
    const heartbeat = setInterval(() => {
      void this.db.screeningBatchItem.updateMany({ where: { id: item.id, leaseToken: item.leaseToken, status: 'running' }, data: { leaseUntil: new Date(Date.now() + LEASE_MS) } })
        .catch(() => this.logger.warn('Batch heartbeat failed; work will remain unknown if interrupted.'));
    }, LEASE_MS / 3);
    heartbeat.unref();
    try {
      await this.screening.runBatchInput(identity, item.snapshot, item.id, item.leaseToken!);
    } catch (error) {
      const response = error && typeof error === 'object' && 'getResponse' in error ? (error as { getResponse(): unknown }).getResponse() as { code?: string; message?: string } : {};
      const detail = response.message ?? '';
      const known = response.code === 'BATCH_EVALUATOR_CHANGED' || /^AI_(HTTP_4\d\d|HTTP_5\d\d|INVALID_JSON|SCHEMA_MISMATCH|EMPTY_RESPONSE|TRUNCATED_BEFORE_OUTPUT|INVALID_RESPONSE_BODY)/.test(detail);
      // Never expose provider response bodies (which may contain sensitive input) in progress APIs.
      await this.db.screeningBatchItem.updateMany({ where: { id: item.id, leaseToken: item.leaseToken, status: { in: ['running', 'unknown'] } },
        data: { status: known ? 'failed' : 'unknown', errorCode: known ? (response.code === 'BATCH_EVALUATOR_CHANGED' ? response.code : 'EVALUATION_FAILED') : 'RESULT_UNKNOWN', completedAt: known ? new Date() : null, leaseUntil: null } });
    } finally { clearInterval(heartbeat); }
  }

  async tick() {
    if (this.ticking || this.active.size >= 8) return;
    this.ticking = true;
    try {
      const workspaces = await this.db.screeningBatchItem.findMany({ where: { status: { in: ['queued', 'running', 'unknown'] } }, distinct: ['workspaceId'], select: { workspaceId: true }, take: 100 });
      for (const { workspaceId } of workspaces) {
        await this.recover(workspaceId);
        for (let n = 0; n < 2 && this.active.size < 8; n++) {
          const item = await this.claim(workspaceId);
          if (!item) break;
          const execution = this.execute(item).catch(() => this.logger.warn('Batch execution persistence failed; recovery will mark it unknown.'));
          this.active.add(execution);
          void execution.finally(() => this.active.delete(execution));
        }
      }
    } finally { this.ticking = false; }
  }
}
