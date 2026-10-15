// #106 AC-2 — the Copilot's "can I publish?" context uses exactly the Publish button's rule.
import { describe, expect, it } from 'vitest';
import { describePublishGate, publishGate } from '../src/features/workspace/publishGate';
import type { AppState } from '../src/store/types';
import type { Evaluation } from '../src/features/workspace/completeness';
import { mkBlock } from '../src/data/fixtures/documents';
import { docKey } from '../src/features/workspace/docHelpers';

const blocks = [mkBlock('b1', 'h2', 'Data Analyst', { level: 'public' }), mkBlock('b2', 'p', 'Owns reporting.', { level: 'public' })];
const state = (versions?: { versionNo: number; blocks: typeof blocks }[]) =>
  ({
    wsVersions: versions ? { j1: { jdCode: 'JD-1', versions } } : {},
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
});
