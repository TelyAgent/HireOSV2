import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { splitText } from '../intake/materials.service';
import type { ParseInput } from '../intake/contracts';
import type { Identity } from '../intake/workspace.guard';
import { updateRubricSchema, confirmRubricSchema, validate, type cardGenerationSchema } from './contracts';
import { advanceTasksStatusForJob } from '../intake/task-status';
import type { z } from 'zod';
import { cardLevel, jdRequirements, requirementSegmentId } from './required-levels';
import { JdContentFacade, formatJdText } from '../core-record/jd-content.facade';
import { createHash } from 'node:crypto';
import { claimGenerationSchema } from './claim-contracts';
import { rubricCardSource } from './rubric-source';

const RUBRIC_SELECT = {
  id: true, jobId: true, versionNumber: true, status: true, version: true,
  confirmedBy: true, confirmedAt: true, createdAt: true, sourceParseJobId: true,
  cards: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true, requirement: true, responsibilityType: true, cardPriority: true,
      requiredLevel: true, sourceRequirementId: true,
      competencyTags: true, expectedEvidence: true, levelAnchors: true, weight: true, sourceRefs: true,
    },
  },
} satisfies Prisma.RubricVersionSelect;

type CardDraft = z.infer<typeof cardGenerationSchema>['cards'][number];

@Injectable()
export class RubricService {
  constructor(private readonly db: PrismaService, private readonly jdContent: JdContentFacade) {}

