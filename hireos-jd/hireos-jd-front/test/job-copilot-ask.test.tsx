// #106 #107 #104 — the job-page Copilot answers questions without a selection and only proposes real edits.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/features/workspace/documentsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/features/workspace/documentsApi')>()),
  askDocumentCopilot: vi.fn(),
  rewriteDocumentSelection: vi.fn(),
  createSuggestion: vi.fn(),
}));

import * as docsApi from '../src/features/workspace/documentsApi';
import { StoreProvider, useStore } from '../src/store/StoreContext';
import { SidePanel } from '../src/features/workspace/SidePanel';
import { mkBlock } from '../src/data/fixtures/documents';
import { coreJobToLocalJob } from '../src/features/jobs/jobsMapping';
import { docKey } from '../src/features/workspace/docHelpers';

const api = vi.mocked(docsApi);

function Seeded({ select, focus, long }: { select?: { blockId: string; text: string }; focus?: string; long?: boolean }) {
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
            mkBlock('b2', 'ul', ['Can write SQL queries.'], { level: 'public' }),
            mkBlock('b3', 'p', 'Internal ceiling: 30K', { level: 'confidential' }),
            ...(long ? [mkBlock('b4', 'p', 'x'.repeat(600000), { level: 'public' })] : []),
          ],
        },
      };
      d.wsSideTab = 'copilot';
      d.wsSelection = select ? { ...select, scopeLabel: 'Selected text' } : null;
      d.wsFocusBlockId = focus ?? null;
    });
    setReady(true);
  }, [mutate, select, focus, long]);
  return ready ? <SidePanel jobId="j1" /> : null;
}
const renderPanel = (select?: { blockId: string; text: string }, focus?: string, long?: boolean) =>
  render(
    <AntApp>
      <StoreProvider>
        <MemoryRouter>
          <Seeded select={select} focus={focus} long={long} />
        </MemoryRouter>
      </StoreProvider>
    </AntApp>,
  );
async function type(text: string) {
  const box = await screen.findByPlaceholderText('Ask Copilot to rewrite, explain, or draft something…');
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: 'Enter' });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

