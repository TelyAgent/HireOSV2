// Issue #33 — recovering from a failed Copilot request: Retry / Start over, nothing retyped, no duplicates.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/features/copilot/copilotApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/copilot/copilotApi')>();
  return {
    CopilotRequestError: actual.CopilotRequestError,
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
  };
});
vi.mock('../src/features/jobs/jobsApi', () => ({ updateJobFields: vi.fn(async () => ({})) }));

import * as copilot from '../src/features/copilot/copilotApi';
import { CopilotRequestError } from '../src/features/copilot/copilotApi';
import { describeCopilotError } from '../src/features/copilot/copilotErrors';
import { StoreProvider } from '../src/store/StoreContext';
import { GeminiPanel } from '../src/features/copilot/GeminiPanel';

const api = vi.mocked(copilot);
const SIGN_IN_DOWN = new CopilotRequestError(503, { code: 'IDENTITY_UNAVAILABLE', message: 'Sign-in service is unavailable.' });
const UNAVAILABLE_TEXT = 'Copilot is temporarily unavailable. Your input is kept — retry in a moment.';
const conversation = (id: string) => ({ id, jobId: null, phase: 'intake', fields: {}, missingFields: [], stateRevision: 1, createdAt: '', updatedAt: '', messages: [] }) as never;

function renderPanel() {
  return render(
    <AntApp>
      <StoreProvider>
        <MemoryRouter>
          <GeminiPanel ctx={{ mode: 'create', jobId: null, audience: 'internal', selText: null }} />
        </MemoryRouter>
      </StoreProvider>
    </AntApp>,
  );
}
const composerBox = () => document.querySelector('textarea') as HTMLTextAreaElement;
function sendChat(text: string) {
  fireEvent.change(composerBox(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}
const entriesVisible = () => ['Quick Start', 'Start with a Job Title', 'Upload a JD', 'Paste a Link or Text', 'Create Manually'].every((x) => screen.queryAllByText(x).length > 0);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

describe('Copilot request failure recovery (#33)', () => {
  it('AC-1: New conversation goes straight back to the five entries, even with the backend down', async () => {
    api.createCopilotConversation.mockRejectedValue(SIGN_IN_DOWN);
    renderPanel();
    fireEvent.click(await screen.findByText('Quick Start'));
    expect(entriesVisible()).toBe(false);
    fireEvent.change(composerBox(), { target: { value: 'half-typed answer' } });

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    await waitFor(() => expect(entriesVisible()).toBe(true));
    expect(composerBox().value).toBe('');
    expect(document.querySelectorAll('.gm-bubble')).toHaveLength(0);
    expect(api.createCopilotConversation).not.toHaveBeenCalled(); // created lazily on the next send
  });

  it('AC-2/AC-3/AC-5: a failed request shows a plain-language card with Retry + Start over and keeps the input', async () => {
    api.createCopilotConversation.mockResolvedValue(conversation('conv-1'));
    api.streamCopilotMessage.mockRejectedValueOnce(SIGN_IN_DOWN);
    renderPanel();
    await screen.findByText('Quick Start');
    sendChat('Senior partner integrations engineer in Shanghai');

    const card = await screen.findByRole('alert');
    expect(card).toHaveTextContent(UNAVAILABLE_TEXT);
    expect(card.textContent).not.toMatch(/IDENTITY_UNAVAILABLE|503|Sign-in service/);
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start over/ })).toBeInTheDocument();
    expect(composerBox().value).toBe('Senior partner integrations engineer in Shanghai');

    fireEvent.click(screen.getByRole('button', { name: /Start over/ }));
    await waitFor(() => expect(entriesVisible()).toBe(true));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('AC-2/AC-4: Retry re-sends the original input on the same conversation, once, however often it is clicked', async () => {
    api.createCopilotConversation.mockResolvedValue(conversation('conv-1'));
    let release!: () => void;
    api.streamCopilotMessage
      .mockRejectedValueOnce(SIGN_IN_DOWN)
      .mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ ...(conversation('conv-1') as object), messages: [] } as never))));
    renderPanel();
    await screen.findByText('Quick Start');
    sendChat('Partner integrations engineer');
    await screen.findByRole('alert');

    const retry = screen.getByRole('button', { name: /Retry/ });
    fireEvent.click(retry);
    fireEvent.click(retry);
    fireEvent.click(retry);
    await waitFor(() => expect(api.streamCopilotMessage).toHaveBeenCalledTimes(2));
    fireEvent.click(retry); // still in flight: ignored
    release();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull());
    expect(api.streamCopilotMessage).toHaveBeenCalledTimes(2);
    expect(api.streamCopilotMessage.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['conv-1', 'Partner integrations engineer'],
      ['conv-1', 'Partner integrations engineer'],
    ]);
    expect(api.createCopilotConversation).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Partner integrations engineer').filter((el) => el.classList.contains('user'))).toHaveLength(1);
  });

  it('AC-4: when creating the conversation itself failed, the retry reuses its idempotency key', async () => {
    api.createCopilotConversation.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(conversation('conv-2'));
    api.streamCopilotMessage.mockResolvedValue(conversation('conv-2'));
    renderPanel();
    await screen.findByText('Quick Start');
    sendChat('Growth manager');
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t reach Copilot. Check your connection, then retry.');
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(api.streamCopilotMessage).toHaveBeenCalledWith('conv-2', 'Growth manager', expect.any(Function)));
    const keys = api.createCopilotConversation.mock.calls.map((c) => c[0]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});

describe('describeCopilotError (#33 AC-5)', () => {
  it('never surfaces codes or status numbers', () => {
    expect(describeCopilotError(SIGN_IN_DOWN)).toBe(UNAVAILABLE_TEXT);
    expect(describeCopilotError(new CopilotRequestError(502, {}))).toBe(UNAVAILABLE_TEXT);
    expect(describeCopilotError(new CopilotRequestError(401, { code: 'AUTH_REQUIRED' }))).toMatch(/sign-in has expired/);
    expect(describeCopilotError(new CopilotRequestError(400, { code: 'CONVERSATION_NOT_READY' }))).not.toMatch(/CONVERSATION_NOT_READY/);
    expect(describeCopilotError(new CopilotRequestError(422, { message: 'Paste a job posting URL or the full JD text.' }))).toBe('Paste a job posting URL or the full JD text.');
    expect(describeCopilotError(new TypeError('Failed to fetch'))).toMatch(/Couldn’t reach Copilot/);
    expect(describeCopilotError(new Error('Copilot request failed (504)'))).not.toMatch(/504/);
  });
});
