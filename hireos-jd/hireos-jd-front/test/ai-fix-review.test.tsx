// #94 #95 — a single AI fix is shown as a before/after to keep or reject; nothing unsourced is written;
// the batch says what it handles and what a person must fill.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { useEffect, useState } from 'react';

vi.mock('../src/features/workspace/documentsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/features/workspace/documentsApi')>()),
  aiSection: vi.fn(),
}));

import * as docsApi from '../src/features/workspace/documentsApi';
import { StoreProvider, useStore } from '../src/store/StoreContext';
import { AnalysisPanel } from '../src/features/workspace/AnalysisPanel';
import { OverlayHost } from '../src/components/ui/Overlays';
import { mkBlock } from '../src/data/fixtures/documents';
import { coreJobToLocalJob } from '../src/features/jobs/jobsMapping';
import { docKey, selectDraft, blockPlainText } from '../src/features/workspace/docHelpers';
import { useDocActions } from '../src/features/workspace/docActions';

const api = vi.mocked(docsApi);

/** Shows the document's responsibility bullets so a test can read what was written. */
function Bullets() {
  const { state } = useStore();
  const blocks = selectDraft(state, 'j1').blocks;
  return <ul data-testid="doc">{blocks.filter((b) => b.kind === 'ul').map((b) => <li key={b.id}>{blockPlainText(b)}</li>)}</ul>;
}
function UndoButton() {
  const actions = useDocActions('j1');
  return <button onClick={() => actions.undoAi()}>undo-ai</button>;
}
function Seeded() {
  const { mutate } = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    mutate((d) => {
      d.jobs = { ...d.jobs, j1: coreJobToLocalJob({ id: 'j1', title: 'Data Analyst', location: 'Shanghai', openings: 1, status: 'draft' } as never) };
      d.drafts = {
        ...d.drafts,
        [docKey('j1')]: {
          id: 'doc-j1', jobId: 'j1', audience: 'internal', language: 'en', revision: 1, saveState: 'saved',
          blocks: [
            mkBlock('b1', 'h2', 'Data Analyst', { level: 'public' }),
            mkBlock('b2', 'p', 'Turns product data into weekly decisions for the team.', { level: 'public' }),
            mkBlock('b3', 'h2', 'Responsibilities', { level: 'public' }),
            mkBlock('b4', 'ul', ['Review product data weekly and share findings'], { level: 'public' }),
            mkBlock('b5', 'h2', 'Requirements', { level: 'public' }),
            mkBlock('b6', 'ul', ['Can write SQL queries'], { level: 'public' }),
          ],
        },
      };
    });
    setReady(true);
  }, [mutate]);
  return ready ? (
    <>
      <AnalysisPanel jobId="j1" />
      <Bullets />
      <UndoButton />
      <OverlayHost />
    </>
  ) : null;
}
const renderPanel = () => render(<AntApp><StoreProvider><Seeded /></StoreProvider></AntApp>);
/** The "AI fix" link in the row for `label`. */
async function aiFixFor(label: string) {
  let el: HTMLElement | null = await screen.findByText(label);
  while (el && !el.querySelector('.req-link-ai')) el = el.parentElement;
  return el!.querySelector('.req-link-ai') as HTMLElement;
}
const bullets = () => [...screen.getByTestId('doc').querySelectorAll('li')].map((li) => li.textContent);
const ORIGINAL = ['Review product data weekly and share findings', 'Can write SQL queries'];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

describe('single AI fix (#94)', () => {
  const fixed = ['Review product data weekly and share findings', 'Build weekly product dashboards', 'Answer ad-hoc data questions'];

  it('AC-1/AC-2: shows original vs new before anything changes; Reject leaves the text as it was', async () => {
    api.aiSection.mockResolvedValue({ items: fixed, explain: 'more bullets', toConfirm: ['Spreadsheet software'] });
    renderPanel();
    fireEvent.click(await aiFixFor('Core responsibilities'));

    expect(await screen.findByText(/Review AI change/)).toBeInTheDocument();
    expect(screen.getByText('Build weekly product dashboards').closest('.ai-diff-line')).toHaveClass('is-added');
    expect(screen.getByText('Spreadsheet software')).toBeInTheDocument();
    expect(bullets()).toEqual(ORIGINAL); // nothing applied yet

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.queryByText(/Review AI change/)).toBeNull());
    expect(bullets()).toEqual(ORIGINAL);
  });

  it('AC-2/AC-3: Keep writes exactly the shown result; Undo restores the original exactly', async () => {
    api.aiSection.mockResolvedValue({ items: fixed, explain: 'more bullets', toConfirm: [] });
    renderPanel();
    fireEvent.click(await aiFixFor('Core responsibilities'));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(bullets()).toEqual([...fixed, 'Can write SQL queries']));
    expect(bullets()).not.toContain('Spreadsheet software');

    fireEvent.click(screen.getByText('undo-ai'));
    await waitFor(() => expect(bullets()).toEqual(ORIGINAL));
  });
});

describe('batch AI fix (#95)', () => {
  it('AC-2: the batch says what it handles, and lists what a person must fill with a way to get there', async () => {
    renderPanel();
    expect(await screen.findByText(/AI handles/)).toHaveTextContent(/Core responsibilities/);
    const manual = screen.getByText('Needs you — AI won’t fill these').closest('.ck-sec, section, div') as HTMLElement;
    expect(manual.parentElement!.textContent).toMatch(/Level/);
    expect(manual.parentElement!.textContent).toMatch(/Public salary range/);
  });

  it('AC-3: double-clicking the batch runs each item once — no duplicated paragraphs', async () => {
    let release!: () => void;
    api.aiSection.mockImplementation(
      (_job, _aud, body) =>
        new Promise((resolve) => (release = () => resolve({ items: [`${body.itemId} one`, `${body.itemId} two`, `${body.itemId} three`], explain: '', toConfirm: [] }))) as never,
    );
    renderPanel();
    const button = await screen.findByRole('button', { name: /AI fix all/ });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(api.aiSection).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 10 && api.aiSection.mock.calls.length; i++) {
      release();
      await new Promise((r) => setTimeout(r, 20));
    }
    await waitFor(() => expect(screen.queryByText('Working…')).toBeNull());
    const all = bullets();
    expect(new Set(all).size).toBe(all.length);
  });
});
