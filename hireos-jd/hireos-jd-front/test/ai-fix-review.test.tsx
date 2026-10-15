// #94 #95 — a single AI fix is shown as a before/after to keep or reject; nothing unsourced is written;
// the batch says what it handles and what a person must fill.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { useEffect, useState } from 'react';

vi.mock('../src/features/workspace/documentsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/features/workspace/documentsApi')>()),
  aiSection: vi.fn(),
  aiAnalyze: vi.fn(async () => ({ verdict: 'needs_work', summary: 'ok', items: [] })),
  saveJobDocument: vi.fn(async (_job, _aud, blocks) => ({ revision: 2, blocks })),
}));

import * as docsApi from '../src/features/workspace/documentsApi';
import { StoreProvider, useStore } from '../src/store/StoreContext';
import { OverlayHost } from '../src/components/ui/Overlays';
import { mkBlock } from '../src/data/fixtures/documents';
import { coreJobToLocalJob } from '../src/features/jobs/jobsMapping';
import { docKey, selectDraft, blockPlainText } from '../src/features/workspace/docHelpers';
import { useDocActions } from '../src/features/workspace/docActions';
import { useDocumentSaver } from '../src/features/workspace/useDocumentSaver';
import { SidePanel } from '../src/features/workspace/SidePanel';

const api = vi.mocked(docsApi);

/** Shows the document's bullets and paragraphs so a test can read what was written. */
function Doc() {
  const { state } = useStore();
  const blocks = selectDraft(state, 'j1').blocks;
  return (
    <>
      <ul data-testid="doc">{blocks.filter((b) => b.kind === 'ul').map((b) => <li key={b.id} data-ai-draft={b.aiDraft ? 'yes' : 'no'}>{blockPlainText(b)}</li>)}</ul>
      <div data-testid="paras">{blocks.filter((b) => b.kind === 'p').map((b) => <p key={b.id}>{blockPlainText(b)}</p>)}</div>
    </>
  );
}
function Controls() {
  const actions = useDocActions('j1');
  const save = useDocumentSaver('j1');
  return (
    <>
      <button onClick={() => actions.undoAi()}>undo-ai</button>
      <button onClick={() => void save({ quiet: true })}>save-doc</button>
      <button onClick={() => actions.reanalyze()}>analyze-now</button>
    </>
  );
}
function Seeded({ withAnalysis = false }: { withAnalysis?: boolean }) {
  const { mutate } = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    mutate((d) => {
      d.jobs = { ...d.jobs, j1: coreJobToLocalJob({ id: 'j1', title: 'Data Analyst', location: 'Shanghai', openings: 1, status: 'draft' } as never) };
      if (withAnalysis) d.wsAiAnalysis = { j1: { at: 1, revision: 1, result: { verdict: 'needs_work', summary: 's', items: [] } } };
      d.wsSideTab = 'analysis';
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
  }, [mutate, withAnalysis]);
  return ready ? (
    <>
      <SidePanel jobId="j1" />
      <Doc />
      <Controls />
      <OverlayHost />
    </>
  ) : null;
}
const renderPanel = (withAnalysis = false) => render(<AntApp><StoreProvider><Seeded withAnalysis={withAnalysis} /></StoreProvider></AntApp>);
const paras = () => [...screen.getByTestId('paras').querySelectorAll('p')].map((p) => p.textContent);
const SUMMARY = 'Turns product data into weekly decisions for the team.';
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

describe('single AI fix — paragraph, save round-trip, re-analysis (#94 review)', () => {
  const NEW_SUMMARY = 'Turns weekly product data into clear decisions for the product team.';

  it('AC-3: a paragraph fix is kept, saved, undone and saved again — what is saved matches each step exactly', async () => {
    api.aiSection.mockResolvedValue({ items: [NEW_SUMMARY], explain: 'clearer', toConfirm: [] });
    renderPanel();
    fireEvent.click(await aiFixFor('Role summary'));
    expect(await screen.findByText(NEW_SUMMARY)).toBeInTheDocument();
    expect(document.querySelector('.ai-diff-line.is-removed')).toHaveTextContent(SUMMARY);
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(paras()).toContain(NEW_SUMMARY));

    fireEvent.click(screen.getByText('save-doc'));
    await waitFor(() => expect(api.saveJobDocument).toHaveBeenCalledTimes(1));
    const kept = api.saveJobDocument.mock.calls[0][2].map((b) => blockPlainText(b));
    expect(kept).toContain(NEW_SUMMARY);
    expect(kept).not.toContain(SUMMARY);

    fireEvent.click(screen.getByText('undo-ai'));
    await waitFor(() => expect(paras()).toEqual([SUMMARY]));
    fireEvent.click(screen.getByText('save-doc'));
    await waitFor(() => expect(api.saveJobDocument).toHaveBeenCalledTimes(2));
    // What a reload would read back is the original document, block for block.
    const reloaded = api.saveJobDocument.mock.calls[1][2].map((b) => blockPlainText(b));
    expect(reloaded).toEqual(['Data Analyst', SUMMARY, 'Responsibilities', ...ORIGINAL.slice(0, 1), 'Requirements', ORIGINAL[1]]);
  });

  it('AC-2: keeping a change re-runs AI Analyze on the new text when the job had been analyzed', async () => {
    api.aiSection.mockResolvedValue({ items: [NEW_SUMMARY], explain: 'clearer', toConfirm: [] });
    renderPanel(true);
    fireEvent.click(await aiFixFor('Role summary'));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(api.aiAnalyze).toHaveBeenCalledTimes(1));
    const sent = api.aiAnalyze.mock.calls[0][2].blocks.map((b) => b.text);
    expect(sent).toContain(NEW_SUMMARY);
  });

  it('Reject never triggers a re-analysis', async () => {
    api.aiSection.mockResolvedValue({ items: [NEW_SUMMARY], explain: 'clearer', toConfirm: [] });
    renderPanel(true);
    fireEvent.click(await aiFixFor('Role summary'));
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(api.aiAnalyze).not.toHaveBeenCalled();
    expect(paras()).toEqual([SUMMARY]);
  });
});

