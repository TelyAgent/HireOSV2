// Issue #34 — creating a job from the Copilot panel must never invent a local-only job.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';

vi.mock('../src/features/copilot/copilotApi', async (importOriginal) => ({
  CopilotRequestError: (await importOriginal<typeof import('../src/features/copilot/copilotApi')>()).CopilotRequestError,
  createCopilotConversation: vi.fn(),
  setCopilotFields: vi.fn(),
  confirmCopilotDraft: vi.fn(),
  listCopilotConversations: vi.fn(async () => []),
  getCopilotConversation: vi.fn(),
  autoCompleteCopilotConversation: vi.fn(),
  quickStartCopilotConversation: vi.fn(),
  TITLE_UNCONFIRMED: 'title_unconfirmed',
  generateCopilotTitleVariants: vi.fn(),
  importCopilotSource: vi.fn(),
  refineCopilotDraft: vi.fn(),
  refineCopilotVariants: vi.fn(),
  streamCopilotMessage: vi.fn(),
  uploadCopilotAttachment: vi.fn(),
}));
vi.mock('../src/features/jobs/jobsApi', () => ({ updateJobFields: vi.fn(async () => ({})) }));

import * as copilot from '../src/features/copilot/copilotApi';
import { StoreProvider } from '../src/store/StoreContext';
import { GeminiPanel } from '../src/features/copilot/GeminiPanel';

const api = vi.mocked(copilot);

function Editor() {
  const { id } = useParams();
  return <div data-testid="editor">editor:{id}</div>;
}

function renderPanel() {
  return render(
    <AntApp>
      <StoreProvider>
        <MemoryRouter initialEntries={['/jobs']}>
          <Routes>
            <Route path="/jobs" element={<GeminiPanel ctx={{ mode: 'create', jobId: null, audience: 'internal', selText: null }} />} />
            <Route path="/jobs/:id/document" element={<Editor />} />
          </Routes>
        </MemoryRouter>
      </StoreProvider>
    </AntApp>,
  );
}

const FIELDS = { title: 'Partner Integrations Engineer', location: 'Shanghai', headcount: 1, responsibilities: ['Own partner APIs'], mustHave: ['Node.js'] };

async function fillManualFormAndSave() {
  fireEvent.click(await screen.findByText('Create Manually'));
  const title = await screen.findByPlaceholderText('e.g. Growth Operations Manager');
  fireEvent.change(title, { target: { value: FIELDS.title } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Ho Chi Minh City, VN'), { target: { value: FIELDS.location } });
  fireEvent.change(screen.getByPlaceholderText('e.g. 2'), { target: { value: '1' } });
  const form = title.closest('.gm-bubble') as HTMLElement;
  const areas = form.querySelectorAll('textarea');
  fireEvent.change(areas[1], { target: { value: 'Own partner APIs' } });
  fireEvent.change(areas[2], { target: { value: 'Node.js' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.createCopilotConversation.mockResolvedValue({ id: 'conv-new' } as never);
  api.setCopilotFields.mockResolvedValue({ id: 'conv-new', fields: FIELDS } as never);
});
afterEach(cleanup);

describe('Copilot → create job (#34)', () => {
  it('AC-1/AC-4: in a brand-new panel, Create Manually confirms the conversation it just created and opens the real job', async () => {
    api.confirmCopilotDraft.mockResolvedValue({ conversationId: 'conv-new', jobId: 'job-real-1' });
    renderPanel();
    await fillManualFormAndSave();

    expect(await screen.findByTestId('editor')).toHaveTextContent('editor:job-real-1');
    expect(api.createCopilotConversation).toHaveBeenCalledTimes(1);
    expect(api.confirmCopilotDraft).toHaveBeenCalledWith('conv-new');
  });

  it('AC-3/AC-5: a failed confirm creates no local job, keeps the input and retries on the same conversation', async () => {
    api.confirmCopilotDraft
      .mockRejectedValueOnce(new Error('Core Record is unavailable.'))
      .mockResolvedValueOnce({ conversationId: 'conv-new', jobId: 'job-real-2' });
    renderPanel();
    await fillManualFormAndSave();

    expect(await screen.findByText('The job was not created — Core Record is unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('The JD is created. You can')).toBeNull();
    expect(document.querySelector('a[href*="job-gen"]')).toBeNull();
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByPlaceholderText('e.g. Growth Operations Manager')).toHaveValue(FIELDS.title);

    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(await screen.findByTestId('editor')).toHaveTextContent('editor:job-real-2');
    await waitFor(() => expect(api.confirmCopilotDraft).toHaveBeenCalledTimes(2));
    expect(api.confirmCopilotDraft.mock.calls.map((c) => c[0])).toEqual(['conv-new', 'conv-new']);
    expect(api.createCopilotConversation).toHaveBeenCalledTimes(1);
  });

  it('#69: a Quick Start draft opens the new job’s editor after Create, and a double click creates it once', async () => {
    api.quickStartCopilotConversation.mockResolvedValue({
      id: 'conv-new', jobId: null, phase: 'ready_to_confirm', fields: FIELDS, missingFields: [], stateRevision: 2, createdAt: '', updatedAt: '', messages: [],
    } as never);
    let finish!: (v: { conversationId: string; jobId: string }) => void;
    api.confirmCopilotDraft.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPanel();
    fireEvent.click(await screen.findByText('Quick Start'));
    fireEvent.change(document.querySelector('.gemini-composer-shell textarea')!, { target: { value: 'Partner Integrations Engineer\nShanghai\nNode.js' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    const create = await screen.findByRole('button', { name: /Create job from this draft/ });
    fireEvent.click(create);
    fireEvent.click(create);
    finish({ conversationId: 'conv-new', jobId: 'job-qs-1' });
    expect(await screen.findByTestId('editor')).toHaveTextContent('editor:job-qs-1');
    expect(api.confirmCopilotDraft).toHaveBeenCalledTimes(1);
  });
});
