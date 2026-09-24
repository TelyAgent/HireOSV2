import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { attachTaskMaterialSchema, confirmPackageSchema, createTaskSchema, reviewTaskSchema, setDecisionSchema, validate, type ParseInput } from './contracts';
import { CandidatesService } from './candidates.service';
import { RoundsService } from './rounds.service';
import { advanceTaskStatus } from './task-status';
import type { Identity } from './workspace.guard';

@Injectable()
export class TasksService {
  constructor(private readonly db: PrismaService, private readonly candidates: CandidatesService, private readonly rounds: RoundsService) {}

  /** Links one more résumé to an existing Job — the "link candidate" action. */
  async create(identity: Identity, jobId: string, raw: unknown) {
    const input = validate(createTaskSchema, raw);
    const job = await this.db.job.findFirst({ where: { id: jobId, workspaceId: identity.workspaceId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
    const material = await this.db.material.findFirst({ where: { id: input.materialId, workspaceId: identity.workspaceId } });
    if (!material) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (material.readStatus !== 'available') throw new BadRequestException({ code: 'MATERIAL_NOT_AVAILABLE' });
    try {
      const taskId = await this.db.$transaction(async (tx) => {
        const { candidateId, resumeId } = await this.candidates.findOrCreateFromResume(tx, identity.workspaceId, material);
        const task = await tx.interviewTask.create({ data: {
          workspaceId: identity.workspaceId, createdBy: identity.actorId, jobId, candidateId, resumeId,
        } });
        await this.rounds.createDefaultRounds(tx, identity.workspaceId, task.id);
        return task.id;
      });
      return this.get(identity.workspaceId, taskId);
    } catch (error) {
      // A Postgres transaction aborts entirely on the first error, so recovering the
      // existing task (rather than creating a duplicate) has to happen in a fresh query,
      // not inside the same transaction — mirrors JobsService.create's retry-outside pattern.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const resume = await this.db.resume.findUniqueOrThrow({ where: { materialId: material.id } });
        const existing = await this.db.interviewTask.findUniqueOrThrow({ where: { jobId_candidateId: { jobId, candidateId: resume.candidateId } } });
        return this.get(identity.workspaceId, existing.id);
      }
      throw error;
    }
  }

  /** Flat, candidate-centric list backing the "Task list" home view — one row per (Job, Candidate). */
  list(workspaceId: string) {
    return this.db.interviewTask.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 200,
      select: {
        id: true, jobId: true, status: true, reviewed: true, version: true,
        matchScore: true, matchRecommendation: true, createdAt: true,
        job: { select: { title: true } },
        candidate: { select: { id: true, name: true, email: true } },
        rounds: { select: { status: true } },
      } });
  }

