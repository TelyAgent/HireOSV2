import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { json } from '../records';
import { HIREOS_JD_FACTS, OUT_OF_SCOPE_REPLY, SALARY_ANSWER_RULES, fixAnnualSalary, workflowGuide } from './jd-agent-scope';
import { LlmProvider, type WebSource } from './llm-provider';

const CAPABILITY_CODE = 'jd_doc_rewrite';

const rewriteInputSchema = z.object({
  /** The exact text the user selected (plain text; list items separated by newlines). */
  selectedText: z.string().trim().min(1).max(8000),
  /** Free-form instruction typed by the user; omitted for the quick actions. */
  instruction: z.string().trim().max(2000).optional(),
  action: z.enum(['rewrite', 'shorten', 'clarify', 'custom']).default('custom'),
  /** The block the selection sits in. `items` is set for list blocks, `text` otherwise. */
  target: z.object({
    kind: z.string().max(40),
    text: z.string().max(20000).optional(),
    items: z.array(z.string().max(20000)).max(200).optional(),
  }),
  /** `items` → the whole list block is being rewritten and the result must be a list. */
  scope: z.enum(['fragment', 'items']),
  context: z.object({
    jobTitle: z.string().max(300).optional(),
    department: z.string().max(300).optional(),
    /** Whole document as plain text, so the rewrite stays consistent with the rest of the JD. */
    documentText: z.string().max(500000).optional(),
  }),
});

const rewriteOutputSchema = z.object({
  text: z.string().optional(),
  items: z.array(z.string()).optional(),
  explain: z.string().default(''),
  reason: z.string().default(''),
});

const AUDIENCES = ['internal', 'external'] as const;

/**
 * A message typed in the job-page Copilot (#106 #107). It may be a question about the JD, a market
 * question, an edit, a request to act, or off-topic — only an edit ever becomes a proposal.
 */
const askInputSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  /** Selected text or the clicked block; absent when the user just asks. */
  selection: z
    .object({
      text: z.string().trim().min(1).max(8000),
      target: rewriteInputSchema.shape.target,
      scope: rewriteInputSchema.shape.scope,
      /** The block the cursor is in, not text the user selected: an edit may use it, an answer is about the whole JD. */
      implicit: z.boolean().optional(),
    })
    .optional(),
  context: rewriteInputSchema.shape.context.extend({
    /** The page's own Analyze / Publish status in words, so "can I submit?" is answered from it. */
    readiness: z.string().max(8000).optional(),
    /** Only the first part of an extremely long JD was sent: the model must not call the rest "absent". */
    documentTruncated: z.boolean().optional(),
  }),
});

export type DocIntent = 'answer' | 'research' | 'edit' | 'action' | 'off_topic';

/** "只回答，不修改" and the like: never a proposal, whatever the classifier thinks (#107 AC-1). */
const ANSWER_ONLY = /只回答|只解释|不(要|用)?修改|别改|不要改|不改动|不用改|just answer|only answer|answer only|explain only|don'?t (change|edit|modify)|do not (change|edit|modify)/i;

const DOC_INTENT_PROMPT = [
  '你是 JD 编辑页 Copilot 的意图分类器。用户在看一份职位 JD，可能选中了一段文字，然后说了一句话。判断这句话属于哪一类：',
  '- edit：要求改写、精简、补充、删除、翻译或调整 JD 内容。',
  '- answer：询问 JD 内容的含义、依据、写得怎么样、能否提交审批或发布等，只需要回答，不要求改动。',
  '- research：询问薪资行情、市场情况、同类岗位做法等需要外部信息的问题，没有要求改动。',
  '- action：要求你代为提交审批、批准、发布职位或执行其他系统操作。',
  '- off_topic：与职位、招聘和这份 JD 都无关（天气、新闻、闲聊等）。',
  '用户明确说“只回答”“不修改”的不是 edit。',
  '只输出 JSON：{"intent":"edit"|"answer"|"research"|"action"|"off_topic"}。',
].join('\n');

