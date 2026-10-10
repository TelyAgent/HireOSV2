import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { json } from '../records';
import { LlmProvider } from './llm-provider';

/**
 * Completeness-standard AI for the job document (JD Completeness Standard v0.1, kept next to the
 * prompts in `skills/jd-completeness/standard.md`):
 *  - `section`: drafts a missing section, or revises one that fails a "Needs revision" rule;
 *  - `analyze`: the judgement-based review the rule check can't do (verifiability, requirement ↔
 *    responsibility coverage, consistency, compliance), in the standard's §6 output format.
 *
 * The frontend never sends the text of Confidential blocks (standard V5) — only their id and level.
 */

const contextSchema = z.object({
  jobTitle: z.string().max(300).optional(),
  level: z.string().max(100).optional(),
  location: z.string().max(300).optional(),
  department: z.string().max(300).optional(),
  headcount: z.number().int().optional(),
  language: z.enum(['zh', 'en']).optional(),
});

const blockSchema = z.object({
  id: z.string().min(1).max(200),
  kind: z.string().max(10),
  level: z.enum(['public', 'internal', 'confidential']),
  section: z.string().max(500),
  /** Omitted for Confidential blocks. */
  text: z.string().max(20000).optional(),
});

const sectionInputSchema = z.object({
  mode: z.enum(['draft', 'fix']),
  itemId: z.string().max(20),
  label: z.string().max(200),
  hint: z.string().max(1000),
  /** The rule message to fix (mode = fix). */
  issue: z.string().max(1000).optional(),
  list: z.boolean(),
  /** Current content of the section (mode = fix). */
  current: z.array(z.string().max(20000)).max(50).default([]),
  context: contextSchema,
  blocks: z.array(blockSchema).max(500),
});

const sectionOutputSchema = z.object({
  items: z.array(z.string()).min(1).max(12),
  explain: z.string().default(''),
});

const analyzeInputSchema = z.object({
  context: contextSchema,
  blocks: z.array(blockSchema).max(500),
});

const findingSchema = z.object({
  id: z.string().default(''),
  status: z.enum(['pass', 'weak', 'missing']).catch('weak'),
  severity: z.enum(['blocker', 'warning', 'suggestion']).catch('suggestion'),
  evidence: z.string().default(''),
  reason: z.string().default(''),
  suggestion: z.string().default(''),
  blockId: z.string().nullable().default(null),
});
const analyzeOutputSchema = z.object({
  verdict: z.enum(['ready', 'needs_work', 'blocked']).catch('needs_work'),
  summary: z.string().default(''),
  items: z.array(findingSchema).default([]),
});

let standardText: string | null = null;
/** Read on first use, so a missing asset fails these two endpoints instead of the whole service at boot. */
function standard(): string {
  standardText ??= readFileSync(join(__dirname, 'skills', 'jd-completeness', 'standard.md'), 'utf-8');
  return standardText;
}

function languageRule(lang?: 'zh' | 'en') {
  return lang === 'en'
    ? '- 文档是英文的：输出内容用英文；explain / reason / suggestion 等说明文字用中文。'
    : '- 输出语言与文档一致（中文文档用中文输出）。';
}

function documentText(blocks: z.infer<typeof blockSchema>[]) {
  return blocks
    .map((b) => {
      if (b.level === 'confidential' || b.text === undefined) return `[${b.id}] (${b.level}) 〔保密内容，已隐藏〕`;
      const prefix = b.kind === 'h2' ? '## ' : b.kind === 'ul' ? '- ' : '';
      return `[${b.id}] (${b.level}) ${prefix}${b.text}`;
    })
    .join('\n');
}

function jobLines(c: z.infer<typeof contextSchema>) {
  return [
    `职位名称：${c.jobTitle || '未填写'}`,
    `级别：${c.level || '未填写'}`,
    `地点：${c.location || '未填写'}`,
    `招聘人数：${c.headcount ?? '未填写'}`,
    `部门：${c.department || '未填写'}`,
  ].join('\n');
}

@Injectable()
export class DocAiService {
  private readonly logger = new Logger(DocAiService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly llm: LlmProvider,
  ) {}

  async section(identity: Identity, jobId: string, raw: unknown) {
    const input = parse(sectionInputSchema, raw);
    const system = [
      '你是 HireOS 的 JD（职位描述）写作助手。下面是团队的 JD 完整性标准，你写的内容必须满足其中对应条目的“完整标准”，并避开“常见缺陷”。',
      '',
      standard(),
      '',
      '## 规则',
      '- 只基于给出的职位信息和文档内容写作，不要编造公司名称、薪资数字、具体产品名等文档里没有的事实；信息不足时写通用但具体、可验证的内容。',
      '- 不要出现年龄、性别、婚育、民族、宗教、国籍等限制条件。',
      '- 不要输出 HTML 或 markdown 标记。',
      languageRule(input.context.language),
      input.list
        ? '- 这是一个列表章节：输出列表项数组，每项一句、只写一件事。职责以动词开头；任职要求每条单一、可验证。条数符合标准（一般 3–8 条，加分项不超过 5 条）。'
        : '- 这是一段文字：items 数组只放 1 个元素，即完整段落。',
      '',
      '## 输出格式',
      '只输出一个 JSON 对象（不要包含其他文字或代码块标记）：',
      '- items: string[] — 新的章节内容',
      '- explain: string — 一句话说明你写了什么 / 改了什么（用中文）',
    ].join('\n');
    const user = [
      '## 职位信息',
      jobLines(input.context),
      '',
      '## 当前文档（[块 id] (可见范围) 内容）',
      documentText(input.blocks),
      '',
      '## 任务',
      input.mode === 'draft'
        ? `为文档起草「${input.label}」（标准条目 ${input.itemId}）。要求：${input.hint}`
        : [
            `修改「${input.label}」（标准条目 ${input.itemId}），使其满足标准。`,
            `当前存在的问题：${input.issue || '未说明'}`,
            `要求：${input.hint}`,
            '当前内容：',
            ...input.current.map((x) => `- ${x}`),
            '保留原有内容的含义和事实，只修正问题；条数不足时补充，过多时合并精简。',
          ].join('\n'),
    ].join('\n');

    const output = await this.run(identity, jobId, 'jd_doc_section', system, user, sectionOutputSchema);
    const items = output.items.map((x) => x.trim()).filter(Boolean);
    if (!items.length) throw new ServiceUnavailableException({ code: 'LLM_INVALID_OUTPUT', message: 'Copilot 没有生成内容，请重试。' });
    return { items: input.list ? items : [items.join('\n')], explain: output.explain.trim() };
  }

