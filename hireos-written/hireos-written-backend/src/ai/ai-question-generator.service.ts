import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { callAiForJson, isAiConfigured } from './ai-json-client';
import type { GenerateQuestionDto } from './generate-question.dto';

const MAX_JD_CHARS = 6000;
const MAX_RESUME_CHARS = 8000;

const AiQuestionSchema = z.object({
  prompt: z.string().min(1).max(4000),
  competencies: z.array(z.object({ name: z.string().min(1).max(60), fraction: z.number().min(0).max(1) })).min(2).max(4),
  deliverables: z.array(z.string().min(1).max(200)).min(2).max(4),
});
export type AiGeneratedQuestion = z.infer<typeof AiQuestionSchema>;

const SYSTEM_PROMPT_ZH = `你是一名招聘测评题目设计专家。根据岗位JD、候选人简历（如提供）和面试官希望重点考察的能力，设计一份约2小时可完成的实操型笔试题目。

规则：
- 题目要紧扣JD描述的岗位职责与要求，若提供了简历内容，可结合候选人的实际经历使题目更有针对性（例如围绕其提到的项目/技术栈设计场景），但不得编造简历中不存在的经历。
- 题目必须让候选人展现真实的分析与判断能力，而非背诵理论。
- 题目正文（prompt字段）需包含：任务背景、具体任务要求（分点列出，要求给出有依据的判断而非泛泛而谈）、交付物清单、以及评分会重点关注的维度说明——参考如下结构撰写，语言为中文：
  背景段落 + "任务要求：" + 编号列表 + "交付物：" + 列表 + 结尾一句评分说明。
- competencies：2-4项，第一项应为面试官指定的重点考察能力，fraction之和为1。
- deliverables：2-4项具体的交付物文件名/描述。
- 只返回一个JSON对象，严格符合以下结构，不要有多余文字：
{
  "prompt": string,
  "competencies": [{ "name": string, "fraction": number }],
  "deliverables": [string]
}`;

const SYSTEM_PROMPT_EN = `You are an expert assessment designer for technical/professional hiring. Given a job description, an optional candidate resume, and the capability the interviewer wants to focus on, design one executable, roughly 2-hour written work-sample exercise.

Rules:
- Ground the exercise in the actual job description. If resume content is provided, you may sharpen the scenario around the candidate's real stated experience/skills, but never invent experience not present in the resume.
- The exercise must let the candidate demonstrate real judgment, not recite theory.
- The "prompt" field must read as: a background paragraph, then "Task requirements:" with a numbered list (demanding evidence-based judgment, not general statements), then "Deliverables:" with a bulleted list, then one closing sentence on what scoring focuses on. Write in English.
- competencies: 2-4 items, the first should be the interviewer's requested focus area, fractions summing to 1.
- deliverables: 2-4 concrete deliverable file names/descriptions.
- Respond with a single JSON object only, matching exactly this shape:
{
  "prompt": string,
  "competencies": [{ "name": string, "fraction": number }],
  "deliverables": [string]
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
}
