// Issue #68 — a Quick Start draft shows, field by field, where each part came from and whether it still awaits
// confirmation; AI suggestions stay highlighted until confirmed. Captured inputs keep the raw answers alongside.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/features/copilot/copilotApi', async (importOriginal) => ({
  CopilotRequestError: (await importOriginal<typeof import('../src/features/copilot/copilotApi')>()).CopilotRequestError,
  TITLE_UNCONFIRMED: 'title_unconfirmed',
  createCopilotConversation: vi.fn(),
  setCopilotFields: vi.fn(),
  confirmCopilotFields: vi.fn(),
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
const ANSWERS = 'No one owns growth in Vietnam\nBuild a repeatable growth process\nPerformance marketing, SQL';
const FIELDS = { title: 'Vietnam Growth Manager', roleSummary: 'Owns growth in Vietnam.', responsibilities: ['Build a growth process', 'Run experiments'], mustHave: ['SQL', 'Performance marketing'] };
const ai = (revision = 1) => ({ source: 'ai', revision, status: 'pending' }) as const;
const META = { title: { source: 'user', revision: 1, status: 'confirmed' }, roleSummary: ai(), responsibilities: ai(), mustHave: ai() } as const;
const conv = (over: object) =>
  ({ id: 'conv-1', jobId: null, phase: 'ready_to_confirm', fields: FIELDS, missingFields: [], fieldMeta: META, stateRevision: 1, createdAt: '', updatedAt: '', messages: [], ...over }) as never;

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
async function quickStart() {
  renderPanel();
  fireEvent.click(await screen.findByText('Quick Start'));
  fireEvent.change(document.querySelector('.gemini-composer-shell textarea') as HTMLTextAreaElement, { target: { value: ANSWERS } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText(/AI-suggested field\(s\) to confirm/);
}
const markOf = (field: string) => document.querySelector(`.gemini-expand-column .gm-field-mark[data-field="${field}"]`) as HTMLElement | null;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.createCopilotConversation.mockResolvedValue({ id: 'conv-1' } as never);
  api.quickStartCopilotConversation.mockResolvedValue(conv({}));
});
afterEach(cleanup);

describe('Quick Start draft provenance (#68)', () => {
  it('AC-1: every field shows its source, revision and confirmation status', async () => {
    await quickStart();
    expect(markOf('title')).toHaveTextContent('Your answer · confirmed');
    expect(markOf('title')).toHaveTextContent('v1');
    for (const field of ['roleSummary', 'responsibilities', 'mustHave']) {
      expect(markOf(field)).toHaveTextContent('AI suggested · to confirm');
      expect(markOf(field)).toHaveTextContent('v1');
    }
  });

  it('AC-2: AI suggestions are highlighted; confirming one updates its status, and the rest stay highlighted', async () => {
    api.confirmCopilotFields.mockResolvedValue(conv({ fieldMeta: { ...META, responsibilities: { source: 'ai', revision: 1, status: 'confirmed' } } }));
    await quickStart();
    const doc = document.querySelector('.gemini-expand-column .gm-ws-doc') as HTMLElement;
    expect(doc.querySelectorAll('.gm-pending')).toHaveLength(3);
    expect(screen.getByText('3 AI-suggested field(s) to confirm — highlighted below')).toBeInTheDocument();

    fireEvent.click(within(markOf('responsibilities')!).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(markOf('responsibilities')).toHaveTextContent('AI suggested · confirmed'));
    expect(api.confirmCopilotFields).toHaveBeenCalledWith('conv-1', ['responsibilities']);
    expect(markOf('responsibilities')).toHaveTextContent('v1');
    expect(doc.querySelectorAll('.gm-pending')).toHaveLength(2);
    expect(markOf('mustHave')).toHaveTextContent('AI suggested · to confirm');
  });

  it('AC-2: “Confirm all” confirms every pending suggestion at once', async () => {
    api.confirmCopilotFields.mockImplementation(async (_id, fields) =>
      conv({ fieldMeta: { ...META, ...Object.fromEntries(fields.map((f) => [f, { source: 'ai', revision: 1, status: 'confirmed' }])) } }),
    );
    await quickStart();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm all' }));
    await waitFor(() => expect(document.querySelectorAll('.gemini-expand-column .gm-pending')).toHaveLength(0));
    expect(api.confirmCopilotFields.mock.calls[0][1].sort()).toEqual(['mustHave', 'responsibilities', 'roleSummary']);
    expect(screen.queryByText(/AI-suggested field\(s\) to confirm/)).toBeNull();
  });

  it('AC-3: Captured inputs still lists the raw answers, separate from the per-field marks', async () => {
    await quickStart();
    const inputs = document.querySelector('.gemini-expand-column .gm-ws-inputs') as HTMLElement;
    expect(inputs).toHaveTextContent('Captured inputs');
    expect(inputs).toHaveTextContent('Performance marketing, SQL');
    expect(inputs.querySelector('.gm-field-mark')).toBeNull();
    expect(document.querySelectorAll('.gemini-expand-column .gm-ws-doc .gm-field-mark').length).toBe(4);
  });
});
