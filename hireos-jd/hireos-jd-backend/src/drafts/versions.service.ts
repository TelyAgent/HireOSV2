import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { CoreRecordClient } from '../core/core-record.client';
import { PrismaService } from '../persistence/prisma.service';
import { json } from '../records';

/**
 * JD identity and versions (completeness standard I2 / I6): every job gets one JD ID
 * (JD-<year>-<number>), and every Publish writes an immutable snapshot of the saved document as the
 * next version. The job document is stored under the "internal" audience slot.
 */

const DOC_AUDIENCE = 'internal';

const publishSchema = z.object({
  /** One-line version note (I6). */
  note: z.string().trim().max(1000).default(''),
  /** Revision of the saved document the user reviewed — refuses to publish anything else. */
  revision: z.number().int().positive(),
  /** App-level person id shown as the publisher. */
  publishedBy: z.string().trim().min(1).max(200).optional(),
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
    const latest = await this.db.jobDocumentVersion.findFirst({
      where: { workspaceId: identity.workspaceId, jobId },
      orderBy: { versionNo: 'desc' },
    });
    if (latest && sameContent(latest.blocks, doc.blocks)) {
      throw new ConflictException({ code: 'NO_CHANGES', message: `与 v${latest.versionNo} 相比没有改动，无需发布。` });
    }

    const jdCode = await this.ensureCode(identity, jobId);
    let job = await this.core.getJob(identity, jobId);
    if (job.status !== 'open') {
      job = await this.core.updateJob(identity, jobId, { status: 'open', reason: 'published' }, `jd-publish-${jobId}-${doc.revision}`);
    }

    const versionNo = (latest?.versionNo ?? 0) + 1;
    try {
      const row = await this.db.jobDocumentVersion.create({
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
      return { version: serialize(row), job };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'VERSION_CONFLICT', message: '其他人刚刚发布了新版本，请刷新后再试。' });
      }
      throw error;
    }
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
