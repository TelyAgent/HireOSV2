import type { JdFields } from './types';

const LABELS: Record<string, string> = {
  title: '职位名称',
  department: '部门',
  location: '工作地点',
  employmentType: '雇佣类型',
  headcount: '招聘人数',
  roleSummary: '职位概述',
  responsibilities: '岗位职责',
  mustHave: '任职要求',
  niceToHave: '加分项',
  publicCompensation: '薪资',
  businessProblem: '业务背景',
  expectedOutcomes: '预期成果',
  successCriteria: '成功标准',
};

const SALARY_NOTE = /salary|compensation|pay\b|wage|薪|工资|待遇|年薪|月薪/i;

/** Comparable form: key order and empty/absent values ignored, so a missing list equals `[]`. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined && x !== null && x !== '' && !(Array.isArray(x) && x.length === 0))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, canon(x)]),
    );
  }
  return v;
}

/** Fields whose content really differs between two drafts, in schema order. */
export function changedJdFields(prev: JdFields, next: JdFields): (keyof JdFields)[] {
  const a = canon(prev) as Record<string, unknown>;
  const b = canon(next) as Record<string, unknown>;
  return (Object.keys(LABELS) as (keyof JdFields)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

/**
 * The reply stored in the conversation after a refine (#99): what really changed, or that nothing did —
 * so reopening the conversation from history never shows a success that didn't happen.
 */
export function refineReply(prev: JdFields, next: JdFields, note: string): string {
  const changed = changedJdFields(prev, next);
  if (!changed.length) return '没有改动：这条补充没有让草稿发生变化，也没有保存任何内容。';
  const lines = [`草稿中改动了：${changed.map((k) => LABELS[k]).join('、')}。它仍是未保存的草稿，创建职位前不会写入任何职位；改动已在工作区中标出。`];
  if (SALARY_NOTE.test(note) && !changed.includes('publicCompensation')) lines.push('薪资没有改动。');
  return lines.join('\n');
}
