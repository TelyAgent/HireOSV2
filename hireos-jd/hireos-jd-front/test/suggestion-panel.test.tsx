import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from '../src/store/StoreContext';
import { AnalysisPanel } from '../src/features/workspace/AnalysisPanel';
import { mkBlock } from '../src/data/fixtures/documents';
import { docKey } from '../src/features/workspace/docHelpers';
import { coreJobToLocalJob } from '../src/features/jobs/jobsMapping';

const actions = vi.hoisted(() => ({ focusField: vi.fn(), fillRequired: vi.fn() }));
vi.mock('../src/features/workspace/docActions', () => ({ useDocActions: () => actions }));

function Seed({ missing = false, weak = false, blocked = false }) {
  const { mutate } = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    mutate(d => {
      d.lang = 'en';
      d.jobs.j87 = { ...coreJobToLocalJob({ id: 'j87', title: 'Backend Engineer', location: missing ? '' : 'Shanghai, China', openings: 1, status: 'draft' } as never), level: weak ? 'Junior' : '' };
      d.wsAnalyzedAt.j87 = 1;
      d.wsVersions.j87 = { jdCode: 'JD-87', versions: [] };
      d.drafts[docKey('j87')] = {
        id: 'd87', jobId: 'j87', audience: 'internal', language: 'en', revision: 1, saveState: 'saved',
        blocks: [
          mkBlock('title', 'h2', 'Backend Engineer'), mkBlock('summary', 'p', 'Build reliable APIs for business customers.'),
          mkBlock('rh', 'h2', 'Responsibilities'),
          mkBlock('r', 'ul', ['Build payment APIs with TypeScript.', 'Maintain PostgreSQL schemas and indexes.', 'Monitor production reliability metrics.']),
          mkBlock('qh', 'h2', 'Requirements'),
          mkBlock('q', 'ul', ['5 years of TypeScript API development.', 'PostgreSQL schema and query design.', 'Docker and Linux operations experience.']),
          mkBlock('sh', 'h2', 'Compensation'), mkBlock('s', 'p', 'CNY 20000-30000 per month gross.'),
          ...(blocked ? [mkBlock('bad', 'p', 'Male only')] : []),
        ].map(b => ({ ...b, level: 'public' as const })),
      };
    });
    setReady(true);
  }, [mutate, missing, weak, blocked]);
  return ready ? <AnalysisPanel jobId="j87" /> : null;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('#87 rendered analysis groups', () => {
  it('shows suggestions without blockers; optional Level Add focuses the field', async () => {
    render(<StoreProvider><Seed /></StoreProvider>);
    await screen.findByText('All required items complete');
    expect(screen.getByText(/10 \/ 10 required items passed/)).toBeTruthy();
    const section = screen.getByText('Suggestions', { exact: true }).closest('section')!;
    const level = within(section).getByText('Level', { exact: true }).closest('.ck-row') as HTMLElement;
    fireEvent.click(within(level).getByRole('button', { name: 'Add' }));
    expect(actions.focusField).toHaveBeenCalledWith('level');
    expect(actions.fillRequired).not.toHaveBeenCalled();
    expect(screen.queryByText('To complete', { exact: true })).toBeNull();
  });
  it('counts only a missing Location and keeps Level under Suggestions', async () => {
    render(<StoreProvider><Seed missing /></StoreProvider>);
    await screen.findByText('1 missing', { exact: true });
    const section = screen.getByText('To complete', { exact: true }).closest('section')!;
    expect(within(section).getByText('Location', { exact: true })).toBeTruthy();
    expect(within(section).queryByText('Level', { exact: true })).toBeNull();
    expect(screen.getByText('Suggestions', { exact: true })).toBeTruthy();
  });
  it('keeps genuine Weak conflicts in To revise', async () => {
    render(<StoreProvider><Seed weak /></StoreProvider>);
    await screen.findByText('1 to revise', { exact: true });
    const section = screen.getByText('To revise', { exact: true }).closest('section')!;
    expect(within(section).getByText('X1 · Consistency')).toBeTruthy();
  });
  it('keeps compliance failures in Blocking', async () => {
    render(<StoreProvider><Seed blocked /></StoreProvider>);
    await screen.findByText('Blocking', { exact: true });
    expect(screen.queryByText('All required items complete')).toBeNull();
  });
});