  async get(workspaceId: string, id: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id, workspaceId }, include: {
      job: { select: { id: true, title: true, department: true, location: true, level: true, jdText: true, jdVersion: true } },
      candidate: { select: { id: true, name: true, email: true, phone: true } },
      resume: { include: {
        material: { select: { id: true, name: true, text: true, segments: true, readStatus: true, errorCode: true } },
        parseJobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, result: true } },
      } },
      materials: { include: { material: { select: { id: true, name: true, text: true, segments: true, readStatus: true, errorCode: true } } } },
      parseJobs: { orderBy: { createdAt: 'desc' }, select: { id: true, type: true, materialId: true, inputVersion: true, status: true, errorCode: true, result: true, attempt: true } },
      rounds: { orderBy: { sequence: 'asc' }, select: {
        id: true, sequence: true, name: true, format: true, duration: true, competencies: true,
        questions: true, mandatory: true, notes: true, status: true, version: true, createdAt: true,
        interviewer: { select: { id: true, name: true, title: true } },
      } },
    } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    return task;
  }

  async review(identity: Identity, id: string, raw: unknown) {
    const input = validate(reviewTaskSchema, raw);
    await this.get(identity.workspaceId, id);
    await this.db.$transaction(async (tx) => {
      const updated = await tx.interviewTask.updateMany({ where: { id, workspaceId: identity.workspaceId, version: input.version },
        data: { status: input.status, reviewed: true, version: { increment: 1 } } });
      if (!updated.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await tx.revision.create({ data: { taskId: id, actorId: identity.actorId, version: input.version + 1, payload: { ...input, action: 'reviewed' } } });
    });
    return this.get(identity.workspaceId, id);
  }

  async attach(identity: Identity, id: string, raw: unknown) {
    const input = validate(attachTaskMaterialSchema, raw);
    await this.get(identity.workspaceId, id);
    const material = await this.db.material.findFirst({ where: { id: input.materialId, workspaceId: identity.workspaceId } });
    if (!material) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.db.taskMaterial.upsert({
      where: { taskId_materialId: { taskId: id, materialId: material.id } }, update: {},
      create: { taskId: id, materialId: material.id, kind: input.kind },
    });
    return this.get(identity.workspaceId, id);
  }

  /** Debrief roll-up: the job's confirmed capability cards, each paired with its latest
   * human score across any of this task's rounds (a card scored in more than one round
   * takes the most recently updated score — see CardScore). */
  async debrief(workspaceId: string, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId }, select: { jobId: true } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    const rubric = await this.db.rubricVersion.findFirst({
      where: { workspaceId, jobId: task.jobId, status: 'confirmed' }, orderBy: { versionNumber: 'desc' },
      select: { cards: { select: { id: true, requirement: true, cardPriority: true, weight: true } } },
    });
    const cards = rubric?.cards ?? [];
    const rounds = await this.db.interviewRound.findMany({ where: { taskId, workspaceId }, select: { id: true } });
    const roundIds = rounds.map((r) => r.id);
    const scores = roundIds.length && cards.length
      ? await this.db.cardScore.findMany({ where: { roundId: { in: roundIds }, cardId: { in: cards.map((c) => c.id) } }, orderBy: { updatedAt: 'desc' }, select: { cardId: true, score: true } })
      : [];
    const latestByCard = new Map<string, number | null>();
    for (const s of scores) if (!latestByCard.has(s.cardId)) latestByCard.set(s.cardId, s.score);
    const mustHaves = cards.filter((c) => c.cardPriority === 'P0');
    const mustMet = mustHaves.filter((c) => { const value = latestByCard.get(c.id); return value != null && value >= 3; });
    const scoredCount = cards.filter((c) => latestByCard.get(c.id) != null).length;
    const totalWeight = cards.reduce((sum, c) => sum + c.weight, 0);
    const evaluatedWeight = cards.reduce((sum, c) => (latestByCard.get(c.id) != null ? sum + c.weight : sum), 0);
    const unknownCards = cards.filter((c) => latestByCard.get(c.id) == null);
    return {
      totalCards: cards.length, scoredCount,
      mustHaveTotal: mustHaves.length, mustHaveMet: mustMet.length,
      evaluatedWeightPct: totalWeight ? Math.round((evaluatedWeight / totalWeight) * 100) : 0,
      overall: cards.length > 0 && unknownCards.length === 0 ? (mustMet.length === mustHaves.length ? 'pass' : 'fail') : null,
      unknownCards: unknownCards.map((c) => ({ id: c.id, requirement: c.requirement })),
      cards: cards.map((c) => ({ id: c.id, requirement: c.requirement, cardPriority: c.cardPriority, weight: c.weight, score: latestByCard.get(c.id) ?? null })),
    };
  }

  /** One segment per capability card: the requirement plus how it actually scored across
   * this task's rounds. This is both what the decision draft is generated from and what
   * its citations are verified against, so the AI can only describe real scores. */
  private async decisionSegments(workspaceId: string, taskId: string, jobId: string) {
    const rubric = await this.db.rubricVersion.findFirst({
      where: { workspaceId, jobId, status: 'confirmed' }, orderBy: { versionNumber: 'desc' },
      select: { cards: { orderBy: { createdAt: 'asc' }, select: { id: true, requirement: true, cardPriority: true, weight: true } } },
    });
    const cards = rubric?.cards ?? [];
    if (!cards.length) return [];
    const rounds = await this.db.interviewRound.findMany({ where: { taskId, workspaceId }, select: { id: true, name: true } });
    const byRound = new Map(rounds.map((r) => [r.id, r.name]));
    const scores = await this.db.cardScore.findMany({
      where: { roundId: { in: rounds.map((r) => r.id) }, cardId: { in: cards.map((c) => c.id) } },
      orderBy: { updatedAt: 'desc' },
      select: { cardId: true, roundId: true, score: true, note: true, aiScore: true, aiRationale: true },
    });
    const latest = new Map<string, (typeof scores)[number]>();
    for (const s of scores) if (!latest.has(s.cardId)) latest.set(s.cardId, s);
    return cards.map((card) => {
      const s = latest.get(card.id);
      const parts = [
        `要求：${card.requirement}`,
        `优先级：${card.cardPriority}（权重 ${card.weight}%）`,
        s ? `所在轮次：${byRound.get(s.roundId) ?? s.roundId}` : '尚未在任何轮次评分',
        `人工评分：${s?.score ?? '未评分'}`,
        s?.note ? `评分说明：${s.note}` : '',
        s?.aiScore != null ? `AI 评分：${s.aiScore}` : '',
        s?.aiRationale ? `AI 依据：${s.aiRationale}` : '',
      ].filter(Boolean);
      return { id: card.id, text: parts.join('\n') };
    });
  }

  /** Queues the AI decision draft — triggered by "Continue to decision" once every round is
   * complete, so the conclusion is written from the finished scorecard, not a partial one. */
  async generateDecisionDraft(identity: Identity, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId }, select: { jobId: true } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    const rounds = await this.db.interviewRound.findMany({ where: { taskId, workspaceId: identity.workspaceId }, select: { status: true } });
    if (!rounds.length || rounds.some((r) => r.status !== 'completed')) throw new BadRequestException({ code: 'ROUNDS_NOT_COMPLETED' });
    const segments = await this.decisionSegments(identity.workspaceId, taskId, task.jobId);
    if (!segments.length) throw new BadRequestException({ code: 'NO_CONFIRMED_RUBRIC' });
    if (!segments.some((s) => !s.text.includes('人工评分：未评分'))) throw new BadRequestException({ code: 'NO_SCORES' });
    const inFlight = await this.db.parseJob.findFirst({ where: { workspaceId: identity.workspaceId, taskId, type: 'decision_summary', status: { in: ['queued', 'parsing'] } }, select: { id: true, status: true } });
    if (inFlight) return inFlight;
    const existingCount = await this.db.parseJob.count({ where: { workspaceId: identity.workspaceId, taskId, type: 'decision_summary' } });
    const input: ParseInput = { sourceId: taskId, segments };
    const job = await this.db.parseJob.create({ data: {
      workspaceId: identity.workspaceId, taskId, type: 'decision_summary', inputVersion: existingCount + 1,
      input: input as unknown as Prisma.InputJsonValue,
    } });
    return { id: job.id, status: job.status };
  }

  /** The task's decision state plus the status of its AI draft, materializing a finished
   * draft on read (same pattern as rubric cards and round scores). */
  async decision(workspaceId: string, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId }, select: {
      decision: true, decisionAt: true, decisionConclusion: true, decisionSuggested: true, decisionSourceJobId: true,
    } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    const ready = await this.db.parseJob.findFirst({ where: { workspaceId, taskId, type: 'decision_summary', status: 'needs_review' }, orderBy: { inputVersion: 'desc' } });
    let current = task;
    if (ready && ready.id !== task.decisionSourceJobId) {
      const result = ready.result as unknown as { conclusion?: string; suggestedDecision?: string };
      current = await this.db.interviewTask.update({
        where: { id: taskId },
        data: { decisionConclusion: result?.conclusion ?? null, decisionSuggested: result?.suggestedDecision ?? null, decisionSourceJobId: ready.id },
        select: { decision: true, decisionAt: true, decisionConclusion: true, decisionSuggested: true, decisionSourceJobId: true },
      });
    }
    const generation = await this.db.parseJob.findFirst({ where: { workspaceId, taskId, type: 'decision_summary' }, orderBy: { inputVersion: 'desc' }, select: { id: true, status: true, errorCode: true } });
    return {
      decision: current.decision, decisionAt: current.decisionAt,
      conclusion: current.decisionConclusion, suggestedDecision: current.decisionSuggested,
      generation: generation ? { id: generation.id, status: generation.status, errorCode: generation.errorCode } : null,
    };
  }

  /** Records the human's final decision — never written by the AI draft. */
  async setDecision(identity: Identity, taskId: string, raw: unknown) {
    const input = validate(setDecisionSchema, raw);
    const existing = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.db.interviewTask.update({ where: { id: taskId }, data: { decision: input.decision, decisionAt: input.decision ? new Date() : null } });
    await this.syncPackageStatus(identity.workspaceId, taskId);
    return this.decision(identity.workspaceId, taskId);
  }

  /** Nudges status to whichever Evaluation Package milestone is now reached, based on the
   * task's current decision + HR/HM sign-off — called after either changes, regardless of
   * which happened first (setDecision and confirmPackage can fire in either order). */
  private async syncPackageStatus(workspaceId: string, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId },
      select: { decision: true, hrConfirmedAt: true, hmConfirmedAt: true } });
    if (!task || task.decision == null) return;
    if (task.hrConfirmedAt != null && task.hmConfirmedAt != null) await advanceTaskStatus(this.db, workspaceId, taskId, 'package_published');
    else await advanceTaskStatus(this.db, workspaceId, taskId, 'awaiting_confirmation');
  }

  /** Per-card evidence, derived from the same real scoring data the decision draft is
   * grounded in — see decisionSegments. No manual evidence-tagging model exists (transcript
   * lines carry no timecodes), so this is computed, not curated. */
  private async packageEvidence(workspaceId: string, taskId: string, jobId: string) {
    const rubric = await this.db.rubricVersion.findFirst({
      where: { workspaceId, jobId, status: 'confirmed' }, orderBy: { versionNumber: 'desc' },
      select: { cards: { orderBy: { createdAt: 'asc' }, select: { id: true, requirement: true, cardPriority: true, weight: true } } },
    });
    const cards = rubric?.cards ?? [];
    if (!cards.length) return [];
    const rounds = await this.db.interviewRound.findMany({ where: { taskId, workspaceId }, select: { id: true, name: true } });
    const byRound = new Map(rounds.map((r) => [r.id, r.name]));
    const scores = await this.db.cardScore.findMany({
      where: { roundId: { in: rounds.map((r) => r.id) }, cardId: { in: cards.map((c) => c.id) } },
      orderBy: { updatedAt: 'desc' },
      select: { cardId: true, roundId: true, score: true, note: true, aiScore: true, aiRationale: true },
    });
    const latest = new Map<string, (typeof scores)[number]>();
    for (const s of scores) if (!latest.has(s.cardId)) latest.set(s.cardId, s);
    return cards.map((card) => {
      const s = latest.get(card.id);
      const score = s?.score ?? null;
      const tag = score == null ? 'unknown' as const
        : card.cardPriority === 'P0' && score < 3 ? 'weak' as const
        : score >= 4 ? 'strong' as const
        : 'medium' as const;
      return {
        cardId: card.id, requirement: card.requirement, cardPriority: card.cardPriority, weight: card.weight,
        roundName: s ? byRound.get(s.roundId) ?? s.roundId : null,
        score, note: s?.note ?? '', aiScore: s?.aiScore ?? null, aiRationale: s?.aiRationale ?? null, tag,
      };
    });
  }

  /** Evaluation Package: decision, debrief roll-up, derived evidence and HR/Hiring Manager
   * sign-off in one read. Never throws on missing data — same "return an empty-but-honest
   * state" convention as decision()/debrief(). */
  async package(workspaceId: string, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId }, select: {
      jobId: true, hrConfirmedBy: true, hrConfirmedAt: true, hmConfirmedBy: true, hmConfirmedAt: true, offerState: true, offerSentAt: true,
      job: { select: { title: true } }, candidate: { select: { name: true } },
    } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    const [decision, debrief, evidence] = await Promise.all([
      this.decision(workspaceId, taskId),
      this.debrief(workspaceId, taskId),
      this.packageEvidence(workspaceId, taskId, task.jobId),
    ]);
    return {
      candidateName: task.candidate.name, jobTitle: task.job.title,
      decision: decision.decision, decisionAt: decision.decisionAt, conclusion: decision.conclusion,
      debrief, evidence,
      hrConfirmedAt: task.hrConfirmedAt, hmConfirmedAt: task.hmConfirmedAt,
      published: decision.decision != null && task.hrConfirmedAt != null && task.hmConfirmedAt != null,
      offerState: task.offerState, offerSentAt: task.offerSentAt,
    };
  }

  /** HR and Hiring Manager confirm independently — there's no real per-role login in this
   * prototype, so this just records who (the current dev identity) confirmed which slot and
   * when, toggleable like setDecision's null-clears-it pattern. */
  async confirmPackage(identity: Identity, taskId: string, raw: unknown) {
    const input = validate(confirmPackageSchema, raw);
    const existing = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const data = input.role === 'hr'
      ? { hrConfirmedBy: input.confirmed ? identity.actorId : null, hrConfirmedAt: input.confirmed ? new Date() : null }
      : { hmConfirmedBy: input.confirmed ? identity.actorId : null, hmConfirmedAt: input.confirmed ? new Date() : null };
    await this.db.interviewTask.update({ where: { id: taskId }, data });
    await this.syncPackageStatus(identity.workspaceId, taskId);
    return this.package(identity.workspaceId, taskId);
  }

  /** Marks the package as handed off to Offer. No real Offer module exists in this codebase
   * to call, so this is a local, deterministic state transition — not a live downstream ack. */
  async sendOffer(identity: Identity, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId },
      select: { decision: true, hrConfirmedAt: true, hmConfirmedAt: true, offerState: true } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (task.decision !== 'recommend_offer') throw new BadRequestException({ code: 'DECISION_NOT_RECOMMEND_OFFER' });
    if (!task.hrConfirmedAt || !task.hmConfirmedAt) throw new BadRequestException({ code: 'PACKAGE_NOT_CONFIRMED' });
    if (task.offerState === 'sent') throw new ConflictException({ code: 'ALREADY_SENT' });
    await this.db.interviewTask.update({ where: { id: taskId }, data: { offerState: 'sent', offerSentAt: new Date() } });
    return this.package(identity.workspaceId, taskId);
  }
}