const DOC_ANSWER_PROMPT = [
  '你是 HireOS 职位编辑页的 Copilot。基于下面给出的整份 JD（以及用户选中的文字）回答用户的问题。',
  '- 只回答，不要改写或提出修改稿；需要时引用 JD 里的原文作为依据。',
  '- 问能否提交审批或发布时，依据“当前检查结果”说明原因和还差什么，不要代为操作。',
  '- JD 里没有的信息就说没有，不要编造。',
  '- 用用户使用的语言回答，纯文本，200 字以内。',
  '',
  HIREOS_JD_FACTS,
  '',
  '只输出 JSON：{"answer": string}。',
].join('\n');

const DOC_RESEARCH_INSTRUCTIONS = [
  '你是招聘助手。用户正在编辑一份 JD，下面给出岗位背景、JD 内容和问题。',
  '需要行情、薪资、市场等时效性信息时先联网搜索，基于搜索结果回答；不确定时说明口径和不确定性。',
  '用用户使用的语言，纯文本，不要用 Markdown，不要贴链接，也不要在末尾写“来源”（来源会单独列出）。回答简洁，控制在 250 字以内。',
  '只回答，不要修改或复述 JD。',
  SALARY_ANSWER_RULES,
].join('\n');

/** What the job-page Copilot did with a message. Only `edit` is meant to become a suggestion. */
export type AskResult =
  | { kind: 'answer'; intent: Exclude<DocIntent, 'edit'>; text: string; sources: WebSource[]; contextScope: 'selection' | 'document' }
  | { kind: 'edit'; text: string; items: string[] | null; explain: string; reason: string }
  | { kind: 'no_change'; explain: string }
  | { kind: 'needs_target' };

const ACTION_HINTS: Record<string, string> = {
  rewrite: '改写选中内容，使其更清晰、专业、具体，可被筛选和面试验证。',
  shorten: '精简选中内容，保留核心含义，去掉冗余。',
  clarify: '澄清选中内容，消除歧义，补充可验证的标准或证据要求。',
  custom: '按用户指令处理选中内容。',
};

function systemPrompt(audience: string, scope: 'fragment' | 'items'): string {
  return [
    '你是 HireOS 的 JD（职位描述）写作助手，负责按用户指令改写职位文档中被选中的部分。',
    '',
    '## 规则',
    '- 只改写选中的内容，结合职位信息和整篇文档上下文，保持风格、术语与其余部分一致。',
    '- 输出语言与选中内容的语言保持一致（中文选中内容用中文输出）。',
    '- 不要编造具体事实：公司名称、薪资数字、具体产品名、年限等文档里没有的信息不要凭空添加；需要时用通用但具体的描述。',
    '- 不要输出 HTML 或 markdown 标记，只输出纯文本。',
    audience === 'external'
      ? '- 这是对外（候选人可见）版本：不得出现内部薪资上限、预算等内部信息，语气面向候选人。'
      : '- 这是内部版本，面向招聘团队。',
    scope === 'items'
      ? '- 选中内容是一个列表（每行一项）。请输出改写后的完整列表，每项一句，项数可以按需要增减。'
      : '- 选中内容是一句话或一段文字。请只输出替换它的那段文字，不要输出整段上下文。',
    '',
    '## 输出格式',
    '你必须只输出一个 JSON 对象（不要包含任何其他文字或代码块标记），字段如下：',
    scope === 'items' ? '- items: string[] — 改写后的列表项' : '- text: string — 改写后的文字',
    '- explain: string — 给用户看的一两句话，说明你做了什么改动（用用户使用的语言）',
    '- reason: string — 一句话说明改动对岗位要求的影响（例如是否改变必备/加分、评估标准）',
  ].join('\n');
}

@Injectable()
export class DocRewriteService {
  private readonly logger = new Logger(DocRewriteService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly llm: LlmProvider,
  ) {}

