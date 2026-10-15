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

  it('only some versions changed → names them; all changed → says all, and that they are unsaved', async () => {
    await openVariants();
    api.refineCopilotVariants.mockResolvedValueOnce({ variants: [variant('A', 'Shanghai'), variant('B', 'Remote'), variant('C', 'Remote')] } as never);
    send('make it Shanghai');
    expect(await screen.findByText(/Updated version A with your note; the other versions didn’t change/)).toBeInTheDocument();

    api.refineCopilotVariants.mockResolvedValueOnce({ variants: [variant('A', 'Hanoi'), variant('B', 'Hanoi'), variant('C', 'Hanoi')] } as never);
    send('make it Hanoi');
    expect(await screen.findByText(/Updated all 3 versions with your note\. They’re still unsaved drafts/)).toBeInTheDocument();
  });
});
