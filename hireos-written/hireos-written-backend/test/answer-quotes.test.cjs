// #378 -- the AI's excerpts are placed in the answer they quote, by question and lines; anything the answer
// doesn't contain is dropped and counted, never shown as evidence.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { locateInAnswer, placeQuotes } = require('../dist/ai/answer-quotes');

const answer = [
  '方案概述：采用分层架构。',
  '第一步，用队列削峰，',
  '再按优先级分批处理。',
  '',
  'Risk: the cache can go stale; we refresh it every 5 minutes.',
].join('\n');

test('AC-2: an excerpt is placed on the line, or the shortest run of lines, that holds it', () => {
  assert.deepEqual(locateInAnswer(answer, '采用分层架构'), { lineFrom: 1, lineTo: 1 });
  assert.deepEqual(locateInAnswer(answer, '用队列削峰，再按优先级分批处理'), { lineFrom: 2, lineTo: 3 }, 'across a line break');
  assert.deepEqual(locateInAnswer(answer, 'the cache can go STALE  we refresh it'), { lineFrom: 5, lineTo: 5 }, 'case, spacing and punctuation ignored');
});

test('AC-2/AC-3: text the answer does not contain, or too short to place, is not placed', () => {
  assert.equal(locateInAnswer(answer, '采用微服务架构'), null);
  assert.equal(locateInAnswer(answer, '方案'), null, 'too short to vouch for a place');
  assert.equal(locateInAnswer('', '采用分层架构'), null);
});

test('AC-2: excerpts are placed in the question they name; the rest are counted as left out', () => {
  const questions = [{ questionId: 'q1' }, { questionId: 'q2' }];
  const answers = [{ questionId: 'q1', answerText: answer }, { questionId: 'q2', answerText: 'SQL: SELECT * FROM t WHERE a = 1' }];
  const placed = placeQuotes([
    { question: 1, text: '再按优先级分批处理' },
    { question: 2, text: 'SELECT * FROM t' },
    { question: 2, text: '采用分层架构' }, // in question 1's answer, not question 2's
    { question: 3, text: 'anything' }, // no such question
  ], questions, answers);
  assert.deepEqual(placed.quotes, [
    { questionId: 'q1', text: '再按优先级分批处理', lineFrom: 3, lineTo: 3 },
    { questionId: 'q2', text: 'SELECT * FROM t', lineFrom: 1, lineTo: 1 },
  ]);
  assert.equal(placed.unlocated, 2);
});

test('AC-1: the evaluator returns each criterion with its rationale and placed excerpts', async () => {
  const client = require('../dist/ai/ai-json-client');
  const original = client.callAiForJson;
  client.callAiForJson = async () => ({
    summary: 's',
    criteria: [
      { name: 'Design', score: 40, evidence: 'Layers and a queue.', quotes: [{ question: 1, text: '用队列削峰' }, { question: 1, text: 'invented text' }] },
      { name: 'Risk', score: 30, evidence: 'Names the stale cache.' },
    ],
  });
  try {
    const { AiEvaluatorService } = require('../dist/ai/ai-evaluator.service');
    const out = await new AiEvaluatorService({ get: () => 'x' }).evaluate({
      questions: [{ questionId: 'q1', title: 'T', prompt: 'P', competencies: [{ name: 'Design', fraction: 0.5 }, { name: 'Risk', fraction: 0.5 }] }],
      answers: [{ questionId: 'q1', answerText: answer }],
    });
    assert.deepEqual(out.criteria.map((c) => [c.name, c.evidence, c.quotes, c.unlocatedQuotes]), [
      ['Design', 'Layers and a queue.', [{ questionId: 'q1', text: '用队列削峰', lineFrom: 2, lineTo: 2 }], 1],
      ['Risk', 'Names the stale cache.', [], 0],
    ]);
  } finally {
    client.callAiForJson = original;
  }
});
