/**
 * The document a never-saved job shows, built from its structured JD draft — a server-side copy of the
 * frontend's `buildDraftFromBackend` (hireos-jd-front/src/features/workspace/docHelpers.ts), in English, with
 * the same block ids. Used only to freeze that content as the v1 "migration baseline" of a job that was
 * published before JD versions existed (#96); keep the two in step if the document layout changes.
 */

type Level = 'public' | 'internal' | 'confidential';
type Block = {
  id: string;
  kind: 'h2' | 'h3' | 'p' | 'ul';
  text: string | string[];
  requirementRefs: string[];
  semanticRole: string;
  comment: null;
  stale: boolean;
  level: Level;
};
type Money = { min?: number | null; max?: number | null; currency?: string; period?: string; basis?: string };
type Requirement = { label?: unknown; priority?: unknown; group?: unknown };

export type DraftContent = {
  roleSummary: string | null;
  responsibilities: unknown;
  requirements: unknown;
  hiringContext: unknown;
  successCriteria: unknown;
  internalCompensation: unknown;
  publicCompensation: unknown;
};

export function draftToBlocks(title: string, content: DraftContent, jobId: string): Block[] {
  const blocks: Block[] = [];
  let n = 1;
  const add = (kind: Block['kind'], text: string | string[], level: Level) =>
    blocks.push({ id: `b${jobId.slice(-3)}-${n++}`, kind, text, requirementRefs: [], semanticRole: 'presentation_only', comment: null, stale: false, level });
  const list = (items: string[], level: Level) => items.forEach((item) => add('ul', [item], level));
  const grouped = (items: Requirement[], level: Level) => {
    let current = '';
    for (const item of items) {
      const group = typeof item.group === 'string' ? item.group.trim() : '';
      if (group && group !== current) add('h3', group, level);
      current = group;
      add('ul', [String(item.label)], level);
    }
  };

  const requirements = (Array.isArray(content.requirements) ? content.requirements : []) as Requirement[];
  const ofPriority = (priority: string) => requirements.filter((r) => r.priority === priority && r.label);
  const must = ofPriority('must_have');
  const pref = ofPriority('preferred');
  const responsibilities = strings(content.responsibilities);
  const hiringContext = record(content.hiringContext);

  add('h2', title, 'public');
  add('p', content.roleSummary || '', 'public');
  const businessProblem = typeof hiringContext.businessProblem === 'string' ? hiringContext.businessProblem : '';
  if (businessProblem) {
    add('h2', 'Business problem', 'internal');
    add('p', businessProblem, 'internal');
  }
  if (responsibilities.length) {
    add('h2', 'Responsibilities', 'public');
    list(responsibilities, 'public');
  }
  if (must.length) {
    add('h2', 'Requirements', 'public');
    grouped(must, 'public');
  }
  if (pref.length) {
    add('h2', 'Preferred', 'public');
    grouped(pref, 'public');
  }
  add('h2', 'Compensation', 'public');
  add('p', money(content.publicCompensation as Money | null), 'public');
  if (content.internalCompensation) add('p', `Internal ceiling: ${money(content.internalCompensation as Money)}`, 'confidential');
  const outcomes = strings(hiringContext.expectedOutcomes).filter(Boolean);
  if (outcomes.length) {
    add('h2', 'Expected outcomes', 'internal');
    list(outcomes, 'internal');
  }
  const success = (Array.isArray(content.successCriteria) ? content.successCriteria : [])
    .map((s) => record(s).statement)
    .filter((s): s is string => typeof s === 'string' && !!s);
  if (success.length) {
    add('h2', 'Success in the first 90 days', 'internal');
    list(success, 'internal');
  }
  return blocks;
}

/** English form of the frontend's `money` / `salaryText`. */
function money(range: Money | null | undefined): string {
  if (!range || (range.min == null && range.max == null)) return 'Not specified';
  const k = (value: number | null | undefined) =>
    value == null
      ? '—'
      : Number.isInteger(value) && Math.abs(value) >= 1000
        ? `${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })}K`
        : value.toLocaleString('en-US', { maximumFractionDigits: 6 });
  const period = range.period === 'year' ? 'year' : range.period === 'hour' ? 'hour' : 'month';
  return [`${k(range.min)}–${k(range.max)} / ${period}`, range.basis, range.currency || 'USD'].filter(Boolean).join(' · ');
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