describe('#94 review', () => {
  it('the preview lists lines in the order they will be written, and Keep confirms them (no second keep)', async () => {
    api.aiSection.mockResolvedValue({ items: ['Review product data weekly and share findings', 'Build dashboards', 'Answer data questions'], explain: '', toConfirm: [] });
    renderPanel();
    fireEvent.click(await aiFixFor('Core responsibilities'));
    await screen.findByText(/Review AI change/);
    const shown = [...document.querySelectorAll('.ai-diff-line')].map((el) => el.textContent?.slice(1).trim());
    expect(shown).toEqual(['Review product data weekly and share findings', 'Build dashboards', 'Answer data questions']);
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(bullets()).toContain('Build dashboards'));
    // Kept in the review = confirmed: no block is left marked as an AI draft to keep a second time.
    expect(screen.getByTestId('doc').querySelectorAll('[data-ai-draft="yes"]')).toHaveLength(0);
  });

  it('a re-analysis asked for while an analysis is running runs after it, on the kept text', async () => {
    let finishFirst!: () => void;
    api.aiAnalyze.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = () => resolve({ verdict: 'needs_work', summary: 'old', items: [] }))) as never);
    api.aiSection.mockResolvedValue({ items: ['A clearer summary of the role.'], explain: '', toConfirm: [] });
    renderPanel(true);
    fireEvent.click(await screen.findByText('analyze-now'));
    await waitFor(() => expect(api.aiAnalyze).toHaveBeenCalledTimes(1));
    fireEvent.click(await aiFixFor('Role summary'));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep' }));
    await new Promise((r) => setTimeout(r, 30));
    expect(api.aiAnalyze).toHaveBeenCalledTimes(1); // still busy: waits
    finishFirst();
    await waitFor(() => expect(api.aiAnalyze).toHaveBeenCalledTimes(2));
    expect(api.aiAnalyze.mock.calls[1][2].blocks.map((b) => b.text)).toContain('A clearer summary of the role.');
  });
});

describe('#94 review: first analysis', () => {
  it('Keep during the very first analysis (no result yet) still re-analyzes the kept text afterwards', async () => {
    let finishFirst!: () => void;
    api.aiAnalyze.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = () => resolve({ verdict: 'needs_work', summary: 'old', items: [] }))) as never);
    api.aiSection.mockResolvedValue({ items: ['A clearer summary of the role.'], explain: '', toConfirm: [] });
    renderPanel(false);
    fireEvent.click(await screen.findByText('analyze-now'));
    await waitFor(() => expect(api.aiAnalyze).toHaveBeenCalledTimes(1));
    fireEvent.click(await aiFixFor('Role summary'));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep' }));
    finishFirst();
    await waitFor(() => expect(api.aiAnalyze).toHaveBeenCalledTimes(2));
    expect(api.aiAnalyze.mock.calls[1][2].blocks.map((b) => b.text)).toContain('A clearer summary of the role.');
  });
});

describe('lineDiff', () => {
  it('keeps the result order with removed lines where they were', async () => {
    const { lineDiff } = await import('../src/features/workspace/docActions');
    expect(lineDiff(['A', 'X', 'C'], ['A', 'B', 'C'])).toEqual([
      { kind: 'same', text: 'A' },
      { kind: 'removed', text: 'X' },
      { kind: 'added', text: 'B' },
      { kind: 'same', text: 'C' },
    ]);
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
    // The batch writes without a review, so its blocks stay marked as AI drafts to check one by one.
    expect(screen.getByTestId('doc').querySelectorAll('[data-ai-draft="yes"]').length).toBeGreaterThan(0);
    const all = bullets();
    expect(new Set(all).size).toBe(all.length);
  });
});