describe('job-page Copilot', () => {
  it('#106 AC-1/AC-2: with nothing selected, a question is answered from the whole JD and the page status, with its basis shown', async () => {
    api.askDocumentCopilot.mockResolvedValue({ kind: 'answer', intent: 'answer', text: 'Not yet: Level is missing.', sources: [], contextScope: 'document' });
    renderPanel();
    await type('Can this JD be submitted for approval now?');

    expect(await screen.findByText('Not yet: Level is missing.')).toBeInTheDocument();
    expect(screen.getByText('Based on the whole JD (Confidential excluded)')).toBeInTheDocument();
    expect(screen.queryByText(/select some text/)).toBeNull();
    const body = api.askDocumentCopilot.mock.calls[0][2];
    expect(body.selection).toBeUndefined();
    expect(body.context.documentText).toContain('Can write SQL queries.');
    expect(body.context.documentText).not.toContain('Internal ceiling'); // Confidential never sent
    expect(body.context.readiness).toMatch(/Publish button is disabled/);
  });

  it('#107 AC-1: "explain only" on a selection shows an answer and creates no suggestion', async () => {
    api.askDocumentCopilot.mockResolvedValue({ kind: 'answer', intent: 'answer', text: 'It means writing SELECT queries.', sources: [], contextScope: 'selection' });
    renderPanel({ blockId: 'b2', text: 'Can write SQL queries.' });
    await type('请解释这项要求的含义，只回答，不修改文档');

    expect(await screen.findByText('It means writing SELECT queries.')).toBeInTheDocument();
    expect(screen.getByText('Based on the selected text and the whole JD (Confidential excluded)')).toBeInTheDocument();
    expect(api.createSuggestion).not.toHaveBeenCalled();
    expect(screen.queryByText(/Accept|采纳/)).toBeNull();
  });

  it('#107 AC-2: research shows its sources; an edit that changes nothing is reported, not proposed', async () => {
    api.askDocumentCopilot.mockResolvedValueOnce({
      kind: 'answer', intent: 'research', text: '15K–25K / month. 数据口径：样本量未知。', sources: [{ title: 'jobui', url: 'https://www.jobui.com/x' }], contextScope: 'document',
    });
    renderPanel();
    await type('上海中级数据分析师的市场薪资是多少？');
    expect(await screen.findByRole('link', { name: 'jobui' })).toHaveAttribute('href', 'https://www.jobui.com/x');

    api.askDocumentCopilot.mockResolvedValueOnce({ kind: 'no_change', explain: 'The wording is already clear.' });
    await type('make it more professional');
    expect(await screen.findByText(/No change needed — nothing was proposed\. The wording is already clear\./)).toBeInTheDocument();
    expect(api.createSuggestion).not.toHaveBeenCalled();
  });

  it('#107 AC-3: an explicit edit still becomes a suggestion', async () => {
    api.askDocumentCopilot.mockResolvedValue({ kind: 'edit', text: 'Writes complex SQL.', items: ['Writes complex SQL.'], explain: 'More specific.', reason: '' });
    api.createSuggestion.mockImplementation(async (_j, _a, body) => ({ id: 's1', status: 'pending', createdAt: '', ...body }) as never);
    renderPanel({ blockId: 'b2', text: 'Can write SQL queries.' });
    await type('make it more specific');
    await waitFor(() => expect(api.createSuggestion).toHaveBeenCalledTimes(1));
    expect(api.createSuggestion.mock.calls[0][2]).toMatchObject({ anchorBlock: 'b2', newItems: ['Writes complex SQL.'] });
  });

  it('#104 AC-3: an off-topic question on the job page gets the scope reply, not a "select a paragraph" prompt', async () => {
    api.askDocumentCopilot.mockResolvedValue({ kind: 'answer', intent: 'off_topic', text: '这个问题超出了职位工作区的范围，我无法回答。', sources: [], contextScope: 'document' });
    renderPanel();
    await type('今天天气怎么样？');
    expect(await screen.findByText(/超出了职位工作区的范围/)).toBeInTheDocument();
    expect(screen.queryByText(/select some text/)).toBeNull();
  });

  it('#106: with the cursor in a Confidential block and nothing selected, a question still goes out — without that block', async () => {
    api.askDocumentCopilot.mockResolvedValue({ kind: 'answer', intent: 'answer', text: 'Yes, once Level is set.', sources: [], contextScope: 'document' });
    renderPanel(undefined, 'b3');
    const box = await screen.findByPlaceholderText('Ask Copilot to rewrite, explain, or draft something…');
    expect(box).not.toBeDisabled();
    await type('What does this JD require?');
    expect(await screen.findByText('Yes, once Level is set.')).toBeInTheDocument();
    const body = api.askDocumentCopilot.mock.calls[0][2];
    expect(body.selection).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('Internal ceiling');
    expect(body.context.readiness).toMatch(/AI Analyze has not been run/);
  });

  it('#106 review: a JD too long to send in full is answered with a "first part only" basis, never "whole JD"', async () => {
    api.askDocumentCopilot.mockResolvedValue({ kind: 'answer', intent: 'answer', text: 'Partly.', sources: [], contextScope: 'document' });
    renderPanel(undefined, undefined, true);
    await type('Does it require SQL?');
    expect(await screen.findByText(/Based on the first part of the JD only/)).toBeInTheDocument();
    expect(screen.queryByText('Based on the whole JD (Confidential excluded)')).toBeNull();
    expect(api.askDocumentCopilot.mock.calls[0][2].context.documentTruncated).toBe(true);
  });

  it('#106 review: an explicit selection too long to send whole is refused with a reason — no request, nothing cut', async () => {
    const huge = 'y'.repeat(9000);
    renderPanel({ blockId: 'b2', text: huge });
    await type('rewrite this');
    expect(await screen.findByText('The selected text is too long for Copilot — select a shorter part and ask again.')).toBeInTheDocument();
    expect(api.askDocumentCopilot).not.toHaveBeenCalled();
  });
});
