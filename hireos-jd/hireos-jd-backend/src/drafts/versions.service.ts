import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { CoreRecordClient } from '../core/core-record.client';
import { PrismaService } from '../persistence/prisma.service';
import { json } from '../records';
import { draftToBlocks } from './baseline-blocks';

/**
 * JD identity and versions (completeness standard I2 / I6): every job gets one JD ID
 * (JD-<year>-<number>), and every Publish writes an immutable snapshot of the saved document as the
 * next version. The job document is stored under the "internal" audience slot.
 */

const DOC_AUDIENCE = 'internal';

/** Author of everything the #96 baseline migration writes; also how a baseline v1 is recognised. */
export const MIGRATION_ACTOR = 'system:jd-baseline-migration';
const BASELINE_NOTE = '迁移基线：此职位在版本功能上线前已发布，原发布快照、审批和发布时间未知；v1 为迁移时的 JD 内容。';

export type BaselineOutcome = {
  jobId: string;
  result: 'created' | 'would_create' | 'has_versions' | 'not_published' | 'job_not_found' | 'no_content';
  source?: 'saved_document' | 'draft';
};

const publishSchema = z.object({
  /** One-line version note (I6). */
  note: z.string().trim().max(1000).default(''),
  /** Revision of the saved document the user reviewed — refuses to publish anything else. */
  revision: z.number().int().positive(),
  /** App-level person id shown as the publisher; `system:` ids are reserved for the service itself (#96 review). */
  publishedBy: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((id) => !id.toLowerCase().startsWith('system:'), { message: 'publishedBy may not be a system id.' })
    .optional(),
});

type VersionRow = {
  versionNo: number;
  code: string;
  title: string;
  blocks: unknown;
  meta: unknown;
  note: string;
  publishedBy: string;
  publishedAt: Date;
};

@Injectable()
export class VersionsService {
  constructor(
    private readonly db: PrismaService,
    private readonly core: CoreRecordClient,
  ) {}

  async list(identity: Identity, jobId: string) {
    const jdCode = await this.ensureCode(identity, jobId);
    const rows = await this.db.jobDocumentVersion.findMany({
      where: { workspaceId: identity.workspaceId, jobId },
      orderBy: { versionNo: 'asc' },
    });
    return { jdCode, versions: rows.map(serialize) };
  }

