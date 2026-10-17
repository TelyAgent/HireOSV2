// Issue #145 — the model gets the latest 10 rounds as written plus the draft's fields, never the whole conversation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { historyTurns, HISTORY_ROUNDS } = require('../dist/copilot/history-budget');
const { requestFailure } = require('../dist/copilot/llm-provider');

const conversation = (rounds) => Array.from({ length: rounds }, (_, i) => [
  { role: 'user', text: `问题 ${i}`, attachments: null },
  { role: 'assistant', text: `回答 ${i}`, attachments: null },
]).flat();

test('AC-3: up to 10 rounds go as written, in order, with nothing added', () => {
  const turns = historyTurns(conversation(HISTORY_ROUNDS), { title: '后端工程师' });
  assert.equal(turns.length, 20);
  assert.deepEqual(turns[0], { role: 'user', content: '问题 0' });
  assert.deepEqual(turns.at(-1), { role: 'assistant', content: '回答 9' });
});

test('AC-3: a longer conversation sends only the latest 10 rounds, led by a note carrying the confirmed fields', () => {
  for (const rounds of [11, 60, 500]) {
    const turns = historyTurns(conversation(rounds), { title: '后端工程师', location: '上海' });
    assert.equal(turns.length, 21, `${rounds} rounds`);
    assert.equal(turns[0].role, 'user');
    assert.match(turns[0].content, new RegExp(`较早的 ${(rounds - 10) * 2} 条对话已省略`));
    assert.match(turns[0].content, /"title":"后端工程师"/);
    assert.match(turns[0].content, /"location":"上海"/);
    assert.deepEqual(turns[1], { role: 'user', content: `问题 ${rounds - 10}` });
    assert.deepEqual(turns.at(-1), { role: 'assistant', content: `回答 ${rounds - 1}` });
  }
});

test('AC-3: the request size stops growing with the conversation', () => {
  const fixed = (rounds) => conversation(rounds).map((m) => ({ ...m, text: '字'.repeat(600) }));
  const size = (rounds) => historyTurns(fixed(rounds), { title: 'X' }).reduce((n, t) => n + t.content.length, 0);
  assert.equal(size(11), 20 * 600 + historyTurns(fixed(11), { title: 'X' })[0].content.length);
  assert.ok(size(500) - size(11) <= 2, 'only the omitted-count digits differ');
});

test('uploads still go as a placeholder, not their text', () => {
  const turns = historyTurns([{ role: 'user', text: 'secret file text', attachments: [{ filename: 'jd.pdf' }] }]);
  assert.deepEqual(turns, [{ role: 'user', content: '[已上传文件]' }]);
});

test('AC-3: a provider context-length error becomes LLM_CONTEXT_TOO_LONG; other failures stay LLM_REQUEST_FAILED', () => {
  const tooLong = Object.assign(new Error("This model's maximum context length is 128000 tokens."), { code: 'context_length_exceeded' });
  assert.equal(requestFailure(tooLong).getResponse().code, 'LLM_CONTEXT_TOO_LONG');
  assert.equal(requestFailure(new Error('Request timed out.')).getResponse().code, 'LLM_REQUEST_FAILED');
});
