/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { invalidSchemaFromZod } from '../http/invalid-schema';
import { asSegments, locateQuote } from '../shared/locate-quote';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { AiScreeningEvaluatorService } from './ai-screening-evaluator.service';
import { AiCallError } from '../shared/ai-json-client';
import { handoffStatusOf, serializeDecision, type HandoffStatus } from '../decisions/decisions.service';
import { AI_EVALUATOR, LOCAL_EVALUATOR, canReuseEvaluation, evaluationInputHash, evaluationMetadata } from './evaluation-identity';

type DimensionInput = { id: string; name: string; weight: number; rubric: string };
type RequirementInput = {
  id: string;
  label: string;
  dimension: string;
  priority: 'must_have' | 'nice_to_have';
  hard: boolean;
  kind: 'authorization' | 'experience' | 'skill' | 'other';
};

type NormalizedDimensionResult = DimensionInput & {
  status: 'evaluated' | 'unknown';
  score: number | null;
  confidence: number | null;
  reason: string;
  evidenceQuote: string | null;
};

type NormalizedRequirementResult = {
  requirementId: string;
  status: 'met' | 'not_met' | 'unknown';
  reason: string;
  evidenceQuote: string | null;
};

@Injectable()
export class ScreeningService {
  // Screening runs currently in progress, keyed by application id. Confirming a link
  // auto-starts a run in the background (see LinkingService), and the AI evaluator is
  // slow, so a recruiter who opens the application and clicks "Run screening" meanwhile
  // would start a second run that races the first for the same version number. A new
  // request for an application that is already running joins the in-flight run instead.
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly db: PrismaService,
    private readonly aiEvaluator: AiScreeningEvaluatorService,
  ) {}

  async getDetail(identity: Identity, applicationId: string) {
    const application = await this.findApplication(identity, applicationId);
    const evaluation = await this.currentEvaluation(identity.workspaceId, applicationId);
    const decision = await this.db.screeningDecision.findFirst({
      where: { workspaceId: identity.workspaceId, applicationId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      include: { evaluation: true },
    });
    // Withdrawn decisions stay readable as history (issue #23).
    const withdrawnDecisions = await this.db.screeningDecision.findMany({
      where: { workspaceId: identity.workspaceId, applicationId, status: 'withdrawn' },
      orderBy: { withdrawnAt: 'desc' },
      include: { evaluation: true },
    });
    // Every snapshot, newest first (#19): earlier results stay readable after a refresh.
    const history = await this.db.screeningEvaluation.findMany({
      where: { workspaceId: identity.workspaceId, applicationId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, overallScore: true, coverage: true, completedAt: true, createdAt: true, modelVersion: true, evaluationMode: true, aiStatus: true, freshness: true },
    });
    // The decision's handoff, written with it in one transaction, so the page can say whether it was sent (#214).
    const handoffEvents = decision
      ? await this.db.screeningOutboxEvent.findMany({
          where: {
            workspaceId: identity.workspaceId,
            aggregateId: applicationId,
            eventType: { in: ['candidate.advanced_to_interview', 'candidate.assessment_requested'] },
            createdAt: { gte: decision.createdAt },
          },
          select: { status: true },
        })
      : [];
    const detail = this.serializeDetail(application, evaluation, decision, decision ? handoffStatusOf(decision, handoffEvents) : undefined);
    return {
      ...detail,
      // Each evidence item with the paragraph it came from, so "Evidence (N)" opens real excerpts (#192).
      evaluation: detail.evaluation && evaluation ? { ...detail.evaluation, evidence: await this.evidenceOf(identity.workspaceId, evaluation) } : detail.evaluation,
      withdrawnDecisions: withdrawnDecisions.map((withdrawn) => serializeDecision(withdrawn)),
      history: history.map(serializeSnapshotSummary),
      screeningInProgress: this.inFlight.has(applicationId),
    };
  }

  async listEvaluations(identity: Identity, applicationId: string) {
    await this.findApplication(identity, applicationId);
    const evaluations = await this.db.screeningEvaluation.findMany({
      where: { workspaceId: identity.workspaceId, applicationId },
      orderBy: { version: 'desc' },
      include: { dimensionScores: true, concerns: true, verificationItems: true, humanAssessments: true, evidenceItems: true },
    });
    return Promise.all(evaluations.map(async (evaluation) => ({
      ...serializeEvaluation(evaluation),
      evidence: await this.evidenceOf(identity.workspaceId, evaluation),
    })));
  }

  /**
   * An evaluation's evidence as the reviewer sees it (#192): source material and résumé version, the excerpt,
   * where it sits (page / paragraph) and whether it was found there. A quote the material doesn't contain is
   * "not_located"; a material that can't be read is "source_unavailable" — never shown as verified.
   */
  private async evidenceOf(workspaceId: string, evaluation: { evidenceItems?: Array<Record<string, unknown>> }) {
    const items = evaluation.evidenceItems ?? [];
    const materialIds = [...new Set(items.map((item) => item.materialId).filter((id): id is string => typeof id === 'string'))];
    const materials = materialIds.length
      ? await this.db.material.findMany({
          where: { workspaceId, id: { in: materialIds } },
          select: { id: true, name: true, readStatus: true, segments: true, resumeVersion: { select: { version: true } } },
        })
      : [];
    const byId = new Map(materials.map((material) => [material.id, material]));
    return items.map((item) => {
      const material = typeof item.materialId === 'string' ? byId.get(item.materialId) : undefined;
      const segments = asSegments(material?.segments);
      const readable = !!material && material.readStatus === 'available' && segments.length > 0;
      const location = readable ? locateQuote(segments, String(item.statement ?? '')) : null;
      return {
        id: String(item.id),
        materialId: material?.id,
        resumeVersion: material?.resumeVersion?.version,
        sourceLabel: String(item.sourceLabel ?? material?.name ?? 'Resume'),
        kind: String(item.kind ?? 'documented_fact'),
        statement: String(item.statement ?? ''),
        location,
        located: !readable ? 'source_unavailable' : location ? 'located' : 'not_located',
        verification: String(item.verification ?? 'unverified'),
        confidence: typeof item.confidence === 'number' ? item.confidence : null,
        availability: String(item.availability ?? 'available'),
      };
    });
  }

  async run(identity: Identity, applicationId: string, purpose: string) {
    const application = await this.findApplication(identity, applicationId);
    return this.singleFlight(applicationId, () => this.runFor(identity, application, purpose));
  }

  async captureBatchInput(identity: Identity, applicationId: string, tx: Prisma.TransactionClient) {
    const input = await this.loadInputs(identity.workspaceId, applicationId, tx);
    if (input.job.criteriaStatus !== 'confirmed' || !input.criteria) throw new ConflictException({ code: 'CRITERIA_NOT_CONFIRMED' });
    if (input.profile?.parseStatus !== 'succeeded') throw new ConflictException({ code: 'PROFILE_NOT_READY' });
    return json(JSON.parse(JSON.stringify({ schemaVersion: 1, input, aiConfigured: this.aiEvaluator.isConfigured(), model: this.aiEvaluator.isConfigured() ? this.aiEvaluator.modelName() : null,
      evaluator: this.aiEvaluator.isConfigured() ? AI_EVALUATOR : LOCAL_EVALUATOR })));
  }

  async runBatchInput(identity: Identity, snapshot: Prisma.JsonValue, itemId: string, leaseToken: string) {
    const saved = snapshot as unknown as { schemaVersion: number; input: EvaluationInputs; aiConfigured: boolean; model: string | null; evaluator: string };
    if (saved.input?.application?.workspaceId !== identity.workspaceId) throw new ConflictException({ code: 'BATCH_SNAPSHOT_INVALID' });
    if (saved.schemaVersion !== 1 || saved.aiConfigured !== this.aiEvaluator.isConfigured() ||
      saved.model !== (this.aiEvaluator.isConfigured() ? this.aiEvaluator.modelName() : null) ||
      saved.evaluator !== (this.aiEvaluator.isConfigured() ? AI_EVALUATOR : LOCAL_EVALUATOR)) {
      throw new ConflictException({ code: 'BATCH_EVALUATOR_CHANGED' });
    }
    return this.createEvaluation(identity, saved.input.application, saved.input, 1, 'batch', { itemId, leaseToken });
  }

  private async runFor(identity: Identity, application: ApplicationInput, purpose: string) {
    const applicationId = application.id;
    const input = await this.loadInputs(identity.workspaceId, applicationId);
    if (input.job.criteriaStatus !== 'confirmed' || !input.criteria) {
      throw new ConflictException({ code: 'CRITERIA_NOT_CONFIRMED' });
    }
    if (!input.profile) throw new ConflictException({ code: 'PROFILE_NOT_READY' });
    if (input.profile.parseStatus !== 'succeeded') {
      throw new ConflictException({ code: 'PROFILE_NOT_READY', status: input.profile.parseStatus });
    }

    const version = await this.db.screeningEvaluation.aggregate({
      where: { workspaceId: identity.workspaceId, applicationId },
      _max: { version: true },
    });
    return this.createEvaluation(identity, application, input, (version._max.version || 0) + 1, purpose);
  }

  async refresh(identity: Identity, evaluationId: string) {
    const previous = await this.db.screeningEvaluation.findFirst({
      where: { id: evaluationId, workspaceId: identity.workspaceId },
      include: { application: true },
    });
    if (!previous) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.singleFlight(previous.applicationId, () => this.refreshFrom(identity, previous));
  }

  private async refreshFrom(identity: Identity, previous: { applicationId: string; version: number; application: ApplicationInput }) {
    const input = await this.loadInputs(identity.workspaceId, previous.applicationId);
    if (input.job.criteriaStatus !== 'confirmed' || !input.criteria) {
      throw new ConflictException({ code: 'CRITERIA_NOT_CONFIRMED' });
    }
    if (!input.profile || input.profile.parseStatus !== 'succeeded') {
      throw new ConflictException({ code: 'PROFILE_NOT_READY' });
    }
    return this.createEvaluation(
      identity,
      previous.application,
      input,
      previous.version + 1,
      'rescreen',
    );
  }

  async saveHumanAssessment(
    identity: Identity,
    evaluationId: string,
    raw: { dimensionId?: string; dimensionName?: string; score?: number; reason?: string },
  ) {
    const evaluation = await this.db.screeningEvaluation.findFirst({
      where: { id: evaluationId, workspaceId: identity.workspaceId },
      include: { dimensionScores: true },
    });
    if (!evaluation) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!raw.dimensionId || !raw.dimensionName || raw.score == null || raw.score < 0 || raw.score > 100 || !raw.reason?.trim()) {
      throw new BadRequestException({ code: 'INVALID_HUMAN_ASSESSMENT' });
    }
    const dimension = evaluation.dimensionScores.find((item) => item.dimensionId === raw.dimensionId);
    if (!dimension || dimension.name !== raw.dimensionName) {
      throw new BadRequestException({ code: 'DIMENSION_NOT_FOUND' });
    }
    const assessment = await this.db.humanAssessment.upsert({
      where: { evaluationId_dimensionId: { evaluationId, dimensionId: raw.dimensionId } },
      create: {
        workspaceId: identity.workspaceId,
        applicationId: evaluation.applicationId,
        evaluationId,
        dimensionId: raw.dimensionId,
        dimensionName: raw.dimensionName,
        score: raw.score,
        reason: raw.reason.trim(),
        byActorId: identity.actorId,
      },
      update: {
        score: raw.score,
        reason: raw.reason.trim(),
        byActorId: identity.actorId,
        createdAt: new Date(),
      },
    });
    await this.db.auditRecord.create({
      data: {
        workspaceId: identity.workspaceId,
        actorId: identity.actorId,
        action: 'screening_human_assessment_saved',
        objectType: 'HumanAssessment',
        objectId: assessment.id,
        payload: { evaluationId, dimensionId: raw.dimensionId },
      },
    });
    return serializeHumanAssessment(assessment);
  }

  /**
   * Handling a concern (F08 FR-8, #193, Owner decision 2026-10-16): a note is required, references to the
   * candidate's material are optional, and the change is recorded — status before and after, note, references,
   * who and when — next to the unchanged concern. Only an open concern can be handled, once: a second or
   * concurrent attempt finds it already handled. Linked verification items are left as they are; they are
   * answered on their own.
   */
  async resolveConcern(identity: Identity, concernId: string, raw: unknown) {
    const parsed = concernResolutionSchema.safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const { resolution, note, evidenceRefs } = parsed.data;
    const concern = await this.db.screeningConcern.findFirst({ where: { id: concernId, workspaceId: identity.workspaceId } });
    if (!concern) throw new NotFoundException({ code: 'NOT_FOUND' });
    const entry = { action: 'resolve', fromStatus: 'open', toStatus: resolution, note, evidenceRefs, actorId: identity.actorId, at: new Date().toISOString() };
    return this.recordConcernChange(identity, concern, 'open', resolution, entry);
  }

  /** Back to open after a mistaken handling, with a note; nothing earlier is erased (#193 AC-4). */
  async reopenConcern(identity: Identity, concernId: string, raw: unknown) {
    const parsed = z.object({ note: z.string().trim().min(1, 'Say why the concern is reopened.').max(2000) }).strict().safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const concern = await this.db.screeningConcern.findFirst({ where: { id: concernId, workspaceId: identity.workspaceId } });
    if (!concern) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (concern.status === 'open') throw new ConflictException({ code: 'CONCERN_ALREADY_OPEN' });
    const entry = { action: 'reopen', fromStatus: concern.status, toStatus: 'open', note: parsed.data.note, evidenceRefs: [], actorId: identity.actorId, at: new Date().toISOString() };
    return this.recordConcernChange(identity, concern, concern.status, 'open', entry);
  }

  private async recordConcernChange(
    identity: Identity,
    concern: { id: string; status: string; resolutionHistory: unknown },
    from: string,
    to: string,
    entry: Record<string, unknown>,
  ) {
    const read = Array.isArray(concern.resolutionHistory) ? concern.resolutionHistory : [];
    const history = [...read, entry];
    const updated = await this.db.$transaction(async (tx) => {
      // Compare-and-set on the status and the history read: the history only grows, so it is the concern's version.
      // A change in between — even one that went open → handled → open again — makes this one a no-op that
      // reports the conflict, instead of writing the old history back over it (#193 review).
      const claim = await tx.screeningConcern.updateMany({
        where: { id: concern.id, workspaceId: identity.workspaceId, status: from, resolutionHistory: { equals: json(read) } },
        data: { status: to, resolution: to === 'open' ? null : to, resolutionHistory: json(history) },
      });
      if (claim.count !== 1) throw new ConflictException({ code: 'CONCERN_CHANGED', message: 'This concern was changed in the meantime. Reload and try again.' });
      await tx.auditRecord.create({
        data: {
          workspaceId: identity.workspaceId,
          actorId: identity.actorId,
          action: entry.action === 'reopen' ? 'screening_concern_reopened' : 'screening_concern_resolved',
          objectType: 'ScreeningConcern',
          objectId: concern.id,
          payload: json(entry),
        },
      });
      return tx.screeningConcern.findUniqueOrThrow({ where: { id: concern.id } });
    });
    return serializeConcern(updated);
  }

  async assignVerification(identity: Identity, itemId: string) {
    const item = await this.db.verificationItem.findFirst({
      where: { id: itemId, workspaceId: identity.workspaceId },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    const updated = await this.db.verificationItem.update({
      where: { id: itemId },
      data: { status: 'assigned', ownerId: identity.actorId },
    });
    return serializeVerificationItem(updated);
  }

  async resolveVerification(identity: Identity, itemId: string, outcome?: string) {
    if (!['met', 'not_met'].includes(outcome || '')) {
      throw new BadRequestException({ code: 'INVALID_VERIFICATION_OUTCOME' });
    }
    const item = await this.db.verificationItem.findFirst({
      where: { id: itemId, workspaceId: identity.workspaceId },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND' });
    const updated = await this.db.$transaction(async (tx) => {
      const resolved = await tx.verificationItem.update({
        where: { id: itemId },
        data: { status: 'resolved', outcome, resolvedBy: identity.actorId, resolvedAt: new Date() },
      });
      await this.applyVerificationOutcome(tx, item.workspaceId, item.evaluationId, itemId, outcome as 'met' | 'not_met');
      return resolved;
    });
    return serializeVerificationItem(updated);
  }

  /**
   * A verification item exists because a hard requirement came back `unknown`. Resolving it
   * answers that requirement: write the outcome into the evaluation's eligibility results,
   * re-aggregate eligibility, and close the matching "not confirmed" concern -- otherwise the
   * evaluation keeps saying "needs verification" after everything was verified.
   */
  private async applyVerificationOutcome(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    evaluationId: string,
    itemId: string,
    outcome: 'met' | 'not_met',
  ) {
    const concerns = await tx.screeningConcern.findMany({ where: { workspaceId, evaluationId } });
    const linked = concerns.filter((c) => asStringArray(c.verificationItemIds).includes(itemId));
    const requirementIds = new Set(linked.flatMap((c) => asStringArray(c.requirementIds)));
    for (const concern of linked) {
      if (concern.status !== 'open') continue;
      const resolution = outcome === 'met' ? 'dismissed' : 'confirmed';
      await tx.screeningConcern.update({ where: { id: concern.id }, data: { status: resolution, resolution } });
    }
    if (!requirementIds.size) return;

    const evaluation = await tx.screeningEvaluation.findUnique({ where: { id: evaluationId }, select: { eligibilityResults: true } });
    if (!evaluation) return;
    const results = (Array.isArray(evaluation.eligibilityResults) ? evaluation.eligibilityResults : []) as Array<Record<string, unknown> & { requirementId?: string; status?: string }>;
    const next = results.map((r) =>
      r.requirementId && requirementIds.has(r.requirementId)
        ? { ...r, status: outcome, reason: outcome === 'met' ? 'Confirmed by a reviewer during verification.' : 'Not met, per reviewer verification.' }
        : r,
    );
    await tx.screeningEvaluation.update({
      where: { id: evaluationId },
      data: { eligibilityResults: json(next), eligibilityStatus: aggregateEligibility(next as Array<{ status: string }>) },
    });
  }

  private async createEvaluation(
    identity: Identity,
    application: ApplicationInput,
    input: EvaluationInputs,
    version: number,
    purpose: string,
    batch?: { itemId: string; leaseToken: string },
  ) {
    const dimensions = asDimensions(input.criteria?.dimensions);
    const requirements = asRequirements(input.criteria?.requirements);
    const hardRequirements = scoredHardRequirements(requirements);
    const resumeText = input.material?.text || '';
    const aiConfigured = this.aiEvaluator.isConfigured();
    const useAi = aiConfigured && !!resumeText;
    const modelVersion = useAi ? this.aiEvaluator.modelName() : null;
    const inputHash = evaluationInputHash({
      evaluator: useAi ? AI_EVALUATOR : LOCAL_EVALUATOR,
      modelVersion,
      jobTitle: input.job?.title || '',
      dimensions,
      hardRequirements,
      profileVersion: input.profile?.version ?? null,
      criteriaVersion: input.criteria?.version ?? null,
      materialId: input.material?.id ?? null,
      resumeText,
    });

    // #19: identical inputs (same resume, profile, rubric, model and prompt) give the identical result --
    // reuse the latest snapshot instead of asking the model again and getting a slightly different score.
    const latest = await this.db.screeningEvaluation.findFirst({
      where: { workspaceId: identity.workspaceId, applicationId: application.id },
      orderBy: { version: 'desc' },
      include: { dimensionScores: true },
    });
    if (canReuseEvaluation(latest, inputHash)) {
      if (batch) await this.db.$transaction(async tx => {
        const changed = await tx.screeningBatchItem.updateMany({ where: { id: batch.itemId, workspaceId: identity.workspaceId, leaseToken: batch.leaseToken, status: { in: ['running', 'unknown'] } },
          data: { status: 'completed', evaluationId: latest!.id, completedAt: new Date(), leaseUntil: null, errorCode: null } });
        if (changed.count !== 1) throw new ConflictException({ code: 'BATCH_LEASE_LOST' });
      });
      return { ...serializeEvaluation(latest), reused: true, snapshotCount: await this.snapshotCount(identity.workspaceId, application.id) };
    }

    let evaluationResult: Awaited<ReturnType<ScreeningService['evaluateWithAi']>> | ReturnType<ScreeningService['evaluateLocally']>;
    if (useAi) {
      try {
        evaluationResult = await this.evaluateWithAi(input.job?.title || '', dimensions, hardRequirements, resumeText);
      } catch (error) {
        // The AI call failing happens before any ScreeningEvaluation row exists for this
        // attempt, so there's nothing to anchor a task to inside a transaction -- flag it
        // standalone, then rethrow so the caller still sees the original 503 unchanged.
        await this.flagEvaluationIssue(identity, application, input, 'AI evaluation call failed.');
        throw error;
      }
    } else {
      const profile = withoutWorkAuthorization(input.profile);
      evaluationResult = this.evaluateLocally(dimensions, hardRequirements, profile, buildCorpus(profile, resumeText));
    }
    const { dimensionResults, eligibilityResults, overall, coverage, evaluatorVersion } = evaluationResult;
    const metadata = evaluationMetadata(useAi, evaluationResult.confidence, modelVersion);

    const eligibilityStatus = aggregateEligibility(eligibilityResults);
    const missingInformation = dimensionResults.filter((dimension) => dimension.status !== 'evaluated').map((dimension) => dimension.name);
    const strengths = dimensionResults.filter((dimension) => dimension.score != null && dimension.score >= 75).map((dimension) => dimension.name);
    const verificationDrafts = hardRequirements
      .map((requirement) => ({ requirement, result: eligibilityResults.find((item) => item.requirementId === requirement.id) }))
      .filter((item) => item.result?.status === 'unknown');
    const inputManifest = {
      candidateId: application.candidateId,
      jobId: application.jobId,
      profileVersion: input.profile?.version ?? null,
      criteriaVersion: input.criteria?.version ?? null,
      materialId: input.material?.id ?? null,
      materialReadStatus: input.material?.readStatus ?? null,
      evaluator: evaluatorVersion,
      modelVersion,
      inputHash,
      ...(batch ? { batchItemId: batch.itemId } : {}),
      ...(useAi ? {} : { aiSkippedReason: aiConfigured ? 'no_resume_text' : 'ai_not_configured' }),
    };

    const evaluation = await this.db.$transaction(async (tx) => {
      let freshness = 'current';
      if (batch) {
        await tx.$queryRaw`SELECT id FROM "ScreeningBatchItem" WHERE id = ${batch.itemId} FOR UPDATE`;
        const item = await tx.screeningBatchItem.findFirst({ where: { id: batch.itemId, workspaceId: identity.workspaceId, leaseToken: batch.leaseToken, status: { in: ['running', 'unknown'] } } });
        if (!item) throw new ConflictException({ code: 'BATCH_LEASE_LOST' });
        await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${application.id} FOR UPDATE`;
        const live = await this.loadInputs(identity.workspaceId, application.id, tx);
        if (live.criteria?.id !== input.criteria?.id || live.profile?.id !== input.profile?.id || live.material?.id !== input.material?.id ||
          live.job.title !== input.job.title || live.job.criteriaStatus !== 'confirmed' ||
          !isDeepStrictEqual(JSON.parse(JSON.stringify({ criteria: live.criteria, profile: live.profile, material: live.material })), JSON.parse(JSON.stringify({ criteria: input.criteria, profile: input.profile, material: input.material })))) freshness = 'stale';
        const last = await tx.screeningEvaluation.aggregate({ where: { workspaceId: identity.workspaceId, applicationId: application.id }, _max: { version: true } });
        version = (last._max.version ?? 0) + 1;
      }
      if (freshness === 'current') await tx.screeningEvaluation.updateMany({
        where: { workspaceId: identity.workspaceId, applicationId: application.id, freshness: 'current' },
        data: { freshness: 'stale' },
      });
      const session = await tx.screeningSession.create({
        data: {
          workspaceId: identity.workspaceId,
          applicationId: application.id,
          purpose,
          ownerId: identity.actorId,
        },
      });
      const created = await tx.screeningEvaluation.create({
        data: {
          workspaceId: identity.workspaceId,
          applicationId: application.id,
          sessionId: session.id,
          version,
          status: 'completed',
          freshness,
          evaluationMode: metadata.evaluationMode,
          aiStatus: metadata.aiStatus,
          inputManifest: json(inputManifest),
          eligibilityStatus,
          eligibilityResults: json(eligibilityResults),
          overallScore: overall,
          coverage,
          confidence: metadata.confidence,
          evaluationStatus: overall == null ? 'insufficient_evidence' : 'evaluated',
          strengths: json(strengths),
          missingInformation: json(missingInformation),
          recommendation: Prisma.JsonNull,
          modelVersion: metadata.modelVersion,
          completedAt: new Date(),
        },
      });
      // Any earlier "AI evaluation issue" task for this application is superseded by this
      // run actually completing (confident or not) -- nobody acted on it, it was just
      // overtaken by a newer attempt, so it's cancelled rather than completed.
      if (freshness === 'current') await tx.humanTask.updateMany({
        where: { workspaceId: identity.workspaceId, applicationId: application.id, taskType: 'screening_evaluation_issue', status: { notIn: ['completed', 'cancelled'] } },
        data: { status: 'cancelled' },
      });
      if (overall == null && freshness === 'current') {
        await tx.humanTask.create({
          data: {
            workspaceId: identity.workspaceId,
            sourceModule: 'Resume Library',
            taskType: 'screening_evaluation_issue',
            title: `AI evaluation incomplete: ${input.candidate.displayName} — ${input.job.title}`,
            subjectLabel: 'AI screening could not produce a confident score (insufficient evidence).',
            requiredAction: 'Review the résumé manually, or re-run screening once more information is available.',
            completionRule: { requiredResultType: 'screening_evaluation_issue_resolved' },
            candidateId: application.candidateId,
            jobId: application.jobId,
            applicationId: application.id,
            priority: 'normal',
            linkRoute: `/applications/${application.id}`,
          },
        });
      }
      // Real evidenceQuotes (from the AI evaluator) get their own EvidenceItem each, so a
      // reviewer opening one dimension's evidence sees the exact quote that justified it,
      // not one generic sentence shared across every dimension. The local fallback
      // evaluator never produces real quotes, so it keeps the single generic item it
      // always used -- still better than fabricating quotes it can't back up.
      const hasRealQuotes = dimensionResults.some((d) => d.evidenceQuote) || eligibilityResults.some((r) => r.evidenceQuote);
      const dimensionEvidenceIds = new Map<string, string>();
      const allEvidenceItems: Array<{ id: string }> = [];
      let genericEvidenceId: string | null = null;
      if (!hasRealQuotes && input.material) {
        const generic = await tx.evidenceItem.create({
          data: {
            workspaceId: identity.workspaceId,
            evaluationId: created.id,
            candidateId: application.candidateId,
            materialId: input.material.id,
            kind: 'documented_fact',
            sourceLabel: input.material.name,
            statement: firstUsefulSentence(input.material.text) || 'Resume material is available for review.',
            locator: json({ type: 'text', segmentId: firstSegmentId(input.material.segments) }),
            verification: 'unverified',
            confidence: 0.62,
            availability: 'available',
          },
        });
        genericEvidenceId = generic.id;
        allEvidenceItems.push(generic);
      }
      for (const dimension of dimensionResults) {
        if (!dimension.evidenceQuote) continue;
        const item = await tx.evidenceItem.create({
          data: {
            workspaceId: identity.workspaceId,
            evaluationId: created.id,
            candidateId: application.candidateId,
            materialId: input.material?.id,
            kind: 'documented_fact',
            sourceLabel: input.material?.name || 'Resume',
            statement: dimension.evidenceQuote,
            locator: json({ type: 'text', segmentId: 'ai-quote' }),
            verification: 'unverified',
            confidence: dimension.confidence ?? 0.6,
            availability: 'available',
          },
        });
        dimensionEvidenceIds.set(dimension.id, item.id);
        allEvidenceItems.push(item);
      }
      const scores = await Promise.all(dimensionResults.map((dimension) => tx.dimensionScore.create({
        data: {
          workspaceId: identity.workspaceId,
          evaluationId: created.id,
          dimensionId: dimension.id,
          name: dimension.name,
          weight: dimension.weight,
          status: dimension.status,
          score: dimension.score,
          confidence: dimension.confidence,
          reason: dimension.reason,
          supportingRefs: json((() => {
            const specific = dimensionEvidenceIds.get(dimension.id);
            if (specific) return [specific];
            return genericEvidenceId && dimension.status === 'evaluated' ? [genericEvidenceId] : [];
          })()),
          counterRefs: json([]),
        },
      })));
      const verificationItems = await Promise.all(verificationDrafts.map(({ requirement }) => tx.verificationItem.create({
        data: {
          workspaceId: identity.workspaceId,
          applicationId: application.id,
          evaluationId: created.id,
          question: `Please confirm: ${requirement.label}`,
          method: 'candidate_question',
          targetStage: 'screening',
          priority: requirement.priority === 'must_have' ? 'high' : 'medium',
          acceptance: `A clear answer addressing: ${requirement.label}`,
        },
      })));
      const concerns = await Promise.all(verificationDrafts.map(({ requirement }) => tx.screeningConcern.create({
        data: {
          workspaceId: identity.workspaceId,
          applicationId: application.id,
          evaluationId: created.id,
          type: 'missing_information',
          title: `${requirement.label} is not confirmed`,
          severity: requirement.priority === 'must_have' ? 'high' : 'medium',
          confidence: null,
          basis: 'missing_information',
          requirementIds: json([requirement.id]),
          verificationItemIds: json([]),
        },
      })));
      if (concerns.length && verificationItems.length) {
        await Promise.all(concerns.map((concern, index) => tx.screeningConcern.update({
          where: { id: concern.id },
          data: { verificationItemIds: json([verificationItems[index].id]) },
        })));
      }
      if (freshness === 'current') await tx.application.update({
        where: { id: application.id },
        data: { screeningStatus: 'review_pending' },
      });
      await tx.auditRecord.create({
        data: {
          workspaceId: identity.workspaceId,
          actorId: identity.actorId,
          action: 'screening_evaluation_created',
          objectType: 'ScreeningEvaluation',
          objectId: created.id,
          payload: json({ applicationId: application.id, version, inputManifest }),
        },
      });
      if (batch) await tx.screeningBatchItem.update({ where: { id: batch.itemId }, data: {
        status: 'completed', evaluationId: created.id, completedAt: new Date(), leaseUntil: null, errorCode: null,
      } });
      return { ...created, dimensionScores: scores, evidenceItems: allEvidenceItems, verificationItems, concerns, humanAssessments: [] };
    });
    return { ...serializeEvaluation(evaluation), reused: false, snapshotCount: await this.snapshotCount(identity.workspaceId, application.id) };
  }

  private snapshotCount(workspaceId: string, applicationId: string) {
    return this.db.screeningEvaluation.count({ where: { workspaceId, applicationId } });
  }

  private singleFlight<T>(applicationId: string, start: () => Promise<T>): Promise<T> {
    const pending = this.inFlight.get(applicationId);
    if (pending) return pending as Promise<T>;
    const run = start().finally(() => this.inFlight.delete(applicationId));
    this.inFlight.set(applicationId, run);
    return run;
  }

  private async currentEvaluation(workspaceId: string, applicationId: string) {
    return this.db.screeningEvaluation.findFirst({
      where: { workspaceId, applicationId, freshness: 'current' },
      orderBy: { version: 'desc' },
      include: { dimensionScores: true, evidenceItems: true, concerns: true, verificationItems: true, humanAssessments: true },
    });
  }

  private async findApplication(identity: Identity, id: string) {
    const application = await this.db.application.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!application) throw new NotFoundException({ code: 'NOT_FOUND' });
    return application;
  }

  private async loadInputs(workspaceId: string, applicationId: string, db: Prisma.TransactionClient = this.db): Promise<EvaluationInputs> {
    const application = await db.application.findFirst({
      where: { id: applicationId, workspaceId },
      include: {
        candidate: { include: { profiles: { orderBy: { version: 'desc' }, take: 1 }, resumeVersions: { where: { isLatest: true }, take: 1, include: { material: true } } } },
        job: { include: { criteriaVersions: { where: { status: 'confirmed' }, orderBy: { version: 'desc' }, take: 1 } } },
      },
    });
    if (!application) throw new NotFoundException({ code: 'NOT_FOUND' });
    return {
      application,
      candidate: application.candidate,
      job: application.job,
      profile: application.candidate.profiles[0],
      material: application.candidate.resumeVersions[0]?.material,
      criteria: application.job.criteriaVersions[0],
    };
  }

  private serializeDetail(application: ApplicationInput, evaluation: EvaluationRecord | null, decision: unknown | null, handoffStatus?: HandoffStatus) {
    return {
      application: serializeApplication(application),
      evaluation: evaluation ? serializeEvaluation(evaluation) : null,
      concerns: evaluation?.concerns.map(serializeConcern) || [],
      verificationItems: evaluation?.verificationItems.map(serializeVerificationItem) || [],
      humanAssessments: evaluation?.humanAssessments.map(serializeHumanAssessment) || [],
      decision: decision ? serializeDecision(decision, handoffStatus) : null,
    };
  }

  // AI is authoritative when configured -- the local fallback below scores every
  // dimension off corpus length and name-substring matches (e.g. a longer resume scores
  // higher regardless of content), which is not a real judgment. A genuine AI failure
  // must surface as an error the caller can retry, not silently degrade to that.
  // Best-effort signal only -- a failure in here must never mask the real screening error
  // that triggered it, so every path through this method swallows its own errors.
  private async flagEvaluationIssue(identity: Identity, application: ApplicationInput, input: EvaluationInputs, subjectLabel: string) {
    try {
      const existing = await this.db.humanTask.findFirst({
        where: { workspaceId: identity.workspaceId, applicationId: application.id, taskType: 'screening_evaluation_issue', status: { notIn: ['completed', 'cancelled'] } },
      });
      if (existing) return;
      await this.db.humanTask.create({
        data: {
          workspaceId: identity.workspaceId,
          sourceModule: 'Resume Library',
          taskType: 'screening_evaluation_issue',
          title: `AI evaluation incomplete: ${input.candidate.displayName} — ${input.job.title}`,
          subjectLabel,
          requiredAction: 'Review the résumé manually, or re-run screening once the issue is resolved.',
          completionRule: { requiredResultType: 'screening_evaluation_issue_resolved' },
          candidateId: application.candidateId,
          jobId: application.jobId,
          applicationId: application.id,
          priority: 'normal',
          linkRoute: `/applications/${application.id}`,
        },
      });
    } catch {
      // swallow -- see method comment
    }
  }

  private async evaluateWithAi(
    jobTitle: string,
    dimensions: DimensionInput[],
    hardRequirements: RequirementInput[],
    resumeText: string,
  ): Promise<{
    dimensionResults: NormalizedDimensionResult[];
    eligibilityResults: NormalizedRequirementResult[];
    overall: number | null;
    coverage: number;
    confidence: number | null;
    evaluatorVersion: string;
  }> {
    let ai: Awaited<ReturnType<AiScreeningEvaluatorService['evaluate']>>;
    try {
      ai = await this.aiEvaluator.evaluate({
        jobTitle,
        dimensions: dimensions.map((d) => ({ id: d.id, name: d.name, weight: d.weight, rubric: d.rubric })),
        hardRequirements: hardRequirements.map((r) => ({ id: r.id, label: r.label, kind: r.kind })),
        resumeText,
      });
    } catch (error) {
      const detail = error instanceof AiCallError ? error.message : 'AI_REQUEST_FAILED';
      // aiStatus lets the client say "the AI call failed, retry" rather than a generic error (#19 AC-5).
      throw new ServiceUnavailableException({ code: 'AI_EVALUATION_FAILED', aiStatus: 'failed', message: detail });
    }
    const byId = new Map(ai.dimensionScores.map((d) => [d.dimensionId, d]));
    const dimensionResults: NormalizedDimensionResult[] = dimensions.map((dimension) => {
      const found = byId.get(dimension.id);
      if (!found || !found.evaluated) {
        return { ...dimension, status: 'unknown', score: null, confidence: null, reason: found?.reason || 'Not evaluated.', evidenceQuote: null };
      }
      return {
        ...dimension,
        status: 'evaluated',
        score: found.score,
        confidence: ai.confidence,
        reason: found.reason,
        evidenceQuote: found.evidenceQuote,
      };
    });
    const evaluatedWeight = dimensionResults.filter((d) => d.status === 'evaluated').reduce((sum, d) => sum + d.weight, 0);
    const overall = ai.coverage >= 0.7 && evaluatedWeight > 0
      ? dimensionResults.filter((d) => d.status === 'evaluated' && d.score != null).reduce((sum, d) => sum + (d.score || 0) * d.weight, 0) / evaluatedWeight
      : null;
    const findingsById = new Map(ai.hardRequirementFindings.map((f) => [f.requirementId, f]));
    const eligibilityResults: NormalizedRequirementResult[] = hardRequirements.map((requirement) => {
      const found = findingsById.get(requirement.id);
      return {
        requirementId: requirement.id,
        status: found?.status || 'unknown',
        reason: found?.reason || 'Not evaluated.',
        evidenceQuote: found?.evidenceQuote || null,
      };
    });
    return { dimensionResults, eligibilityResults, overall, coverage: ai.coverage, confidence: ai.confidence, evaluatorVersion: AI_EVALUATOR };
  }

  private evaluateLocally(
    dimensions: DimensionInput[],
    hardRequirements: RequirementInput[],
    profile: unknown,
    corpus: string,
  ): {
    dimensionResults: NormalizedDimensionResult[];
    eligibilityResults: NormalizedRequirementResult[];
    overall: number | null;
    coverage: number;
    confidence: number | null;
    evaluatorVersion: string;
  } {
    const dimensionResults: NormalizedDimensionResult[] = dimensions.map((dimension) => ({
      ...evaluateDimension(dimension, profile, corpus),
      evidenceQuote: null,
    }));
    const evaluatedWeight = dimensionResults.filter((d) => d.status === 'evaluated').reduce((sum, d) => sum + d.weight, 0);
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0) || 1;
    const coverage = evaluatedWeight / totalWeight;
    const overall = coverage >= 0.7
      ? dimensionResults.filter((d) => d.status === 'evaluated' && d.score != null).reduce((sum, d) => sum + (d.score || 0) * d.weight, 0) / evaluatedWeight
      : null;
    const eligibilityResults: NormalizedRequirementResult[] = hardRequirements.map((requirement) => ({
      ...evaluateRequirement(requirement, profile, corpus),
      evidenceQuote: null,
    }));
    // The local rules have no calibrated confidence of their own; recording a constant would be made up.
    return { dimensionResults, eligibilityResults, overall, coverage, confidence: null, evaluatorVersion: LOCAL_EVALUATOR };
  }
}

type ApplicationInput = Awaited<ReturnType<ScreeningService['findApplication']>> & {
  candidate?: unknown;
  job?: unknown;
};
type EvaluationInputs = {
  application: ApplicationInput;
  candidate: any;
  job: any;
  profile: any;
  material: any;
  criteria: any;
};
type EvaluationRecord = any;

function evaluateDimension(dimension: DimensionInput, profile: any, corpus: string) {
  const name = dimension.name.toLowerCase();
  if (!corpus.trim()) return unknownDimension(dimension, 'No readable source material is available.');
  if (name.includes('compensation') || name.includes('location')) {
    const known = profile?.location?.status === 'known' || profile?.compensationExpectation?.status === 'known';
    return known
      ? evaluatedDimension(dimension, 78, 0.72, 'Profile contains location or compensation data.')
      : unknownDimension(dimension, 'Compensation and location fit are not sufficiently documented.');
  }
  if (name.includes('skill') || name.includes('technical') || name.includes('experience') || name.includes('seniority') || name.includes('ownership')) {
    const score = Math.min(92, 58 + Math.min(30, Math.round(corpus.length / 180)));
    return evaluatedDimension(dimension, score, 0.64, `Available profile and resume text provide evidence for ${dimension.name}.`);
  }
  return corpus.length > 80
    ? evaluatedDimension(dimension, 68, 0.55, `Available source text gives partial evidence for ${dimension.name}.`)
    : unknownDimension(dimension, `Available material does not contain enough evidence for ${dimension.name}.`);
}

function evaluatedDimension(dimension: DimensionInput, score: number, confidence: number, reason: string) {
  return { ...dimension, status: 'evaluated' as const, score, confidence, reason };
}

function unknownDimension(dimension: DimensionInput, reason: string) {
  return { ...dimension, status: 'unknown' as const, score: null, confidence: null, reason };
}

function evaluateRequirement(requirement: RequirementInput, profile: any, corpus: string) {
  const lower = `${requirement.label} ${corpus}`.toLowerCase();
  if (requirement.kind === 'experience' && profile?.employmentHistory?.length) {
    return { requirementId: requirement.id, status: 'met' as const, reason: 'Employment history is present in the candidate profile.' };
  }
  if (requirement.kind === 'skill' && lower.includes(requirement.label.toLowerCase().split(' ')[0])) {
    return { requirementId: requirement.id, status: 'met' as const, reason: 'The source corpus contains a matching skill term.' };
  }
  return { requirementId: requirement.id, status: 'unknown' as const, reason: 'The available material does not establish this requirement conclusively.' };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function aggregateEligibility(results: Array<{ status: string }>) {
  if (results.some((result) => result.status === 'not_met')) return 'not_eligible';
  if (results.some((result) => result.status === 'unknown')) return 'needs_verification';
  return 'eligible';
}

/**
 * The hard requirements eligibility is decided on. Work authorization is not a matching or scoring factor
 * (F02 WA-2, #157 AC-3): an authorization requirement isn't evaluated, so whether a profile states it can't
 * change a candidate's eligibility.
 */
export function scoredHardRequirements<T extends { hard: boolean; kind: string }>(requirements: T[]): T[] {
  return requirements.filter((requirement) => requirement.hard && requirement.kind !== 'authorization');
}

/** The profile as scoring sees it: work authorization is not a matching or scoring factor (F02 WA-2, #157). */
export function withoutWorkAuthorization<T>(profile: T): T {
  if (!profile || typeof profile !== 'object') return profile;
  const rest = { ...(profile as Record<string, unknown>) };
  delete rest.workAuthorization;
  return rest as T;
}

function buildCorpus(profile: any, text: string) {
  return `${text} ${JSON.stringify(profile || {})}`.toLowerCase();
}

function firstUsefulSentence(text: string) {
  return text.split(/[.!?\n]/).map((item) => item.trim()).find((item) => item.length > 20)?.slice(0, 500) || '';
}

function firstSegmentId(segments: unknown) {
  return Array.isArray(segments) && segments[0] && typeof segments[0] === 'object' && 'id' in segments[0]
    ? String((segments[0] as { id: unknown }).id)
    : 'full-text';
}

function asDimensions(value: unknown): DimensionInput[] {
  return Array.isArray(value) ? value.filter(isDimension) : [];
}

function asRequirements(value: unknown): RequirementInput[] {
  return Array.isArray(value) ? value.filter(isRequirement) : [];
}

function isDimension(value: unknown): value is DimensionInput {
  return Boolean(value && typeof value === 'object' && typeof (value as DimensionInput).id === 'string' && typeof (value as DimensionInput).name === 'string');
}

function isRequirement(value: unknown): value is RequirementInput {
  return Boolean(value && typeof value === 'object' && typeof (value as RequirementInput).id === 'string' && typeof (value as RequirementInput).label === 'string');
}

function serializeApplication(application: any) {
  return {
    id: application.id,
    candidateId: application.candidateId,
    jobId: application.jobId,
    cycleId: application.cycleId,
    status: application.status,
    screeningStatus: application.screeningStatus,
    origin: application.origin,
    linkedAt: application.linkedAt.toISOString(),
    linkedBy: application.linkedBy,
    linkReason: application.linkReason,
  };
}

function serializeSnapshotSummary(evaluation: any) {
  return {
    id: evaluation.id,
    version: evaluation.version,
    overall: evaluation.overallScore,
    coverage: evaluation.coverage || 0,
    completedAt: (evaluation.completedAt || evaluation.createdAt).toISOString(),
    modelVersion: evaluation.modelVersion,
    evaluationMode: evaluation.evaluationMode,
    aiStatus: evaluation.aiStatus,
    freshness: evaluation.freshness,
  };
}

function serializeEvaluation(evaluation: any) {
  return {
    id: evaluation.id,
    applicationId: evaluation.applicationId,
    version: evaluation.version,
    status: evaluation.status,
    evaluationMode: evaluation.evaluationMode,
    aiStatus: evaluation.aiStatus,
    eligibilityStatus: evaluation.eligibilityStatus,
    eligibilityResults: evaluation.eligibilityResults,
    overall: evaluation.overallScore,
    coverage: evaluation.coverage || 0,
    confidence: evaluation.confidence,
    evaluationStatus: evaluation.evaluationStatus,
    dimensionScores: (evaluation.dimensionScores || []).map((dimension: any) => ({
      id: dimension.dimensionId,
      name: dimension.name,
      weight: dimension.weight,
      status: dimension.status,
      score: dimension.score,
      confidence: dimension.confidence,
      reason: dimension.reason,
      supporting: dimension.supportingRefs,
      counter: dimension.counterRefs,
    })),
    modelVersion: evaluation.modelVersion,
    completedAt: evaluation.completedAt?.toISOString() || evaluation.createdAt.toISOString(),
    freshness: evaluation.freshness,
  };
}

function serializeConcern(concern: any) {
  return {
    id: concern.id,
    type: concern.type,
    title: concern.title,
    severity: concern.severity,
    confidence: concern.confidence,
    basis: concern.basis,
    status: concern.status,
    requirementIds: concern.requirementIds,
    verificationItemIds: concern.verificationItemIds,
    restricted: concern.restricted,
    resolution: concern.resolution,
    history: Array.isArray(concern.resolutionHistory) ? concern.resolutionHistory : [],
  };
}

const concernResolutionSchema = z.object({
  resolution: z.enum(['dismissed', 'confirmed', 'accepted_risk']),
  note: z.string().trim().min(1, 'Describe how the concern was checked.').max(2000),
  evidenceRefs: z.array(z.object({
    materialId: z.string().min(1).max(100),
    label: z.string().trim().max(300).optional(),
  }).strict()).max(10).optional().default([]),
}).strict();

function serializeVerificationItem(item: any) {
  return {
    id: item.id,
    applicationId: item.applicationId,
    question: item.question,
    method: item.method,
    targetStage: item.targetStage,
    priority: item.priority,
    status: item.status,
    acceptance: item.acceptance,
    owner: item.ownerId || undefined,
    outcome: item.outcome || undefined,
    resolvedBy: item.resolvedBy || undefined,
    resolvedAt: item.resolvedAt?.toISOString(),
  };
}

function serializeHumanAssessment(assessment: any) {
  return {
    id: assessment.id,
    dimensionId: assessment.dimensionId,
    dimensionName: assessment.dimensionName,
    score: assessment.score,
    reason: assessment.reason,
    by: assessment.byActorId,
    at: assessment.createdAt.toISOString(),
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
