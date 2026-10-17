import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Question } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import type { CreateQuestionDto, UpdateQuestionDto } from './question.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly db: PrismaService) {}

  private serialize(q: Question) {
    return {
      id: q.id,
      code: q.code,
      title: q.title,
      prompt: q.prompt,
      type: q.type,
      roles: q.roles,
      competencies: q.competencies,
      difficulty: q.difficulty,
      estMinutes: q.estMinutes,
      language: q.language,
      version: q.version,
      revision: q.revision,
      status: q.status,
      author: q.author,
      deliverables: q.deliverables ?? [],
      favorite: q.favorite,
      createdAt: q.createdAt.toISOString(),
    };
  }

  async list(identity: Identity) {
    const questions = await this.db.question.findMany({
      where: { workspaceId: identity.workspaceId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return questions.map((q) => this.serialize(q));
  }

  async get(identity: Identity, id: string) {
    const q = await this.db.question.findFirst({ where: { id, workspaceId: identity.workspaceId, deletedAt: null } });
    if (!q) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
    return this.serialize(q);
  }

  async update(identity: Identity, id: string, dto: UpdateQuestionDto) {
    const existing = await this.db.question.findFirst({ where: { id, workspaceId: identity.workspaceId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
    const contentChanged = dto.title !== undefined || dto.prompt !== undefined || dto.roles !== undefined || dto.competencies !== undefined;
    if (contentChanged && (!Number.isSafeInteger(dto.expectedRevision) || dto.expectedRevision !== existing.revision)) {
      throw new ConflictException({ code: 'QUESTION_VERSION_CONFLICT', message: 'This question changed. Reload before editing.' });
    }
    const q = await this.db.$transaction(async tx => {
      const changed = await tx.question.updateMany({
      where: { id, workspaceId: identity.workspaceId, deletedAt: null, ...(contentChanged ? { revision: dto.expectedRevision } : {}) },
      data: {
        title: dto.title?.trim(),
        prompt: dto.prompt?.trim(),
        roles: dto.roles,
        competencies: dto.competencies as unknown as object | undefined,
        favorite: dto.favorite,
        revision: contentChanged ? { increment: 1 } : undefined,
        status: contentChanged ? 'draft_review' : undefined,
      },
      });
      if (changed.count !== 1) throw new ConflictException({ code: 'QUESTION_VERSION_CONFLICT' });
      return tx.question.findUniqueOrThrow({ where: { id } });
    });
    return this.serialize(q);
  }

  async remove(identity: Identity, id: string) {
    const { count } = await this.db.question.updateMany({ where: { id, workspaceId: identity.workspaceId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!count) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
    return { status: 'deleted' };
  }

  async create(identity: Identity, dto: CreateQuestionDto) {
    // Q-0001, Q-0002, ... per workspace, continuing from the highest code ever handed out still in the
    // table (not the row count -- after a delete that would re-issue a live code). Retried on the
    // (rare) unique clash of two concurrent creates.
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await this.db.question.findFirst({
        where: { workspaceId: identity.workspaceId, code: { startsWith: 'Q-' } },
        orderBy: { code: 'desc' },
        select: { code: true },
      });
      const lastNumber = last ? Number(last.code.slice(2)) || 0 : 0;
      const code = `Q-${String(lastNumber + 1 + attempt).padStart(4, '0')}`;
      try {
        const q = await this.db.question.create({
          data: {
            workspaceId: identity.workspaceId,
            code,
            title: dto.title.trim(),
            prompt: dto.prompt.trim(),
            roles: dto.roles,
            competencies: dto.competencies as unknown as object,
            type: dto.type,
            difficulty: dto.difficulty,
            estMinutes: dto.estMinutes,
            language: dto.language,
            status: 'draft_review',
            author: dto.author,
          },
        });
        return this.serialize(q);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
    }
    throw new Error('Could not allocate a question code');
  }

  async versions(identity: Identity, id: string) {
    await this.get(identity, id);
    return this.db.questionVersion.findMany({ where: { workspaceId: identity.workspaceId, questionId: id }, orderBy: { version: 'desc' },
      select: { id: true, version: true, content: true, historicalBaseline: true, publishedBy: true, publishedAt: true, createdAt: true } });
  }

  async publish(identity: Identity, id: string, expectedRevision: number) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new BadRequestException({ code: 'QUESTION_REVISION_REQUIRED' });
    return this.db.$transaction(async tx => {
      // Serialize publication with edits without changing immutable version rows.
      await tx.$queryRaw`SELECT id FROM "Question" WHERE id = ${id} AND "workspaceId" = ${identity.workspaceId} FOR UPDATE`;
      const q = await tx.question.findFirst({ where: { id, workspaceId: identity.workspaceId, deletedAt: null } });
      if (!q) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
      if (q.revision !== expectedRevision) throw new ConflictException({ code: 'QUESTION_VERSION_CONFLICT' });
      const prior = await tx.questionVersion.findUnique({ where: { questionId_draftRevision: { questionId: id, draftRevision: expectedRevision } } });
      if (prior && q.status === 'published') return { question: this.serialize(q), replayed: true };
      if (q.status !== 'draft_review') throw new ConflictException({ code: 'QUESTION_NOT_DRAFT' });
      const competencies = q.competencies as Array<{ name?: string; fraction?: number }>;
      if (!q.title.trim() || !q.prompt.trim() || !Array.isArray(competencies) || !competencies.length ||
          competencies.some(c => typeof c.name !== 'string' || !c.name.trim() || typeof c.fraction !== 'number' || !Number.isFinite(c.fraction) || c.fraction <= 0 || c.fraction > 1) ||
          Math.abs(competencies.reduce((sum, c) => sum + (c.fraction ?? 0), 0) - 1) > 0.001) {
        throw new BadRequestException({ code: 'QUESTION_NOT_PUBLISHABLE', message: 'Title, content and competencies totaling 100% are required.' });
      }
      const published = await tx.question.update({ where: { id }, data: { status: 'published', version: { increment: 1 } } });
      await tx.questionVersion.create({ data: { workspaceId: identity.workspaceId, questionId: id, version: published.version,
        draftRevision: expectedRevision, content: this.serialize(published) as unknown as Prisma.InputJsonValue, publishedBy: identity.actorId, publishedAt: new Date() } });
      return { question: this.serialize(published), replayed: false };
    });
  }

  async deprecations(identity: Identity, id: string) {
    await this.get(identity, id);
    return this.db.questionDeprecation.findMany({ where: { questionId: id, workspaceId: identity.workspaceId }, orderBy: { createdAt: 'desc' },
      select: { id: true, version: true, actorId: true, createdAt: true } });
  }

  async deprecate(identity: Identity, id: string, expectedRevision: number) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new BadRequestException({ code: 'QUESTION_REVISION_REQUIRED' });
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Question" WHERE id = ${id} AND "workspaceId" = ${identity.workspaceId} FOR UPDATE`;
      const q = await tx.question.findFirst({ where: { id, workspaceId: identity.workspaceId, deletedAt: null } });
      if (!q) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
      if (q.revision !== expectedRevision) throw new ConflictException({ code: 'QUESTION_VERSION_CONFLICT' });
      const event = await tx.questionDeprecation.findUnique({ where: { questionId_version: { questionId: id, version: q.version } } });
      if (q.status === 'deprecated' && event) return { question: this.serialize(q), event, replayed: true };
      if (q.status !== 'published') throw new ConflictException({ code: 'QUESTION_NOT_PUBLISHED' });
      const deprecated = await tx.question.update({ where: { id }, data: { status: 'deprecated' } });
      const created = await tx.questionDeprecation.create({ data: { workspaceId: identity.workspaceId, questionId: id, version: q.version, actorId: identity.actorId } });
      return { question: this.serialize(deprecated), event: created, replayed: false };
    });
  }
}
