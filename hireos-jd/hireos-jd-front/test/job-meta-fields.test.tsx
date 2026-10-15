// #76 — the field row under the title: Workplace type always visible, no invented Level.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from '../src/store/StoreContext';
import { JobMetaFields } from '../src/features/workspace/JobMetaFields';
import { coreJobToLocalJob } from '../src/features/jobs/jobsMapping';

function Seeded({ level }: { level: string | null }) {
  const { mutate } = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    mutate((d) => {
      d.jobs = { ...d.jobs, j1: coreJobToLocalJob({ id: 'j1', title: 'Finance Manager', location: 'Shanghai', openings: 1, seniority: level, status: 'draft' } as never) };
    });
    setReady(true);
  }, [mutate, level]);
  return ready ? <JobMetaFields jobId="j1" ev={null} /> : null;
}
const renderRow = (level: string | null) =>
  render(
    <AntApp>
      <StoreProvider>
        <Seeded level={level} />
      </StoreProvider>
    </AntApp>,
  );
const field = (key: string) => document.querySelector(`[data-field="${key}"]`) as HTMLElement | null;

afterEach(cleanup);

describe('#76: job field row', () => {
  it('shows Location, Headcount and Workplace type without adding a field', async () => {
    renderRow(null);
    await screen.findByText('Workplace type');
    expect(field('location')).not.toBeNull();
    expect(field('headcount')).not.toBeNull();
    expect(field('workplaceType')).not.toBeNull();
  });

  it('an unset Level is empty (flagged as required), never "Mid"; a set Level shows as saved', async () => {
    renderRow(null);
    const level = (await screen.findByText('Level')).closest('[data-field]')!.querySelector('input')!;
    expect(level.value).toBe('');
    expect(document.body.textContent).not.toContain('Mid');
    cleanup();

    renderRow('Senior');
    const set = (await screen.findByText('Level')).closest('[data-field]')!.querySelector('input')!;
    expect(set.value).toBe('Senior');
  });
});
