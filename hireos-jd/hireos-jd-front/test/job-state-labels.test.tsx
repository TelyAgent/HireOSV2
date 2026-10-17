import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { JobStateLabels } from '../src/features/workspace/JobStateLabels';
import { translate } from '../src/data/i18n';

const locale = vi.hoisted(() => ({ zh: false }));
vi.mock('../src/store/StoreContext', () => ({ useStore: () => ({ t: (source: string, key?: string) => translate(locale.zh ? 'zh' : 'en', source, key) }) }));
afterEach(() => { cleanup(); locale.zh = false; });

describe('#92: recruitment and document publication are distinct', () => {
  it.each([false, true])('labels the contradictory-looking state in both languages (zh=%s)', zh => {
    locale.zh = zh;
    render(<JobStateLabels hiringStatus="published" publishedVersion={null} />);
    const hiring = screen.getByRole('group', { name: zh ? '招聘状态' : 'Recruiting status' });
    const publication = screen.getByRole('group', { name: zh ? 'JD 发布状态' : 'JD publication' });
    expect(hiring).toHaveTextContent(zh ? '已发布' : 'Published');
    expect(publication).toHaveTextContent(zh ? '未发布' : 'Not published');
    expect(within(hiring).queryByText(zh ? '未发布' : 'Not published')).toBeNull();
  });
  it('shows the exact published version, not an approval claim', () => {
    render(<JobStateLabels hiringStatus="published" publishedVersion={3} />);
    expect(screen.getByRole('group', { name: 'JD publication' })).toHaveTextContent('v3 published');
    expect(document.body).not.toHaveTextContent(/approved/i);
  });
  it('does not claim unpublished while versions are still loading', () => {
    render(<JobStateLabels hiringStatus="draft" publishedVersion={undefined} />);
    expect(screen.getByRole('group', { name: 'JD publication' })).toHaveTextContent('Loading');
    expect(document.body).not.toHaveTextContent('Not published');
  });
});
