// #65 #66 — Quick Start keeps asking until it has three answers, and an AI-suggested title gates Create.
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
const FIELDS = { title: 'Vietnam Growth Manager', roleSummary: 'Owns growth.', responsibilities: ['Build a growth process'], mustHave: ['SQL'] };
const conv = (over: object) =>
  ({ id: 'conv-1', jobId: null, phase: 'intake', fields: {}, missingFields: [], stateRevision: 1, createdAt: '', updatedAt: '', messages: [], ...over }) as never;
const reply = (text: string) => conv({ messages: [{ id: 'm', role: 'assistant', text, sequence: 2, createdAt: '' }] });

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

describe('Quick Start', () => {
  it('#65 AC-1: a follow-up question shows no draft; the next answer is sent on its own (the backend keeps the earlier ones)', async () => {
    api.quickStartCopilotConversation
      .mockResolvedValueOnce(reply('One more thing before I write the JD — please answer:\n1. What hard skills must the candidate have?'))
      .mockResolvedValueOnce(conv({ phase: 'ready_to_confirm', fields: FIELDS, missingFields: ['title_unconfirmed'] }));
    renderPanel();
    fireEvent.click(await screen.findByText('Quick Start'));
    send('We have nobody owning growth in Vietnam\nBuild a repeatable local growth process');

    expect(await screen.findByText(/What hard skills must the candidate have\?/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create job from this draft/ })).toBeNull();

    send('Performance marketing, SQL');
    await screen.findByRole('button', { name: /Create job from this draft/ });
    expect(api.quickStartCopilotConversation.mock.calls.map((c) => c[1])).toEqual([
      'We have nobody owning growth in Vietnam\nBuild a repeatable local growth process',
      'Performance marketing, SQL',
    ]);
  });

  it('#66 AC-1/AC-2: an AI-suggested title is highlighted and Create stays disabled until it is confirmed or edited', async () => {
    api.quickStartCopilotConversation.mockResolvedValue(conv({ phase: 'ready_to_confirm', fields: FIELDS, missingFields: ['title_unconfirmed'] }));
    api.getCopilotConversation.mockResolvedValue(conv({ phase: 'ready_to_confirm', fields: FIELDS, missingFields: ['title_unconfirmed'] }));
    api.setCopilotFields.mockImplementation(async (_id, fields) => conv({ phase: 'ready_to_confirm', fields, missingFields: [] }));
    api.confirmCopilotDraft.mockResolvedValue({ conversationId: 'conv-1', jobId: 'job-1' });
    renderPanel();
    fireEvent.click(await screen.findByText('Quick Start'));
    send('No one owns growth\nBuild a growth process\nSQL');

    expect(await screen.findByText('AI suggested · to confirm')).toBeInTheDocument();
    const create = screen.getByRole('button', { name: /Create job from this draft/ });
    expect(create).toBeDisabled();
    fireEvent.click(create);
    expect(api.confirmCopilotDraft).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Job title' }), { target: { value: 'Growth Manager, Vietnam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this title' }));
    await waitFor(() => expect(api.setCopilotFields).toHaveBeenCalledTimes(1));
    expect(api.setCopilotFields.mock.calls[0][1]).toMatchObject({ ...FIELDS, title: 'Growth Manager, Vietnam' });
    await waitFor(() => expect(screen.queryByText('AI suggested · to confirm')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Create job from this draft/ }));
    expect(await screen.findByTestId('editor')).toBeInTheDocument();
    expect(api.confirmCopilotDraft).toHaveBeenCalledTimes(1);
  });

  it('#66 AC-3: when no title can be suggested, the reply asks for one and there is no draft to create', async () => {
    api.quickStartCopilotConversation.mockResolvedValue(reply('From these answers I can’t tell which role this is yet. What’s the job title?'));
    renderPanel();
    fireEvent.click(await screen.findByText('Quick Start'));
    send('Things are messy\nTidy them up\nPatience, curiosity, kindness');
    expect(await screen.findByText(/What’s the job title\?/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create job from this draft/ })).toBeNull();
  });
});
