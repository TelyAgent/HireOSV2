import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { fieldsToDraftContent } from '../copilot/draft-mapping';
import { LlmProvider } from '../copilot/llm-provider';
import { PromptRegistry } from '../copilot/prompt-registry';
import { llmTurnResultSchema, type JdFields } from '../copilot/types';
import { CoreRecordClient } from '../core/core-record.client';
import { DraftsService } from '../drafts/drafts.service';
import { PrismaService } from '../persistence/prisma.service';
import { json, type RequestMeta } from '../records';

const CAPABILITY = 'jd_intake_extract';

const intakeSchema = z.object({
  text: z.string().trim().min(1).max(150000),
  coreMaterialId: z.string().trim().min(1).max(200).optional(),
  // What the recruiter confirmed after reading the preview (#178); they win over the model's reading.
  title: z.string().trim().min(1).max(200).optional(),
  team: z.string().trim().min(1).max(200).optional(),
}).strict();

const previewSchema = z.object({ text: z.string().trim().min(1).max(150000) }).strict();

export type IntakePreview = {
  title: string;
  team: string | null;
  location: string | null;
  /** The same JD already created this job; creating again would open it. */
  duplicateOf: { coreJobId: string; title: string } | null;
};

/** A reading kept briefly so "create" right after "preview" doesn't ask the model again. */
const PREVIEW_TTL_MS = 30 * 60 * 1000;

export type IntakeJobResult = { coreJobId: string; title: string; jdText: string; duplicate: boolean };

/**
 * "Start from a JD" for the other subsystems' new-task entries (Interview, Written, Screening).
 * Nothing is created until AI has read the whole JD: the same `jd-file-extract` prompt Copilot uses
 * for an uploaded JD yields the title, location, department, employment type, headcount,
 * responsibilities and requirements; the job is registered with Core Record from those, with the
 * structured `external_import` draft, and the raw text is kept in JdSource. If the model can't be
 * reached, returns unusable output, or finds no job in the text, the request fails and nothing is
 * created. The same JD text (whitespace aside) always resolves to the job it first created --
 * `duplicate: true` tells the caller to say so -- without another AI call.
 */
