// #71 — refining the variants keeps the user on the version they chose, and creating uses that version's facts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../src/features/copilot/copilotApi', async (importOriginal) => ({
  CopilotRequestError: (await importOriginal<typeof import('../src/features/copilot/copilotApi')>()).CopilotRequestError,
  TITLE_UNCONFIRMED: 'title_unconfirmed',
  createCopilotConversation: vi.fn(),
  setCopilotFields: vi.fn(),
  confirmCopilotDraft: vi.fn(),
  listCopilotConversations: vi.fn(async () => []),
  getCopilotConversation: vi.fn(),
  autoCompleteCopilotConversation: vi.fn(),
  quickStartCopilotConversation: vi.fn(),
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
const v = (key: string, location: string) => ({ key, label: key, description: '', fields: { title: 'Finance Manager', location, headcount: 1, responsibilities: [`${key} duty`], mustHave: [`${key} skill`] } });

function renderPanel() {
  return render(
    <AntApp>
      <StoreProvider>
        <MemoryRouter initialEntries={['/jobs']}>
          <Routes>
            <Route path="/jobs" element={<GeminiPanel ctx={{ mode: 'create', jobId: null, audience: 'internal', selText: null }} />} />
            <Route path="/jobs/:id/document" element={<div data-testid="editor" />} />
          </Routes>
        </MemoryRouter>
      </StoreProvider>
    </AntApp>,
  );
}
const composer = () => document.querySelector('.gemini-composer-shell textarea') as HTMLTextAreaElement;
function send(text: string) {
  fireEvent.change(composer(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.createCopilotConversation.mockResolvedValue({ id: 'conv-1' } as never);
});
afterEach(cleanup);

describe('title variants (#71)', () => {
  it('AC-2/AC-3: with B selected, refine says B is primary, B stays selected, and creating uses B’s refined facts', async () => {
    api.generateCopilotTitleVariants.mockResolvedValue({ title: 'Finance Manager', variants: [v('A', '上海'), v('B', '上海'), v('C', '上海')] } as never);
    api.refineCopilotVariants.mockResolvedValue({ variants: [v('A', '远程'), v('B', '远程'), v('C', '远程')] } as never);
    api.setCopilotFields.mockImplementation(async (_id, fields) => ({ id: 'conv-1', fields }) as never);
    api.confirmCopilotDraft.mockResolvedValue({ conversationId: 'conv-1', jobId: 'job-1' });
    renderPanel();
    fireEvent.click(await screen.findByText('Start with a Job Title'));
    send('Finance Manager');

    fireEvent.click(await screen.findByRole('button', { name: /^B · B/ }));
    send('make it remote');
    await waitFor(() => expect(api.refineCopilotVariants).toHaveBeenCalledTimes(1));
    expect(api.refineCopilotVariants.mock.calls[0][3]).toBe(1);

    const create = await screen.findByRole('button', { name: 'Create job with version B' });
    fireEvent.click(create);
    expect(await screen.findByTestId('editor')).toBeInTheDocument();
    expect(api.setCopilotFields.mock.calls[0][1]).toMatchObject({ location: '远程', responsibilities: ['B duty'] });
  });
});
