import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { ZoomHostService } from '../meetings/zoom-host.service';
import { createRoundSchema, updateRoundSchema, scheduleRoundSchema, setCardScoreSchema, setRecommendationSchema, validate, type ParseInput } from './contracts';
import { advanceTaskStatus } from './task-status';
import type { Identity } from './workspace.guard';

const ROUND_SELECT = {
  id: true, taskId: true, sequence: true, name: true, format: true, duration: true,
  competencies: true, questions: true, mandatory: true, notes: true, status: true, version: true,
  scheduledAt: true, timezone: true, meetingLink: true,
  transcriptStatus: true, transcriptError: true, completedAt: true, recommendation: true,
  createdAt: true, interviewer: { select: { id: true, name: true, title: true } },
} satisfies Prisma.InterviewRoundSelect;

@Injectable()
export class RoundsService {
  constructor(private readonly db: PrismaService, private readonly zoomHost: ZoomHostService) {}

  /** Every task gets two generic rounds the moment it exists — content is filled in later. */
  async createDefaultRounds(tx: Prisma.TransactionClient, workspaceId: string, taskId: string) {
    for (const sequence of [1, 2]) {
      await tx.interviewRound.create({ data: {
        workspaceId, taskId, sequence, name: `Round ${sequence}`, format: 'Onsite panel', duration: 45,
        competencies: '', questions: 3, mandatory: 2, notes: '',
      } });
    }
  }

