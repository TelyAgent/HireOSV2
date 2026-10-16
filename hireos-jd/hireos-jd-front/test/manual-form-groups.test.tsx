// Issue #86 — a manual JD written in groups keeps them: "1.基础条件" is a sub-heading of Requirements, its lines are items.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';

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
import { toGroupedLines, toLines } from '../src/features/copilot/formLines';
import { buildDraftFromBackend, groupSections } from '../src/features/workspace/docHelpers';
import { evaluateJob } from '../src/features/workspace/completeness';
import { StoreProvider } from '../src/store/StoreContext';
import { GeminiPanel } from '../src/features/copilot/GeminiPanel';
import type { Job } from '../src/data/types';

const api = vi.mocked(copilot);

const GROUPED = ['1.基础条件', '● 计算机、数学等相关专业，3+ 年经验', '● 熟悉 C++ / Python（含 "引号" & 符号）', '2.专业能力', '● 熟悉 RAG、Agent 与工具调用', '● 能搭建离线评测与 A/B 实验'].join('\n');
const GROUPED_ITEMS = ['计算机、数学等相关专业，3+ 年经验', '熟悉 C++ / Python（含 "引号" & 符号）', '熟悉 RAG、Agent 与工具调用', '能搭建离线评测与 A/B 实验'];

describe('toGroupedLines (#86)', () => {
  it('AC-1: numbered group lines above bullets become group headings, kept as typed', () => {
    expect(toGroupedLines(GROUPED)).toEqual({ items: GROUPED_ITEMS, groups: ['1.基础条件', '1.基础条件', '2.专业能力', '2.专业能力'] });
  });

  it('a heading ending in a colon, or followed by indented lines, opens a group too', () => {
    expect(toGroupedLines('基础条件：\n本科及以上\n3 年经验')).toEqual({ items: ['本科及以上', '3 年经验'], groups: ['基础条件：', '基础条件：'] });
    expect(toGroupedLines('Basics\n  Degree in CS\n  3+ years')).toEqual({ items: ['Degree in CS', '3+ years'], groups: ['Basics', 'Basics'] });
  });

  it('review: one plain line above some bullets stays a requirement, not a heading', () => {
    expect(toGroupedLines('1. 4+ years in B2B sales\n- Fluent English\n- CRM experience')).toEqual({
      items: ['4+ years in B2B sales', 'Fluent English', 'CRM experience'],
      groups: ['', '', ''],
    });
    // A line between groups that has no bullets under it is an item too, so the text isn't read as groups.
    expect(toGroupedLines('1.基础条件\n● 本科\nMust relocate to Hangzhou\n2.专业能力\n● SQL').items).toContain('Must relocate to Hangzhou');
  });

  it('AC-3: plain lines, numbered or not, stay one flat list with no groups', () => {
    expect(toGroupedLines('1. Own partner APIs\n2. Ship SDKs\nWrite docs')).toEqual({ items: ['Own partner APIs', 'Ship SDKs', 'Write docs'], groups: ['', '', ''] });
    expect(toGroupedLines('- Node.js\n- 3+ years')).toEqual({ items: ['Node.js', '3+ years'], groups: ['', ''] });
    expect(toLines('1. a\n- b')).toEqual(['a', 'b']);
  });
});

const content = (requirements: { label: string; priority: string; group?: string }[]) =>
  ({ roleSummary: 'Builds AI products.', responsibilities: ['Ship models', 'Run evals', 'Own quality'], requirements, internalCompensation: null, publicCompensation: null }) as never;

