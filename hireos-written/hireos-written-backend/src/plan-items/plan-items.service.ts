import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import type { CreatePlanItemDto, UpdatePlanItemDto } from './plan-item.dto';
import { assertCaseOpen, assertPlanItemEditable, hasDraftRound } from '../invitations/rounds';

@Injectable()
export class PlanItemsService {
  constructor(private readonly db: PrismaService) {}

  private serialize(item: {
    id: string; kind: string; status: string; questionCode: string; questionTitle: string;
    questionPrompt: string; customPrompt: string | null; competencies: unknown; deliverables: unknown; createdAt: Date;
    invitationId: string | null; invitation?: { round: number } | null;
    bankQuestionVersionId?: string | null;
  }) {
    return {
      id: item.id,
      bankQuestionVersionId: item.bankQuestionVersionId ?? null,
      kind: item.kind,
      status: item.status,
      questionCode: item.questionCode,
      questionTitle: item.questionTitle,
      questionPrompt: item.questionPrompt,
      customPrompt: item.customPrompt,
      competencies: item.competencies,
      deliverables: item.deliverables,
      // #48: null = in the draft round (editable); otherwise the round it was sent in (read-only).
      invitationId: item.invitationId,
      round: item.invitation?.round ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async list(identity: Identity, caseId: string) {
    // Must 404 for a case this workspace doesn't have -- an empty-but-200 response here is
    // indistinguishable from "this real case just has no plan items yet" to the frontend, which
    // treats a successful list as authoritative and overwrites its fixture demo plan items with
    // it (see applyRealPlanItems). Silently returning [] for a fixture-only case id wiped out that
    // case's demo questions on every visit.
    const kase = await this.db.case.findFirst({ where: { id: caseId, workspaceId: identity.workspaceId } });
    if (!kase) throw new NotFoundException({ code: 'CASE_NOT_FOUND' });

    const items = await this.db.planItem.findMany({
      where: { caseId, workspaceId: identity.workspaceId },
      orderBy: { createdAt: 'asc' },
      include: { invitation: { select: { round: true } } },
    });
    return items.map((item) => this.serialize(item));
  }

  async create(identity: Identity, caseId: string, dto: CreatePlanItemDto) {
    const kase = await this.db.case.findFirst({ where: { id: caseId, workspaceId: identity.workspaceId } });
    if (!kase) throw new NotFoundException({ code: 'CASE_NOT_FOUND' });
    assertCaseOpen(kase.status);
    // New questions always go into the draft round (invitationId stays null until it is sent) -- which
    // must exist: after a send, a new one only opens via "Add supplemental test" (rounds/draft).
    const [roundsSent, draftItems] = await Promise.all([
      this.db.invitation.count({ where: { caseId, workspaceId: identity.workspaceId } }),
      this.db.planItem.count({ where: { caseId, workspaceId: identity.workspaceId, invitationId: null } }),
    ]);
    if (!hasDraftRound({ roundsSent, draftRoundOpen: kase.draftRoundOpen, draftItems })) {
      throw new ConflictException({ code: 'NO_DRAFT_ROUND', message: 'Open a supplemental round before adding questions.' });
    }

    if (/^Q-\d+$/.test(dto.questionCode) && !dto.bankQuestionId) {
      throw new BadRequestException({ code: 'QUESTION_VERSION_REQUIRED' });
    }
    const create = async (db: Prisma.TransactionClient) => {
      let source: { id: string; content: Prisma.JsonValue } | null = null;
      if (dto.bankQuestionId) {
        await db.$queryRaw`SELECT id FROM "Question" WHERE id = ${dto.bankQuestionId} AND "workspaceId" = ${identity.workspaceId} FOR SHARE`;
        const question = await db.question.findFirst({ where: { id: dto.bankQuestionId, workspaceId: identity.workspaceId, deletedAt: null } });
        if (!question) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND' });
        if (question.status !== 'published') throw new ConflictException({ code: 'QUESTION_NOT_PUBLISHED' });
        if (question.version !== dto.bankQuestionVersion) throw new ConflictException({ code: 'QUESTION_VERSION_CONFLICT' });
        source = await db.questionVersion.findUnique({ where: { questionId_version: { questionId: question.id, version: question.version } } });
        if (!source) throw new ConflictException({ code: 'QUESTION_VERSION_UNAVAILABLE' });
      }
      const content = source?.content as { code: string; title: string; prompt: string; competencies: Prisma.InputJsonValue; deliverables?: Prisma.InputJsonValue } | undefined;
      return db.planItem.create({
      data: {
        workspaceId: identity.workspaceId,
        caseId,
        kind: dto.kind,
        bankQuestionVersionId: source?.id,
        questionCode: content?.code ?? dto.questionCode,
        questionTitle: content?.title ?? dto.questionTitle,
        questionPrompt: content?.prompt ?? dto.questionPrompt,
        customPrompt: dto.customPrompt,
        competencies: content?.competencies ?? dto.competencies as unknown as object,
        deliverables: content?.deliverables ?? dto.deliverables as unknown as object,
      },
      });
    };
    const item = dto.bankQuestionId ? await this.db.$transaction(create) : await create(this.db);
    return this.serialize(item);
  }

  async update(identity: Identity, caseId: string, id: string, dto: UpdatePlanItemDto) {
    const existing = await this.db.planItem.findFirst({ where: { id, caseId, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'PLAN_ITEM_NOT_FOUND' });
    assertPlanItemEditable(existing);
    const item = await this.db.planItem.update({
      where: { id },
      data: { customPrompt: dto.customPrompt, status: dto.status },
    });
    return this.serialize(item);
  }

  async remove(identity: Identity, caseId: string, id: string) {
    const existing = await this.db.planItem.findFirst({ where: { id, caseId, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'PLAN_ITEM_NOT_FOUND' });
    assertPlanItemEditable(existing);
    await this.db.planItem.delete({ where: { id } });
    return { status: 'deleted' };
  }
}
