import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { callAiForJson, isAiConfigured } from './ai-json-client';

const MAX_ANSWER_CHARS = 12000;
const MAX_PROMPT_CHARS = 6000;

const AiEvaluationSchema = z.object({
  summary: z.string().min(1).max(1000),
  criteria: z.array(z.object({ name: z.string().min(1).max(60), score: z.number(), evidence: z.string().min(1).max(800) })).min(1).max(8),
});

export interface EvaluationInput {
  questions: { questionId: string; title: string; prompt: string; competencies?: { name: string; fraction: number }[] }[];
  answers: { questionId: string; answerText: string }[];
}

export interface EvaluatedCriterion {
  name: string;
  max: number;
  score: number;
  evidence: string;
}

export interface AiEvaluationResult {
  overall: number;
  summary: string;
  criteria: EvaluatedCriterion[];
}

const SYSTEM_PROMPT = `你是一名资深招聘评估专家。根据笔试题目、评分维度权重和候选人的实际作答，对候选人在每个评分维度上打分，并给出依据。

规则：
- 严格依据候选人的实际作答内容评分，不得脑补或假设作答中不存在的内容；如果候选人没有回答或明确表示不会，相关维度应给低分（甚至0分）并如实说明。
- 每个维度的分值上限已给出（见"评分维度"部分的 max），你给出的 score 必须是 0 到该 max 之间的整数。
- evidence 字段需引用候选人作答中的具体内容作为依据，而不是空泛评语。
- summary 用 2-4 句话总结候选人的整体表现、突出优势与主要不足，语气客观专业。
- 只返回一个JSON对象，严格符合以下结构，不要有多余文字：
{
  "summary": string,
  "criteria": [{ "name": string, "score": number, "evidence": string }]
}
criteria 数组必须恰好包含"评分维度"部分列出的每一项，name 与给出的维度名称完全一致。`;

function buildRubric(questions: EvaluationInput['questions']): { name: string; max: number }[] {
  const all = questions.flatMap((q) => q.competencies ?? []);
  if (all.length === 0) return [{ name: '整体作答质量', max: 100 }];
  const totalFraction = all.reduce((sum, c) => sum + c.fraction, 0) || 1;
  // Merge duplicate dimension names across multiple questions (rare, but a candidate could receive
  // more than one question sharing a competency) rather than double-counting them.
  const merged = new Map<string, number>();
  for (const c of all) merged.set(c.name, (merged.get(c.name) ?? 0) + c.fraction);
  return Array.from(merged.entries()).map(([name, fraction]) => ({ name, max: Math.max(1, Math.round((fraction / totalFraction) * 100)) }));
}

@Injectable()
export class AiEvaluatorService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return isAiConfigured(this.config);
  }

  async evaluate(input: EvaluationInput): Promise<AiEvaluationResult> {
    const rubric = buildRubric(input.questions);
    const qaSections = input.questions.map((q, i) => {
      const answer = input.answers.find((a) => a.questionId === q.questionId)?.answerText ?? '（未作答）';
      return `## 题目 ${i + 1}：${q.title}\n${q.prompt.slice(0, MAX_PROMPT_CHARS)}\n\n### 候选人作答\n${answer.slice(0, MAX_ANSWER_CHARS)}`;
    }).join('\n\n');
    const rubricText = rubric.map((r) => `- ${r.name}（满分 ${r.max}）`).join('\n');
    const prompt = `${qaSections}\n\n# 评分维度\n${rubricText}`;

    const result = await callAiForJson(this.config, SYSTEM_PROMPT, prompt, AiEvaluationSchema, { maxCompletionTokens: 3000 });
    const byName = new Map(result.criteria.map((c) => [c.name, c]));
    const criteria: EvaluatedCriterion[] = rubric.map((r) => {
      const match = byName.get(r.name);
      const score = match ? Math.max(0, Math.min(r.max, Math.round(match.score))) : 0;
      return { name: r.name, max: r.max, score, evidence: match?.evidence ?? '（AI 未对该维度给出说明）' };
    });
    const overall = criteria.reduce((sum, c) => sum + c.score, 0);
    return { overall, summary: result.summary, criteria };
  }
}