  async publish(identity: Identity, jobId: string, raw: unknown) {
    const parsed = publishSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_PUBLISH_REQUEST', message: parsed.error.message });
    const input = parsed.data;

    const doc = await this.db.jobDocument.findUnique({
      where: { workspaceId_jobId_audience: { workspaceId: identity.workspaceId, jobId, audience: DOC_AUDIENCE } },
    });
    if (!doc) throw new ConflictException({ code: 'DOCUMENT_NOT_SAVED', message: '请先保存文档再发布。' });
    if (doc.revision !== input.revision) {
      throw new ConflictException({ code: 'DOCUMENT_CHANGED', message: '文档在你确认之后又有更新，请重新打开发布窗口确认。' });
    }
    // AI-written text nobody has kept or edited is not the job's content yet (#93 AC-1): the same rule as the button.
    if (Array.isArray(doc.blocks) && doc.blocks.some((b) => (b as { aiDraft?: unknown } | null)?.aiDraft === true)) {
      throw new ConflictException({ code: 'AI_DRAFT_UNCONFIRMED', message: '还有 AI 撰写的内容未确认保留，请逐项确认或修改后再发布。' });
    }
    const analysis = doc.aiAnalysis as { verdict?: string; items?: { severity?: string }[] } | null;
    if (doc.aiAnalysisRevision !== doc.revision || !analysis) {
      throw new ConflictException({ code: 'ANALYSIS_REQUIRED', message: '请先对当前已保存版本完成 AI 分析。' });
    }
    if ((analysis.items ?? []).some((item) => item.severity !== 'suggestion')) {
      throw new ConflictException({ code: 'ANALYSIS_NOT_READY', message: '当前 JD 仍有需要处理的分析问题，不能发布。' });
    }
    const latest = await this.db.jobDocumentVersion.findFirst({
      where: { workspaceId: identity.workspaceId, jobId },
      orderBy: { versionNo: 'desc' },
    });
    // Checked again under the job's version lock below; this early check just avoids touching Core.
    if (latest && sameContent(latest.blocks, doc.blocks)) {
      throw new ConflictException({ code: 'NO_CHANGES', message: `与 v${latest.versionNo} 相比没有改动，无需发布。` });
    }

    const jdCode = await this.ensureCode(identity, jobId);
    let job = await this.core.getJob(identity, jobId);
    if (job.status !== 'open') {
      job = await this.core.updateJob(identity, jobId, { status: 'open', reason: 'published' }, `jd-publish-${jobId}-${doc.revision}`);
    }

    try {
      const row = await this.db.$transaction(async (tx) => {
        await lockJobVersions(tx, identity.workspaceId, jobId);
        const current = await tx.jobDocumentVersion.findFirst({ where: { workspaceId: identity.workspaceId, jobId }, orderBy: { versionNo: 'desc' } });
        if (current && sameContent(current.blocks, doc.blocks)) {
          throw new ConflictException({ code: 'NO_CHANGES', message: `与 v${current.versionNo} 相比没有改动，无需发布。` });
        }
        const versionNo = (current?.versionNo ?? 0) + 1;
        return tx.jobDocumentVersion.create({
          data: {
            workspaceId: identity.workspaceId,
            jobId,
            versionNo,
            code: `${jdCode}@v${versionNo}`,
            title: job.title,
            blocks: json(doc.blocks),
            meta: doc.meta === null ? undefined : json(doc.meta),
            note: input.note,
            publishedBy: input.publishedBy ?? identity.actorId,
            createdBy: identity.actorId,
          },
        });
      });
      return { version: serialize(row), job };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'VERSION_CONFLICT', message: '其他人刚刚发布了新版本，请刷新后再试。' });
      }
      throw error;
    }
  }

  /**
   * Gives a job published before JD versions existed its v1 (#96, PD-M8-02). The original publish snapshot
   * isn't kept anywhere, so v1 is the job's JD content at migration time: its saved document, or — for a job
   * whose document was never saved — the document its draft shows, which is then saved too so the editor and
   * v1 hold the same content. v1 is marked as a migration baseline; its time is the migration time, and the
   * original approval and publish time stay unknown rather than invented. Idempotent: a job that already has
   * any version, or isn't published, is left alone.
   */
  async backfillBaseline(identity: Identity, jobId: string, options: { apply: boolean }): Promise<BaselineOutcome> {
    const where = { workspaceId: identity.workspaceId, jobId };
    if (await this.db.jobDocumentVersion.findFirst({ where })) return { jobId, result: 'has_versions' };
    // JD content can outlive its job: a job deleted in Core leaves its draft rows here.
    const job = await this.core.getJob(identity, jobId).catch((error: unknown) => {
      if (error instanceof NotFoundException) return null;
      throw error;
    });
    if (!job) return { jobId, result: 'job_not_found' };
    if (job.status !== 'open') return { jobId, result: 'not_published' };

    const doc = await this.db.jobDocument.findUnique({
      where: { workspaceId_jobId_audience: { workspaceId: identity.workspaceId, jobId, audience: DOC_AUDIENCE } },
    });
    const draft = doc ? null : await this.db.jobDraft.findFirst({ where, orderBy: { revision: 'desc' } });
    if (!doc && !draft) return { jobId, result: 'no_content' };
    const source = doc ? 'saved_document' : 'draft';
    if (!options.apply) return { jobId, result: 'would_create', source };

    const blocks = doc ? doc.blocks : draftToBlocks(job.title, draft!, jobId);
    const migratedAt = new Date();
    const baseline = { kind: 'migration_baseline', source, migratedAt: migratedAt.toISOString(), originalPublishedAt: null, originalApproval: null };
    const jdCode = await this.ensureCode(identity, jobId);
    try {
      const created = await this.db.$transaction(async (tx) => {
        await lockJobVersions(tx, identity.workspaceId, jobId);
        // A Publish may have landed since the check above.
        if (await tx.jobDocumentVersion.findFirst({ where })) return false;
        if (!doc) {
          await tx.jobDocument.create({
            data: { workspaceId: identity.workspaceId, jobId, audience: DOC_AUDIENCE, blocks: json(blocks), revision: 1, updatedBy: MIGRATION_ACTOR },
          });
        }
        await tx.jobDocumentVersion.create({
          data: {
            workspaceId: identity.workspaceId,
            jobId,
            versionNo: 1,
            code: `${jdCode}@v1`,
            title: job.title,
            blocks: json(blocks),
            // Keeps the document-meta shape ({ values, shown }) the editor reads when a version is restored.
            meta: json({ values: {}, shown: [], ...asRecord(doc?.meta), baseline }),
            note: BASELINE_NOTE,
            publishedBy: MIGRATION_ACTOR,
            createdBy: MIGRATION_ACTOR,
            publishedAt: migratedAt,
          },
        });
        return true;
      });
      if (!created) return { jobId, result: 'has_versions' };
    } catch (error) {
      // A concurrent run (or a real Publish) got there first: the job has its v1.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { jobId, result: 'has_versions' };
      throw error;
    }
    return { jobId, result: 'created', source };
  }

  /**
   * Undoes `backfillBaseline` for one job: removes the baseline v1 — and the document it saved from the draft,
   * if nobody has edited that since — but only while v1 is still the job's only version.
   */
  async rollbackBaseline(identity: Identity, jobId: string): Promise<'removed' | 'kept' | 'none'> {
    const where = { workspaceId: identity.workspaceId, jobId };
    // Decided and done under the job's version lock, so a Publish can't add v2 between the check and the delete.
    return this.db.$transaction(async (tx) => {
      await lockJobVersions(tx, identity.workspaceId, jobId);
      const versions = await tx.jobDocumentVersion.findMany({ where });
      // Only what the migration itself wrote: createdBy is set by the service, never by a client (#96 review).
      const v1 = versions.find(
        (v) => v.versionNo === 1 && v.createdBy === MIGRATION_ACTOR && v.publishedBy === MIGRATION_ACTOR && asRecord(asRecord(v.meta).baseline).kind === 'migration_baseline',
      );
      if (!v1) return 'none' as const;
      if (versions.length > 1) return 'kept' as const;
      await tx.jobDocumentVersion.delete({ where: { id: v1.id } });
      if (asRecord(asRecord(v1.meta).baseline).source === 'draft') {
        await tx.jobDocument.deleteMany({ where: { ...where, audience: DOC_AUDIENCE, updatedBy: MIGRATION_ACTOR, revision: 1 } });
      }
      return 'removed' as const;
    });
  }

  /** Returns the job's JD ID, assigning the next free number for the current year on first use. */
  private async ensureCode(identity: Identity, jobId: string): Promise<string> {
    const where = { workspaceId_jobId: { workspaceId: identity.workspaceId, jobId } };
    const existing = await this.db.jdCode.findUnique({ where });
    if (existing) return existing.code;
    const year = new Date().getFullYear();
    // Two jobs can race for the same number; the unique index decides and the loser retries.
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await this.db.jdCode.findFirst({
        where: { workspaceId: identity.workspaceId, year },
        orderBy: { seq: 'desc' },
      });
      const seq = (last?.seq ?? 0) + 1;
      const code = `JD-${year}-${String(seq).padStart(4, '0')}`;
      try {
        const row = await this.db.jdCode.create({ data: { workspaceId: identity.workspaceId, jobId, code, year, seq } });
        return row.code;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        const mine = await this.db.jdCode.findUnique({ where });
        if (mine) return mine.code;
      }
    }
    throw new ConflictException({ code: 'JD_CODE_CONFLICT', message: '分配 JD 编号失败，请重试。' });
  }
}

/** Same blocks in the same order with the same text and visibility (ignores editor-only flags). */
function sameContent(a: unknown, b: unknown) {
  const key = (blocks: unknown) =>
    JSON.stringify(
      (Array.isArray(blocks) ? blocks : []).map((x: { id?: unknown; kind?: unknown; text?: unknown; level?: unknown }) => [x.id, x.kind, x.text, x.level]),
    );
  return key(a) === key(b);
}

function serialize(row: VersionRow) {
  return {
    versionNo: row.versionNo,
    code: row.code,
    title: row.title,
    blocks: row.blocks,
    meta: row.meta ?? null,
    note: row.note,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt.toISOString(),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Serialises everything that writes or removes a job's versions — Publish, the baseline migration and its
 * rollback (#96 review) — for the rest of the transaction. A Postgres advisory lock, so no table is locked.
 */
async function lockJobVersions(tx: Prisma.TransactionClient, workspaceId: string, jobId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`jd-versions:${workspaceId}:${jobId}`}, 0))`;
}
