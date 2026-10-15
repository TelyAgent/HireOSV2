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
  it('cursor in a 16000-character paragraph, nothing selected: the paragraph is dropped, the JD is sent (marked partial) under the limit', () => {
    const para = cjk(16000);
    const { body, truncated } = fitted({
      message: '这份 JD 现在能发布吗？',
      selection: { text: para, target: { kind: 'p', text: para }, scope: 'fragment', implicit: true },
      context: { jobTitle: '数据分析师', documentText: `${para}\n${cjk(30000)}`, readiness: 'x'.repeat(6000) },
    });
    expect(body.selection).toBeUndefined();
    expect(size(body)).toBeLessThanOrEqual(MAX_ASK_BYTES);
    expect(truncated).toBe(true);
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
    const items = Array.from({ length: 50 }, () => cjk(2000));
    expect(fitAskRequest({ message: 'rewrite', selection: { text: items[0], target: { kind: 'ul', items }, scope: 'items' }, context: {} })).toEqual({ tooLarge: true });
    expect(fitAskRequest({ message: 'rewrite', selection: { text: 'a'.repeat(8001), target: { kind: 'p', text: 'a'.repeat(8001) }, scope: 'fragment' }, context: {} })).toEqual({ tooLarge: true });
  });

  it('a normal JD is sent whole and not marked partial', () => {
    const doc = 'Data Analyst\n- Can write SQL queries.';
    const { body, truncated } = fitted({ message: 'q', context: { documentText: doc } });
    expect(body.context.documentText).toBe(doc);
    expect(truncated).toBe(false);
  });

  it('newlines and quotes that grow when JSON-escaped are still counted', () => {
    const { body } = fitted({ message: 'q', context: { documentText: '"\n'.repeat(60000) } });
    expect(size(body)).toBeLessThanOrEqual(MAX_ASK_BYTES);
  });
});
