import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Identity } from '../auth/workspace.guard';
import { extractTextFromFile } from './attachment-extract';
import { extractTextFromLink } from './link-extract';
import { CoreRecordClient } from '../core/core-record.client';
import { DraftsService } from '../drafts/drafts.service';
import { PrismaService } from '../persistence/prisma.service';
import { findIdempotent, json, requestHash, storeIdempotency, type RequestMeta } from '../records';
import { LlmProvider, type ChatTurn, type WebAnswer } from './llm-provider';
import { PromptRegistry } from './prompt-registry';
import { ReplyStreamExtractor } from './reply-stream-extractor';
import {
  autoCompleteInputSchema,
  computeMissingAuthoredFields,
  computeMissingFields,
  importSourceInputSchema,
  llmTurnResultSchema,
  sendMessageInputSchema,
  setFieldsInputSchema,
  refineDraftInputSchema,
  refineVariantsInputSchema,
  titleVariantsInputSchema,
  type JdFields,
  type LlmTurnResult,
} from './types';

export type UploadedAttachment = { buffer: Buffer; mimetype: string; originalname: string; size: number };

type ConversationRow = {
  id: string;
  jobId: string | null;
  phase: string;
  fields: unknown;
  missingFields: unknown;
  stateRevision: number;
  createdAt: Date;
  updatedAt: Date;
};

type MessageRow = { id: string; role: string; text: string | null; attachments: unknown; sequence: number; createdAt: Date };

type SerializedConversation = ReturnType<typeof serializeConversation>;

