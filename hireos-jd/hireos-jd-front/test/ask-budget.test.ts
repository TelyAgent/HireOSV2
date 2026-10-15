// #106 review — every job-page Copilot request fits the backend's 100 KB JSON body limit, and a
// selection is never cut (an accepted edit must replace exactly what the model saw).
import { describe, expect, it } from 'vitest';
import { MAX_ASK_BYTES, fitAskRequest } from '../src/features/workspace/askBudget';
import type { AskRequest } from '../src/features/workspace/documentsApi';

const size = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const cjk = (n: number) => '数'.repeat(n);
const fitted = (req: AskRequest) => {
  const fit = fitAskRequest(req);
  if ('tooLarge' in fit) throw new Error('unexpectedly too large');
  return fit;
};

describe('fitAskRequest', () => {
  it('a long JD (80000 characters, requirement at the end) is sent whole, nothing marked partial', () => {
    const doc = `${cjk(80000)}\nCan write SQL queries.`;
    const { body, truncated } = fitted({ message: '有 SQL 要求吗？', context: { documentText: doc } });
    expect(body.context.documentText).toBe(doc);
    expect(truncated).toBe(false);
    expect(body.context).not.toHaveProperty('documentTruncated');
  });

  it('cursor in a 16000-character paragraph, nothing selected: the paragraph is kept within limits or dropped, and the JD still goes whole', () => {
    const para = cjk(16000);
    const { body, truncated } = fitted({
      message: '这份 JD 现在能发布吗？',
      selection: { text: para, target: { kind: 'p', text: para }, scope: 'fragment', implicit: true },
      context: { jobTitle: '数据分析师', documentText: `${para}\n${cjk(30000)}`, readiness: 'x'.repeat(6000) },
    });
    expect(body.selection).toBeUndefined(); // 16000 > the backend's 8000-character selection limit
    expect(size(body)).toBeLessThanOrEqual(MAX_ASK_BYTES);
    expect(truncated).toBe(false);
  });

  it('an extreme JD that cannot fit is cut AND the backend is told so, not just the UI', () => {
    const { body, truncated } = fitted({ message: 'q', context: { documentText: cjk(700000) } });
    expect(truncated).toBe(true);
    expect(body.context.documentTruncated).toBe(true);
    expect(size(body)).toBeLessThanOrEqual(MAX_ASK_BYTES);
  });

  it('an explicit selection is sent whole — never trimmed — when it fits', () => {
    const text = cjk(3004);
    const items = Array.from({ length: 10 }, () => cjk(600));
    const one = fitted({ message: 'rewrite', selection: { text, target: { kind: 'p', text }, scope: 'fragment' }, context: { documentText: text } });
    expect(one.body.selection!.text).toBe(text);
    expect(one.body.selection!.target.text).toBe(text);
    const list = fitted({ message: 'rewrite', selection: { text: items.join('\n'), target: { kind: 'ul', items }, scope: 'items' }, context: {} });
    expect(list.body.selection!.target.items).toEqual(items);
  });

  it('an explicit selection too big to send whole is refused, not cut', () => {
    const many = Array.from({ length: 201 }, () => 'item');
    expect(fitAskRequest({ message: 'rewrite', selection: { text: 'item', target: { kind: 'ul', items: many }, scope: 'items' }, context: {} })).toEqual({ tooLarge: true });
    const longItem = [cjk(20001)];
    expect(fitAskRequest({ message: 'rewrite', selection: { text: 'x', target: { kind: 'ul', items: longItem }, scope: 'items' }, context: {} })).toEqual({ tooLarge: true });
    const big = Array.from({ length: 200 }, () => cjk(19000)); // within field limits, over the request budget
    expect(fitAskRequest({ message: 'rewrite', selection: { text: 'x', target: { kind: 'ul', items: big }, scope: 'items' }, context: {} })).toEqual({ tooLarge: true });
    expect(fitAskRequest({ message: 'rewrite', selection: { text: 'a'.repeat(8001), target: { kind: 'p', text: 'a'.repeat(8001) }, scope: 'fragment' }, context: {} })).toEqual({ tooLarge: true });
  });

  it('a normal JD is sent whole and not marked partial', () => {
    const doc = 'Data Analyst\n- Can write SQL queries.';
    const { body, truncated } = fitted({ message: 'q', context: { documentText: doc } });
    expect(body.context.documentText).toBe(doc);
    expect(truncated).toBe(false);
  });

  it('newlines and quotes that grow when JSON-escaped are still counted', () => {
    const { body } = fitted({ message: 'q', context: { documentText: '"\n'.repeat(240000) } });
    expect(size(body)).toBeLessThanOrEqual(MAX_ASK_BYTES);
  });
});
