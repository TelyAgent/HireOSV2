import { describe, expect, it } from 'vitest';
import { evaluateJob, issueCount, verdictOf } from '../src/features/workspace/completeness';
import { publishGate } from '../src/features/workspace/publishGate';
import { mkBlock } from '../src/data/fixtures/documents';
import { docKey } from '../src/features/workspace/docHelpers';
import type { Job, DocumentDraft } from '../src/data/types';
import type { AppState } from '../src/store/types';

const job = { id: 'j87', title: 'Backend Engineer', level: '', location: 'Shanghai, China', headcount: 1 } as Job;
const doc = {
  id: 'd87', jobId: job.id, audience: 'internal', revision: 1, saveState: 'saved',
  blocks: [
    mkBlock('title', 'h2', job.title), mkBlock('summary', 'p', 'Build reliable APIs for business customers.'),
    mkBlock('rh', 'h2', 'Responsibilities'),
    ...['Build payment APIs with TypeScript.', 'Maintain PostgreSQL schemas and indexes.', 'Monitor production reliability metrics.'].map((s, i) => mkBlock(`r${i}`, 'li', s)),
    mkBlock('qh', 'h2', 'Requirements'),
    ...['5 years of TypeScript API development.', 'PostgreSQL schema and query design.', 'Docker and Linux operations experience.'].map((s, i) => mkBlock(`q${i}`, 'li', s)),
    mkBlock('sh', 'h2', 'Compensation'), mkBlock('salary', 'p', 'CNY 20000-30000 per month gross.'),
  ].map(b => ({ ...b, level: 'public' as const })),
} as DocumentDraft;
const gate = (d: DocumentDraft, ev: ReturnType<typeof evaluateJob>) => publishGate({
  drafts: { [docKey(job.id)]: d }, wsVersions: { [job.id]: { versions: [] } },
  wsAiAnalysis: { [job.id]: { revision: 1, result: { verdict: 'ready', items: [{ severity: 'suggestion', reason: 'Add team context.' }] } } },
} as unknown as AppState, job.id, ev);

describe('#87 suggestions and required fields', () => {
  it('counts legacy grouped bullets as items, while ignoring blank placeholders', () => {
    const grouped = { ...doc, blocks: doc.blocks.flatMap(b => {
      if (/^[rq][12]$/.test(b.id)) return [];
      if (/^[rq]0$/.test(b.id)) return [{ ...b, kind: 'ul' as const, text: doc.blocks.filter(x => new RegExp(`^${b.id[0]}[0-2]$`).test(x.id)).map(x => String(x.text)) }];
      return [b];
    }) };
    expect(issueCount(evaluateJob(job, grouped, 'en', 'JD-87'))).toBe(0);
    const short = { ...grouped, blocks: grouped.blocks.map(b => b.id === 'r0' ? { ...b, text: ['Build APIs.', '', 'TODO'] } : b) };
    expect(evaluateJob(job, short, 'en', 'JD-87').rows.find(r => r.item.id === 'C1')?.weak).toBe('Add at least 3 responsibilities.');
    const tooLong = { ...grouped, blocks: grouped.blocks.map(b => b.id === 'q0' ? { ...b, text: Array.from({ length: 9 }, (_, i) => `TypeScript API experience ${i}`) } : b) };
    expect(evaluateJob(job, tooLong, 'en', 'JD-87').rows.find(r => r.item.id === 'D1')?.weak).toBe('Keep to 8 requirements or fewer.');
  });
  it('AC-1: ten required items pass without Level; optional suggestions do not block', () => {
    const ev = evaluateJob(job, doc, 'en', 'JD-87');
    expect(ev.total).toBe(10);
    expect(ev.suggestions.some(s => s.id === 'A4')).toBe(true);
    expect(issueCount(ev)).toBe(0);
    expect(verdictOf(ev)).toBe('ready');
    expect(gate(doc, ev).kind).toBe('ready');
  });
  it('AC-2: one missing required item counts once, not together with suggestions', () => {
    const ev = evaluateJob({ ...job, location: '' }, doc, 'en', 'JD-87');
    expect(ev.suggestions.length).toBeGreaterThan(0);
    expect(issueCount(ev)).toBe(1);
    expect(gate(doc, ev)).toMatchObject({ kind: 'issues', count: 1, missing: ['Location'] });
  });
  it('AC-3: a supplied level that conflicts with experience still blocks as Weak', () => {
    const ev = evaluateJob({ ...job, level: 'Junior' }, doc, 'en', 'JD-87');
    expect(ev.suggestions.some(s => s.id === 'A4')).toBe(false);
    expect(ev.flags).toContainEqual(expect.objectContaining({ rule: 'X1', severity: 'warning' }));
    expect(verdictOf(ev)).toBe('needs_work');
    expect(gate(doc, ev)).toMatchObject({ kind: 'issues', count: 1 });
  });
  it('AC-3: real blocking compliance errors still block', () => {
    const invalid = { ...doc, blocks: [...doc.blocks, mkBlock('bad', 'p', 'Male only', { level: 'public' })] };
    const ev = evaluateJob(job, invalid, 'en', 'JD-87');
    expect(verdictOf(ev)).toBe('blocked');
    expect(gate(invalid, ev).kind).toBe('issues');
  });
});
