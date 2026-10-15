// #106 review — every job-page Copilot request fits the backend's 100 KB JSON body limit.
import { describe, expect, it } from 'vitest';
import { MAX_ASK_BYTES, fitAskRequest } from '../src/features/workspace/askBudget';

const size = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const cjk = (n: number) => '数'.repeat(n);

describe('fitAskRequest', () => {
  it('cursor in a 16000-character Chinese paragraph, nothing selected, long JD: under the limit and marked partial', () => {
    const para = cjk(16000);
    const { body, truncated } = fitAskRequest({
      message: '这份 JD 现在能发布吗？',
      selection: { text: para, target: { kind: 'p', text: para }, scope: 'fragment', implicit: true },
      context: { jobTitle: '数据分析师', documentText: `${para}\n${cjk(30000)}`, readiness: 'x'.repeat(6000) },
    });
    expect(size(body)).toBeLessThanOrEqual(MAX_ASK_BYTES);
    expect(truncated).toBe(true);
    expect(body.context.documentText!.startsWith(cjk(100))).toBe(true);
    expect(body.context.readiness).toHaveLength(6000);
  });

  it('a list block with many long items stays under the limit', () => {
    const items = Array.from({ length: 50 }, () => cjk(2000));
    const { body } = fitAskRequest({
      message: 'explain',
      selection: { text: items.join('\n'), target: { kind: 'ul', items }, scope: 'items' },
      context: { documentText: items.join('\n') },
    });
    expect(size(body)).toBeLessThanOrEqual(MAX_ASK_BYTES);
  });

  it('a normal JD is sent whole and not marked partial', () => {
    const doc = 'Data Analyst\n- Can write SQL queries.';
    const { body, truncated } = fitAskRequest({ message: 'q', context: { documentText: doc } });
    expect(body.context.documentText).toBe(doc);
    expect(truncated).toBe(false);
  });

  it('newlines and quotes that grow when JSON-escaped are still counted', () => {
    const doc = '"\n'.repeat(60000);
    const { body } = fitAskRequest({ message: 'q', context: { documentText: doc } });
    expect(size(body)).toBeLessThanOrEqual(MAX_ASK_BYTES);
  });
});
