// #106 AC-2 — the Copilot's "can I publish?" context uses exactly the Publish button's rule.
import { describe, expect, it } from 'vitest';
import { MAX_STATUS_CONTEXT, describeAiAnalysis, describePublishGate, publishGate, statusContext } from '../src/features/workspace/publishGate';
import type { AppState } from '../src/store/types';
import type { Evaluation } from '../src/features/workspace/completeness';
import { mkBlock } from '../src/data/fixtures/documents';
import { docKey } from '../src/features/workspace/docHelpers';

const blocks = [
  mkBlock('b1', 'h2', 'Data Analyst', { level: 'public' }),
  mkBlock('b2', 'p', 'Owns reporting.', { level: 'public' }),
  mkBlock('b3', 'p', 'Hiring preference: under 42 years old', { level: 'confidential' }),
];
const state = (versions?: { versionNo: number; blocks: typeof blocks }[], aiRun?: unknown) =>
  ({
    wsVersions: versions ? { j1: { jdCode: 'JD-1', versions } } : {},
    wsAiAnalysis: aiRun ? { j1: aiRun } : versions ? { j1: { at: 1, revision: 1, result: { verdict: 'ready', summary: '', items: [] } } } : {},
    drafts: { [docKey('j1')]: { id: 'doc-j1', jobId: 'j1', audience: 'internal', language: 'en', revision: 1, saveState: 'saved', blocks } },
    jobs: {},
  }) as unknown as AppState;
const ev = (over: Partial<Evaluation> = {}) =>
  ({ rows: [], flags: [], sections: [], missing: 0, weakCount: 0, blockers: 0, total: 11, passed: 11, language: 'en', suggestions: [], ...over }) as Evaluation;

describe('publishGate', () => {
  it('is disabled while versions load, and the Copilot is told so', () => {
    const gate = publishGate(state(), 'j1', ev());
    expect(gate.kind).toBe('loading');
    expect(describePublishGate(gate, false)).toMatch(/still loading, so the Publish button is disabled/);
  });

  it('a compliance warning alone disables Publish (it counts as "to revise")', () => {
    const warning = { rule: 'R3', severity: 'warning' as const, blockId: 'b2', message: 'Use neutral wording.', evidence: 'young' };
    const gate = publishGate(state([]), 'j1', ev({ flags: [warning], weakCount: 1 }));
    expect(gate).toMatchObject({ kind: 'issues', count: 1, revise: ['R3 Use neutral wording.'] });
    expect(describePublishGate(gate, false)).toMatch(/Publish button is disabled: 1 item/);
    expect(describePublishGate(gate, false)).not.toMatch(/Publish button is available/);
  });

  it('nothing changed since the last published version disables Publish', () => {
    const gate = publishGate(state([{ versionNo: 2, blocks }]), 'j1', ev());
    expect(gate).toEqual({ kind: 'no_changes', versionNo: 2 });
    expect(describePublishGate(gate, false)).toMatch(/nothing has changed since v2/);
  });

  it('ready only when loaded, clean and changed; always says approval is not available', () => {
    const gate = publishGate(state([]), 'j1', ev());
    expect(gate.kind).toBe('ready');
    expect(describePublishGate(gate, true)).toMatch(/Publish button is available\. The document has unsaved changes\. Submitting for approval is not available/);
  });

  it('#93 AC-1: an AI-written block nobody has kept blocks the gate, even with a clean, current analysis', () => {
    const st = state([]);
    const draft = Object.values(st.drafts)[0] as { blocks: Array<{ aiDraft?: boolean }> };
    draft.blocks = draft.blocks.map((b, i) => (i === 1 ? { ...b, aiDraft: true } : b));
    const gate = publishGate(st, 'j1', ev());
    expect(gate).toMatchObject({ kind: 'issues', count: 1 });
    expect(describePublishGate(gate, false)).toMatch(/1 AI-written block\(s\) still need Keep/);
  });

  it('a flag on a Confidential block is named by rule only — its quoted text never reaches the Copilot', () => {
    const flag = { rule: 'R2', severity: 'warning' as const, blockId: 'b3', message: '“under 42 years old” implies an age.', evidence: 'under 42 years old' };
    const text = describePublishGate(publishGate(state([]), 'j1', ev({ flags: [flag], weakCount: 1 })), false);
    expect(text).toContain('R2 (in a Confidential block)');
    expect(text).not.toContain('42');
  });
});

describe('describeAiAnalysis', () => {
  const run = (revision: number) => ({
    at: 1,
    revision,
    result: {
      verdict: 'blocked',
      summary: 'Requirements contradict the level.',
      items: [
        { id: 'X7', status: 'weak', severity: 'blocker', evidence: '10 years', reason: 'Junior with 10 years', suggestion: '', blockId: 'b2' },
        { id: 'S1', status: 'weak', severity: 'suggestion', evidence: '', reason: 'optional', suggestion: '', blockId: null },
      ],
    },
  });

  it('gives the current verdict and blocking findings for the same revision', () => {
    const text = describeAiAnalysis(state([], run(1)), 'j1');
    expect(text).toMatch(/Current AI Analyze result: blocked\. Requirements contradict the level\./);
    expect(text).toMatch(/X7 \(blocker\): Junior with 10 years — “10 years”/);
    expect(text).not.toContain('S1');
  });

  it('says an older result is outdated instead of repeating it, and says when none ran', () => {
    expect(describeAiAnalysis(state([], run(0)), 'j1')).toMatch(/outdated/);
    expect(describeAiAnalysis(state([], run(0)), 'j1')).not.toContain('blocked');
    expect(describeAiAnalysis(state(), 'j1')).toMatch(/has not been run/);
  });


  it('stays bounded with many findings and keeps the gate conclusion first', () => {
    const flags = Array.from({ length: 40 }, (_, n) => ({ rule: 'R1', severity: 'warning' as const, blockId: 'b2', message: `Wording issue ${n} `.repeat(20), evidence: 'x' }));
    const gate = describePublishGate(publishGate(state([]), 'j1', ev({ flags, weakCount: 40 })), false);
    expect(gate).toMatch(/and 32 more/);
    const text = statusContext(gate, 'A'.repeat(20000));
    expect(text.length).toBeLessThanOrEqual(MAX_STATUS_CONTEXT);
    expect(text.startsWith('The Publish button is disabled: 40 item(s)')).toBe(true);
  });
});
