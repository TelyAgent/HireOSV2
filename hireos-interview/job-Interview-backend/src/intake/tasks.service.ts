import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';

export type OfferTimeline = {
  decision: string | null;
  decisionAt: Date | null;
  hrConfirmedAt: Date | null;
  hmConfirmedAt: Date | null;
  offerSentAt: Date | null;
};

export function offerTimelineIssue(timeline: OfferTimeline): string | null {
  if (!timeline.offerSentAt) return null;
  if (timeline.decision !== 'recommend_offer' || !timeline.decisionAt || !timeline.hrConfirmedAt || !timeline.hmConfirmedAt) return 'OFFER_PREREQUISITES_INCOMPLETE';
  const handoffAt = timeline.offerSentAt.getTime();
  if (handoffAt <= timeline.decisionAt.getTime()) return 'OFFER_BEFORE_DECISION';
  if (handoffAt <= timeline.hrConfirmedAt.getTime()) return 'OFFER_BEFORE_HR_CONFIRMATION';
  if (handoffAt <= timeline.hmConfirmedAt.getTime()) return 'OFFER_BEFORE_HM_CONFIRMATION';
  return null;
}
import { PrismaService } from '../persistence/prisma.service';
import { attachTaskMaterialSchema, confirmPackageSchema, confirmPlanSchema, createTaskSchema, reviewTaskSchema, setDecisionSchema, offerAckSchema, validate, type ParseInput } from './contracts';
import { CandidatesService } from './candidates.service';
import { RoundsService } from './rounds.service';
import { advanceTaskStatus } from './task-status';
import { taskStages } from './task-stages';
import { buildPackagePdf, packagePdfLines } from './package-pdf';
import { mergeTranscriptLines } from '../rubric/summary-contracts';
import { CoreRecordClient } from '../core-record/core-record.client';
import type { Identity } from './workspace.guard';


@Injectable()
export class TasksService {
  constructor(
    private readonly db: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly rounds: RoundsService,
    private readonly coreRecord: CoreRecordClient,
  ) {}