@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly core: CoreRecordClient,
    private readonly drafts: DraftsService,
    private readonly llm: LlmProvider,
    private readonly prompts: PromptRegistry,
  ) {}

  private readonly readings = new Map<string, { fields: JdFields; at: number }>();

  /**
   * Read a JD without creating anything (#178): the model's title, team and location for the recruiter to
   * check, or the job this same JD already created. Failures are the same as for createJob.
   */
  async previewJob(identity: Identity, raw: unknown): Promise<IntakePreview> {
    const input = previewSchema.parse(raw);
    const contentHash = `sha256:${createHash('sha256').update(normalize(input.text)).digest('hex')}`;
    const existing = await this.findExisting(identity, contentHash);
    if (existing) return { title: existing.title, team: null, location: null, duplicateOf: { coreJobId: existing.coreJobId, title: existing.title } };
    const fields = await this.extract(identity, input.text);
    this.readings.set(`${identity.workspaceId}:${contentHash}`, { fields, at: Date.now() });
    return { title: fields.title!, team: fields.department?.trim() || null, location: fields.location?.trim() || null, duplicateOf: null };
  }

  async createJob(identity: Identity, raw: unknown, meta: RequestMeta & { sourceService?: string }): Promise<IntakeJobResult> {
    const input = intakeSchema.parse(raw); // invalid -> 422 INVALID_SCHEMA via ZodExceptionFilter
    const key = meta.idempotencyKey?.trim();
    if (!key) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const contentHash = `sha256:${createHash('sha256').update(normalize(input.text)).digest('hex')}`;

    const existing = await this.findExisting(identity, contentHash);
    if (existing) return existing;

    const cached = this.readings.get(`${identity.workspaceId}:${contentHash}`);
    const read = cached && Date.now() - cached.at < PREVIEW_TTL_MS ? cached.fields : await this.extract(identity, input.text);
    this.readings.delete(`${identity.workspaceId}:${contentHash}`);
    const fields: JdFields = { ...read, ...(input.title ? { title: input.title } : {}), ...(input.team ? { department: input.team } : {}) };
    const sourceService = meta.sourceService?.trim() || 'unknown';
    // Keys derived from the caller's Idempotency-Key: a retry after a partial failure reuses the
    // same Core job and draft (same pattern as CopilotService.confirmDraft).
    const job = await this.core.createJob(identity, {
      title: fields.title!.slice(0, 200),
      ...(fields.department ? { team: fields.department.slice(0, 200) } : {}),
      ...(fields.location ? { location: fields.location.slice(0, 200) } : {}),
      ...(fields.employmentType ? { employmentType: fields.employmentType.slice(0, 80) } : {}),
      ...(fields.headcount ? { openings: Math.min(fields.headcount, 10000) } : {}),
    }, `jd.intake:${key}:job`);
    const draft = await this.drafts.create(identity, job.id, {
      ...fieldsToDraftContent(fields),
      sourceRefs: [{ kind: 'subsystem_intake', service: sourceService, ...(input.coreMaterialId ? { coreMaterialId: input.coreMaterialId } : {}) }],
      origin: 'external_import',
    }, { ...meta, idempotencyKey: `${key}:draft` }) as { id: string; contentHash: string };
    try {
      await this.db.jdSource.create({ data: {
        workspaceId: identity.workspaceId, jobId: job.id, text: input.text, contentHash,
        coreMaterialId: input.coreMaterialId, sourceService, createdBy: identity.actorId,
        draftId: draft.id, draftHash: draft.contentHash,
      } });
    } catch (error) {
      // Two identical JDs submitted at once: the other request won the unique index, so this one
      // reports that job (the Core job created above stays as an unused draft).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.findExisting(identity, contentHash);
        if (winner) return winner;
      }
      throw error;
    }
    return { coreJobId: job.id, title: job.title, jdText: input.text, duplicate: false };
  }

  /** The model's reading of the whole JD; throws (and records the failed AI run) unless it found a job with a title. */
  private async extract(identity: Identity, text: string): Promise<JdFields> {
    const startedAt = Date.now();
    let fields: JdFields;
    try {
      const raw = await this.llm.completeJson(this.prompts.jdFileExtractSystemPrompt, [{ role: 'user', content: `[粘贴的 JD 文案]\n\n${text}` }]);
      fields = llmTurnResultSchema.parse(JSON.parse(raw)).fields;
    } catch (error) {
      // AI_NOT_CONFIGURED (and other provider errors) pass through with their own code.
      const failureCode = error instanceof ServiceUnavailableException ? ((error.getResponse() as { code?: string }).code || 'AI_REQUEST_FAILED') : 'LLM_INVALID_OUTPUT';
      this.logger.warn(`${CAPABILITY} failed after ${Date.now() - startedAt}ms: ${error instanceof Error ? error.message : error}`);
      await this.record(identity, 'Failed', { failureCode }, failureCode);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({ code: 'LLM_INVALID_OUTPUT', message: 'AI 返回的内容格式有误，岗位未创建，请重试。' });
    }
    if (!fields.title?.trim() || (!fields.roleSummary && !fields.responsibilities?.length && !fields.mustHave?.length && !fields.niceToHave?.length)) {
      await this.record(identity, 'Succeeded', { outcome: 'not_recognized' });
      throw new UnprocessableEntityException({ code: 'JD_NOT_RECOGNIZED', message: '没有从文本中识别到岗位名称和岗位内容，请检查 JD。' });
    }
    this.logger.log(`${CAPABILITY} succeeded in ${Date.now() - startedAt}ms`);
    await this.record(identity, 'Succeeded', { outcome: 'extracted', title: fields.title });
    return { ...fields, title: fields.title.trim() };
  }

  private async findExisting(identity: Identity, contentHash: string): Promise<IntakeJobResult | null> {
    const source = await this.db.jdSource.findUnique({ where: { workspaceId_contentHash: { workspaceId: identity.workspaceId, contentHash } } });
    if (!source) return null;
    try {
      const job = await this.core.getJob(identity, source.jobId);
      return { coreJobId: job.id, title: job.title, jdText: source.text, duplicate: true };
    } catch (error) {
      // The job was deleted in Core Record since — forget the stale source and start fresh.
      if (!(error instanceof NotFoundException)) throw error;
      await this.db.jdSource.delete({ where: { id: source.id } });
      return null;
    }
  }

  private record(identity: Identity, status: 'Succeeded' | 'Failed', resultJson: Record<string, unknown>, failureCode?: string) {
    return this.db.aiRun.create({ data: { workspaceId: identity.workspaceId, capabilityCode: CAPABILITY, status, resultJson: json(resultJson), failureCode } }).catch(() => undefined);
  }
}

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}