  async analyze(identity: Identity, jobId: string, raw: unknown) {
    const input = parse(analyzeInputSchema, raw);
    const system = [
      '你是 HireOS 的 JD 审核助手。请严格按照下面的 JD 完整性标准检查一份 JD，找出质量问题、跨项一致性问题（第 3 节）、分级与合规问题（第 4 节）和语言质量问题（第 5 节）。',
      '',
      standard(),
      '',
      '## 检查要求',
      '- 重点做规则难以判断的检查：要求是否可验证、是否一条混多个标准、职责与要求是否对应（X3/X4）、级别与经验/薪资是否一致（X1/X6）、工作方式与地点是否冲突（X2）、措辞是否中性（R3）、Internal 块是否其实可以对外（V3）、Public 块是否含内部信息（V2）。',
      '- 以下由系统规则检查，不要输出：字段是否填写（A1/A4/A7/A8）、章节是否存在以及条数是否在 3–8 条（B1/C1/D1）、对外薪资范围是否填写以及是否缺范围/币种/周期/税前税后（F1）、I1、I2、I7；职位名称的营销词或内部编号、Remote 未写地区、“沟通能力强”这类明显模糊词也已由规则检查。',
      '- 标为保密的块正文已隐藏，不要猜测其内容，只检查它的分级是否合理；内部预算与对外薪资的比对（X5）由系统在本地完成，不要输出。',
      '- 只报告真实存在的问题，不要为了凑数报告；没有问题的条目不用输出。最多 12 条，按严重程度排序。',
      '- evidence 必须是文档中原文的一段（逐字摘录，便于定位）；blockId 填该原文所在块的 id，找不到对应块时为 null。',
      '- suggestion 给出可以直接替换 evidence 的改写文本（不要写“建议……”之类的说明），无法给出替换文本时留空。',
      '- reason、summary 用中文。suggestion 的语言与文档一致。',
      '',
      '## 输出格式',
      '只输出一个 JSON 对象（不要包含其他文字或代码块标记）：',
      '- verdict: "ready" | "needs_work" | "blocked"',
      '- summary: string — 一两句话的整体评价',
      '- items: { id: 标准条目编号（如 D1、X3、R3）, status: "weak" | "missing", severity: "blocker" | "warning" | "suggestion", evidence, reason, suggestion, blockId }[]',
    ].join('\n');
    const user = ['## 职位信息', jobLines(input.context), '', '## 文档（[块 id] (可见范围) 内容）', documentText(input.blocks)].join('\n');

    const output = await this.run(identity, jobId, 'jd_doc_analyze', system, user, analyzeOutputSchema);
    const known = new Set(input.blocks.map((b) => b.id));
    return {
      verdict: output.verdict,
      summary: output.summary.trim(),
      items: output.items
        .filter((x) => x.status !== 'pass')
        .slice(0, 12)
        .map((x) => ({
          ...x,
          evidence: stripBullets(x.evidence),
          suggestion: stripBullets(x.suggestion),
          blockId: x.blockId && known.has(x.blockId) ? x.blockId : null,
        })),
    };
  }

  private async run<T>(identity: Identity, jobId: string, capabilityCode: string, system: string, user: string, schema: z.ZodType<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      const raw = await this.llm.completeJson(system, [{ role: 'user', content: user }]);
      const output = schema.parse(JSON.parse(raw));
      this.logger.log(`${capabilityCode} succeeded in ${Date.now() - startedAt}ms (job=${jobId})`);
      await this.db.aiRun
        .create({ data: { workspaceId: identity.workspaceId, capabilityCode, status: 'Succeeded', resultJson: json(output) } })
        .catch(() => undefined);
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${capabilityCode} failed (job=${jobId}): ${message}`);
      await this.db.aiRun
        .create({ data: { workspaceId: identity.workspaceId, capabilityCode, status: 'Failed', failureCode: 'LLM_INVALID_OUTPUT' } })
        .catch(() => undefined);
      throw error instanceof ServiceUnavailableException
        ? error
        : new ServiceUnavailableException({ code: 'LLM_INVALID_OUTPUT', message: 'Copilot 暂时无法完成，请稍后重试。' });
    }
  }
}

/** Removes the "- " / "## " markers the document was sent with, so quoted evidence matches the block text. */
function stripBullets(text: string) {
  return text.replace(/^\s*(?:[-•]|#{1,6})\s+/gm, '').trim();
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new BadRequestException({ code: 'INVALID_AI_REQUEST', message: result.error.message });
  return result.data;
}