  async listForTask(workspaceId: string, taskId: string) {
    await this.getTask(workspaceId, taskId);
    const existing = await this.db.interviewRound.findMany({ where: { taskId, workspaceId }, orderBy: { sequence: 'asc' }, select: ROUND_SELECT });
    if (existing.length) return existing;
    // Self-heals a task that reaches Plan with no rounds yet — either seeded/created
    // before auto-round-creation existed, or a future task-creation path (e.g. a Resume
    // Screening hand-off) that doesn't call createDefaultRounds itself. Concurrent callers
    // racing this are resolved by the [taskId, sequence] unique constraint below.
    try {
      await this.db.$transaction((tx) => this.createDefaultRounds(tx, workspaceId, taskId));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
    return this.db.interviewRound.findMany({ where: { taskId, workspaceId }, orderBy: { sequence: 'asc' }, select: ROUND_SELECT });
  }

  async createForTask(identity: { workspaceId: string }, taskId: string, raw: unknown) {
    const input = validate(createRoundSchema, raw);
    await this.getTask(identity.workspaceId, taskId);
    if (input.interviewerId) await this.getInterviewer(identity.workspaceId, input.interviewerId);
    const questions = input.questions ?? 3;
    const mandatory = Math.min(questions, input.mandatory ?? 2);
    const round = await this.db.$transaction(async (tx) => {
      const last = await tx.interviewRound.findFirst({ where: { taskId }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
      const sequence = (last?.sequence ?? 0) + 1;
      return tx.interviewRound.create({ data: {
        workspaceId: identity.workspaceId, taskId, sequence,
        name: input.name?.trim() || `Round ${sequence}`,
        format: input.format || 'Video interview',
        duration: input.duration ?? 45,
        competencies: input.competencies ?? '',
        questions, mandatory,
        notes: input.notes ?? '',
        interviewerId: input.interviewerId ?? null,
      }, select: ROUND_SELECT });
    });
    return round;
  }

  async update(identity: { workspaceId: string }, roundId: string, raw: unknown) {
    const input = validate(updateRoundSchema, raw);
    const existing = await this.db.interviewRound.findFirst({ where: { id: roundId, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (input.interviewerId) await this.getInterviewer(identity.workspaceId, input.interviewerId);
    const mandatory = Math.min(input.questions, input.mandatory);
    const updated = await this.db.interviewRound.updateMany({
      where: { id: roundId, workspaceId: identity.workspaceId, version: input.version },
      data: {
        name: input.name, format: input.format, duration: input.duration, competencies: input.competencies,
        questions: input.questions, mandatory, notes: input.notes, status: input.status,
        interviewerId: input.interviewerId, version: { increment: 1 },
      },
    });
    if (!updated.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
    return this.db.interviewRound.findUniqueOrThrow({ where: { id: roundId }, select: ROUND_SELECT });
  }

  /** Sets or moves a round's meeting time — distinct from `update`, which edits round content. */
  async schedule(identity: { workspaceId: string }, roundId: string, raw: unknown) {
    const input = validate(scheduleRoundSchema, raw);
    const existing = await this.db.interviewRound.findFirst({ where: { id: roundId, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const updated = await this.db.interviewRound.updateMany({
      where: { id: roundId, workspaceId: identity.workspaceId, version: input.version },
      data: { scheduledAt: new Date(input.scheduledAt), timezone: input.timezone, meetingLink: input.meetingLink || null, version: { increment: 1 } },
    });
    if (!updated.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
    await advanceTaskStatus(this.db, identity.workspaceId, existing.taskId, 'interview_in_progress');
    return this.db.interviewRound.findUniqueOrThrow({ where: { id: roundId }, select: ROUND_SELECT });
  }

  /** Live transcript for a round's Zoom meeting — status plus lines streamed in so far via RTMS. */
  async transcript(workspaceId: string, roundId: string) {
    const round = await this.db.interviewRound.findFirst({ where: { id: roundId, workspaceId }, select: { transcriptStatus: true, transcriptError: true } });
    if (!round) throw new NotFoundException({ code: 'NOT_FOUND' });
    const lines = await this.db.transcriptLine.findMany({ where: { roundId }, orderBy: { createdAt: 'asc' }, select: { speaker: true, text: true, createdAt: true } });
    return { status: round.transcriptStatus, error: round.transcriptError, lines };
  }

  /** The job's confirmed capability cards, each paired with this round's own human score
   * (if any) and AI-drafted score (if generated) — every round can score every card
   * independently (see CardScore). Materializes any finished `round_scores` AI job first. */
  async scores(workspaceId: string, roundId: string) {
    const round = await this.db.interviewRound.findFirst({ where: { id: roundId, workspaceId }, select: { taskId: true } });
    if (!round) throw new NotFoundException({ code: 'NOT_FOUND' });
    const task = await this.db.interviewTask.findUniqueOrThrow({ where: { id: round.taskId }, select: { jobId: true } });
    const rubric = await this.db.rubricVersion.findFirst({
      where: { workspaceId, jobId: task.jobId, status: 'confirmed' }, orderBy: { versionNumber: 'desc' },
      select: { cards: { orderBy: { createdAt: 'asc' }, select: {
        id: true, requirement: true, responsibilityType: true, cardPriority: true, competencyTags: true, weight: true, levelAnchors: true,
      } } },
    });
    const cards = rubric?.cards ?? [];
    await this.materializeAiScoresIfReady(workspaceId, roundId, cards.map((c) => c.id));
    const generation = await this.db.parseJob.findFirst({ where: { workspaceId, roundId, type: 'round_scores' }, orderBy: { inputVersion: 'desc' }, select: { id: true, status: true, errorCode: true } });
    const scores = cards.length
      ? await this.db.cardScore.findMany({ where: { roundId, cardId: { in: cards.map((c) => c.id) } }, select: { cardId: true, score: true, note: true, aiScore: true, aiRationale: true, aiQuote: true } })
      : [];
    const byCard = new Map(scores.map((s) => [s.cardId, s]));
    const entries = cards.map((card) => {
      const s = byCard.get(card.id);
      return { card, score: s?.score ?? null, note: s?.note ?? '', aiScore: s?.aiScore ?? null, aiRationale: s?.aiRationale ?? null, aiQuote: s?.aiQuote ?? null };
    });
    return { generation: generation ? { id: generation.id, status: generation.status, errorCode: generation.errorCode } : null, entries };
  }

  /** Applies a finished `round_scores` AI job's result into CardScore.ai* fields, once per
   * job (see CardScore.aiSourceParseJobId) — never touches the human score/note fields. */
  private async materializeAiScoresIfReady(workspaceId: string, roundId: string, cardIds: string[]) {
    if (!cardIds.length) return;
    const ready = await this.db.parseJob.findFirst({ where: { workspaceId, roundId, type: 'round_scores', status: 'needs_review' }, orderBy: { inputVersion: 'desc' } });
    if (!ready) return;
    const already = await this.db.cardScore.findFirst({ where: { roundId, cardId: { in: cardIds }, aiSourceParseJobId: ready.id } });
    if (already) return;
    const result = ready.result as unknown as { scores: { cardId: string; score: number | null; rationale: string; segmentId: string | null; quote: string | null }[] };
    const now = new Date();
    for (const entry of result.scores ?? []) {
      if (!cardIds.includes(entry.cardId)) continue; // rubric may have changed since this job was queued
      await this.db.cardScore.upsert({
        where: { roundId_cardId: { roundId, cardId: entry.cardId } },
        create: { workspaceId, roundId, cardId: entry.cardId, score: null, note: '', aiScore: entry.score, aiRationale: entry.rationale, aiQuoteSegmentId: entry.segmentId, aiQuote: entry.quote, aiGeneratedAt: now, aiSourceParseJobId: ready.id },
        update: { aiScore: entry.score, aiRationale: entry.rationale, aiQuoteSegmentId: entry.segmentId, aiQuote: entry.quote, aiGeneratedAt: now, aiSourceParseJobId: ready.id },
      });
    }
  }

  /** Kicks off AI scoring for this round against its job's confirmed rubric, grounded in
   * the round's real transcript — requires both to exist, and never fabricates either. */
  async generateAiScores(identity: Identity, roundId: string) {
    const round = await this.db.interviewRound.findFirst({ where: { id: roundId, workspaceId: identity.workspaceId }, select: { taskId: true } });
    if (!round) throw new NotFoundException({ code: 'NOT_FOUND' });
    const task = await this.db.interviewTask.findUniqueOrThrow({ where: { id: round.taskId }, select: { jobId: true } });
    const rubric = await this.db.rubricVersion.findFirst({
      where: { workspaceId: identity.workspaceId, jobId: task.jobId, status: 'confirmed' }, orderBy: { versionNumber: 'desc' },
      select: { cards: { select: { id: true, requirement: true, cardPriority: true, levelAnchors: true } } },
    });
    const cards = rubric?.cards ?? [];
    if (!cards.length) throw new BadRequestException({ code: 'NO_CONFIRMED_RUBRIC' });
    const lines = await this.db.transcriptLine.findMany({ where: { roundId }, orderBy: { createdAt: 'asc' }, select: { id: true, speaker: true, text: true } });
    if (!lines.length) throw new BadRequestException({ code: 'NO_TRANSCRIPT' });
    const existingCount = await this.db.parseJob.count({ where: { workspaceId: identity.workspaceId, roundId, type: 'round_scores' } });
    const input: ParseInput = {
      sourceId: roundId,
      segments: lines.map((l) => ({ id: l.id, text: `${l.speaker}: ${l.text}` })),
      cards: cards.map((c) => ({ id: c.id, requirement: c.requirement, cardPriority: c.cardPriority, levelAnchors: c.levelAnchors })),
    };
    const job = await this.db.parseJob.create({ data: {
      workspaceId: identity.workspaceId, roundId, type: 'round_scores', inputVersion: existingCount + 1,
      input: input as unknown as Prisma.InputJsonValue,
    } });
    return { id: job.id, status: job.status };
  }

  /** Upserts this round's human score/note for one capability card. */
  async setScore(identity: { workspaceId: string }, roundId: string, cardId: string, raw: unknown) {
    const input = validate(setCardScoreSchema, raw);
    const round = await this.db.interviewRound.findFirst({ where: { id: roundId, workspaceId: identity.workspaceId } });
    if (!round) throw new NotFoundException({ code: 'NOT_FOUND' });
    const card = await this.db.capabilityCard.findFirst({ where: { id: cardId, workspaceId: identity.workspaceId } });
    if (!card) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.db.cardScore.upsert({
      where: { roundId_cardId: { roundId, cardId } },
      create: { workspaceId: identity.workspaceId, roundId, cardId, score: input.score, note: input.note },
      update: { score: input.score, note: input.note },
    });
    return { score: input.score, note: input.note };
  }

  /** Sets this round's overall interviewer recommendation (separate from per-card scores). */
  async setRecommendation(identity: { workspaceId: string }, roundId: string, raw: unknown) {
    const input = validate(setRecommendationSchema, raw);
    const existing = await this.db.interviewRound.findFirst({ where: { id: roundId, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const updated = await this.db.interviewRound.update({ where: { id: roundId }, data: { recommendation: input.recommendation }, select: ROUND_SELECT });
    return updated;
  }

  /** "Complete session & review" from Live Interview — marks the round as actually having
   * happened (distinct from `status`'s plan-time meaning) so Review/Debrief can rely on it,
   * and ends the round's Zoom meeting (best-effort) so its join link stops working. */
  async complete(identity: Identity, roundId: string) {
    const existing = await this.db.interviewRound.findFirst({ where: { id: roundId, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const updated = await this.db.interviewRound.update({ where: { id: roundId }, data: { status: 'completed', completedAt: new Date() }, select: ROUND_SELECT });
    await this.zoomHost.endMeeting(identity, roundId).catch(() => {});
    return updated;
  }

  private async getTask(workspaceId: string, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    return task;
  }

  private async getInterviewer(workspaceId: string, interviewerId: string) {
    const interviewer = await this.db.interviewer.findFirst({ where: { id: interviewerId, workspaceId } });
    if (!interviewer) throw new BadRequestException({ code: 'INTERVIEWER_NOT_FOUND' });
    return interviewer;
  }
}
