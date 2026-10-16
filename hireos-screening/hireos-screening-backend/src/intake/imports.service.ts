import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { currentContact } from '../duplicates/current-contact';
import { IDENTITY_POLICY, scoreIdentity, type ExistingSide, type IdentityScore } from '../duplicates/identity-scoring';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { decodeOriginalFileName, MaterialsService } from './materials.service';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { CoreRecordClient } from '../core-record/core-record.client';
import type { ImportChannel } from './imports.types';
import { confirmedIdentityOf, pasteImportSchema, pastePreviewSchema, type ConfirmedIdentity } from './confirmed-identity';
import { invalidSchemaFromZod } from '../http/invalid-schema';
import { splitText } from './materials.service';
import { ProfilesService } from '../profiles/profiles.service';
import { AUTO_MATCH_JOB } from '../discovery/discovery.service';

type MulterFile = Express.Multer.File;

type JobMatchProgress = {
  stage: 'parsing' | 'matching' | 'done';
  result?: 'matched' | 'no_match' | 'already_linked' | 'job_not_open' | 'criteria_not_confirmed' | 'not_evaluated' | 'parse_failed' | 'match_failed';
  score?: number;
  confidence?: number;
  recommendationStatus?: string;
};

const TERMINAL_ITEM_STATUSES = new Set(['completed', 'duplicate', 'needs_review', 'failed', 'cancelled']);
const RETRYABLE_ITEM_STATUSES = new Set(['failed']);
const CANDIDATE_CREATION_JOB = 'import_candidate_creation';
const CANDIDATE_CREATION_LEASE_MS = 60_000;

type CandidateCreationJobInput = {
  operationId: string;
  batchId: string;
  itemId: string;
  channel: ImportChannel;
  actorId: string;
};