  /** Links one more résumé to an existing Job — the "link candidate" action, and the
   * résumé half of the new-task entry (QuickStartService, origin 'quick_start'). */
  async create(identity: Identity, jobId: string, raw: unknown, origin: 'manual' | 'quick_start' = 'manual') {
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
          workspaceId: identity.workspaceId, createdBy: identity.actorId, jobId, candidateId, resumeId, origin,
        } });
        await this.rounds.createDefaultRounds(tx, identity.workspaceId, task.id);
        return task.id;
      });
      await this.linkCore(identity, taskId);
      return this.get(identity.workspaceId, taskId);
    } catch (error) {
      // A Postgres transaction aborts entirely on the first error, so recovering the
      // existing task (rather than creating a duplicate) has to happen in a fresh query,
      // not inside the same transaction — mirrors JobsService.create's retry-outside pattern.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const resume = await this.db.resume.findUniqueOrThrow({ where: { materialId: material.id } });
        const existing = await this.db.interviewTask.findUniqueOrThrow({ where: { jobId_candidateId: { jobId, candidateId: resume.candidateId } } });
        await this.linkCore(identity, existing.id);
        return this.get(identity.workspaceId, existing.id);
      }
      throw error;
    }
  }

  /**
   * Registers the task's candidate and (job, candidate) Application with Core Record, so
   * every subsystem shares the same ids. Runs after the local transaction (it's HTTP) and is
   * idempotent: ids already stored are reused, and Core's own idempotency keys make a retry
   * after a partial failure safe -- a failed call surfaces to the caller, whose retry of the
   * same résumé lands back here through the existing-task path above.
   */
  private async linkCore(identity: Identity, taskId: string) {
    const task = await this.db.interviewTask.findUniqueOrThrow({ where: { id: taskId }, include: { job: true, candidate: true, resume: { include: { material: true } } } });
    if (!task.job.coreJobId) return;
    let coreCandidateId = task.candidate.coreCandidateId;
    if (!coreCandidateId) {
      // The same résumé file seen by another subsystem (Written, Screening) resolves to the
      // candidate it already has; only a task without a Core-stored résumé gets a fresh one.
      const coreMaterialId = task.resume?.material.coreMaterialId;
      const core = coreMaterialId
        ? await this.coreRecord.resolveCandidateForMaterial(identity, { materialId: coreMaterialId, displayName: task.candidate.name, source: 'interview' })
        : await this.coreRecord.createCandidate(identity, { displayName: task.candidate.name, source: 'interview' }, `interview:candidate:${task.candidate.id}`);
      coreCandidateId = core.id;
      try {
        await this.db.candidate.update({ where: { id: task.candidate.id }, data: { coreCandidateId } });
      } catch (error) {
        // Another local candidate already carries this Core id (e.g. a Screening hand-off that
        // arrived without its résumé). Still link the application to the shared candidate;
        // leave the local rows as they are rather than merging them silently.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      }
    }
    if (!task.coreApplicationId) {
      const application = await this.coreRecord.createApplication(identity, {
        candidateId: coreCandidateId, jobId: task.job.coreJobId,
        origin: task.origin === 'quick_start' ? 'interview_quick_start' : 'interview_manual',
        linkReason: 'Résumé linked to the job in Interview',
      }, `interview:application:${task.id}`);
      await this.db.interviewTask.update({ where: { id: task.id }, data: { coreApplicationId: application.id } });
    }
  }

  /** Flat, candidate-centric list backing the "Task list" home view — one row per (Job, Candidate). */
  list(workspaceId: string) {
    return this.db.interviewTask.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 200,
      select: {
        id: true, jobId: true, status: true, reviewed: true, version: true,
        matchScore: true, matchRecommendation: true, createdAt: true,
        job: { select: { title: true } },
        candidate: { select: { id: true, name: true, email: true, possibleDuplicate: true } },
        resume: { select: { material: { select: { id: true, name: true } } } },
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
        scheduledAt: true, timezone: true, completedAt: true,
        interviewer: { select: { id: true, name: true, title: true } },
      } },
    } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    return { ...task, stages: await taskStages(this.db, workspaceId, id) };
  }

  /** "Confirm interview plan" — unlocks Schedule and freezes the plan's rounds. Can be undone
   * only while no round has been scheduled yet; past that the plan is part of the record. */
  async confirmPlan(identity: Identity, taskId: string, raw: unknown) {
    const input = validate(confirmPlanSchema, raw);
    const stages = await taskStages(this.db, identity.workspaceId, taskId);
    if (!stages.find((s) => s.stage === 'plan')!.unlocked) throw new BadRequestException({ code: 'RUBRIC_NOT_CONFIRMED' });
    if (!input.confirmed && stages.find((s) => s.stage === 'schedule')!.done) throw new ConflictException({ code: 'PLAN_ALREADY_SCHEDULED' });
    if (input.confirmed) {
      const rounds = await this.db.interviewRound.findMany({ where: { taskId, workspaceId: identity.workspaceId },
        select: { sequence: true, name: true, interviewerId: true, competencies: true, notes: true } });
      const incomplete = rounds.filter((round) => !round.name.trim() || !round.interviewerId || !round.competencies.trim() || !round.notes.trim());
      if (incomplete.length) throw new BadRequestException({ code: 'PLAN_NOT_READY', rounds: incomplete.map((round) => round.sequence) });
    }
    await this.db.interviewTask.update({ where: { id: taskId }, data: { planConfirmedAt: input.confirmed ? new Date() : null } });
    if (input.confirmed) await advanceTaskStatus(this.db, identity.workspaceId, taskId, 'ready_to_schedule');
    return this.get(identity.workspaceId, taskId);
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
   * takes the most recently updated score — see CardScore), set beside the AI cross-round
   * draft score for the same card (see generateDebriefDraft). Headline numbers only ever
   * count human scores; the AI draft feeds the disagreement list, never the result. */
  async debrief(workspaceId: string, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId }, select: { jobId: true } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    const rubric = await this.db.rubricVersion.findFirst({
      where: { workspaceId, jobId: task.jobId, status: 'confirmed' }, orderBy: { versionNumber: 'desc' },
      select: { cards: { orderBy: { createdAt: 'asc' }, select: { id: true, requirement: true, cardPriority: true, weight: true, requiredLevel: true, sourceRequirementId: true } } },
    });
    const cards = rubric?.cards ?? [];
    const rounds = await this.db.interviewRound.findMany({ where: { taskId, workspaceId }, select: { id: true, sequence: true, name: true, interviewer: { select: { id: true, name: true } } } });
    const roundById = new Map(rounds.map((r) => [r.id, r]));
    const scores = rounds.length && cards.length
      ? await this.db.cardScore.findMany({ where: { workspaceId, roundId: { in: rounds.map((r) => r.id) }, cardId: { in: cards.map((c) => c.id) } }, orderBy: { updatedAt: 'desc' }, select: { cardId: true, roundId: true, score: true, note: true, updatedAt: true, aiQuoteSegmentId: true, aiQuote: true } })
      : [];
    const latestByCard = new Map<string, (typeof scores)[number]>();
    for (const s of scores) if (s.score != null && !latestByCard.has(s.cardId)) latestByCard.set(s.cardId, s);
    const humanScore = (cardId: string) => latestByCard.get(cardId)?.score ?? null;

    const job = await this.db.parseJob.findFirst({ where: { workspaceId, taskId, type: 'debrief_scores' }, orderBy: { inputVersion: 'desc' },
      select: { id: true, status: true, errorCode: true, result: true } });
    const draft = job?.status === 'needs_review'
      ? job.result as unknown as { cards: { cardId: string; score: number | null; rationale: string; quote: string | null }[]; unresolved: string[] }
      : null;
    const aiByCard = new Map((draft?.cards ?? []).map((c) => [c.cardId, c]));

    const mustHaves = cards.filter((c) => c.cardPriority === 'P0');
    const mustMet = mustHaves.filter((c) => { const value = humanScore(c.id); return value != null && c.requiredLevel != null && value >= c.requiredLevel; });
    const unknownRequirements = mustHaves.some(c => c.requiredLevel == null);
    const totalWeight = cards.reduce((sum, c) => sum + c.weight, 0);
    const evaluatedWeight = cards.reduce((sum, c) => (humanScore(c.id) != null ? sum + c.weight : sum), 0);
    const unknownCards = cards.filter((c) => humanScore(c.id) == null);
    const rows = cards.map((c) => {
      const human = latestByCard.get(c.id);
      const round = human ? roundById.get(human.roundId) : undefined;
      const ai = aiByCard.get(c.id);
      return {
        id: c.id, requirement: c.requirement, cardPriority: c.cardPriority, weight: c.weight,
        requiredLevel: c.requiredLevel ?? null, sourceRequirementId: c.sourceRequirementId ?? null,
        score: human?.score ?? null, note: human?.note ?? '', round: round ? { sequence: round.sequence, name: round.name } : null,
        roundScores: scores.filter(s => s.cardId === c.id).map(s => {
          const sourceRound = roundById.get(s.roundId)!;
          return {
            roundId: s.roundId, sequence: sourceRound.sequence, name: sourceRound.name,
            interviewer: sourceRound.interviewer ?? null, score: s.score, note: s.note, updatedAt: s.updatedAt,
            aiEvidence: s.aiQuoteSegmentId && s.aiQuote ? { segmentId: s.aiQuoteSegmentId, quote: s.aiQuote } : null,
          };
        }).sort((a, b) => a.sequence - b.sequence),
        ai: ai ? { score: ai.score, rationale: ai.rationale, quote: ai.quote } : null,
      };
    });
    return {
      bar: null,
      totalCards: cards.length, scoredCount: cards.length - unknownCards.length,
      mustHaveTotal: mustHaves.length, mustHaveMet: mustMet.length,
      evaluatedWeightPct: totalWeight ? Math.round((evaluatedWeight / totalWeight) * 100) : 0,
      overall: cards.length > 0 && unknownCards.length === 0 && !unknownRequirements ? (mustMet.length === mustHaves.length ? 'pass' : 'fail') : null,
      unknownCards: unknownCards.map((c) => ({ id: c.id, requirement: c.requirement })),
      cards: rows,
      // PRD INT-10: every card where the AI draft and the recorded human score are 2+ levels apart.
      mismatches: rows.filter((r) => r.score != null && r.ai?.score != null && Math.abs(r.score - r.ai.score) >= 2)
        .map((r) => ({ cardId: r.id, requirement: r.requirement, human: r.score!, ai: r.ai!.score! })),
      unresolved: draft?.unresolved ?? [],
      generation: job ? { id: job.id, status: job.status, errorCode: job.errorCode } : null,
    };
  }

  /** Queues the AI cross-round draft — one score per confirmed capability card, read from
   * every round's real transcript together. Triggered by "Continue to debrief" once every
   * round is complete. Reuses the latest job when its input is unchanged, so moving back
   * and forth between Review and Debrief doesn't re-run the model for nothing. */
  async generateDebriefDraft(identity: Identity, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId }, select: { jobId: true } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    const rounds = await this.db.interviewRound.findMany({ where: { taskId, workspaceId: identity.workspaceId }, orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, name: true, status: true } });
    if (!rounds.length || rounds.some((r) => r.status !== 'completed')) throw new BadRequestException({ code: 'ROUNDS_NOT_COMPLETED' });
    // "Continue to debrief" is Review's confirmation — recorded before the AI draft's own
    // preconditions, since Debrief opens (and can retry the draft) regardless of them.
    await this.db.interviewTask.updateMany({ where: { id: taskId, reviewConfirmedAt: null }, data: { reviewConfirmedAt: new Date() } });
    const rubric = await this.db.rubricVersion.findFirst({
      where: { workspaceId: identity.workspaceId, jobId: task.jobId, status: 'confirmed' }, orderBy: { versionNumber: 'desc' },
      select: { cards: { orderBy: { createdAt: 'asc' }, select: { id: true, requirement: true, cardPriority: true, levelAnchors: true } } },
    });
    const cards = rubric?.cards ?? [];
    if (!cards.length) throw new BadRequestException({ code: 'NO_CONFIRMED_RUBRIC' });
    const lines = await this.db.transcriptLine.findMany({ where: { roundId: { in: rounds.map((r) => r.id) } }, orderBy: { createdAt: 'asc' }, select: { id: true, roundId: true, speaker: true, text: true } });
    if (!lines.length) throw new BadRequestException({ code: 'NO_TRANSCRIPT' });
    const segments = rounds.flatMap((r) => mergeTranscriptLines(lines.filter((l) => l.roundId === r.id), `[第 ${r.sequence} 轮（${r.name}）] `));
    const input: ParseInput = { sourceId: taskId, segments, cards };
    const latest = await this.db.parseJob.findFirst({ where: { workspaceId: identity.workspaceId, taskId, type: 'debrief_scores' }, orderBy: { inputVersion: 'desc' },
      select: { id: true, status: true, input: true, inputVersion: true } });
    if (latest && latest.status !== 'failed' && JSON.stringify(latest.input) === JSON.stringify(input)) return { id: latest.id, status: latest.status };
    const job = await this.db.parseJob.create({ data: {
      workspaceId: identity.workspaceId, taskId, type: 'debrief_scores', inputVersion: (latest?.inputVersion ?? 0) + 1,
      input: input as unknown as Prisma.InputJsonValue,
    } });
    return { id: job.id, status: job.status };
  }

  /** One segment per capability card: the requirement plus how it actually scored across
   * this task's rounds. This is both what the decision draft is generated from and what
   * its citations are verified against, so the AI can only describe real scores. */
  private async decisionSegments(workspaceId: string, taskId: string, jobId: string) {
    const rubric = await this.db.rubricVersion.findFirst({
      where: { workspaceId, jobId, status: 'confirmed' }, orderBy: { versionNumber: 'desc' },
      select: { cards: { orderBy: { createdAt: 'asc' }, select: { id: true, requirement: true, cardPriority: true, weight: true, requiredLevel: true } } },
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
        `要求等级：${card.requiredLevel == null ? '未记录' : `L${card.requiredLevel}`}`,
        `达标状态：${s?.score == null || card.requiredLevel == null ? '未知' : s.score >= card.requiredLevel ? '达标' : '未达标'}`,
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
    // "Continue to decision" is Debrief's confirmation.
    await this.db.interviewTask.updateMany({ where: { id: taskId, debriefConfirmedAt: null }, data: { debriefConfirmedAt: new Date() } });
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
      decision: true, decisionAt: true, decisionReason: true, decisionBy: true, decisionVersion: true, decisionConclusion: true, decisionSuggested: true, decisionSourceJobId: true,
    } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    const ready = await this.db.parseJob.findFirst({ where: { workspaceId, taskId, type: 'decision_summary', status: 'needs_review' }, orderBy: { inputVersion: 'desc' } });
    let current = task;
    if (ready && ready.id !== task.decisionSourceJobId) {
      const result = ready.result as unknown as { conclusion?: string; suggestedDecision?: string };
      current = await this.db.interviewTask.update({
        where: { id: taskId },
        data: { decisionConclusion: result?.conclusion ?? null, decisionSuggested: result?.suggestedDecision ?? null, decisionSourceJobId: ready.id },
        select: { decision: true, decisionAt: true, decisionReason: true, decisionBy: true, decisionVersion: true, decisionConclusion: true, decisionSuggested: true, decisionSourceJobId: true },
      });
    }
    const generation = await this.db.parseJob.findFirst({ where: { workspaceId, taskId, type: 'decision_summary' }, orderBy: { inputVersion: 'desc' }, select: { id: true, status: true, errorCode: true } });
    const source = current.decisionSourceJobId ? await this.db.parseJob.findFirst({ where: { id: current.decisionSourceJobId, workspaceId, taskId, type: 'decision_summary', status: 'needs_review' }, select: { id: true, input: true, result: true, createdAt: true } }) : null;
    const input = source?.input as { segments?: { id: string; text: string }[] } | null;
    const output = source?.result as { citations?: { segmentId: string; quote: string }[] } | null;
    const citations = Array.isArray(output?.citations) ? output.citations.flatMap(c => {
      if (typeof c?.segmentId !== 'string' || typeof c?.quote !== 'string' || !c.quote.trim()) return [];
      const segment = Array.isArray(input?.segments) ? input.segments.find(s => s?.id === c.segmentId && typeof s.text === 'string' && s.text.includes(c.quote)) : null;
      return [{ segmentId: c.segmentId, quote: c.quote, sourceJobId: source!.id, generatedAt: source!.createdAt, snapshot: segment?.text ?? null }];
    }) : [];
    return {
      decision: current.decision, decisionAt: current.decisionAt,
      decisionReason: current.decisionReason ?? null, decisionBy: current.decisionBy ?? null, decisionVersion: current.decisionVersion || null, citations,
      conclusion: current.decisionConclusion, suggestedDecision: current.decisionSuggested,
      generation: generation ? { id: generation.id, status: generation.status, errorCode: generation.errorCode } : null,
    };
  }

  /** Records the human's final decision — never written by the AI draft. */
  async setDecision(identity: Identity, taskId: string, raw: unknown) {
    const input = validate(setDecisionSchema, raw);
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "InterviewTask" WHERE id = ${taskId} AND "workspaceId" = ${identity.workspaceId} FOR UPDATE`;
      const existing = await tx.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId } });
      if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
      if (existing.debriefConfirmedAt == null && existing.decision == null) throw new BadRequestException({ code: 'DEBRIEF_NOT_CONFIRMED' });
      const reason = input.reason ?? (input.decision === existing.decision ? existing.decisionReason : null);
      if (existing.decisionBy === identity.actorId && existing.decision === input.decision && existing.decisionReason === reason) return;
      if (input.version !== undefined && input.version !== existing.decisionVersion) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      const at = new Date();
      const decisionVersion = existing.decisionVersion + 1;
      await tx.interviewTask.update({ where: { id: taskId }, data: { decision: input.decision, decisionAt: input.decision ? at : null, decisionReason: reason, decisionBy: identity.actorId, decisionVersion, version: { increment: 1 } } });
      await tx.revision.create({ data: { taskId, actorId: identity.actorId, version: existing.version + 1,
        payload: { kind: 'stage_decision', decision: input.decision, reason, decisionVersion, decidedAt: at.toISOString() } } });
    });
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
      select: { cards: { orderBy: { createdAt: 'asc' }, select: { id: true, requirement: true, expectedEvidence: true, levelAnchors: true, cardPriority: true, weight: true } } },
    });
    const cards = rubric?.cards ?? [];
    if (!cards.length) return [];
    const rounds = await this.db.interviewRound.findMany({ where: { taskId, workspaceId }, select: { id: true, name: true } });
    const byRound = new Map(rounds.map((r) => [r.id, r.name]));
    const scores = await this.db.cardScore.findMany({
      where: { roundId: { in: rounds.map((r) => r.id) }, cardId: { in: cards.map((c) => c.id) } },
      orderBy: { updatedAt: 'desc' },
      select: { cardId: true, roundId: true, score: true, note: true, aiScore: true, aiRationale: true, aiQuoteSegmentId: true, aiQuote: true },
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
        cardId: card.id, requirement: card.requirement, expectedEvidence: card.expectedEvidence, levelAnchors: card.levelAnchors, cardPriority: card.cardPriority, weight: card.weight,
        sourceRefs: s?.aiQuoteSegmentId && s.aiQuote ? [{ segmentId: s.aiQuoteSegmentId, quote: s.aiQuote }] : [],
        roundId: s?.roundId ?? null, roundName: s ? byRound.get(s.roundId) ?? s.roundId : null,
        score, note: s?.note ?? '', aiScore: s?.aiScore ?? null, aiRationale: s?.aiRationale ?? null, tag,
      };
    });
  }

  /** Evaluation Package: decision, debrief roll-up, derived evidence and HR/Hiring Manager
   * sign-off in one read. Never throws on missing data — same "return an empty-but-honest
   * state" convention as decision()/debrief(). */
  private async packageCurrent(workspaceId: string, taskId: string) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId }, select: {
      jobId: true, version: true, updatedAt: true, packageNeedsReview: true, packageReviewReason: true, packageInvalidatedAt: true, hrConfirmedBy: true, hrConfirmedAt: true, hrConfirmationNote: true, hmConfirmedBy: true, hmConfirmedAt: true, hmConfirmationNote: true, offerState: true, offerSentAt: true, offerAckAt: true, offerAttemptId: true, offerPackageVersion: true, offerError: true,
      job: { select: { title: true } }, candidate: { select: { name: true } },
    } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    const [decision, debrief, evidence, rubric] = await Promise.all([
      this.decision(workspaceId, taskId),
      this.debrief(workspaceId, taskId),
      this.packageEvidence(workspaceId, taskId, task.jobId),
      this.db.rubricVersion.findFirst({ where: { workspaceId, jobId: task.jobId, status: 'confirmed' }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } }),
    ]);
    return {
      candidateName: task.candidate.name, jobTitle: task.job.title,
      packageId: taskId, rubricVersion: rubric?.versionNumber ?? null,
      needsReview: task.packageNeedsReview, reviewReason: task.packageReviewReason, invalidatedAt: task.packageInvalidatedAt,
      decision: decision.decision, decisionAt: decision.decisionAt, conclusion: decision.conclusion,
      debrief, evidence,
      hrConfirmedBy: task.hrConfirmedBy, hrConfirmedAt: task.hrConfirmedAt,
      hrConfirmationNote: task.hrConfirmationNote,
      hmConfirmedBy: task.hmConfirmedBy, hmConfirmedAt: task.hmConfirmedAt,
      hmConfirmationNote: task.hmConfirmationNote,
      published: decision.decision != null && task.hrConfirmedAt != null && task.hmConfirmedAt != null,
      offerTimelineIssue: offerTimelineIssue({ decision: decision.decision, decisionAt: decision.decisionAt, hrConfirmedAt: task.hrConfirmedAt, hmConfirmedAt: task.hmConfirmedAt, offerSentAt: task.offerSentAt }),
      offerState: task.offerState, offerSentAt: task.offerSentAt,
      offerAckAt: task.offerAckAt, offerAttemptId: undefined, offerPackageVersion: task.offerPackageVersion, offerError: task.offerError,
    };
  }

  async package(workspaceId: string, taskId: string) {
    return this.packageTransaction(reader => reader.materializePackage(workspaceId, taskId));
  }

  private async packageTransaction<T>(operation: (reader: TasksService) => Promise<T>): Promise<T> {
    // Read and freeze one consistent source snapshot. Concurrent readers retry rather
    // than assigning duplicate versions or freezing a mixture of two revisions.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(async (tx) => {
          const reader = new TasksService(tx as PrismaService, this.candidates, this.rounds, this.coreRecord);
          return operation(reader);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) continue;
        throw error;
      }
    }
    throw new ConflictException({ code: 'PACKAGE_VERSION_CONFLICT' });
  }

  private async materializePackage(workspaceId: string, taskId: string) {
    const current = await this.packageCurrent(workspaceId, taskId);
    const { offerState, offerSentAt, offerAckAt, offerAttemptId, offerPackageVersion, offerError, offerTimelineIssue,
      needsReview, reviewReason, invalidatedAt, ...content } = current;
    // Delivery/invalidations are live operational state, not new content revisions.
    const serialized = JSON.stringify(content);
    const contentHash = createHash('sha256').update(serialized).digest('hex');
    let record = await this.db.evaluationPackageVersion.findFirst({ where: { workspaceId, taskId }, orderBy: { version: 'desc' } });
    if (!record || record.contentHash !== contentHash) {
      record = await this.db.evaluationPackageVersion.create({ data: {
        workspaceId, taskId, version: (record?.version ?? 0) + 1, contentHash, createdAt: new Date(),
        content: JSON.parse(serialized) as Prisma.InputJsonValue,
      } });
    }
    return { ...content, packageVersion: record.version, generatedAt: record.createdAt, historical: false,
      needsReview, reviewReason, invalidatedAt,
      offerState, offerSentAt, offerAckAt, offerAttemptId, offerPackageVersion, offerError, offerTimelineIssue };
  }

  async packageEvents(workspaceId: string, taskId: string) {
    if (!await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId }, select: { id: true } })) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.db.evaluationPackageEvent.findMany({ where: { workspaceId, taskId }, orderBy: { sequence: 'asc' } });
  }

  async packageVersions(workspaceId: string, taskId: string) {
    if (!await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId }, select: { id: true } })) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.db.evaluationPackageVersion.findMany({ where: { workspaceId, taskId }, orderBy: { version: 'desc' }, select: { version: true, createdAt: true } });
  }

  async packageVersion(workspaceId: string, taskId: string, version: number) {
    if (!Number.isSafeInteger(version) || version < 1) throw new BadRequestException({ code: 'INVALID_PACKAGE_VERSION' });
    const record = await this.db.evaluationPackageVersion.findFirst({ where: { workspaceId, taskId, version } });
    if (!record) throw new NotFoundException({ code: 'NOT_FOUND' });
    const content = record.content as unknown as Awaited<ReturnType<TasksService['packageCurrent']>>;
    return { ...content, packageVersion: record.version, generatedAt: record.createdAt, historical: true,
      decisionAt: content.decisionAt ? new Date(content.decisionAt) : null,
      hrConfirmedAt: content.hrConfirmedAt ? new Date(content.hrConfirmedAt) : null,
      hmConfirmedAt: content.hmConfirmedAt ? new Date(content.hmConfirmedAt) : null,
      needsReview: false, reviewReason: null, invalidatedAt: null,
      offerState: 'none', offerSentAt: null, offerAckAt: null, offerPackageVersion: null, offerError: null, offerTimelineIssue: null };
  }

  async packagePdf(workspaceId: string, taskId: string, version?: number) {
    const data = version === undefined ? await this.package(workspaceId, taskId) : await this.packageVersion(workspaceId, taskId, version);
    return buildPackagePdf(packagePdfLines(data));
  }

  /** HR and Hiring Manager confirm independently — there's no real per-role login in this
   * prototype, so this just records who (the current dev identity) confirmed which slot and
   * when, toggleable like setDecision's null-clears-it pattern. */
  async confirmPackage(identity: Identity, taskId: string, raw: unknown) {
    return this.packageTransaction(reader => reader.confirmPackageWithEvent(identity, taskId, raw));
  }

  private async confirmPackageWithEvent(identity: Identity, taskId: string, raw: unknown) {
    const input = validate(confirmPackageSchema, raw);
    const existing = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const data = input.role === 'hr'
      ? { hrConfirmedBy: input.confirmed ? identity.actorId : null, hrConfirmedAt: input.confirmed ? new Date() : null, hrConfirmationNote: input.confirmed ? input.note ?? null : null }
      : { hmConfirmedBy: input.confirmed ? identity.actorId : null, hmConfirmedAt: input.confirmed ? new Date() : null, hmConfirmationNote: input.confirmed ? input.note ?? null : null };
    await this.db.interviewTask.update({ where: { id: taskId }, data });
    await this.syncPackageStatus(identity.workspaceId, taskId);
    const result = await this.materializePackage(identity.workspaceId, taskId);
    await this.db.evaluationPackageEvent.create({ data: {
      workspaceId: identity.workspaceId, taskId, packageVersion: result.packageVersion,
      action: input.confirmed ? 'confirmed' : 'unconfirmed', role: input.role, actorId: identity.actorId,
      createdAt: new Date(),
      hrConfirmedAt: result.hrConfirmedAt, hmConfirmedAt: result.hmConfirmedAt,
    } });
    return result;
  }

  /** Marks the package as handed off to Offer. No real Offer module exists in this codebase
   * to call, so this is a local, deterministic state transition — not a live downstream ack. */
  async sendOffer(identity: Identity, taskId: string) {
    return this.packageTransaction(reader => reader.sendOfferWithEvent(identity, taskId));
  }

  private async sendOfferWithEvent(identity: Identity, taskId: string) {
    const packageData = await this.materializePackage(identity.workspaceId, taskId);
    if (packageData.needsReview) throw new ConflictException({ code: 'PACKAGE_REVIEW_REQUIRED' });
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId },
      select: { decision: true, decisionAt: true, version: true, hrConfirmedAt: true, hmConfirmedAt: true, offerState: true, offerSentAt: true } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (task.decision !== 'recommend_offer') throw new BadRequestException({ code: 'DECISION_NOT_RECOMMEND_OFFER' });
    if (!task.decisionAt || !task.hrConfirmedAt || !task.hmConfirmedAt) throw new BadRequestException({ code: 'PACKAGE_NOT_CONFIRMED' });
    if (task.decision !== packageData.decision || task.decisionAt.getTime() !== packageData.decisionAt?.getTime()
      || task.hrConfirmedAt.getTime() !== packageData.hrConfirmedAt?.getTime() || task.hmConfirmedAt.getTime() !== packageData.hmConfirmedAt?.getTime()) {
      throw new ConflictException({ code: 'PACKAGE_VERSION_CONFLICT' });
    }
    const attemptId = randomUUID();
    const now = new Date();
    const orderIssue = offerTimelineIssue({ ...task, offerSentAt: now });
    if (orderIssue) throw new BadRequestException({ code: orderIssue });
    const timeoutBefore = new Date(now.getTime() - 5 * 60 * 1000);
    const claimed = await this.db.interviewTask.updateMany({
      where: { id: taskId, workspaceId: identity.workspaceId, decision: task.decision, decisionAt: task.decisionAt, hrConfirmedAt: task.hrConfirmedAt, hmConfirmedAt: task.hmConfirmedAt, OR: [
        { offerState: { in: ['none', 'failed', 'sent'] } },
        { offerState: 'pending', offerSentAt: { lt: timeoutBefore } },
      ] },
      data: { offerState: 'pending', offerSentAt: now, offerAckAt: null, offerAttemptId: attemptId, offerPackageVersion: packageData.packageVersion, offerError: null },
    });
    if (!claimed.count) {
      const current = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId }, select: { offerState: true } });
      if (current?.offerState === 'acknowledged') throw new ConflictException({ code: 'ALREADY_SENT' });
      if (current?.offerState === 'pending') throw new ConflictException({ code: 'OFFER_PENDING' });
      throw new ConflictException({ code: 'OFFER_STATE_CHANGED' });
    }
    await this.db.evaluationPackageEvent.create({ data: {
      workspaceId: identity.workspaceId, taskId, packageVersion: packageData.packageVersion,
      action: 'handoff_requested', actorId: identity.actorId, createdAt: now,
      hrConfirmedAt: task.hrConfirmedAt, hmConfirmedAt: task.hmConfirmedAt,
    } });
    return { ...(await this.materializePackage(identity.workspaceId, taskId)), offerAttemptId: attemptId };
  }

  /** Offer's idempotent delivery callback. A stale attempt can never overwrite a newer one. */
  async acknowledgeOffer(identity: Identity, taskId: string, raw: unknown) {
    const input = validate(offerAckSchema, raw);
    if (identity.kind !== 'service') throw new BadRequestException({ code: 'SERVICE_AUTH_REQUIRED' });
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId: identity.workspaceId }, select: { offerAttemptId: true, offerState: true } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (task.offerAttemptId !== input.attemptId) throw new ConflictException({ code: 'STALE_OFFER_ATTEMPT' });
    if (task.offerState === 'acknowledged' && input.acknowledged) return this.package(identity.workspaceId, taskId);
    const updated = await this.db.interviewTask.updateMany({ where: { id: taskId, workspaceId: identity.workspaceId, offerAttemptId: input.attemptId, offerState: 'pending' }, data: input.acknowledged
      ? { offerState: 'acknowledged', offerAckAt: new Date(), offerError: null }
      : { offerState: 'failed', offerAckAt: null, offerError: input.error ?? 'OFFER_ACK_FAILED' } });
    if (!updated.count) throw new ConflictException({ code: 'STALE_OFFER_ATTEMPT' });
    return this.package(identity.workspaceId, taskId);
  }
}
