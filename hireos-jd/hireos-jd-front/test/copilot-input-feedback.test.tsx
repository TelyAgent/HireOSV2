// #75 #82 #88 #89 #90 #99 — Copilot says why an input can't be used, and only claims changes that happened.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
import { CopilotRequestError } from '../src/features/copilot/copilotApi';
import { describeCopilotError } from '../src/features/copilot/copilotErrors';
import { buildDraftFromBackend } from '../src/features/workspace/docHelpers';
import { StoreProvider } from '../src/store/StoreContext';
import { GeminiPanel } from '../src/features/copilot/GeminiPanel';

const api = vi.mocked(copilot);

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
const composerBox = () => document.querySelector('.gemini-composer-shell textarea') as HTMLTextAreaElement;
function send(text: string) {
  fireEvent.change(composerBox(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

async function openManualForm() {
  fireEvent.click(await screen.findByText('Create Manually'));
  const title = await screen.findByPlaceholderText('e.g. Growth Operations Manager');
  const form = title.closest('.gm-bubble') as HTMLElement;
  return { title, form };
}
async function fillManualForm(titleText: string) {
  const { title, form } = await openManualForm();
  fireEvent.change(title, { target: { value: titleText } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Ho Chi Minh City, VN'), { target: { value: 'Shanghai' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. 2'), { target: { value: '1' } });
  const areas = form.querySelectorAll('textarea');
  fireEvent.change(areas[1], { target: { value: 'Own partner APIs' } });
  fireEvent.change(areas[2], { target: { value: 'Node.js' } });
  return form;
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

const variant = (key: string, location: string) => ({ key, label: key, description: '', fields: { title: 'Finance Manager', location, responsibilities: ['a'], mustHave: ['b'] } });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.createCopilotConversation.mockResolvedValue({ id: 'conv-1' } as never);
  api.setCopilotFields.mockImplementation(async (_id, fields) => ({ id: 'conv-1', fields }) as never);
  api.confirmCopilotDraft.mockResolvedValue({ conversationId: 'conv-1', jobId: 'job-1' });
});
afterEach(cleanup);

describe('#75: job title input feedback', () => {
  it('an empty or symbols-only title says why and starts nothing; a short real title goes through', async () => {
    api.generateCopilotTitleVariants.mockResolvedValue({ title: 'CFO', variants: [variant('A', 'Shanghai')] } as never);
    renderPanel();
    fireEvent.click(await screen.findByText('Start with a Job Title'));

    send('   ');
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a job title first.');
    send('123 ???');
    expect(screen.getByRole('alert')).toHaveTextContent('That doesn’t look like a job title');
    expect(composerBox().value).toBe('123 ???');
    expect(api.generateCopilotTitleVariants).not.toHaveBeenCalled();

    send('CFO');
    await waitFor(() => expect(api.generateCopilotTitleVariants).toHaveBeenCalledWith('conv-1', 'CFO'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('#88 / #90: manual form', () => {
  it('#88: an untouched employment type is not sent; a picked one is', async () => {
    renderPanel();
    await fillManualForm('Partner Integrations Engineer');
    save();
    await waitFor(() => expect(api.setCopilotFields).toHaveBeenCalledTimes(1));
    expect(api.setCopilotFields.mock.calls[0][1]).not.toHaveProperty('employmentType');
    cleanup();

    renderPanel();
    const form = await fillManualForm('Partner Integrations Engineer');
    const employment = [...form.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'Part-time'))!;
    expect(employment.value).toBe('');
    fireEvent.change(employment, { target: { value: 'Part-time' } });
    save();
    await waitFor(() => expect(api.setCopilotFields).toHaveBeenCalledTimes(2));
    expect(api.setCopilotFields.mock.calls[1][1]).toMatchObject({ employmentType: 'Part-time' });
  });

  it('#90: a 201-character title is refused at the field with no request; 200 characters is created', async () => {
    renderPanel();
    await fillManualForm('x'.repeat(201));
    save();
    expect(await screen.findByText('Job title can be at most 200 characters.', { selector: '.gm-field-error' })).toBeInTheDocument();
    expect(api.setCopilotFields).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('e.g. Growth Operations Manager'), { target: { value: 'x'.repeat(200) } });
    save();
    expect(await screen.findByTestId('editor')).toBeInTheDocument();
    expect(api.setCopilotFields.mock.calls[0][1]).toMatchObject({ title: 'x'.repeat(200) });
  });

  it('#90: the backend refusing the title reads as the title limit, not "Copilot unavailable"', () => {
    const err = new CopilotRequestError(422, { code: 'INVALID_SCHEMA', message: 'Request validation failed.', fieldPaths: ['fields.title'] } as never);
    expect(describeCopilotError(err)).toBe('Job title can be at most 200 characters.');
  });
});

describe('#89: an empty role summary stays empty', () => {
  it('the seeded document has an empty summary paragraph, not invented copy', () => {
    const doc = buildDraftFromBackend('Engineer', { roleSummary: null, responsibilities: ['a'], requirements: [] } as never, 'job-1');
    expect(doc.blocks[1]).toMatchObject({ kind: 'p', text: '' });
  });
});

describe('#82: upload errors', () => {
  it('a 0-byte or over-10 MB file is refused with the reason, without uploading', async () => {
    renderPanel();
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([], 'empty.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('This file is empty (0 bytes). Choose a file that has the JD in it.')).toBeInTheDocument();

    const big = new File(['x'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText('This file is larger than the 10 MB limit. Compress or split it, then choose it again.')).toBeInTheDocument();
    expect(api.uploadCopilotAttachment).not.toHaveBeenCalled();
  });

  it('the server’s 413 / empty codes read as the same plain reasons', () => {
    expect(describeCopilotError(new CopilotRequestError(413, { message: 'File too large' }))).toMatch(/10 MB limit/);
    expect(describeCopilotError(new CopilotRequestError(400, { code: 'ATTACHMENT_FILE_EMPTY' }))).toMatch(/empty \(0 bytes\)/);
  });
});

describe('#99: refine only reports real changes', () => {
  async function openVariants() {
    api.generateCopilotTitleVariants.mockResolvedValue({ title: 'Finance Manager', variants: [variant('A', 'Remote'), variant('B', 'Remote'), variant('C', 'Remote')] } as never);
    renderPanel();
    fireEvent.click(await screen.findByText('Start with a Job Title'));
    send('Finance Manager');
    await waitFor(() => expect(api.generateCopilotTitleVariants).toHaveBeenCalled());
    await waitFor(() => expect(composerBox().disabled).toBe(false));
  }

  it('no version changed → says nothing changed, never "updated all versions"', async () => {
    await openVariants();
    api.refineCopilotVariants.mockResolvedValue({ variants: [variant('A', 'Remote'), variant('B', 'Remote'), variant('C', 'Remote')] } as never);
    send('put the salary in the JD');
    expect(await screen.findByText(/Nothing changed — none of the versions needed an edit/)).toBeInTheDocument();
    expect(screen.queryByText(/Updated all/)).toBeNull();
  });

  it('a list that only went from missing to empty is not a change', async () => {
    await openVariants();
    const withEmpty = (key: string) => ({ ...variant(key, 'Remote'), fields: { ...variant(key, 'Remote').fields, niceToHave: [] } });
    api.refineCopilotVariants.mockResolvedValue({ variants: [withEmpty('A'), withEmpty('B'), withEmpty('C')] } as never);
    send('put the salary in the JD');
    expect(await screen.findByText(/Nothing changed — none of the versions needed an edit/)).toBeInTheDocument();
  });

  it('lists the fields each version really changed and says they are unsaved drafts', async () => {
    await openVariants();
    api.refineCopilotVariants.mockResolvedValueOnce({ variants: [variant('A', 'Shanghai'), variant('B', 'Remote'), variant('C', 'Remote')] } as never);
    send('make it Shanghai');
    expect(await screen.findByText(/still unsaved drafts/)).toHaveTextContent(/- Version A: Location\s*- Version B: no change\s*- Version C: no change/);
  });

  it('asked for salary but only other fields changed → says the salary was not changed, never "updated"', async () => {
    await openVariants();
    api.refineCopilotVariants.mockResolvedValueOnce({ variants: [variant('A', 'Hanoi'), variant('B', 'Hanoi'), variant('C', 'Hanoi')] } as never);
    send('按照上面的薪资标准写到JD里');
    const reply = await screen.findByText(/still unsaved drafts/);
    expect(reply).toHaveTextContent('- Version A: Location');
    expect(reply).toHaveTextContent('The salary was not changed in any version.');

    const paid = (key: string) => ({ ...variant(key, 'Hanoi'), fields: { ...variant(key, 'Hanoi').fields, publicCompensation: { min: 15000, max: 22000, currency: 'CNY', period: 'month' } } });
    api.refineCopilotVariants.mockResolvedValueOnce({ variants: [paid('A'), variant('B', 'Hanoi'), paid('C')] } as never);
    send('add the salary 15-22K');
    expect(await screen.findByText(/The salary was not changed in version B\./)).toBeInTheDocument();
    expect(screen.getAllByText(/- Version A: Salary/).length).toBeGreaterThan(0);
  });

  it('single draft: lists what changed and calls out an unchanged salary', async () => {
    const conv = (fields: object) => ({ id: 'conv-1', jobId: null, phase: 'ready_to_confirm', fields, missingFields: [], stateRevision: 2, createdAt: '', updatedAt: '', messages: [] }) as never;
    const base = { title: 'Product Designer', location: 'Beijing', responsibilities: ['Design flows'], mustHave: ['Figma'] };
    api.quickStartCopilotConversation.mockResolvedValue(conv(base));
    renderPanel();
    fireEvent.click(await screen.findByText('Quick Start'));
    send('Product Designer\nBeijing\nFigma');
    await screen.findByRole('button', { name: /Create job from this draft/ });

    api.refineCopilotDraft.mockResolvedValueOnce(conv({ ...base, location: 'Shanghai' }));
    send('按照上面的薪资标准写到JD里');
    expect(await screen.findByText(/Changed in the draft: Location\./)).toHaveTextContent('The salary was not changed.');

    api.refineCopilotDraft.mockResolvedValueOnce(conv({ ...base, location: 'Shanghai' }));
    send('add the salary');
    expect(await screen.findByText(/Nothing changed — the draft didn’t need an edit/)).toBeInTheDocument();
  });

  it('a small salary change (hourly 26–36 → 29–39) shows the new amount, highlighted, in the Workspace', async () => {
    const hourly = (key: string, min: number, max: number) => ({
      ...variant(key, 'Remote'),
      fields: { ...variant(key, 'Remote').fields, publicCompensation: { min, max, currency: 'USD', period: 'hour' } },
    });
    api.generateCopilotTitleVariants.mockResolvedValue({ title: 'Finance Manager', variants: [hourly('A', 26, 36), hourly('B', 26, 36), hourly('C', 26, 36)] } as never);
    renderPanel();
    fireEvent.click(await screen.findByText('Start with a Job Title'));
    send('Finance Manager');
    await waitFor(() => expect(composerBox().disabled).toBe(false));

    api.refineCopilotVariants.mockResolvedValueOnce({ variants: [hourly('A', 29, 39), hourly('B', 29, 39), hourly('C', 29, 39)] } as never);
    send('raise the hourly salary to 29-39');
    expect(await screen.findByText(/- Version A: Salary/)).toBeInTheDocument();
    const shown = await screen.findByText(/29–39 \/ hour/);
    expect(shown.closest('.gm-changed')).not.toBeNull();
    expect(document.body.textContent).not.toContain('0.03K');
  });

  it('a fractional salary change is still highlighted in the Workspace', async () => {
    const pay = (key: string, min: number) => ({
      ...variant(key, 'Remote'),
      fields: { ...variant(key, 'Remote').fields, publicCompensation: { min, max: 22000, currency: 'USD', period: 'month' } },
    });
    api.generateCopilotTitleVariants.mockResolvedValue({ title: 'Finance Manager', variants: [pay('A', 15000), pay('B', 15000), pay('C', 15000)] } as never);
    renderPanel();
    fireEvent.click(await screen.findByText('Start with a Job Title'));
    send('Finance Manager');
    await waitFor(() => expect(composerBox().disabled).toBe(false));
    api.refineCopilotVariants.mockResolvedValueOnce({ variants: [pay('A', 15000.25), pay('B', 15000.25), pay('C', 15000.25)] } as never);
    send('salary from 15000.25');
    const shown = await screen.findByText(/15,000\.25–22K \/ month/);
    expect(shown.closest('.gm-changed')).not.toBeNull();
  });
});
