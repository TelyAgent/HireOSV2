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
import { GeminiPanel } from '../src/features/copilot/GeminiPanel';

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
