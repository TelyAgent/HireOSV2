// Issue #35 — the Job Library tells "loading" and "failed" apart from "no jobs".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/features/jobs/jobsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/features/jobs/jobsApi')>()),
  listJobs: vi.fn(),
}));

import * as jobsApi from '../src/features/jobs/jobsApi';
import { StoreProvider, useStore } from '../src/store/StoreContext';
import { JobLibraryPage } from '../src/pages/JobLibraryPage';
import { loadJobsIntoStore } from '../src/features/jobs/jobsLoader';

const api = vi.mocked(jobsApi);

/** Does what App does on start-up: load the jobs once. */
function Loader() {
  const { mutate } = useStore();
  useEffect(() => {
    void loadJobsIntoStore(mutate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderLibrary() {
  return render(
    <AntApp>
      <StoreProvider>
        <MemoryRouter initialEntries={['/jobs']}>
          <Loader />
          <JobLibraryPage />
        </MemoryRouter>
      </StoreProvider>
    </AntApp>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

describe('Job Library loading states (#35)', () => {
  it('AC-1: while the request is pending it shows loading, not "No jobs match these filters"', async () => {
    api.listJobs.mockReturnValue(new Promise(() => {}));
    renderLibrary();
    expect(await screen.findByText('Loading jobs…')).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText('No jobs match these filters')).toBeNull();
  });

  it('AC-1/AC-2: a failure shows the error and Retry; the empty state appears only after a real empty answer', async () => {
    api.listJobs.mockRejectedValueOnce(new Error('HTTP 504')).mockResolvedValueOnce([]);
    renderLibrary();
    expect(await screen.findByText(/Couldn’t load the job list\./)).toBeInTheDocument();
    expect(screen.queryByText('No jobs match these filters')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No jobs match these filters')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.listJobs).toHaveBeenCalledTimes(2);
  });
});
