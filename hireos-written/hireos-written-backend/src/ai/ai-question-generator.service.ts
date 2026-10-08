import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { callAiForJson, isAiConfigured } from './ai-json-client';
import type { ExtractCompetenciesDto, GenerateQuestionDto } from './generate-question.dto';

const MAX_JD_CHARS = 6000;
const MAX_RESUME_CHARS = 8000;

const AiQuestionSchema = z.object({
  title: z.string().min(1).max(60),
  prompt: z.string().min(1).max(4000),
  competencies: z.array(z.object({ name: z.string().min(1).max(60), fraction: z.number().min(0).max(1) })).min(2).max(4),
});
export type AiGeneratedQuestion = z.infer<typeof AiQuestionSchema>;

const AiCompetenciesSchema = z.object({ competencies: AiQuestionSchema.shape.competencies });

const COMPETENCIES_SYSTEM_PROMPT_ZH = `你是一名招聘测评专家。给定一道笔试题目（标题、适用岗位、题目正文），提炼出这道题实际考察的 2-4 项能力，作为招聘方内部评分维度。
规则：
- 能力项必须能从题目正文的任务要求中直接看出来，不要泛泛而谈。
- name 简洁（不超过 20 个字），fraction 表示该能力在评分中的权重，之和为 1，最核心的能力排第一。
- 只返回一个JSON对象，不要有多余文字：
{ "competencies": [{ "name": string, "fraction": number }] }`;

const COMPETENCIES_SYSTEM_PROMPT_EN = `You are a hiring assessment expert. Given a written exercise (title, target roles, exercise text), extract the 2-4 capabilities it actually tests, to be used as the hiring team's internal scoring dimensions.
Rules:
- Each capability must be directly evident from the exercise's task requirements; avoid generic labels.
- Keep each name short (max ~6 words); fraction is its scoring weight, fractions sum to 1, most central capability first.
- Respond with a single JSON object only:
{ "competencies": [{ "name": string, "fraction": number }] }`;

const SYSTEM_PROMPT_ZH = `你是一名招聘测评题目设计专家。根据岗位JD、候选人简历（如提供）和面试官希望重点考察的能力，设计一份约2小时可完成的实操型笔试题目。候选人只会看到题目正文，在一个文本框里直接写下作答——没有文件上传，也不会看到评分标准，所以题目正文本身绝不能出现任何评分说明或交付物清单。

规则：
- 题目要紧扣JD描述的岗位职责与要求，若提供了简历内容，可结合候选人的实际经历使题目更有针对性（例如围绕其提到的项目/技术栈设计场景），但不得编造简历中不存在的经历。
- 题目必须让候选人展现真实的分析与判断能力，而非背诵理论。
- 题目正文（prompt字段）只包含候选人需要读到的内容：任务背景段落 + "任务要求：" + 编号列表。到此为止——不要写交付物清单，不要写任何关于评分、打分维度、评分标准的句子，那些是招聘方内部使用的信息，不会展示给候选人。
- competencies：2-4项，仅用于招聘方内部评分，不会出现在题目正文里；第一项应为面试官指定的重点考察能力，fraction之和为1。
- title：根据题目正文概括的简短题目名称（不超过20个字），概括题目的具体场景和任务，例如"企业知识助手的 RAG 方案设计"；不要照抄面试官的考察要求，不要加"AI生成"等前缀。
- 只返回一个JSON对象，严格符合以下结构，不要有多余文字：
{
  "title": string,
  "prompt": string,
  "competencies": [{ "name": string, "fraction": number }]
}`;

const SYSTEM_PROMPT_EN = `You are an expert assessment designer for technical/professional hiring. Given a job description, an optional candidate resume, and the capability the interviewer wants to focus on, design one executable, roughly 2-hour written work-sample exercise. The candidate only ever sees the exercise text itself and types their answer directly into a plain text box — there is no file upload, and they never see the scoring rubric, so the exercise text itself must never mention scoring, scoring dimensions, or a deliverables list.

Rules:
- Ground the exercise in the actual job description. If resume content is provided, you may sharpen the scenario around the candidate's real stated experience/skills, but never invent experience not present in the resume.
- The exercise must let the candidate demonstrate real judgment, not recite theory.
- The "prompt" field contains only what the candidate needs to read: a background paragraph, then "Task requirements:" with a numbered list. Stop there — no deliverables list, and no sentence about scoring, scoring dimensions, or the rubric; those are internal to the hiring team and never shown to the candidate.
- competencies: 2-4 items, used only for the hiring team's internal scoring and never shown in the exercise text; the first should be the interviewer's requested focus area, fractions summing to 1.
- title: a short name for the exercise (max ~8 words) summarizing its concrete scenario and task, derived from the exercise text, e.g. "RAG design for an enterprise knowledge assistant"; do not copy the interviewer's focus request, no "AI-generated" prefix.
- Respond with a single JSON object only, matching exactly this shape:
{
  "title": string,
  "prompt": string,
  "competencies": [{ "name": string, "fraction": number }]
}`;

function normalizeFractions(competencies: { name: string; fraction: number }[]): { name: string; fraction: number }[] {
  const sum = competencies.reduce((acc, c) => acc + c.fraction, 0);
  if (sum <= 0) {
    const even = 1 / competencies.length;
    return competencies.map((c) => ({ ...c, fraction: even }));
  }
  return competencies.map((c) => ({ ...c, fraction: c.fraction / sum }));
}

@Injectable()
export class AiQuestionGeneratorService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return isAiConfigured(this.config);
  }

  async generate(dto: GenerateQuestionDto): Promise<AiGeneratedQuestion> {
    const zh = dto.lang !== 'en';
    const prompt = `# Job title\n${dto.jobTitle}\n\n# Job description\n${dto.jdText?.slice(0, MAX_JD_CHARS) || (zh ? '（暂无JD原文）' : '(not available)')}\n\n# Candidate resume\n${dto.resumeText?.slice(0, MAX_RESUME_CHARS) || (zh ? '（暂无简历原文）' : '(not available)')}\n\n# Requested test focus\n${dto.focusBrief.trim()}`;
    const result = await callAiForJson(this.config, zh ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN, prompt, AiQuestionSchema);
    return { ...result, competencies: normalizeFractions(result.competencies) };
  }

  /** Scoring competencies for a hand-written Question Bank question (see QuestionCreateDrawer). */
  async extractCompetencies(dto: ExtractCompetenciesDto): Promise<{ competencies: { name: string; fraction: number }[] }> {
    const zh = dto.lang !== 'en';
    const prompt = `# Title\n${dto.title.trim()}\n\n# Target roles\n${dto.roles?.length ? dto.roles.join(', ') : zh ? '（未指定）' : '(not specified)'}\n\n# Exercise text\n${dto.prompt.trim()}`;
    const result = await callAiForJson(this.config, zh ? COMPETENCIES_SYSTEM_PROMPT_ZH : COMPETENCIES_SYSTEM_PROMPT_EN, prompt, AiCompetenciesSchema);
    return { competencies: normalizeFractions(result.competencies) };
  }
}