describe('document built from the draft (#86)', () => {
  it('AC-1/AC-2: groups are sub-headings under Requirements, each followed by its own items, in order', () => {
    const { items, groups } = toGroupedLines(GROUPED);
    const draft = buildDraftFromBackend('AI应用算法工程师', content(items.map((label, i) => ({ label, priority: 'must_have', group: groups[i] }))), 'job-86');
    const requirements = groupSections(draft.blocks).find((s) => s.head?.text === 'Requirements')!;
    expect(requirements.blocks.map((b) => [b.kind, b.text])).toEqual([
      ['h3', '1.基础条件'],
      ['ul', [GROUPED_ITEMS[0]]],
      ['ul', [GROUPED_ITEMS[1]]],
      ['h3', '2.专业能力'],
      ['ul', [GROUPED_ITEMS[2]]],
      ['ul', [GROUPED_ITEMS[3]]],
    ]);
    // The other chapters keep their place: title section, Responsibilities, Requirements, Compensation.
    expect(draft.blocks.filter((b) => b.kind === 'h2').map((b) => b.text)).toEqual(['AI应用算法工程师', 'Responsibilities', 'Requirements', 'Compensation']);
  });

  it('AC-3: ungrouped requirements are plain bullets, as before', () => {
    const draft = buildDraftFromBackend('Engineer', content([{ label: 'Node.js', priority: 'must_have' }, { label: 'SQL', priority: 'must_have' }]), 'job-86b');
    const requirements = groupSections(draft.blocks).find((s) => s.head?.text === 'Requirements')!;
    expect(requirements.blocks.map((b) => b.kind)).toEqual(['ul', 'ul']);
  });

  it('completeness counts the requirement items, not the group headings', () => {
    // 4 groups × 2 items = 8 requirements, the most D1 allows; counting the 4 headings too would make it 12.
    const text = ['A', 'B', 'C', 'D'].map((g) => `${g}.分组\n● 熟练使用 ${g} 工具链完成交付\n● 具备 ${g} 方向两年项目经验`).join('\n');
    const { items, groups } = toGroupedLines(text);
    expect(items).toHaveLength(8);
    const draft = buildDraftFromBackend('AI应用算法工程师', content(items.map((label, i) => ({ label, priority: 'must_have', group: groups[i] }))), 'job-86');
    const job = { id: 'job-86', title: 'AI应用算法工程师', location: '上海', headcount: 1 } as unknown as Job;
    const d1 = evaluateJob(job, draft).rows.find((r) => r.item.id === 'D1')!;
    expect(d1.ok).toBe(true);
    expect(d1.weak).not.toMatch(/8 requirements or fewer/);
  });
});

describe('manual form → create (#86)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.createCopilotConversation.mockResolvedValue({ id: 'conv-86' } as never);
    api.setCopilotFields.mockResolvedValue({ id: 'conv-86', fields: {} } as never);
    api.confirmCopilotDraft.mockResolvedValue({ conversationId: 'conv-86', jobId: 'job-86' });
  });
  afterEach(cleanup);

  it('AC-1: sends each requirement with the group it was written under', async () => {
    render(
      <AntApp>
        <StoreProvider>
          <MemoryRouter>
            <GeminiPanel ctx={{ mode: 'create', jobId: null, audience: 'internal', selText: null }} />
          </MemoryRouter>
        </StoreProvider>
      </AntApp>,
    );
    fireEvent.click(await screen.findByText('Create Manually'));
    const title = await screen.findByPlaceholderText('e.g. Growth Operations Manager');
    fireEvent.change(title, { target: { value: 'AI应用算法工程师' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Ho Chi Minh City, VN'), { target: { value: '上海' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 2'), { target: { value: '1' } });
    const areas = (title.closest('.gm-bubble') as HTMLElement).querySelectorAll('textarea');
    fireEvent.change(areas[1], { target: { value: '需求与问题定义\n数据飞轮与治理' } });
    fireEvent.change(areas[2], { target: { value: GROUPED } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.setCopilotFields).toHaveBeenCalled());
    const fields = api.setCopilotFields.mock.calls[0][1] as Record<string, unknown>;
    expect(fields.mustHave).toEqual(GROUPED_ITEMS);
    expect(fields.mustHaveGroups).toEqual(['1.基础条件', '1.基础条件', '2.专业能力', '2.专业能力']);
    expect(fields.responsibilities).toEqual(['需求与问题定义', '数据飞轮与治理']);
    expect(fields).not.toHaveProperty('niceToHaveGroups');
  });
});