  /**
   * One message typed in the job-page Copilot. Questions are answered from the whole (non-confidential)
   * JD with or without a selection (#106); market questions go to web search; only an explicit edit runs
   * the rewrite, and an edit that comes back identical to the original is reported as "no change" (#107).
   */
  async ask(identity: Identity, jobId: string, audience: string, raw: unknown): Promise<AskResult> {
    if (!(AUDIENCES as readonly string[]).includes(audience)) {
      throw new BadRequestException({ code: 'INVALID_AUDIENCE', message: 'audience must be "internal" or "external".' });
    }
    const parsed = askInputSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_ASK_REQUEST', message: parsed.error.message });
    const input = parsed.data;
    const contextScope = input.selection && !input.selection.implicit ? 'selection' : 'document';

    const intent = await this.classify(jobId, input.message, input.selection && !input.selection.implicit ? input.selection.text : undefined);
    if (intent === 'off_topic') return { kind: 'answer', intent, text: OUT_OF_SCOPE_REPLY, sources: [], contextScope };
    if (intent === 'action') return { kind: 'answer', intent, text: workflowGuide(input.context.readiness), sources: [], contextScope };

    const background = [
      `职位名称：${input.context.jobTitle || '未知'}`,
      `部门：${input.context.department || '未知'}`,
      '',
      input.context.documentTruncated ? '## JD（仅前一部分：原文过长未全部发送）' : '## 整份 JD',
      input.context.documentText || '（无）',
      ...(input.context.documentTruncated
        ? ['', '注意：上面只是 JD 的前一部分。没出现在这里的内容不能说 JD 里“没有”，应说明只看到了前一部分，并请用户选中相关段落再问。']
        : []),
      ...(input.selection ? ['', input.selection.implicit ? '## 光标所在的段落（用户没有选中文字）' : '## 用户选中的文字', input.selection.text] : []),
      ...(input.context.readiness ? ['', '## 当前检查结果（Analyze / 发布按钮）', input.context.readiness] : []),
    ].join('\n');

    if (intent === 'research') {
      const startedAt = Date.now();
      try {
        const answer = await this.llm.answerWithWebSearch(DOC_RESEARCH_INSTRUCTIONS, `${background}\n\n问题：${input.message}`);
        await this.recordRun(identity, 'jd_doc_research', 'Succeeded', startedAt, jobId);
        return { kind: 'answer', intent, text: fixAnnualSalary(answer.text), sources: answer.sources, contextScope };
      } catch (error) {
        throw await this.fail(identity, 'jd_doc_research', jobId, error);
      }
    }

    if (intent === 'answer') {
      const startedAt = Date.now();
      try {
        const rawOutput = await this.llm.completeJson(DOC_ANSWER_PROMPT, [{ role: 'user', content: `${background}\n\n问题：${input.message}` }]);
        const text = z.object({ answer: z.string().trim().min(1) }).parse(JSON.parse(rawOutput)).answer;
        await this.recordRun(identity, 'jd_doc_answer', 'Succeeded', startedAt, jobId);
        return { kind: 'answer', intent, text: fixAnnualSalary(text), sources: [], contextScope };
      } catch (error) {
        throw await this.fail(identity, 'jd_doc_answer', jobId, error);
      }
    }

    // An edit needs something to edit: the selection, or else the block the cursor is in.
    if (!input.selection) return { kind: 'needs_target' };
    const result = await this.rewrite(identity, jobId, audience, {
      selectedText: input.selection.text,
      instruction: input.message,
      action: 'custom',
      target: input.selection.target,
      scope: input.selection.scope,
      context: { jobTitle: input.context.jobTitle, department: input.context.department, documentText: input.context.documentText },
    });
    const original = input.selection.scope === 'items' ? (input.selection.target.items ?? []).join('\n') : input.selection.text;
    if (sameText(result.text, original)) return { kind: 'no_change', explain: result.explain };
    return { kind: 'edit', ...result };
  }

  private async classify(jobId: string, message: string, selected?: string): Promise<DocIntent> {
    if (ANSWER_ONLY.test(message)) return /薪|工资|待遇|行情|市场|salary|pay|market/i.test(message) ? 'research' : 'answer';
    try {
      const raw = await this.llm.completeJson(DOC_INTENT_PROMPT, [
        { role: 'user', content: `${selected ? `选中的文字：${selected}\n\n` : ''}用户这句话：${message}` },
      ]);
      const said = (JSON.parse(raw) as { intent?: unknown }).intent;
      if (said === 'edit' || said === 'answer' || said === 'research' || said === 'action' || said === 'off_topic') return said;
    } catch (error) {
      this.logger.warn(`jd_doc_intent failed (job=${jobId}): ${error instanceof Error ? error.message : String(error)}`);
    }
    // Unclear: with a selection keep the old "it's an edit" behavior (the user still reviews a proposal);
    // without one, answer rather than ask them to select something.
    return selected ? 'edit' : 'answer';
  }