type TurnPrep =
  | { cached: SerializedConversation }
  | {
      cached: null;
      operation: string;
      key: string;
      hash: string;
      userMessage: { text: string; attachments?: unknown };
      capabilityCode: string;
      turns: ChatTurn[];
      currentFields: JdFields;
    };

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly llm: LlmProvider,
    private readonly prompts: PromptRegistry,
    private readonly core: CoreRecordClient,
    private readonly drafts: DraftsService,
  ) {}

  async createConversation(identity: Identity, meta: RequestMeta) {
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, 'copilot.conversation.create', meta, {});
      if (prior.prior) return prior.prior.responseBody;
      const conversation = await tx.copilotConversation.create({
        data: { workspaceId: identity.workspaceId, actorId: identity.actorId },
      });
      const result = serializeConversation(conversation, []);
      await storeIdempotency(tx, identity, 'copilot.conversation.create', prior.key, prior.hash, result);
      return result;
    });
  }

  /** Basic AI-run health signal: counts by capability/status, for a minimal failure-rate view. */
  async getAiRunStats(identity: Identity) {
    const rows = await this.db.aiRun.groupBy({
      by: ['capabilityCode', 'status'],
      where: { workspaceId: identity.workspaceId },
      _count: { _all: true },
      orderBy: [{ capabilityCode: 'asc' }, { status: 'asc' }],
    });
    return rows.map((row) => ({ capabilityCode: row.capabilityCode, status: row.status, count: row._count._all }));
  }

  async listConversations(identity: Identity) {
    const conversations = await this.db.copilotConversation.findMany({
      where: { workspaceId: identity.workspaceId, actorId: identity.actorId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
    return conversations.map((conversation) => serializeConversation(conversation, []));
  }

  async getConversation(identity: Identity, id: string) {
    const conversation = await this.loadConversation(identity, id);
    const messages = await this.db.copilotMessage.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
    return serializeConversation(conversation, messages);
  }

  async sendMessage(identity: Identity, id: string, raw: unknown, meta: RequestMeta) {
    const prep = await this.prepareTurn(identity, id, raw, meta);
    if (prep.cached) return prep.cached;
    const parsed = await this.runIntakeTurn(identity, id, prep.turns);
    return this.commitTurn(identity, id, prep, parsed);
  }

  /** Same turn as `sendMessage`, but streams the assistant's reply text via `onDelta` as it's generated. */
  async streamMessage(identity: Identity, id: string, raw: unknown, meta: RequestMeta, onDelta: (text: string) => void) {
    const prep = await this.prepareTurn(identity, id, raw, meta);
    if (prep.cached) return prep.cached;
    const parsed = await this.runIntakeTurnStream(identity, id, prep.turns, onDelta);
    return this.commitTurn(identity, id, prep, parsed);
  }

  // Idempotency and the LLM call are resolved BEFORE opening a DB transaction: an LLM round trip
  // routinely takes several seconds, well past Prisma's default 5s interactive-transaction timeout,
  // so holding a transaction open across it would abort the write with a P2028 error.
  private async prepareTurn(identity: Identity, id: string, raw: unknown, meta: RequestMeta): Promise<TurnPrep> {
    const input = sendMessageInputSchema.parse(raw);
    const conversation = await this.loadConversation(identity, id);
    if (conversation.phase === 'completed') throw new ConflictException({ code: 'CONVERSATION_COMPLETED' });

    const key = meta.idempotencyKey?.trim();
    if (!key) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const operation = `copilot.message:${id}`;
    const hash = requestHash(input);

    const existing = await this.db.idempotencyKey.findUnique({
      where: { workspaceId_operation_key: { workspaceId: identity.workspaceId, operation, key } },
    });
    if (existing) {
      if (existing.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
      return { cached: existing.responseBody as unknown as SerializedConversation };
    }

    const history = await this.db.copilotMessage.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
    const turns: ChatTurn[] = [
      ...history.map((message) => ({ role: message.role as 'user' | 'assistant', content: message.text || '' })),
      { role: 'user', content: input.text },
    ];
    return {
      cached: null,
      operation,
      key,
      hash,
      userMessage: { text: input.text },
      capabilityCode: 'jd_intake_turn',
      turns,
      currentFields: asRecord(conversation.fields) as JdFields,
    };
  }

  private async commitTurn(
    identity: Identity,
    id: string,
    prep: Extract<TurnPrep, { cached: null }>,
    parsed: LlmTurnResult,
  ): Promise<SerializedConversation> {
    const { operation, key, hash, userMessage, capabilityCode, currentFields } = prep;
    const mergedFields: JdFields = { ...currentFields, ...parsed.fields };
    const missingFields = computeMissingFields(mergedFields);
    const phase = missingFields.length === 0 ? 'ready_to_confirm' : 'intake';

    try {
      return await this.db.$transaction(async (tx) => {
        const prior = await tx.idempotencyKey.findUnique({
          where: { workspaceId_operation_key: { workspaceId: identity.workspaceId, operation, key } },
        });
        if (prior) {
          if (prior.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
          return prior.responseBody as unknown as SerializedConversation;
        }
        // This UPDATE is also the concurrency lock point: Postgres holds a row lock on the conversation
        // for the rest of this transaction, so a second concurrent turn on the same conversation blocks
        // here until this one commits. Only after acquiring it do we look up the *current* max sequence
        // — using the sequence captured back in prepareTurn (before the slow LLM call) would let two
        // concurrent turns compute the same number and collide on the (conversationId, sequence)
        // constraint, which is exactly what an earlier version of this code did.
        const updated = await tx.copilotConversation.update({
          where: { id },
          data: {
            fields: json(mergedFields),
            missingFields: json(missingFields),
            phase,
            stateRevision: { increment: 1 },
          },
        });
        const latest = await tx.copilotMessage.findFirst({ where: { conversationId: id }, orderBy: { sequence: 'desc' } });
        const userSequence = (latest?.sequence ?? 0) + 1;
        await tx.copilotMessage.create({
          data: {
            conversationId: id,
            sequence: userSequence,
            role: 'user',
            text: userMessage.text,
            attachments: userMessage.attachments === undefined ? undefined : json(userMessage.attachments),
            idempotencyKey: key,
          },
        });
        await tx.copilotMessage.create({
          data: { conversationId: id, sequence: userSequence + 1, role: 'assistant', text: parsed.reply },
        });
        await tx.aiRun.create({
          data: {
            workspaceId: identity.workspaceId,
            conversationId: id,
            capabilityCode,
            status: 'Succeeded',
            resultJson: json(parsed),
          },
        });
        const messages = await tx.copilotMessage.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
        const result = serializeConversation(updated, messages);
        await tx.idempotencyKey.create({
          data: { workspaceId: identity.workspaceId, operation, key, requestHash: hash, responseBody: json(result) },
        });
        return result;
      });
    } catch (error) {
      // The conversation-row lock above should make this unreachable in practice, but a raw 500 with
      // no explanation is a worse failure mode than an honest "conflict, retry" for any P2002 this
      // transaction didn't anticipate — e.g. the same Idempotency-Key racing itself.
      if (error instanceof ConflictException) throw error;
      if (isUniqueConstraintError(error)) {
        throw new ConflictException({ code: 'CONVERSATION_BUSY', message: '当前会话正在处理另一条消息，请重试。' });
      }
      throw error;
    }
  }

  async confirmDraft(identity: Identity, id: string, meta: RequestMeta) {
    const conversation = await this.loadConversation(identity, id);
    if (conversation.jobId) return { conversationId: conversation.id, jobId: conversation.jobId };
    if (conversation.phase !== 'ready_to_confirm') throw new ConflictException({ code: 'CONVERSATION_NOT_READY' });

    const key = meta.idempotencyKey?.trim();
    if (!key) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });

    const fields = asRecord(conversation.fields) as JdFields;

    // Job (title/team/location/headcount) is owned by the Core Record service; JobDraft (JD content)
    // is owned by this service and always hangs off an existing Job. Deterministic keys derived from
    // the caller's Idempotency-Key make retrying this whole action safe: Core and DraftsService each
    // do their own idempotent create, so a retry after a partial failure reuses the same Job/Draft
    // instead of creating duplicates.
    const job = await this.core.createJob(
      identity,
      {
        title: fields.title,
        team: fields.department,
        location: fields.location,
        employmentType: fields.employmentType,
        openings: fields.headcount,
      },
      `copilot.confirm-draft:${id}:job:${key}`,
    );

    // Core's role-version schema requires each requirement to carry id/label/dimension/hard/kind
    // (see hireos-core-record's RoleVersionsService requirementSchema) — a `statement` string alone
    // isn't enough. This service doesn't yet have a real dimension taxonomy, so everything collected
    // by the JD-intake chat lands under a generic "experience" dimension for now.
    const requirements = [
      ...(fields.mustHave || []).map((label, index) => ({
        id: `must-${index}`,
        label,
        dimension: 'experience',
        priority: 'must_have' as const,
        hard: true,
        kind: 'general',
      })),
      ...(fields.niceToHave || []).map((label, index) => ({
        id: `nice-${index}`,
        label,
        dimension: 'experience',
        priority: 'preferred' as const,
        hard: false,
        kind: 'general',
      })),
    ];
    const draft = await this.drafts.create(
      identity,
      job.id,
      {
        roleSummary: fields.roleSummary,
        responsibilities: fields.responsibilities || [],
        requirements,
        publicCompensation: fields.publicCompensation ?? null,
        ...(fields.businessProblem || fields.expectedOutcomes?.length
          ? { hiringContext: { businessProblem: fields.businessProblem, expectedOutcomes: fields.expectedOutcomes } }
          : {}),
        // Same `{ period, statement }` shape the role blueprint reads; the period lives in the statement text.
        ...(fields.successCriteria?.length
          ? { successCriteria: fields.successCriteria.map((statement) => ({ period: '90 days', statement })) }
          : {}),
        sourceRefs: [{ kind: 'copilot_conversation', id }],
        origin: 'jd_module',
      },
      { ...meta, idempotencyKey: `${key}:draft` },
    );

    await this.db.copilotConversation.update({ where: { id }, data: { jobId: job.id, phase: 'completed' } });
    this.logger.log(`confirm-draft completed: conversation=${id} job=${job.id}`);

    return { conversationId: id, jobId: job.id, draft };
  }

  async processAttachment(identity: Identity, id: string, file: UploadedAttachment, meta: RequestMeta) {
    file = { ...file, originalname: decodeUploadName(file.originalname) };
    const conversation = await this.loadConversation(identity, id);
    if (conversation.phase === 'completed') throw new ConflictException({ code: 'CONVERSATION_COMPLETED' });
    const key = meta.idempotencyKey?.trim();
    if (!key) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const operation = `copilot.attachment:${id}`;
    const attachmentMeta = { filename: file.originalname, mimeType: file.mimetype, size: file.size };
    const hash = requestHash(attachmentMeta);

    const existing = await this.db.idempotencyKey.findUnique({
      where: { workspaceId_operation_key: { workspaceId: identity.workspaceId, operation, key } },
    });
    if (existing) {
      if (existing.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
      return existing.responseBody;
    }

    const text = await extractTextFromFile(file.buffer, file.mimetype, file.originalname);
    if (!text) {
      throw new BadRequestException({ code: 'ATTACHMENT_EMPTY', message: '没有从文件中读取到可用的文本内容。' });
    }
    return this.extractFromSource(identity, id, conversation, {
      operation,
      key,
      hash,
      llmContent: `[上传文件：${file.originalname}]\n\n${text}`,
      userMessage: { text: `[已上传文件] ${file.originalname}`, attachments: [attachmentMeta] },
    });
  }

  /** "Paste a link or text": reads a public job posting page, or takes pasted JD text, through the same extraction as an upload. */
  async importSource(identity: Identity, id: string, raw: unknown, meta: RequestMeta) {
    const input = importSourceInputSchema.parse(raw);
    const conversation = await this.loadConversation(identity, id);
    if (conversation.phase === 'completed') throw new ConflictException({ code: 'CONVERSATION_COMPLETED' });
    const key = meta.idempotencyKey?.trim();
    if (!key) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const operation = `copilot.import:${id}`;
    const hash = requestHash(input);

    const existing = await this.db.idempotencyKey.findUnique({
      where: { workspaceId_operation_key: { workspaceId: identity.workspaceId, operation, key } },
    });
    if (existing) {
      if (existing.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
      return existing.responseBody;
    }

    if (input.url) {
      const text = await extractTextFromLink(input.url);
      return this.extractFromSource(identity, id, conversation, {
        operation,
        key,
        hash,
        llmContent: `[职位链接：${input.url}]\n\n${text}`,
        userMessage: { text: input.url, attachments: [{ kind: 'link', url: input.url }] },
      });
    }
    const text = input.text!;
    return this.extractFromSource(identity, id, conversation, {
      operation,
      key,
      hash,
      llmContent: `[粘贴的 JD 文案]\n\n${text}`,
      userMessage: { text },
    });
  }

  /** Shared by upload and link/text import: one file-extract turn over the source text. */
  private async extractFromSource(
    identity: Identity,
    id: string,
    conversation: ConversationRow,
    source: { operation: string; key: string; hash: string; llmContent: string; userMessage: { text: string; attachments?: unknown } },
  ) {
    const history = await this.db.copilotMessage.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
    const turns: ChatTurn[] = [
      ...history.map((message) => ({ role: message.role as 'user' | 'assistant', content: message.text || '' })),
      { role: 'user', content: source.llmContent },
    ];
    const parsed = await this.runFileExtractTurn(identity, id, turns);

    const prep: Extract<TurnPrep, { cached: null }> = {
      cached: null,
      operation: source.operation,
      key: source.key,
      hash: source.hash,
      userMessage: source.userMessage,
      capabilityCode: 'jd_file_extract_turn',
      turns,
      currentFields: asRecord(conversation.fields) as JdFields,
    };
    return this.commitTurn(identity, id, prep, parsed);
  }

  /**
   * "Start with a job title": three complete drafts of the same role in different writing styles, generated
   * in parallel. Nothing is committed — the user picks one, which is then saved through `setFields`.
   */
  async titleVariants(identity: Identity, id: string, raw: unknown) {
    const input = titleVariantsInputSchema.parse(raw);
    const conversation = await this.loadConversation(identity, id);
    if (conversation.phase === 'completed') throw new ConflictException({ code: 'CONVERSATION_COMPLETED' });

    const variants = await Promise.all(
      TITLE_VARIANT_STYLES.map(async (style) => {
        const turns: ChatTurn[] = [
          { role: 'user', content: `岗位名称：${input.title}\n\n请直接生成一份完整 JD。写作风格：${style.label}——${style.instruction}` },
        ];
        const parsed = await this.runAutoCompleteTurn(identity, id, turns);
        const fields: JdFields = { headcount: 1, ...parsed.fields, title: parsed.fields.title || input.title };
        return { key: style.key, label: style.label, description: style.description, fields };
      }),
    );
    return { title: input.title, variants };
  }

  /**
   * Refine every title variant with the same note, in parallel. Like `titleVariants`, nothing is committed —
   * each version keeps its own writing style and only changes what the note asks for.
   */
  async refineVariants(identity: Identity, id: string, raw: unknown) {
    const input = refineVariantsInputSchema.parse(raw);
    const conversation = await this.loadConversation(identity, id);
    if (conversation.phase === 'completed') throw new ConflictException({ code: 'CONVERSATION_COMPLETED' });
    const answer = await this.answerIfQuestion(identity, id, input.variants[0]?.fields ?? {}, input.note);
    if (answer) return { variants: input.variants, answer };

    const variants = await Promise.all(
      input.variants.map(async (variant) => {
        const fields = await this.runRefineTurn(identity, id, variant.fields, input.note, variant.label);
        return { ...variant, fields };
      }),
    );
    return { variants };
  }

  /**
   * "Refine" on a ready draft: rewrites the current fields with the user's note and keeps the conversation
   * ready to confirm. The LLM sees the full current JD, so a note never wipes out the parts it didn't mention.
   */
  async refineDraft(identity: Identity, id: string, raw: unknown, meta: RequestMeta) {
    const input = refineDraftInputSchema.parse(raw);
    const conversation = await this.loadConversation(identity, id);
    if (conversation.phase === 'completed') throw new ConflictException({ code: 'CONVERSATION_COMPLETED' });
    const current = asRecord(conversation.fields) as JdFields;
    const operation = `copilot.refine:${id}`;
    const key = meta.idempotencyKey?.trim();
    if (!key) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const existing = await this.db.idempotencyKey.findUnique({
      where: { workspaceId_operation_key: { workspaceId: identity.workspaceId, operation, key } },
    });
    if (existing) {
      if (existing.requestHash !== requestHash(input)) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
      return existing.responseBody;
    }

    const answer = await this.answerIfQuestion(identity, id, current, input.note);
    if (answer) {
      // A question about the role, not an edit: answer it and leave the draft (fields, phase, revision) untouched.
      return this.db.$transaction(async (tx) => {
        const prior = await findIdempotent(tx, identity, operation, meta, input);
        if (prior.prior) return prior.prior.responseBody;
        const latest = await tx.copilotMessage.findFirst({ where: { conversationId: id }, orderBy: { sequence: 'desc' } });
        const sequence = (latest?.sequence ?? 0) + 1;
        await tx.copilotMessage.create({ data: { conversationId: id, sequence, role: 'user', text: input.note, idempotencyKey: prior.key } });
        await tx.copilotMessage.create({
          data: { conversationId: id, sequence: sequence + 1, role: 'assistant', text: formatWebAnswer(answer) },
        });
        const messages = await tx.copilotMessage.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
        const result = { ...serializeConversation(conversation, messages), answer };
        await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
        return result;
      });
    }

    const fields = await this.runRefineTurn(identity, id, current, input.note);
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, operation, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      const updated = await tx.copilotConversation.update({
        where: { id },
        data: { fields: json(fields), missingFields: json([]), phase: 'ready_to_confirm', stateRevision: { increment: 1 } },
      });
      const latest = await tx.copilotMessage.findFirst({ where: { conversationId: id }, orderBy: { sequence: 'desc' } });
      const sequence = (latest?.sequence ?? 0) + 1;
      await tx.copilotMessage.create({ data: { conversationId: id, sequence, role: 'user', text: input.note, idempotencyKey: prior.key } });
      await tx.copilotMessage.create({
        data: { conversationId: id, sequence: sequence + 1, role: 'assistant', text: '已按你的补充意见更新草稿，改动已在工作区中标出。' },
      });
      const messages = await tx.copilotMessage.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
      const result = serializeConversation(updated, messages);
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
      return result;
    });
  }

  /**
   * The refine box doubles as a chat box once a draft exists, so a note may be a question ("what's the
   * monthly salary for this role in Wuhan?") rather than an edit. Questions are answered with web search
   * and never touch the draft; anything that asks to change the draft — or an unclear note — stays an edit.
   */
  private async answerIfQuestion(identity: Identity, id: string, current: JdFields, note: string): Promise<WebAnswer | null> {
    let intent = 'edit';
    try {
      const raw = await this.llm.completeJson(REFINE_INTENT_PROMPT, [
        { role: 'user', content: `当前 JD 草稿：${JSON.stringify(current)}\n\n用户这句话：${note}` },
      ]);
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && (parsed as { intent?: unknown }).intent === 'question') intent = 'question';
    } catch (error) {
      // Classification is best-effort: falling back to the old "every note is an edit" behavior.
      this.logger.warn(`refine_intent failed (conversation=${id}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (intent !== 'question') return null;
    const startedAt = Date.now();
    try {
      const context = [
        current.title && `职位：${current.title}`,
        current.department && `部门：${current.department}`,
        current.location && `地点：${current.location}`,
        current.employmentType && `类型：${current.employmentType}`,
        current.mustHave?.length && `任职要求：${current.mustHave.join('；')}`,
      ].filter(Boolean).join('\n');
      const answer = await this.llm.answerWithWebSearch(WEB_ANSWER_INSTRUCTIONS, `${context}\n\n问题：${note}`);
      this.logger.log(`refine_web_answer succeeded in ${Date.now() - startedAt}ms (conversation=${id}, ${answer.sources.length} sources)`);
      return answer;
    } catch (error) {
      throw await this.recordLlmFailure(identity, id, 'refine_web_answer', error);
    }
  }

  /**
   * One refine pass over a complete JD. The model gets the whole current JD and must return every field in
   * full; a result that lost required content is rejected instead of overwriting a good draft.
   */
  private async runRefineTurn(identity: Identity, id: string, current: JdFields, note: string, style?: string): Promise<JdFields> {
    const turns: ChatTurn[] = [
      {
        role: 'user',
        content: [
          `以下是当前 JD 草稿（JSON${style ? `，写作风格：${style}` : ''}）：`,
          JSON.stringify(current),
          '',
          `请按我的补充意见修改：${note}`,
          '要求：只改动与意见相关的内容，其余字段和条目保持原文不变' + (style ? '，写作风格保持不变' : '') + '。',
          'fields 必须输出修改后的完整 JD：每个字段都要给出，列表字段（responsibilities、mustHave、niceToHave）要列出全部条目，不能只输出改动的条目。',
          '业务背景、预期成果、入职成功标准分别写进 businessProblem、expectedOutcomes、successCriteria。这三项和 publicCompensation 是可选字段：当前草稿里没有、意见也没明确要求的，不要输出，更不要自行编写。',
          '薪资写进 publicCompensation（结构见字段 schema），不要放进其他字段，也不要新增 schema 以外的字段；意见没提薪资时原样保留。',
        ].join('\n'),
      },
    ];
    const parsed = await this.runAutoCompleteTurn(identity, id, turns);
    const fields: JdFields = { ...current, ...parsed.fields, title: parsed.fields.title || current.title };
    // Prompting alone doesn't stop the model from "completing" optional sections nobody asked for, so an
    // optional section that was empty is only accepted when the note actually talks about it.
    for (const [field, mentioned] of OPTIONAL_SECTION_MENTIONS) {
      if (current[field] === undefined && !mentioned.test(note)) delete fields[field];
    }
    if (computeMissingFields(fields).length > 0) {
      throw new ServiceUnavailableException({ code: 'REFINE_INCOMPLETE', message: '这次修改没有生成完整的 JD，原草稿未改动，请换个说法再试一次。' });
    }
    return fields;
  }

  /**
   * Fields the user authored (manual form) or picked (a title variant): stored as-is with no LLM turn, and the
   * conversation goes straight to `ready_to_confirm` so the existing confirm-draft creates the job.
   */
  async setFields(identity: Identity, id: string, raw: unknown, meta: RequestMeta) {
    const input = setFieldsInputSchema.parse(raw);
    const missing = computeMissingAuthoredFields(input.fields);
    if (missing.length > 0) {
      throw new BadRequestException({ code: 'FIELDS_INCOMPLETE', message: `缺少必填内容：${missing.join(', ')}` });
    }
    const conversation = await this.loadConversation(identity, id);
    if (conversation.phase === 'completed') throw new ConflictException({ code: 'CONVERSATION_COMPLETED' });

    return this.db.$transaction(async (tx) => {
      const operation = `copilot.fields:${id}`;
      const prior = await findIdempotent(tx, identity, operation, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      const updated = await tx.copilotConversation.update({
        where: { id },
        data: { fields: json(input.fields), missingFields: json([]), phase: 'ready_to_confirm', stateRevision: { increment: 1 } },
      });
      const latest = await tx.copilotMessage.findFirst({ where: { conversationId: id }, orderBy: { sequence: 'desc' } });
      const sequence = (latest?.sequence ?? 0) + 1;
      await tx.copilotMessage.create({ data: { conversationId: id, sequence, role: 'user', text: input.label, idempotencyKey: prior.key } });
      await tx.copilotMessage.create({
        data: { conversationId: id, sequence: sequence + 1, role: 'assistant', text: `好的，已按「${input.fields.title}」整理好 JD 草稿，请确认后创建职位。` },
      });
      const messages = await tx.copilotMessage.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
      const result = serializeConversation(updated, messages);
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
      return result;
    });
  }

  /**
   * "Auto-complete and optimize": a deliberately different mode from the conversational intake turn
   * above. Where intake asks one question at a time and refuses to invent facts, this one is a single
   * turn that must fill in every remaining required field with reasonable, clearly-editable
   * industry-standard suggestions and land on `ready_to_confirm` — matching the old project's separate
   * `guided` vs `automatic` creation modes (jd-intake vs jd-autotake), which this service didn't have
   * before: it only ever asked narrow clarifying questions, even when the user explicitly asked for a
   * complete draft instead.
   */
  async autoComplete(identity: Identity, id: string, raw: unknown, meta: RequestMeta) {
    const input = autoCompleteInputSchema.parse(raw ?? {});
    const conversation = await this.loadConversation(identity, id);
    if (conversation.phase === 'completed') throw new ConflictException({ code: 'CONVERSATION_COMPLETED' });
    const key = meta.idempotencyKey?.trim();
    if (!key) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const operation = `copilot.autocomplete:${id}`;
    const userText = input.text || '自动补全并优化内容';
    const hash = requestHash({ userText });

    const existing = await this.db.idempotencyKey.findUnique({
      where: { workspaceId_operation_key: { workspaceId: identity.workspaceId, operation, key } },
    });
    if (existing) {
      if (existing.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
      return existing.responseBody;
    }

    const history = await this.db.copilotMessage.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
    const turns: ChatTurn[] = [
      ...history.map((message) => ({ role: message.role as 'user' | 'assistant', content: message.text || '' })),
      { role: 'user', content: userText },
    ];
    const parsed = await this.runAutoCompleteTurn(identity, id, turns);

    const prep: Extract<TurnPrep, { cached: null }> = {
      cached: null,
      operation,
      key,
      hash,
      userMessage: { text: userText },
      capabilityCode: 'jd_autotake_turn',
      turns,
      currentFields: asRecord(conversation.fields) as JdFields,
    };
    return this.commitTurn(identity, id, prep, parsed);
  }

  private async loadConversation(identity: Identity, id: string): Promise<ConversationRow> {
    const conversation = await this.db.copilotConversation.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!conversation) throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
    return conversation;
  }

  private async runIntakeTurn(identity: Identity, conversationId: string, turns: ChatTurn[]): Promise<LlmTurnResult> {
    const startedAt = Date.now();
    try {
      const raw = await this.llm.completeJson(this.prompts.jdIntakeSystemPrompt, turns);
      const parsed = llmTurnResultSchema.parse(JSON.parse(raw));
      this.logger.log(`jd_intake_turn succeeded in ${Date.now() - startedAt}ms (conversation=${conversationId})`);
      return parsed;
    } catch (error) {
      throw await this.recordLlmFailure(identity, conversationId, 'jd_intake_turn', error);
    }
  }

  private async runFileExtractTurn(identity: Identity, conversationId: string, turns: ChatTurn[]): Promise<LlmTurnResult> {
    const startedAt = Date.now();
    try {
      const raw = await this.llm.completeJson(this.prompts.jdFileExtractSystemPrompt, turns);
      const parsed = llmTurnResultSchema.parse(JSON.parse(raw));
      this.logger.log(`jd_file_extract_turn succeeded in ${Date.now() - startedAt}ms (conversation=${conversationId})`);
      return parsed;
    } catch (error) {
      throw await this.recordLlmFailure(identity, conversationId, 'jd_file_extract_turn', error);
    }
  }

  private async runAutoCompleteTurn(identity: Identity, conversationId: string, turns: ChatTurn[]): Promise<LlmTurnResult> {
    const startedAt = Date.now();
    try {
      const raw = await this.llm.completeJson(this.prompts.jdAutotakeSystemPrompt, turns);
      const parsed = llmTurnResultSchema.parse(JSON.parse(raw));
      this.logger.log(`jd_autotake_turn succeeded in ${Date.now() - startedAt}ms (conversation=${conversationId})`);
      return parsed;
    } catch (error) {
      throw await this.recordLlmFailure(identity, conversationId, 'jd_autotake_turn', error);
    }
  }

  private async runIntakeTurnStream(
    identity: Identity,
    conversationId: string,
    turns: ChatTurn[],
    onDelta: (text: string) => void,
  ): Promise<LlmTurnResult> {
    const startedAt = Date.now();
    const extractor = new ReplyStreamExtractor();
    let raw = '';
    try {
      for await (const chunk of this.llm.streamJson(this.prompts.jdIntakeSystemPrompt, turns)) {
        raw += chunk;
        const delta = extractor.push(chunk);
        if (delta) onDelta(delta);
      }
      if (!raw) throw new Error('LLM_EMPTY_RESPONSE');
      const parsed = llmTurnResultSchema.parse(JSON.parse(raw));
      this.logger.log(`jd_intake_turn (streamed) succeeded in ${Date.now() - startedAt}ms (conversation=${conversationId})`);
      return parsed;
    } catch (error) {
      throw await this.recordLlmFailure(identity, conversationId, 'jd_intake_turn', error);
    }
  }

  /** Logs and records an `AiRun` failure row, then returns the exception the caller should throw. */
  private async recordLlmFailure(
    identity: Identity,
    conversationId: string,
    capabilityCode: string,
    error: unknown,
  ): Promise<ServiceUnavailableException> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`${capabilityCode} failed (conversation=${conversationId}): ${message}`);
    await this.db.aiRun
      .create({
        data: { workspaceId: identity.workspaceId, conversationId, capabilityCode, status: 'Failed', failureCode: 'LLM_INVALID_OUTPUT' },
      })
      .catch(() => undefined);
    // The raw parse error (a zod issue dump or JSON syntax error) means nothing to the user; it's logged above.
    return error instanceof ServiceUnavailableException
      ? error
      : new ServiceUnavailableException({ code: 'LLM_INVALID_OUTPUT', message: 'AI 返回的内容格式有误，原草稿未改动，请重试或换个说法。' });
  }
}

const OPTIONAL_SECTION_MENTIONS: [keyof JdFields, RegExp][] = [
  ['businessProblem', /背景|业务|为什么|原因|business|context|why/i],
  ['expectedOutcomes', /成果|产出|目标|交付|指标|KPI|OKR|outcome|deliverable/i],
  ['successCriteria', /成功|试用期|\d+\s*天|个月|success|first\s*\d+/i],
  ['publicCompensation', /薪|工资|待遇|报酬|salary|pay|compensation|\d+(\.\d+)?\s*[kK万]/i],
];

const REFINE_INTENT_PROMPT = [
  '你是招聘 JD 助手的意图分类器。用户已经有一份 JD 草稿，现在又说了一句话。',
  '判断这句话是要求修改草稿（edit），还是在提问、咨询、要信息或建议而没有要求改稿（question）。',
  '明确要求修改、补充、删减、调整草稿内容（包括“改成”“加上”“写上”“去掉”等）的是 edit；',
  '询问薪资行情、市场情况、招聘难度、写法建议、名词解释等的是 question。既提问又要求修改的算 edit。',
  '只输出 JSON：{"intent":"edit"} 或 {"intent":"question"}。',
].join('\n');

const WEB_ANSWER_INSTRUCTIONS = [
  '你是招聘助手。用户正在写一份 JD，下面给出岗位背景和用户的问题。',
  '需要行情、薪资、市场等时效性信息时先联网搜索，基于搜索结果回答；不确定时说明口径和不确定性。',
  '用简体中文，纯文本，不要用 Markdown，不要贴链接，也不要在末尾写“来源”（来源会单独列出）。回答简洁，控制在 200 字以内。',
  '薪资类问题给出区间，并注明口径（税前月薪、年终/薪数等）和适用的经验段。不要修改或复述 JD。',
].join('\n');

/** Stored message text for a web answer: the answer plus its sources, since the chat history is plain text. */
function formatWebAnswer(answer: WebAnswer): string {
  if (answer.sources.length === 0) return answer.text;
  return `${answer.text}\n\n来源：\n${answer.sources.map((source) => `- ${source.title} ${source.url}`).join('\n')}`;
}

const TITLE_VARIANT_STYLES = [
  { key: 'concise', label: '简洁直接', description: '简短易扫读，阅读最快。', instruction: '用短句和精炼的要点，每条职责和要求尽量一句话说清，整体篇幅短。' },
  { key: 'warm', label: '温暖亲和', description: '直接对候选人说话，突出影响力和团队文化。', instruction: '以“你”称呼候选人，突出这份工作带来的影响、成长和团队氛围，语气友好有温度。' },
  { key: 'detailed', label: '详细结构化', description: '背景和期望完整清晰，适合资深岗位。', instruction: '给出完整的业务背景、明确的工作产出和衡量标准，职责和要求条目更多、更具体。' },
] as const;

/** Multer reads multipart filenames as latin1, so UTF-8 names (e.g. Chinese) arrive garbled; re-decode them. */
function decodeUploadName(name: string): string {
  if ([...name].some((char) => char.charCodeAt(0) > 0xff)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

function serializeConversation(conversation: ConversationRow, messages: MessageRow[]) {
  return {
    id: conversation.id,
    jobId: conversation.jobId,
    phase: conversation.phase,
    fields: conversation.fields,
    missingFields: conversation.missingFields,
    stateRevision: conversation.stateRevision,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      attachments: message.attachments,
      sequence: message.sequence,
      createdAt: message.createdAt,
    })),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