  async candidateClaims(workspaceId: string, taskId: string, generate = false) {
    const task = await this.db.interviewTask.findFirst({ where: { id: taskId, workspaceId },
      include: { resume: { include: { material: true } } } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND' });
    const rubric = await this.db.rubricVersion.findFirst({ where: { workspaceId, jobId: task.jobId }, orderBy: { versionNumber: 'desc' }, include: { cards: { orderBy: { id: 'asc' } } } });
    const material = task.resume?.workspaceId === workspaceId && task.resume.candidateId === task.candidateId && task.resume.material.workspaceId === workspaceId ? task.resume.material : null;
    const base = { taskId, rubricVersionId: rubric?.id ?? null, materialId: material?.id ?? null, materialName: material?.name ?? null };
    if (!rubric || !material) return { ...base, status: 'missing_resume_or_rubric', cards: [] };
    if (material.readStatus !== 'available' || !material.text) return { ...base, status: 'unreadable_resume', cards: [] };
    const segments = splitText(material.text);
    const cards = rubric.cards.map(c => ({ id: c.id, requirement: c.requirement, cardPriority: c.cardPriority, levelAnchors: c.levelAnchors }));
    const sourceId = createHash('sha256').update(JSON.stringify({ rubric: rubric.id, version: rubric.version, material: material.id, segments, cards })).digest('hex');
    const invalidResult = (candidate: { status: string; result: unknown }) => {
      if (candidate.status !== 'needs_review') return false;
      const parsed = claimGenerationSchema.safeParse(candidate.result);
      return !parsed.success || new Set(parsed.data.cards.map(c => c.cardId)).size !== parsed.data.cards.length || parsed.data.cards.some(c =>
        !cards.some(card => card.id === c.cardId) || c.claims.some(ref => !segments.some(s => s.id === ref.segmentId && s.text.includes(ref.quote))));
    };
    const jobs = await this.db.parseJob.findMany({ where: { workspaceId, taskId, type: 'rubric_claims' }, orderBy: { createdAt: 'desc' } });
    let job = jobs.find(j => (j.input as { sourceId?: string })?.sourceId === sourceId);
    if (generate && (!job || job.status === 'failed' || invalidResult(job))) {
      job = await this.db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "InterviewTask" WHERE id = ${taskId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
        const current = await tx.parseJob.findMany({ where: { workspaceId, taskId, type: 'rubric_claims' }, orderBy: { createdAt: 'desc' } });
        const same = current.find(j => (j.input as { sourceId?: string })?.sourceId === sourceId);
        if (same && same.status !== 'failed' && !invalidResult(same)) return same;
        return tx.parseJob.create({ data: { workspaceId, taskId, type: 'rubric_claims', inputVersion: rubric.versionNumber,
          input: { sourceId, segments, cards } as unknown as Prisma.InputJsonValue } });
      });
    }
    const parsed = job?.status === 'needs_review' ? claimGenerationSchema.safeParse(job.result) : null;
    if (parsed && !parsed.success) return { ...base, status: 'failed', cards: [] };
    const result = parsed?.success ? parsed.data : null;
    if (result && (new Set(result.cards.map(c => c.cardId)).size !== result.cards.length || result.cards.some(c =>
      !cards.some(card => card.id === c.cardId) || c.claims.some(ref => !segments.some(s => s.id === ref.segmentId && s.text.includes(ref.quote)))))) {
      return { ...base, status: 'failed', cards: [] };
    }
    return { ...base, status: job?.status ?? 'not_generated', cards: rubric.cards.map(c => ({ cardId: c.id,
      claims: (result?.cards.filter(row => row.cardId === c.id).flatMap(row => row.claims) ?? []).filter(ref => segments.some(s => s.id === ref.segmentId && s.text.includes(ref.quote))),
    })) };
  }

  /**
   * Entry point for the whole capability — usable for any Job regardless of how the
   * task reached this workspace: today the manual "create interview project" flow,
   * and later a hand-off notification from an upstream Resume Screening subsystem.
   * Idempotent per JD version, same pattern as JobsService.review()'s JD-change parse job.
   */
  async generate(workspaceId: string, jobId: string, identity?: Identity) {
    let job = await this.getJobWithParseJobs(workspaceId, jobId);
    if (await this.isLocked(workspaceId, jobId)) throw new ConflictException({ code: 'RUBRIC_LOCKED' });
    // A handoff may carry only prose. Read the authority before generating, not from that lossy payload.
    if (identity && job.coreJobId) {
      const content = await this.jdContent.get(identity, job.coreJobId);
      if (!content) throw new BadRequestException({ code: 'JD_REQUIRED' });
      const requirements = jdRequirements(content.requirements);
      const jdText = formatJdText(content, job.title);
      if (jdText !== job.jdText || JSON.stringify(requirements) !== JSON.stringify(job.jdRequirements)) {
        const updated = await this.db.job.updateMany({ where: { id: jobId, workspaceId, jdVersion: job.jdVersion }, data: { jdText, jdRequirements: requirements, jdVersion: { increment: 1 } } });
        if (!updated.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
        job = await this.getJobWithParseJobs(workspaceId, jobId);
      }
    }
    if (!job.jdText) throw new BadRequestException({ code: 'JD_REQUIRED' });
    const existing = job.parseJobs.find((j) => j.type === 'capability_cards' && j.inputVersion === job.jdVersion && j.status !== 'failed');
    if (existing) return existing;
    const requirements = jdRequirements(job.jdRequirements);
    const input: ParseInput = {
      sourceId: `jd:${job.jdVersion}`, requirements,
      segments: [...splitText(job.jdText), ...requirements.map(r => ({ id: requirementSegmentId(r.id), text: r.label }))],
    };
    return this.db.parseJob.create({ data: {
      jobId, workspaceId, type: 'capability_cards', inputVersion: job.jdVersion,
      input: input as unknown as Prisma.InputJsonValue,
    } });
  }

  /**
   * Returns the current generation status plus the latest materialized rubric version
   * (draft or confirmed), materializing a just-finished AI draft into persisted,
   * editable `CapabilityCard` rows the first time it is read.
   */
  async getRubric(workspaceId: string, jobId: string) {
    const job = await this.getJobWithParseJobs(workspaceId, jobId);
    await this.materializeIfReady(workspaceId, jobId, job);
    const rubric = await this.db.rubricVersion.findFirst({ where: { workspaceId, jobId }, orderBy: { versionNumber: 'desc' }, select: RUBRIC_SELECT });
    const generationJob = job.parseJobs.find((j) => j.type === 'capability_cards' && j.inputVersion === job.jdVersion) ?? null;
    const sourceJob = job.parseJobs.find(p => p.id === rubric?.sourceParseJobId);
    return {
      jobId, jdVersion: job.jdVersion, locked: await this.isLocked(workspaceId, jobId),
      generation: generationJob ? { id: generationJob.id, status: generationJob.status, errorCode: generationJob.errorCode } : null,
      rubric: rubric ? { ...rubric, sourceJdVersion: sourceJob?.inputVersion ?? null,
        cards: rubric.cards.map(card => {
          const source = rubricCardSource(card, sourceJob);
          return { ...card, sourceRefs: source.refs, source };
        }),
      } : null,
    };
  }

  async update(identity: Identity, jobId: string, raw: unknown) {
    const input = validate(updateRubricSchema, raw);
    const draft = await this.requireDraft(identity.workspaceId, jobId);
    return this.db.$transaction(async (tx) => {
      const locked = await tx.rubricVersion.updateMany({ where: { id: draft.id, version: input.version }, data: { version: { increment: 1 } } });
      if (!locked.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      const keepIds = input.cards.filter((c) => c.id).map((c) => c.id!);
      await tx.capabilityCard.deleteMany({ where: { rubricVersionId: draft.id, id: { notIn: keepIds.length ? keepIds : ['__none__'] } } });
      for (const c of input.cards) {
        const prior = draft.cards.find(card => card.id === c.id);
        if (c.id && !prior) throw new BadRequestException({ code: 'CARD_NOT_IN_RUBRIC' });
        const data = {
          ...(prior && prior.requirement !== c.requirement ? { requiredLevel: null, sourceRequirementId: null, sourceRefs: [] } : {}),
          requirement: c.requirement, responsibilityType: c.responsibilityType, cardPriority: c.cardPriority,
          competencyTags: c.competencyTags.join(','), expectedEvidence: c.expectedEvidence,
          levelAnchors: c.levelAnchors as unknown as Prisma.InputJsonValue, weight: c.weight,
        };
        if (c.id) await tx.capabilityCard.update({ where: { id: c.id }, data });
        else await tx.capabilityCard.create({ data: { ...data, workspaceId: identity.workspaceId, rubricVersionId: draft.id, sourceRefs: [] } });
      }
      return tx.rubricVersion.findUniqueOrThrow({ where: { id: draft.id }, select: RUBRIC_SELECT });
    });
  }

  async confirm(identity: Identity, jobId: string, raw: unknown) {
    const input = validate(confirmRubricSchema, raw);
    const draft = await this.requireDraft(identity.workspaceId, jobId);
    const updated = await this.db.rubricVersion.updateMany({
      where: { id: draft.id, version: input.version, status: 'draft' },
      data: { status: 'confirmed', confirmedBy: identity.actorId, confirmedAt: new Date(), version: { increment: 1 } },
    });
    if (!updated.count) throw new ConflictException({ code: 'VERSION_CONFLICT' });
    await this.db.interviewTask.updateMany({ where: { workspaceId: identity.workspaceId, jobId, decision: { not: null } }, data: { packageNeedsReview: true, packageReviewReason: 'RUBRIC_UPDATED', packageInvalidatedAt: new Date() } });
    await advanceTasksStatusForJob(this.db, identity.workspaceId, jobId, 'requirements_ready');
    return this.db.rubricVersion.findUniqueOrThrow({ where: { id: draft.id }, select: RUBRIC_SELECT });
  }

  /** Clones the latest confirmed version into a new editable draft (the "Create new version" action). */
  async newVersion(identity: Identity, jobId: string) {
    const latest = await this.db.rubricVersion.findFirst({
      where: { workspaceId: identity.workspaceId, jobId }, orderBy: { versionNumber: 'desc' }, select: RUBRIC_SELECT,
    });
    if (!latest || latest.status !== 'confirmed') throw new ConflictException({ code: 'RUBRIC_NOT_CONFIRMED' });
    if (await this.isLocked(identity.workspaceId, jobId)) throw new ConflictException({ code: 'RUBRIC_LOCKED' });
    return this.db.rubricVersion.create({
      data: {
        workspaceId: identity.workspaceId, jobId, versionNumber: latest.versionNumber + 1, status: 'draft',
        sourceParseJobId: latest.sourceParseJobId,
        cards: { create: latest.cards.map((c) => ({
          workspaceId: identity.workspaceId, requirement: c.requirement, responsibilityType: c.responsibilityType,
          cardPriority: c.cardPriority, competencyTags: c.competencyTags, expectedEvidence: c.expectedEvidence,
          levelAnchors: c.levelAnchors as unknown as Prisma.InputJsonValue, weight: c.weight,
          sourceRefs: c.sourceRefs as unknown as Prisma.InputJsonValue,
          requiredLevel: c.requiredLevel, sourceRequirementId: c.sourceRequirementId,
        })) },
      },
      select: RUBRIC_SELECT,
    });
  }

  /** A confirmed rubric is frozen once any candidate's interview plan has been confirmed on
   * it — Plan, Brief, Review and Debrief all build on those exact cards from then on. */
  private async isLocked(workspaceId: string, jobId: string) {
    return (await this.db.interviewTask.count({ where: { workspaceId, jobId, planConfirmedAt: { not: null } } })) > 0;
  }

  private async requireDraft(workspaceId: string, jobId: string) {
    const latest = await this.db.rubricVersion.findFirst({ where: { workspaceId, jobId }, orderBy: { versionNumber: 'desc' }, select: RUBRIC_SELECT });
    if (!latest) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (latest.status !== 'draft') throw new ConflictException({ code: 'RUBRIC_NOT_DRAFT' });
    return latest;
  }

  // Turns a completed `capability_cards` ParseJob into a persisted RubricVersion the
  // first time anyone reads it. Keyed by `sourceParseJobId` so a concurrent read never
  // double-materializes the same AI draft, and a JD edit that produces a new draft
  // naturally becomes its own new version rather than overwriting an in-progress one.
  private async materializeIfReady(workspaceId: string, jobId: string, job: { jdVersion: number; parseJobs: { id: string; type: string; inputVersion: number; status: string; result: unknown; input?: unknown }[] }) {
    const ready = job.parseJobs.find((j) => j.type === 'capability_cards' && j.inputVersion === job.jdVersion && j.status === 'needs_review');
    if (!ready) return;
    const already = await this.db.rubricVersion.findFirst({ where: { sourceParseJobId: ready.id } });
    if (already) return;
    const result = ready.result as unknown as z.infer<typeof cardGenerationSchema>;
    await this.db.$transaction(async (tx) => {
      const race = await tx.rubricVersion.findFirst({ where: { sourceParseJobId: ready.id } });
      if (race) return;
      const last = await tx.rubricVersion.findFirst({ where: { jobId }, orderBy: { versionNumber: 'desc' } });
      await tx.rubricVersion.create({ data: {
        workspaceId, jobId, versionNumber: (last?.versionNumber ?? 0) + 1, status: 'draft', sourceParseJobId: ready.id,
        cards: { create: result.cards.map((c: CardDraft) => ({
          ...cardLevel(ready.input, c.segmentId, c.quote),
          workspaceId, requirement: c.requirement, responsibilityType: c.responsibilityType, cardPriority: c.cardPriority,
          competencyTags: c.competencyTags.join(','), expectedEvidence: c.expectedEvidence,
          levelAnchors: c.levelAnchors as unknown as Prisma.InputJsonValue, weight: c.weight,
          sourceRefs: [{ segmentId: c.segmentId, quote: c.quote }] as unknown as Prisma.InputJsonValue,
        })) },
      } });
    });
  }

  private async getJobWithParseJobs(workspaceId: string, jobId: string) {
    const job = await this.db.job.findFirst({
      where: { id: jobId, workspaceId },
      select: {
        id: true, title: true, coreJobId: true, jdText: true, jdVersion: true, jdRequirements: true,
        parseJobs: { where: { workspaceId, type: 'capability_cards' }, orderBy: { createdAt: 'desc' }, select: { id: true, type: true, inputVersion: true, status: true, errorCode: true, result: true, input: true } },
      },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
    return job;
  }
}