  private async recordRun(identity: Identity, capabilityCode: string, status: 'Succeeded', startedAt: number, jobId: string) {
    this.logger.log(`${capabilityCode} succeeded in ${Date.now() - startedAt}ms (job=${jobId})`);
    await this.db.aiRun.create({ data: { workspaceId: identity.workspaceId, capabilityCode, status } }).catch(() => undefined);
  }

  private async fail(identity: Identity, capabilityCode: string, jobId: string, error: unknown) {
    this.logger.error(`${capabilityCode} failed (job=${jobId}): ${error instanceof Error ? error.message : String(error)}`);
    await this.db.aiRun
      .create({ data: { workspaceId: identity.workspaceId, capabilityCode, status: 'Failed', failureCode: 'LLM_INVALID_OUTPUT' } })
      .catch(() => undefined);
    return error instanceof ServiceUnavailableException
      ? error
      : new ServiceUnavailableException({ code: 'LLM_INVALID_OUTPUT', message: 'Copilot 暂时无法回答，请稍后重试。' });
  }

  async rewrite(identity: Identity, jobId: string, audience: string, raw: unknown) {
    if (!(AUDIENCES as readonly string[]).includes(audience)) {
      throw new BadRequestException({ code: 'INVALID_AUDIENCE', message: 'audience must be "internal" or "external".' });
    }
    const parsedInput = rewriteInputSchema.safeParse(raw);
    if (!parsedInput.success) throw new BadRequestException({ code: 'INVALID_REWRITE_REQUEST', message: parsedInput.error.message });
    const input = parsedInput.data;

    const userPrompt = [
      `## 职位`,
      `职位名称：${input.context.jobTitle || '未知'}`,
      `部门：${input.context.department || '未知'}`,
      `文档版本：${audience === 'external' ? '对外版' : '内部版'}`,
      '',
      '## 整篇文档（上下文，仅供参考，不要整篇改写）',
      input.context.documentText || '（无）',
      '',
      '## 选中内容所在的块',
      input.target.items ? input.target.items.map((x) => `- ${x}`).join('\n') : input.target.text || '',
      '',
      '## 选中内容',
      input.selectedText,
      '',
      '## 任务',
      ACTION_HINTS[input.action],
      input.instruction ? `用户指令：${input.instruction}` : '',
    ].join('\n');

    const startedAt = Date.now();
    try {
      const rawOutput = await this.llm.completeJson(systemPrompt(audience, input.scope), [{ role: 'user', content: userPrompt }]);
      const output = rewriteOutputSchema.parse(JSON.parse(rawOutput));
      const items = output.items?.map((x) => x.trim()).filter(Boolean);
      const text = output.text?.trim();
      if (input.scope === 'items' ? !items?.length : !text) throw new Error('LLM_EMPTY_REWRITE');
      const result = {
        text: input.scope === 'items' ? items!.join('\n') : text!,
        items: input.scope === 'items' ? items! : null,
        explain: output.explain.trim(),
        reason: output.reason.trim(),
      };
      this.logger.log(`${CAPABILITY_CODE} succeeded in ${Date.now() - startedAt}ms (job=${jobId})`);
      await this.db.aiRun
        .create({ data: { workspaceId: identity.workspaceId, capabilityCode: CAPABILITY_CODE, status: 'Succeeded', resultJson: json(result) } })
        .catch(() => undefined);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${CAPABILITY_CODE} failed (job=${jobId}): ${message}`);
      await this.db.aiRun
        .create({ data: { workspaceId: identity.workspaceId, capabilityCode: CAPABILITY_CODE, status: 'Failed', failureCode: 'LLM_INVALID_OUTPUT' } })
        .catch(() => undefined);
      throw error instanceof ServiceUnavailableException
        ? error
        : new ServiceUnavailableException({ code: 'LLM_INVALID_OUTPUT', message: 'Copilot 暂时无法生成改写，请稍后重试。' });
    }
  }
}

/** Same wording once whitespace and list bullets are ignored — an "edit" that changes nothing (#107 AC-2). */
function sameText(a: string, b: string): boolean {
  const norm = (t: string) => t.replace(/^\s*[-•*]\s*/gm, '').replace(/\s+/g, ' ').trim();
  return norm(a) === norm(b);
}
