import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type RubricExport } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../persistence/prisma.service';
import { validate } from '../intake/contracts';
import type { Identity } from '../intake/workspace.guard';
import { rubricCardSource } from './rubric-source';
import { buildPackagePdf } from '../intake/package-pdf';

const requestSchema = z.object({ requestId: z.string().uuid(), rubricId: z.string().uuid(), revision: z.number().int().positive() }).strict();
const metadata = (row: RubricExport) => ({ id: row.id, actorId: row.actorId, rubricId: row.rubricId, revision: row.revision,
  versionNumber: row.versionNumber, rubricStatus: row.rubricStatus, status: row.status, errorCode: row.errorCode, createdAt: row.createdAt, completedAt: row.completedAt });

type Snapshot = { title: string; rubricId: string; versionNumber: number; revision: number; status: string; confirmedBy: string | null; confirmedAt: string | null;
  cards: { requirement: string; weight: number; requiredLevel: number | null; responsibilityType: string; cardPriority: string; competencyTags: string; expectedEvidence: string; levelAnchors: unknown; source: ReturnType<typeof rubricCardSource> }[] };

export function rubricPdf(snapshot: Snapshot): Buffer {
  const text = [
    'HireOS Rubric', snapshot.title,
    `Version ${snapshot.versionNumber} | Revision ${snapshot.revision} | ${snapshot.status}`,
    `Rubric ID: ${snapshot.rubricId}`,
    `Confirmed by: ${snapshot.confirmedBy ?? 'Not recorded'} | ${snapshot.confirmedAt ?? 'Not recorded'}`, '',
  ];
  snapshot.cards.forEach((card, index) => {
    text.push(`${index + 1}. ${card.requirement}`, `Weight: ${card.weight}% | Required level: ${card.requiredLevel ?? 'Not recorded'}`,
      `${card.responsibilityType} | ${card.cardPriority} | ${card.competencyTags}`, `Expected evidence: ${card.expectedEvidence}`);
    const anchors = card.levelAnchors && typeof card.levelAnchors === 'object' ? card.levelAnchors as Record<string, unknown> : {};
    for (const key of ['l1', 'l2', 'l3', 'l4', 'l5']) text.push(`${key.toUpperCase()}: ${anchors[key] ?? 'Not recorded'}`);
    if (card.source.status === 'verified') {
      text.push(`Source JD input snapshot: v${card.source.jdVersion}`);
      card.source.refs.forEach(ref => text.push(`Segment ${ref.segmentId}: ${ref.quote}`));
    } else text.push('Source: Not recorded / not verified');
    text.push('');
  });
  // Bound physical line width for both CJK and Latin text before pagination.
  const lines = text.flatMap(value => {
    const result: { text: string }[] = []; let line = ''; let width = 0;
    for (const char of value.replace(/[\r\n\t]/g, ' ')) {
      const size = char.charCodeAt(0) < 128 ? 1 : 2;
      if (width + size > 48) { result.push({ text: line }); line = ''; width = 0; }
      line += char; width += size;
    }
    result.push({ text: line }); return result;
  });
  const paged: { text: string }[] = [];
  let block: { text: string }[] = [];
  const flush = () => {
    const used = paged.length % 48;
    if (used && block.length <= 48 && used + block.length > 48) {
      for (let i = used; i < 48; i++) paged.push({ text: '' });
    }
    paged.push(...block); block = [];
  };
  for (const line of lines) { block.push(line); if (!line.text) flush(); }
  flush();
  return buildPackagePdf(paged);
}

@Injectable()
export class RubricExportService {
  constructor(private readonly db: PrismaService) {}

  async create(identity: Identity, jobId: string, raw: unknown) {
    const input = validate(requestSchema, raw);
    const key = { workspaceId: identity.workspaceId, actorId: identity.actorId, requestId: input.requestId };
    const replay = (row: RubricExport) => {
      if (row.jobId !== jobId || row.rubricId !== input.rubricId || row.revision !== input.revision) throw new ConflictException({ code: 'EXPORT_REQUEST_CONFLICT' });
      return metadata(row);
    };
    const previous = await this.db.rubricExport.findUnique({ where: { workspaceId_actorId_requestId: key } });
    if (previous) return replay(previous);
    let row: RubricExport;
    try {
      row = await this.db.$transaction(async tx => {
        const job = await tx.job.findFirst({ where: { id: jobId, workspaceId: identity.workspaceId }, select: { title: true } });
        if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
        const rubric = await tx.rubricVersion.findFirst({ where: { jobId, workspaceId: identity.workspaceId }, orderBy: { versionNumber: 'desc' }, include: { cards: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } });
        if (!rubric || rubric.id !== input.rubricId || rubric.version !== input.revision) throw new ConflictException({ code: 'RUBRIC_EXPORT_STALE' });
        const source = rubric.sourceParseJobId ? await tx.parseJob.findFirst({ where: { id: rubric.sourceParseJobId, workspaceId: identity.workspaceId, jobId, type: 'capability_cards' } }) : null;
        const snapshot: Snapshot = { title: job.title, rubricId: rubric.id, versionNumber: rubric.versionNumber, revision: rubric.version, status: rubric.status,
          confirmedBy: rubric.confirmedBy, confirmedAt: rubric.confirmedAt?.toISOString() ?? null,
          cards: rubric.cards.map(card => ({ requirement: card.requirement, weight: card.weight, requiredLevel: card.requiredLevel, responsibilityType: card.responsibilityType, cardPriority: card.cardPriority,
            competencyTags: card.competencyTags, expectedEvidence: card.expectedEvidence, levelAnchors: card.levelAnchors, source: rubricCardSource(card, source ?? undefined) })) };
        return tx.rubricExport.create({ data: { ...key, jobId, rubricId: rubric.id, revision: rubric.version, versionNumber: rubric.versionNumber,
          rubricStatus: rubric.status, snapshot: snapshot as unknown as Prisma.InputJsonValue } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.db.rubricExport.findUnique({ where: { workspaceId_actorId_requestId: key } });
        if (existing) return replay(existing);
      }
      throw error;
    }
    let pdf: Buffer;
    try { pdf = this.render(row.snapshot as unknown as Snapshot); }
    catch {
      return metadata(await this.db.rubricExport.update({ where: { id: row.id }, data: { status: 'failed', errorCode: 'PDF_GENERATION_FAILED', completedAt: new Date() } }));
    }
    // A persistence failure leaves pending/unknown, never a fabricated successful receipt.
    return metadata(await this.db.rubricExport.update({ where: { id: row.id }, data: { status: 'succeeded', pdf: new Uint8Array(pdf), completedAt: new Date() } }));
  }

  render(snapshot: Snapshot) { return rubricPdf(snapshot); }

  async list(workspaceId: string, jobId: string) {
    if (!await this.db.job.findFirst({ where: { id: jobId, workspaceId }, select: { id: true } })) throw new NotFoundException({ code: 'NOT_FOUND' });
    const rows = await this.db.rubricExport.findMany({ where: { workspaceId, jobId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50,
      omit: { pdf: true, snapshot: true } });
    return rows.map(row => metadata({ ...row, pdf: null, snapshot: {} }));
  }

  async download(workspaceId: string, jobId: string, id: string) {
    const row = await this.db.rubricExport.findFirst({ where: { id, workspaceId, jobId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (row.status !== 'succeeded' || !row.pdf) throw new ConflictException({ code: 'EXPORT_NOT_READY' });
    return Buffer.from(row.pdf);
  }
}
