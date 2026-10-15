import type { JdFields } from './types';

/**
 * The job facts the three title variants must share (#71): they differ in writing style, never in what
 * the job is. Prose fields (summary, responsibilities, requirements…) stay each version's own.
 */
export const FACT_FIELDS = ['title', 'department', 'location', 'employmentType', 'headcount', 'publicCompensation'] as const;

export type JobFacts = Pick<JdFields, (typeof FACT_FIELDS)[number]>;

export function pickFacts(fields: JdFields): JobFacts {
  const facts: JobFacts = {};
  for (const key of FACT_FIELDS) if (fields[key] !== undefined) (facts as Record<string, unknown>)[key] = fields[key];
  return facts;
}

/** `fields` with exactly `facts` as its job facts: a fact the reference lacks is removed, not kept. */
export function pinFacts(fields: JdFields, facts: JobFacts): JdFields {
  const out: JdFields = { ...fields };
  for (const key of FACT_FIELDS) {
    if (facts[key] === undefined) delete out[key];
    else (out as Record<string, unknown>)[key] = facts[key];
  }
  return out;
}

/** Prompt lines that hand a version the shared facts, so its prose agrees with them too. */
export function factsInstruction(facts: JobFacts): string {
  return [
    '以下职位事实已经确定，必须原样使用（JSON 中没有的字段不要输出）；正文里提到地点、工作方式、人数、薪资等时也必须与之一致，不能另写：',
    JSON.stringify(facts),
  ].join('\n');
}