@Injectable()
export class ImportsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof globalThis.setInterval>;
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly materials: MaterialsService,
    private readonly profiles: ProfilesService,
    private readonly coreRecord: CoreRecordClient,
  ) {}

  onModuleInit() {
    this.timer = globalThis.setInterval(() => void this.processQueuedCandidateJobs(), 250);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) globalThis.clearInterval(this.timer);
  }

  async createBatch(
    identity: Identity,
    files: MulterFile[],
    channel: ImportChannel = 'manual_upload',
    idempotencyKey?: string,
    targetJobId?: string,
    confirmed?: ConfirmedIdentity,
  ) {
    if (!files?.length) throw new NotFoundException({ code: 'NO_FILES' });
    if (targetJobId) {
      const job = await this.db.job.findFirst({ where: { id: targetJobId, workspaceId: identity.workspaceId }, select: { id: true } });
      if (!job) throw new BadRequestException({ code: 'JOB_NOT_FOUND' });
    }

    if (idempotencyKey) {
      const existing = await this.db.ingestionOperation.findFirst({
        where: { workspaceId: identity.workspaceId, idempotencyKey },
        include: { batch: true },
      });
      if (existing?.batch) return this.getBatch(identity.workspaceId, existing.batch.id);
    }

    const operation = await this.db.ingestionOperation.create({
      data: {
        workspaceId: identity.workspaceId,
        kind: 'resume_import',
        createdBy: identity.actorId,
        idempotencyKey,
        batch: { create: { workspaceId: identity.workspaceId, createdBy: identity.actorId, targetJobId } },
      },
      include: { batch: true },
    });
    const batch = operation.batch;
    if (!batch) throw new BadRequestException({ code: 'BATCH_CREATE_FAILED' });

    await this.recordActivity({
      workspaceId: identity.workspaceId,
      actorId: identity.actorId,
      operationId: operation.id,
      importBatchId: batch.id,
      action: 'import_batch_created',
      stage: 'received',
      status: 'processing',
      metadata: { channel, fileCount: files.length, ...(targetJobId ? { targetJobId } : {}) },
    });

    for (const file of files) {
      const item = await this.db.importItem.create({
        data: {
          batchId: batch.id,
          workspaceId: identity.workspaceId,
          fileName: decodeOriginalFileName(file.originalname),
          sizeKB: Math.max(1, Math.round(file.size / 1024)),
          outcome: 'received',
          stage: 'received',
          status: 'processing',
          attemptCount: 1,
          lastAttemptAt: new Date(),
        },
      });
      await this.processOne(identity, operation.id, batch.id, item.id, file, channel, confirmed);
    }

    return this.finalizeBatch(identity.workspaceId, identity.actorId, operation.id, batch.id);
  }

  /**
   * "Paste profile", step 1 (#167): what the text says about who this is, for the user to confirm or correct
   * before anything is saved. Read by rules, not AI, and never invented: no name line means no name — an email
   * address is not a name (#160).
   */
  previewPaste(raw: unknown) {
    const input = pastePreviewSchema.safeParse(raw);
    if (!input.success) throw invalidSchemaFromZod(input.error);
    const segments = splitText(input.data.text).map((segment, index) => ({ ...segment, id: `s${index + 1}` }));
    const signals = this.profiles.extractIdentitySignals('paste-preview', segments, '');
    return { displayName: signals.displayName || null, email: signals.email || null, location: signals.location || null };
  }

  /**
   * "Paste profile", step 2 (#160 #161 #167): import the text with the identity the user confirmed. The name is
   * required here too, so a request that skips the form can't create a nameless candidate; the source is
   * recorded as a paste, not a manual upload.
   */
  async importPaste(identity: Identity, raw: unknown, idempotencyKey?: string, targetJobId?: string) {
    const input = pasteImportSchema.safeParse(raw);
    if (!input.success) throw invalidSchemaFromZod(input.error);
    const { text, displayName, email, location } = input.data;
    const buffer = Buffer.from(text, 'utf-8');
    const safeName = displayName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'pasted-resume';
    const file = {
      // Multer reads multipart file names as latin1; materials decode them back, so encode the same way.
      originalname: Buffer.from(`${safeName}.txt`, 'utf8').toString('latin1'),
      mimetype: 'text/plain',
      size: buffer.length,
      buffer,
    } as MulterFile;
    // A field the user cleared is null — they said there is none, so what parsing reads doesn't come back; one
    // not sent at all (older clients) leaves parsing to fill it in.
    const confirmed: ConfirmedIdentity = {
      displayName,
      ...(email !== undefined ? { email: email || null } : {}),
      ...(location !== undefined ? { location: location || null } : {}),
    };
    return this.createBatch(identity, [file], 'paste', idempotencyKey, targetJobId, confirmed);
  }

  async getBatch(workspaceId: string, id: string) {
    const batch = await this.db.importBatch.findFirst({
      where: { id, workspaceId },
      include: { items: { orderBy: { createdAt: 'asc' } }, operation: true },
    });
    if (!batch) throw new NotFoundException({ code: 'NOT_FOUND' });
    const progress = batch.targetJobId ? await this.jobMatchProgress(workspaceId, batch.targetJobId, batch.items) : undefined;
    // How each flagged item's email and phone compare with the existing candidate's, so the result says what
    // actually matched or differs (#154) — the same comparison the review page shows.
    const reviewIds = batch.items.map((item) => item.duplicateReviewId).filter((id): id is string => !!id);
    const checks = reviewIds.length
      ? await this.db.duplicateCheck.findMany({ where: { workspaceId, id: { in: reviewIds } }, select: { id: true, basis: true } })
      : [];
    const contactOf = new Map(checks.map((check) => [check.id, (check.basis as { contact?: unknown } | null)?.contact ?? undefined]));
    // An identical file names the candidate it already belongs to (#153).
    const reusedIds = [...new Set(batch.items.filter((item) => item.outcome === 'exact_file' && item.candidateId).map((item) => item.candidateId!))];
    const reused = reusedIds.length
      ? await this.db.candidate.findMany({ where: { workspaceId, id: { in: reusedIds } }, select: { id: true, displayName: true } })
      : [];
    const nameOf = new Map(reused.map((candidate) => [candidate.id, candidate.displayName]));
    return {
      id: batch.id,
      operationId: batch.operationId ?? undefined,
      createdAt: batch.createdAt.toISOString(),
      status: batch.status,
      targetJobId: batch.targetJobId ?? undefined,
      items: batch.items.map((item) => ({
        ...serializeItem(item),
        jobMatch: progress?.get(item.id),
        duplicateContact: item.duplicateReviewId ? contactOf.get(item.duplicateReviewId) : undefined,
        existingCandidate: item.outcome === 'exact_file' && item.candidateId && nameOf.has(item.candidateId)
          ? { id: item.candidateId, displayName: nameOf.get(item.candidateId)! }
          : undefined,
      })),
    };
  }

  /**
   * For a batch imported from a job's screening workspace: how far each resume has got past
   * intake -- profile parse, then auto-match against that job -- and the match outcome. The
   * batch itself settles once candidates exist; parse and match keep running after that.
   */
  private async jobMatchProgress(
    workspaceId: string,
    jobId: string,
    items: Array<{ id: string; candidateId: string | null; createdAt: Date }>,
  ) {
    const result = new Map<string, JobMatchProgress>();
    const withCandidate = items.filter((item): item is typeof item & { candidateId: string } => Boolean(item.candidateId));
    if (!withCandidate.length) return result;
    const candidateIds = [...new Set(withCandidate.map((item) => item.candidateId))];
    const since = new Date(Math.min(...withCandidate.map((item) => item.createdAt.getTime())));
    const [jobs, evaluations, recommendations, applications, job] = await Promise.all([
      this.db.processingJob.findMany({
        where: { workspaceId, candidateId: { in: candidateIds }, type: { in: ['resume_parse', AUTO_MATCH_JOB] }, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: { candidateId: true, type: true, status: true, createdAt: true },
      }),
      this.db.preLinkMatchEvaluation.findMany({
        where: { workspaceId, jobId, candidateId: { in: candidateIds }, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, candidateId: true, status: true, overallScore: true, createdAt: true },
      }),
      this.db.candidateJobRecommendation.findMany({
        where: { workspaceId, jobId, candidateId: { in: candidateIds } },
        select: { prelinkEvaluationId: true, status: true, confidence: true },
      }),
      this.db.application.findMany({ where: { workspaceId, jobId, candidateId: { in: candidateIds } }, select: { candidateId: true } }),
      this.db.job.findFirst({
        where: { id: jobId, workspaceId },
        select: { status: true, criteriaVersions: { where: { status: 'confirmed' }, take: 1, select: { id: true } } },
      }),
    ]);
    const linked = new Set(applications.map((a) => a.candidateId));
    const recByEvaluation = new Map(recommendations.map((r) => [r.prelinkEvaluationId, r]));

    for (const item of withCandidate) {
      const after = (at: Date, bound: Date) => at.getTime() >= bound.getTime();
      const parse = jobs.find((j) => j.candidateId === item.candidateId && j.type === 'resume_parse' && after(j.createdAt, item.createdAt));
      if (!parse || parse.status === 'queued' || parse.status === 'running') {
        result.set(item.id, { stage: 'parsing' });
        continue;
      }
      if (parse.status !== 'succeeded') {
        result.set(item.id, { stage: 'done', result: 'parse_failed' });
        continue;
      }
      const match = jobs.find((j) => j.candidateId === item.candidateId && j.type === AUTO_MATCH_JOB && after(j.createdAt, parse.createdAt));
      if (!match || match.status === 'queued' || match.status === 'running') {
        result.set(item.id, { stage: 'matching' });
        continue;
      }
      if (match.status !== 'succeeded') {
        result.set(item.id, { stage: 'done', result: 'match_failed' });
        continue;
      }
      const evaluation = evaluations.find((e) => e.candidateId === item.candidateId && after(e.createdAt, match.createdAt));
      if (evaluation) {
        const rec = recByEvaluation.get(evaluation.id);
        result.set(item.id, {
          stage: 'done',
          result: evaluation.status === 'no_match' ? 'no_match' : 'matched',
          score: evaluation.overallScore ?? undefined,
          confidence: rec?.confidence,
          recommendationStatus: rec?.status,
        });
        continue;
      }
      // Matching finished without evaluating this job -- say why instead of a bare "no result".
      const reason = linked.has(item.candidateId)
        ? 'already_linked'
        : !job || job.status !== 'open'
          ? 'job_not_open'
          : !job.criteriaVersions.length
            ? 'criteria_not_confirmed'
            : 'not_evaluated';
      result.set(item.id, { stage: 'done', result: reason });
    }
    return result;
  }

  async retryBatch(identity: Identity, id: string) {
    const batch = await this.db.importBatch.findFirst({
      where: { id, workspaceId: identity.workspaceId },
      include: { items: true },
    });
    if (!batch) throw new NotFoundException({ code: 'NOT_FOUND' });
    const retryable = batch.items.filter((item) => RETRYABLE_ITEM_STATUSES.has(item.status) && item.retryable && item.materialId);
    if (!retryable.length) throw new BadRequestException({ code: 'NO_RETRYABLE_ITEMS' });
    for (const item of retryable) await this.retryItem(identity, item.id);
    return this.finalizeBatch(identity.workspaceId, identity.actorId, batch.operationId || '', batch.id);
  }

  async retryItem(identity: Identity, id: string) {
    const item = await this.db.importItem.findFirst({
      where: { id, workspaceId: identity.workspaceId },
      include: { batch: true, material: true },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!RETRYABLE_ITEM_STATUSES.has(item.status) || !item.retryable || !item.material) {
      throw new BadRequestException({ code: 'ITEM_NOT_RETRYABLE', status: item.status });
    }
    const operationId = item.batch.operationId;
    if (!operationId) throw new BadRequestException({ code: 'OPERATION_NOT_FOUND' });
    await this.db.importItem.update({
      where: { id: item.id },
      data: {
        status: 'processing',
        stage: 'candidate_creation',
        outcome: 'retrying',
        errorCode: null,
        errorMessage: null,
        retryable: false,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        completedAt: null,
      },
    });
    await this.enqueueCandidateCreation(identity, operationId, item.batchId, item.id, item.material, 'manual_upload');
    return this.getBatch(identity.workspaceId, item.batchId);
  }

  async cancelBatch(identity: Identity, id: string) {
    const batch = await this.db.importBatch.findFirst({
      where: { id, workspaceId: identity.workspaceId },
    });
    if (!batch) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.db.$transaction([
      this.db.importItem.updateMany({
        where: { batchId: id, workspaceId: identity.workspaceId, status: 'processing' },
        data: { status: 'cancelled', outcome: 'cancelled', completedAt: new Date(), retryable: false },
      }),
      this.db.importBatch.update({ where: { id }, data: { status: 'cancelled' } }),
      ...(batch.operationId ? [
        this.db.ingestionOperation.update({
          where: { id: batch.operationId },
          data: { status: 'cancelled', completedAt: new Date() },
        }),
      ] : []),
    ]);
    await this.recordActivity({
      workspaceId: identity.workspaceId,
      actorId: identity.actorId,
      operationId: batch.operationId ?? undefined,
      importBatchId: batch.id,
      action: 'import_batch_cancelled',
      stage: 'cancelled',
      status: 'cancelled',
      metadata: {},
    });
    return this.getBatch(identity.workspaceId, id);
  }

  async activity(workspaceId: string, batchId: string) {
    const batch = await this.db.importBatch.findFirst({ where: { id: batchId, workspaceId } });
    if (!batch) throw new NotFoundException({ code: 'NOT_FOUND' });
    const events = await this.db.activityEvent.findMany({
      where: { workspaceId, importBatchId: batchId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return events.map((event) => ({
      id: event.id,
      action: event.action,
      stage: event.stage,
      status: event.status,
      actorId: event.actorId,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  private async processOne(
    identity: Identity,
    operationId: string,
    batchId: string,
    itemId: string,
    file: MulterFile,
    channel: ImportChannel,
    confirmed?: ConfirmedIdentity,
  ) {
    try {
      await this.updateItem(identity, operationId, batchId, itemId, { stage: 'validating', outcome: 'validating' });
      const saved = await this.materials.saveUpload(identity, file, channel, confirmed);
      await this.processSavedMaterial(identity, operationId, batchId, itemId, saved, channel);
    } catch (error) {
      await this.failItem(identity, operationId, batchId, itemId, error);
    }
  }

  private async enqueueCandidateCreation(
    identity: Identity,
    operationId: string,
    batchId: string,
    itemId: string,
    material: Prisma.MaterialGetPayload<{}>,
    channel: ImportChannel,
  ) {
    const input: CandidateCreationJobInput = { operationId, batchId, itemId, channel, actorId: identity.actorId };
    await this.db.processingJob.create({
      data: {
        workspaceId: identity.workspaceId,
        materialId: material.id,
        type: CANDIDATE_CREATION_JOB,
        input,
      },
    });
  }

  private async processQueuedCandidateJobs() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const job = await this.db.processingJob.findFirst({
        where: {
          type: CANDIDATE_CREATION_JOB,
          OR: [
            { status: 'queued', nextRunAt: { lte: now } },
            // Reclaim jobs whose worker died mid-flight: the lease expired without the
            // job ever reaching a terminal status, so it is safe to run again.
            { status: 'running', leaseUntil: { lt: now } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!job) return;
      const leaseToken = randomUUID();
      const claimed = await this.db.processingJob.updateMany({
        where: { id: job.id, status: job.status },
        data: {
          status: 'running',
          attempt: { increment: 1 },
          leaseToken,
          leaseUntil: new Date(Date.now() + CANDIDATE_CREATION_LEASE_MS),
        },
      });
      if (claimed.count !== 1) return;
      await this.processClaimedCandidateJob(job.id, leaseToken);
    } finally {
      this.running = false;
    }
  }

  private async processClaimedCandidateJob(jobId: string, leaseToken: string) {
    const job = await this.db.processingJob.findFirst({ where: { id: jobId, leaseToken } });
    if (!job || !job.materialId) return;
    const input = job.input as unknown as CandidateCreationJobInput;

    // The batch or item may have been cancelled while this job sat in the queue. Honor
    // that instead of resurrecting a cancelled item by writing a candidate into it.
    const currentItem = await this.db.importItem.findUnique({ where: { id: input.itemId }, select: { status: true } });
    if (!currentItem || currentItem.status === 'cancelled') {
      await this.db.processingJob.update({
        where: { id: job.id },
        data: { status: 'cancelled', leaseToken: null, leaseUntil: null },
      });
      return;
    }

    const identity: Identity = { workspaceId: job.workspaceId, actorId: input.actorId, roles: [] };
    const attempt = await this.db.ingestionAttempt.create({
      data: {
        operationId: input.operationId,
        importItemId: input.itemId,
        workspaceId: job.workspaceId,
        stage: 'candidate_creation',
        status: 'running',
        attempt: job.attempt,
      },
    });
    try {
      const material = await this.db.material.findUniqueOrThrow({ where: { id: job.materialId } });
      const candidate = await this.createCandidateFromMaterial(identity, material.id, material.name, input.channel, material.coreMaterialId, confirmedIdentityOf(material));
      const batch = await this.db.importBatch.findUnique({ where: { id: input.batchId }, select: { targetJobId: true } });
      await this.profiles.enqueue(job.workspaceId, candidate.id, candidate.resumeVersionId, material.id, batch?.targetJobId ?? undefined);
      await this.updateItem(identity, input.operationId, input.batchId, input.itemId, {
        stage: 'profile_processing',
        status: 'completed',
        outcome: 'new_candidate',
        candidateId: candidate.id,
        businessConsumeStatus: 'completed',
        completedAt: new Date(),
      });
      await this.db.processingJob.update({
        where: { id: job.id },
        data: { status: 'succeeded', result: { candidateId: candidate.id }, leaseToken: null, leaseUntil: null },
      });
      await this.db.ingestionAttempt.update({ where: { id: attempt.id }, data: { status: 'succeeded', finishedAt: new Date() } });
    } catch (error) {
      const { code, message, retryable } = errorDetails(error);
      await this.updateItem(identity, input.operationId, input.batchId, input.itemId, {
        stage: 'failed',
        status: 'failed',
        outcome: code,
        errorCode: code,
        errorMessage: message,
        retryable,
        businessConsumeStatus: 'failed',
        completedAt: new Date(),
      });
      await this.db.processingJob.update({
        where: { id: job.id },
        data: { status: 'failed', errorCode: code, leaseToken: null, leaseUntil: null },
      });
      await this.db.ingestionAttempt.update({ where: { id: attempt.id }, data: { status: 'failed', errorCode: code, finishedAt: new Date() } });
    }
    await this.finalizeBatch(job.workspaceId, input.actorId, input.operationId, input.batchId);
  }

  private async processSavedMaterial(
    identity: Identity,
    operationId: string,
    batchId: string,
    itemId: string,
    saved: Awaited<ReturnType<MaterialsService['saveUpload']>>,
    channel: ImportChannel,
  ) {
    if (saved.kind === 'exact_file') {
      // The same file is already someone's résumé: this upload is recorded as another source of that candidate
      // and the result points at them (#153). Nothing new is created — no candidate, version or analysis.
      const owner = await this.db.resumeVersion.findUnique({ where: { materialId: saved.material.id }, select: { candidateId: true } });
      await this.db.candidateSource.create({
        data: { workspaceId: identity.workspaceId, materialId: saved.material.id, candidateId: owner?.candidateId ?? null, channel, receivedAt: new Date() },
      });
      await this.updateItem(identity, operationId, batchId, itemId, {
        materialId: saved.material.id,
        duplicateOfMaterialId: saved.material.id,
        candidateId: owner?.candidateId ?? null,
        stage: 'duplicate',
        status: 'duplicate',
        outcome: 'exact_file',
        businessConsumeStatus: 'skipped',
        completedAt: new Date(),
      });
      return;
    }

    const material = saved.material;
    if (material.securityStatus === 'quarantined') {
      await this.updateItem(identity, operationId, batchId, itemId, {
        materialId: material.id,
        stage: 'quarantined',
        status: 'failed',
        outcome: 'quarantined',
        errorCode: material.errorCode || 'SECURITY_QUARANTINED',
        retryable: false,
        businessConsumeStatus: 'failed',
        completedAt: new Date(),
      });
      return;
    }
    if (material.readStatus !== 'available') {
      await this.updateItem(identity, operationId, batchId, itemId, {
        materialId: material.id,
        stage: 'extracting',
        status: 'failed',
        outcome: 'parse_failed',
        errorCode: material.errorCode || 'SOURCE_MATERIAL_NOT_READY',
        retryable: false,
        businessConsumeStatus: 'failed',
        completedAt: new Date(),
      });
      return;
    }

    const parsedSignals = this.profiles.extractIdentitySignals(material.id, material.segments, displayNameFromFileName(material.name));
    // What the user confirmed on a paste is the identity checked for duplicates, not a guess from the text.
    const confirmedSignals = confirmedIdentityOf(material);
    const signals = confirmedSignals
      ? { ...parsedSignals, displayName: confirmedSignals.displayName, email: confirmedSignals.email === undefined ? parsedSignals.email : (confirmedSignals.email ?? null) }
      : parsedSignals;
    const match = await this.findPossibleDuplicate(identity.workspaceId, material, signals);
    if (match) {
      const duplicate = await this.db.$transaction(async (tx) => {
        const check = await tx.duplicateCheck.create({
          data: {
            workspaceId: identity.workspaceId,
            materialId: material.id,
            kind: match.kind,
            existingCandidateId: match.candidate.id,
            confidence: match.confidence,
            basis: match.basis as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.candidateSource.create({
          data: { workspaceId: identity.workspaceId, materialId: material.id, channel, receivedAt: new Date() },
        });
        await tx.humanTask.create({
          data: {
            workspaceId: identity.workspaceId,
            sourceModule: 'Resume Library',
            taskType: 'duplicate_review',
            title: `Review possible duplicate: ${signals.displayName}`,
            subjectLabel: 'Confirm candidate identity before importing this resume.',
            requiredAction: 'Choose same person, different person, reuse file, or defer.',
            completionRule: { requiredResultType: 'duplicate_resolution' },
            candidateId: match.candidate.id,
            materialId: material.id,
            duplicateReviewId: check.id,
            // Single-operator dev setup: whoever uploaded the file is the only person who
            // could review it, so hand it straight to them instead of parking it in an
            // unclaimed queue nobody else will ever pick up. Once real multi-user accounts
            // exist, this should go back to an unassigned queue for the right reviewer.
            assigneeId: identity.actorId,
            queue: null,
            // Confidence drives urgency: a strong signal (matched email/phone/identical
            // text) is worth a human's attention sooner than a weak name-only guess.
            priority: match.kind === 'possible_same_person' ? 'normal' : 'high',
            linkRoute: `/duplicates/${check.id}`,
          },
        });
        return check;
      });
      await this.updateItem(identity, operationId, batchId, itemId, {
        materialId: material.id,
        stage: 'needs_identity_review',
        status: 'needs_review',
        outcome: match.kind,
        duplicateReviewId: duplicate.id,
        businessConsumeStatus: 'pending',
        completedAt: new Date(),
      });
      return;
    }

    // Candidate creation makes a network call to the Core Record service. That call must
    // not block the upload request, and a transient failure there must not strand the
    // item -- so this step hands off to the durable job queue (same lease/retry pattern
    // ProfilesService uses for resume parsing) instead of running inline.
    await this.updateItem(identity, operationId, batchId, itemId, {
      materialId: material.id,
      stage: 'candidate_creation',
      status: 'processing',
      outcome: 'creating_candidate',
      businessConsumeStatus: 'pending',
    });
    await this.enqueueCandidateCreation(identity, operationId, batchId, itemId, material, channel);
  }

  private async updateItem(
    identity: Identity,
    operationId: string,
    batchId: string,
    itemId: string,
    data: Prisma.ImportItemUncheckedUpdateInput,
  ) {
    const item = await this.db.importItem.update({ where: { id: itemId }, data });
    await this.recordActivity({
      workspaceId: identity.workspaceId,
      actorId: identity.actorId,
      operationId,
      importBatchId: batchId,
      importItemId: itemId,
      materialId: item.materialId ?? undefined,
      candidateId: item.candidateId ?? undefined,
      action: 'import_item_updated',
      stage: item.stage,
      status: item.status,
      metadata: { outcome: item.outcome, errorCode: item.errorCode },
    });
    return item;
  }

  private async failItem(identity: Identity, operationId: string, batchId: string, itemId: string, error: unknown) {
    const { code, message, retryable } = errorDetails(error);
    await this.updateItem(identity, operationId, batchId, itemId, {
      stage: 'failed',
      status: 'failed',
      outcome: code,
      errorCode: code,
      errorMessage: message,
      retryable,
      businessConsumeStatus: 'failed',
      completedAt: new Date(),
    });
  }

  // Public on purpose: anything that changes an ImportItem's status outside this service's
  // own flow (e.g. a duplicate review being resolved) must re-run this so the batch's
  // rolled-up status doesn't go stale.
  async finalizeBatch(workspaceId: string, actorId: string, operationId: string, batchId: string) {
    const items = await this.db.importItem.findMany({ where: { batchId, workspaceId } });
    const hasProcessing = items.some((item) => !TERMINAL_ITEM_STATUSES.has(item.status));
    const hasFailure = items.some((item) => item.status === 'failed');
    const hasReview = items.some((item) => item.status === 'needs_review');
    const status = hasProcessing ? 'processing' : hasFailure || hasReview ? 'partial' : 'completed';
    await this.db.importBatch.update({ where: { id: batchId }, data: { status } });
    if (operationId) {
      await this.db.ingestionOperation.update({
        where: { id: operationId },
        data: { status, ...(status !== 'processing' ? { completedAt: new Date() } : {}) },
      });
    }
    await this.recordActivity({
      workspaceId,
      actorId,
      operationId: operationId || undefined,
      importBatchId: batchId,
      action: 'import_batch_updated',
      stage: status === 'processing' ? 'processing' : 'completed',
      status,
      metadata: { itemCount: items.length },
    });
    return this.getBatch(workspaceId, batchId);
  }

  private async recordActivity(input: {
    workspaceId: string;
    actorId: string;
    operationId?: string;
    importBatchId?: string;
    importItemId?: string;
    materialId?: string;
    candidateId?: string;
    action: string;
    stage?: string;
    status?: string;
    metadata: Prisma.InputJsonValue;
  }) {
    await this.db.activityEvent.create({ data: input });
  }

  private async createCandidateFromMaterial(
    identity: Identity,
    materialId: string,
    fileName: string,
    channel: ImportChannel,
    coreMaterialId?: string | null,
    confirmed?: ConfirmedIdentity | null,
  ) {
    const displayName = confirmed?.displayName || displayNameFromFileName(fileName);
    // A file already stored in Core Record resolves to the candidate other subsystems linked to
    // it (Interview/Written may have seen this résumé first), so one person stays one Core
    // candidate. Screening has already turned away an identical file as a duplicate before
    // reaching here, so a reused Core id is never one this service has a local row for.
    const coreCandidate = coreMaterialId
      ? await this.coreRecord.resolveCandidateForMaterial(identity, { materialId: coreMaterialId, displayName, source: channel })
      : await this.coreRecord.createCandidate(
        identity,
        { displayName, source: channel },
        `screening:candidate:material:${identity.workspaceId}:${materialId}`,
      );
    return this.db.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: {
          ...(coreCandidate?.id ? { id: coreCandidate.id } : {}),
          workspaceId: identity.workspaceId,
          displayName,
          ...(confirmed?.email ? { email: confirmed.email } : {}),
          ownerId: identity.actorId,
        },
      });
      await tx.libraryEntry.create({ data: { workspaceId: identity.workspaceId, candidateId: candidate.id, ownerId: identity.actorId } });
      const resumeVersion = await tx.resumeVersion.create({
        data: { workspaceId: identity.workspaceId, candidateId: candidate.id, materialId, version: 1, source: channel, parseStatus: 'pending' },
      });
      await tx.candidateSource.create({
        data: { workspaceId: identity.workspaceId, candidateId: candidate.id, materialId, channel, receivedAt: new Date() },
      });
      await tx.auditRecord.create({
        data: {
          workspaceId: identity.workspaceId,
          actorId: identity.actorId,
          action: 'candidate_imported',
          objectType: 'Candidate',
          objectId: candidate.id,
          payload: { materialId, channel },
        },
      });
      return { id: candidate.id, resumeVersionId: resumeVersion.id };
    });
  }

  /**
   * Who on record this upload might be (F03 §4.1–4.2, #151). Candidates are gathered by any identity signal —
   * same text, email, phone or a same / near name — and each is scored on every signal; the best score decides
   * the band. A check is a prompt for a person: nothing here ever merges a candidate.
   */
  private async findPossibleDuplicate(
    workspaceId: string,
    material: { id: string; name: string; normalizedTextHash: string | null; text?: string | null },
    signals: { displayName: string; email: string | null; phone: string | null },
  ): Promise<DuplicateMatch | null> {
    const uploadedText = material.text ?? (await this.db.material.findUnique({ where: { id: material.id }, select: { text: true } }))?.text ?? '';
    // Every candidate in the workspace is scored, not just those an email, phone or name points at: similar
    // content, shared jobs and the same education reach the review band on their own (#151 review). Read in
    // pages so a large library isn't loaded at once.
    let best: DuplicateMatch | null = null;
    for (let cursor: string | undefined; ;) {
      const page = await this.db.candidate.findMany({
        where: { workspaceId },
        orderBy: { id: 'asc' },
        take: DUPLICATE_SCAN_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true, displayName: true, email: true, phone: true,
          profiles: { orderBy: { version: 'desc' }, take: 1, select: { employmentHistory: true, education: true, contact: true } },
          resumeVersions: { where: { isLatest: true }, take: 1, select: { material: { select: { id: true, text: true } } } },
        },
      });
      for (const candidate of page) {
        // The upload itself, once linked (a retried item), is not its own duplicate.
        if (candidate.resumeVersions[0]?.material.id === material.id) continue;
        const profile = candidate.profiles[0];
        // The contact the latest version gives, as the candidate page shows it — not the record's first values.
        const contact = currentContact(candidate, profile);
        const score = scoreIdentity(
          { name: signals.displayName, email: signals.email, phone: signals.phone, text: uploadedText },
          {
            name: candidate.displayName, email: contact.email, phone: contact.phone,
            text: candidate.resumeVersions[0]?.material.text ?? null,
            employment: Array.isArray(profile?.employmentHistory) ? (profile.employmentHistory as ExistingSide['employment']) : [],
            education: Array.isArray(profile?.education) ? (profile.education as ExistingSide['education']) : [],
          },
        );
        // CNT-4: the same content in another format is its own finding, whatever the identity score.
        const sameContent = score.contentSimilarity != null && score.contentSimilarity >= IDENTITY_POLICY.content.same;
        const kind = sameContent ? 'same_content' : score.band;
        if (kind === 'none') continue;
        const rank = sameContent ? 101 : score.total;
        if (!best || rank > best.rank) {
          best = { candidate: { id: candidate.id, displayName: candidate.displayName }, kind, confidence: score.total / 100, basis: toBasis(score, kind), rank };
        }
      }
      if (page.length < DUPLICATE_SCAN_PAGE) break;
      cursor = page[page.length - 1].id;
    }
    return best;
  }
}

/** Candidates read per query while looking for a duplicate. */
const DUPLICATE_SCAN_PAGE = 100;

type DuplicateMatch = {
  candidate: { id: string; displayName: string };
  kind: 'same_content' | 'new_resume_version' | 'possible_same_person';
  confidence: number;
  basis: DuplicateBasis;
  rank: number;
};

/** What a check stores: the score breakdown, its policy version, and readable lines for the review. */
export type DuplicateBasis = IdentityScore & { kind: DuplicateMatch['kind']; lines: string[] };

function toBasis(score: IdentityScore, kind: DuplicateMatch['kind']): DuplicateBasis {
  const lines = score.signals.map((signal) => `${signal.detail} (${signal.points > 0 ? '+' : ''}${signal.points})`);
  if (kind === 'same_content') lines.unshift(`Same résumé content in another format (${Math.round((score.contentSimilarity ?? 1) * 100)}% similar)`);
  return { ...score, kind, lines };
}

function serializeItem(item: {
  id: string;
  fileName: string;
  sizeKB: number;
  outcome: string;
  stage: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  attemptCount: number;
  completedAt: Date | null;
  materialId: string | null;
  duplicateOfMaterialId: string | null;
  candidateId: string | null;
  duplicateReviewId: string | null;
  businessConsumeStatus: string;
}) {
  return {
    id: item.id,
    fileName: item.fileName,
    sizeKB: item.sizeKB,
    outcome: item.outcome,
    stage: item.stage,
    status: item.status,
    errorCode: item.errorCode ?? undefined,
    errorMessage: item.errorMessage ?? undefined,
    retryable: item.retryable,
    attemptCount: item.attemptCount,
    completedAt: item.completedAt?.toISOString(),
    materialId: item.materialId ?? undefined,
    duplicateOfMaterialId: item.duplicateOfMaterialId ?? undefined,
    candidateId: item.candidateId ?? undefined,
    duplicateReviewId: item.duplicateReviewId ?? undefined,
    businessConsumeStatus: item.businessConsumeStatus,
  };
}

// Codes below describe the file itself (wrong type, too large, empty). Re-running the
// same upload can never succeed, so these must never be marked retryable; the user has
// to supply a different file instead. Anything else is treated as a transient/operational
// failure (DB hiccup, downstream service timeout, etc.) and is safe to retry.
const NON_RETRYABLE_ERROR_CODES = new Set(['EMPTY_FILE', 'FILE_TOO_LARGE', 'UNSUPPORTED_FILE_TYPE']);

export function errorDetails(error: unknown) {
  const response = error && typeof error === 'object' && 'response' in error
    ? (error as { response?: { code?: string; message?: string } }).response
    : undefined;
  const code = String(response?.code || (error instanceof Error ? error.message : 'IMPORT_FAILED'));
  const message = String(response?.message || (error instanceof Error ? error.message : 'Import failed.'));
  return {
    code: code.slice(0, 100),
    message: message.slice(0, 500),
    retryable: !NON_RETRYABLE_ERROR_CODES.has(code),
  };
}

export function normalizeName(fileName: string) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\bresume\b|\bcv\b|v\d+/gi, '')
    .trim()
    .toLowerCase();
}

export function displayNameFromFileName(fileName: string) {
  const normalized = normalizeName(fileName);
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 200) || 'Unnamed candidate';
}
