// Issue #64 — a job link that can't be read: say why, keep the link, never draft; Retry shows one error, not two.
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
import { sourceLinks } from '../src/features/workspace/documentsApi';
import { StoreProvider } from '../src/store/StoreContext';
import { GeminiPanel, conversationToGeminiMsgs } from '../src/features/copilot/GeminiPanel';

const api = vi.mocked(copilot);
const LINK = 'https://careers.example.com/position/42';
const NO_CONTENT = '页面已打开，但没有找到职位内容，可能需要登录，或职位已下线。请打开链接复制 JD 全文，粘贴到下方。';
const unreadable = () => new CopilotRequestError(400, { code: 'LINK_UNREADABLE', message: NO_CONTENT });
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

async function sendLink(text: string) {
  fireEvent.click(await screen.findByText('Paste a Link or Text'));
  fireEvent.change(composerBox(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.createCopilotConversation.mockResolvedValue(conversation('conv-1'));
});
afterEach(cleanup);

describe('Paste a link that cannot be read (#64)', () => {
  it.each([LINK, 'Original pasted job description'])('#84: the draft identifies its source for %s', async (source) => {
    api.importCopilotSource.mockResolvedValue({ ...conversation('conv-1'), phase: 'ready_to_confirm', fields: { title: 'Synthetic role' } } as never);
    renderPanel();
    await sendLink(source);
    const note = await screen.findByTestId('draft-source');
    expect(note).toHaveTextContent(source === LINK ? 'Link source' : 'Text source');
    if (source === LINK) expect(note.querySelector('a')).toHaveAttribute('href', LINK);
    else expect(note.querySelector('a')).toBeNull();
  });

  it('#84: reopening a conversation restores recorded import provenance without guessing from message text', () => {
    const dto = (attachments: unknown) => ({ ...conversation('conv-1'), phase: 'ready_to_confirm', fields: { title: 'Synthetic role' }, messages: [{ role: 'user', text: LINK, attachments }] }) as never;
    expect(conversationToGeminiMsgs(dto([{ kind: 'link', url: LINK }])).at(-1)?.origin).toEqual({ path: 'link', detail: LINK, sourceType: 'link' });
    expect(conversationToGeminiMsgs(dto([{ kind: 'pasted_text' }])).at(-1)?.origin).toEqual({ path: 'link', detail: LINK, sourceType: 'text' });
    expect(conversationToGeminiMsgs(dto(null)).at(-1)?.origin).toBeUndefined();
  });
  it('#83: an incomplete import never automatically generates missing requirements', async () => {
    api.importCopilotSource.mockResolvedValue({ ...conversation('conv-1'), missingFields: ['responsibilities', 'mustHave'], messages: [{ id: 'm83', role: 'assistant', text: 'Please review the source.', sequence: 2, createdAt: '' }] } as never);
    renderPanel();
    await sendLink(LINK);
    await waitFor(() => expect(api.importCopilotSource).toHaveBeenCalledWith('conv-1', { url: LINK }));
    await screen.findByText('Please review the source.');
    expect(api.autoCompleteCopilotConversation).not.toHaveBeenCalled();
    expect(api.confirmCopilotDraft).not.toHaveBeenCalled();
  });

  it.each(['file:///tmp/uj-test-m4.txt', 'ftp://example.com/jd'])('#85: rejects %s before import, preserving input and no draft', async (url) => {
    renderPanel();
    await sendLink(url);
    expect(await screen.findByRole('alert')).toHaveTextContent('Only http:// and https:// links are supported.');
    expect(composerBox().value).toBe(url);
    expect(api.importCopilotSource).not.toHaveBeenCalled();
    expect(api.confirmCopilotDraft).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Create/ })).toBeNull();
  });

  it('#85: login failure offers a focused full-text recovery without creating a draft', async () => {
    api.importCopilotSource.mockRejectedValue(new CopilotRequestError(400, { code: 'LINK_UNREADABLE', message: 'This page requires login. Paste the full JD text.' }));
    renderPanel();
    await sendLink(LINK);
    expect(await screen.findByRole('alert')).toHaveTextContent('requires login');
    fireEvent.click(screen.getByRole('button', { name: 'Paste full JD text' }));
    expect(composerBox()).toHaveFocus();
    expect(composerBox().value).toBe('');
    expect(screen.getByText(LINK, { exact: true })).toBeInTheDocument();
    const text = 'Platform engineer. Build and operate reliable infrastructure.';
    api.importCopilotSource.mockResolvedValue({ ...conversation('conv-1'), reply: 'Please review the source.' } as never);
    fireEvent.change(composerBox(), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(api.importCopilotSource).toHaveBeenLastCalledWith('conv-1', { text }));
    expect(api.confirmCopilotDraft).not.toHaveBeenCalled();
  });
  it('AC-3: says why, keeps the link in the composer for pasting the JD instead, and drafts nothing', async () => {
    api.importCopilotSource.mockRejectedValue(unreadable());
    renderPanel();
    await sendLink(LINK);

    const card = await screen.findByRole('alert');
    expect(card).toHaveTextContent(NO_CONTENT);
    expect(composerBox().value).toBe(LINK);
    expect(api.autoCompleteCopilotConversation).not.toHaveBeenCalled();
    expect(api.confirmCopilotDraft).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Create/ })).toBeNull();
  });

  it('AC-4: Retry on the same failing link shows only the current error, not a second identical card', async () => {
    api.importCopilotSource.mockRejectedValue(unreadable());
    renderPanel();
    await sendLink(LINK);
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(api.importCopilotSource).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    expect(screen.getByRole('alert')).toHaveTextContent(NO_CONTENT);
    expect(api.importCopilotSource.mock.calls.map((c) => c[1])).toEqual([{ url: LINK }, { url: LINK }]);

    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(api.importCopilotSource).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
  });
});

describe('sourceLinks (#64 AC-2)', () => {
  it('lists the public links a draft was read from and ignores other source refs', () => {
    expect(
      sourceLinks({
        sourceRefs: [{ kind: 'copilot_conversation' }, { kind: 'link', url: LINK }, { kind: 'link', url: 'javascript:alert(1)' }],
      } as never),
    ).toEqual([LINK]);
    expect(sourceLinks(null)).toEqual([]);
  });
});
