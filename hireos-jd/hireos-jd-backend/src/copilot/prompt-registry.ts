import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HIREOS_JD_FACTS } from './jd-agent-scope';

const OUTPUT_FORMAT = [
  '## 输出格式',
  '你必须只输出一个 JSON 对象（不要包含任何其他文字、markdown 代码块标记），字段如下：',
  '- reply: string — 给用户看的自然语言回复（追问或确认小结）',
  "- phase: 'intake' | 'ready_to_confirm'",
  '- fields: object — 本轮新增/变更的字段（用 job-standard-v1 的字段名，如 title/department/location/employmentType/headcount/roleSummary/responsibilities/mustHave/niceToHave/publicCompensation/businessProblem/expectedOutcomes/successCriteria），未变化的字段不要输出；不要输出 schema 以外的字段',
  '- publicCompensation（薪资）只记录用户或资料里明确给出的数字，绝不自行估算或编造；没有就不输出这个字段',
  '- businessProblem/expectedOutcomes/successCriteria 是可选的内部章节：只整理用户或资料里提到的内容，不要为了填满而编造，也不要为它们追问',
  '- missingFields: string[] — 你认为仍然缺失的关键字段名',
].join('\n');

/** `chat`: a skill the user talks to directly, which also needs the Agent's scope and HireOS facts (#103 #104). */
function buildSystemPrompt(skillDir: string, chat = false): string {
  const instructions = readFileSync(join(skillDir, 'instructions.md'), 'utf-8');
  const fieldSchema = readFileSync(join(skillDir, 'job-standard-v1.json'), 'utf-8');
  return [
    instructions.trim(),
    ...(chat ? ['', HIREOS_JD_FACTS] : []),
    '',
    '## 字段 schema（job-standard-v1）',
    '```json',
    fieldSchema.trim(),
    '```',
    '',
    OUTPUT_FORMAT,
  ].join('\n');
}

@Injectable()
export class PromptRegistry {
  private readonly intakePrompt: string;
  private readonly fileExtractPrompt: string;
  private readonly autotakePrompt: string;

  constructor() {
    this.intakePrompt = buildSystemPrompt(join(__dirname, 'skills', 'jd-intake'), true);
    this.fileExtractPrompt = buildSystemPrompt(join(__dirname, 'skills', 'jd-file-extract'));
    this.autotakePrompt = buildSystemPrompt(join(__dirname, 'skills', 'jd-autotake'));
  }

  get jdIntakeSystemPrompt(): string {
    return this.intakePrompt;
  }

  get jdFileExtractSystemPrompt(): string {
    return this.fileExtractPrompt;
  }

  get jdAutotakeSystemPrompt(): string {
    return this.autotakePrompt;
  }
}
