import { Injectable, NotFoundException } from '@nestjs/common';
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
      status: q.status,
      author: q.author,
      deliverables: q.deliverables ?? [],
      favorite: q.favorite,
      createdAt: q.createdAt.toISOString(),
    };
  }

  async list(identity: Identity) {
    const questions = await this.db.question.findMany({
      where: { workspaceId: identity.workspaceId },
      orderBy: { createdAt: 'asc' },
    });
    return questions.map((q) => this.serialize(q));
  }

  async get(identity: Identity, id: string) {
    const q = await this.db.question.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!q) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
    return this.serialize(q);
  }

  async update(identity: Identity, id: string, dto: UpdateQuestionDto) {
    const existing = await this.db.question.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
    // A content change is a new version (candidates already given this question keep their own
    // PlanItem snapshot, so nothing they received changes); a favorite toggle is not.
    const contentChanged =
      (dto.title !== undefined && dto.title.trim() !== existing.title) ||
      (dto.prompt !== undefined && dto.prompt.trim() !== existing.prompt) ||
      dto.competencies !== undefined;
    const q = await this.db.question.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        prompt: dto.prompt?.trim(),
        roles: dto.roles,
        competencies: dto.competencies as unknown as object | undefined,
        favorite: dto.favorite,
        version: contentChanged ? { increment: 1 } : undefined,
      },
    });
    return this.serialize(q);
  }

  async remove(identity: Identity, id: string) {
    const { count } = await this.db.question.deleteMany({ where: { id, workspaceId: identity.workspaceId } });
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
            status: dto.status,
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
}
