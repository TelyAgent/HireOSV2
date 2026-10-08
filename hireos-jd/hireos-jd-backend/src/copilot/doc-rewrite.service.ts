import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { json } from '../records';
import { LlmProvider } from './llm-provider';

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
    documentText: z.string().max(40000).optional(),
  }),
});

const rewriteOutputSchema = z.object({
  text: z.string().optional(),
  items: z.array(z.string()).optional(),
  explain: z.string().default(''),
  reason: z.string().default(''),
});

const AUDIENCES = ['internal', 'external'] as const;

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
