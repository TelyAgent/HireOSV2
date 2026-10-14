// A finalized evaluation's scores must stay within each criterion's max; the overall is out of 100.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertValidFinalScores, percentScore } = require('../dist/invitations/scores');

const code = (fn) => { try { fn(); return null; } catch (e) { return e.response?.code; } };
const criteria = (h1, h2) => [{ name: '任务理解', max: 35, human: h1 }, { name: '方案设计', max: 65, human: h2 }];

test('the overall is points over the total maximum, scaled to 100', () => {
  assert.equal(percentScore([{ score: 23, max: 103 }]), 22);
  assert.equal(percentScore([{ score: 103, max: 103 }]), 100);
  assert.equal(percentScore([{ score: 35, max: 35 }, { score: 0, max: 65 }]), 35);
  assert.equal(percentScore([]), 0);
});

test('in-range whole scores whose sum is the overall are accepted', () => {
  assert.equal(code(() => assertValidFinalScores({ overall: 60, criteria: criteria(35, 25) })), null);
  assert.equal(code(() => assertValidFinalScores({ overall: 0, criteria: criteria(0, 0) })), null);
});

test('a score above the max, below zero or fractional is refused', () => {
  assert.equal(code(() => assertValidFinalScores({ overall: 105, criteria: criteria(80, 25) })), 'SCORE_OUT_OF_RANGE');
  assert.equal(code(() => assertValidFinalScores({ overall: 24, criteria: criteria(-1, 25) })), 'SCORE_OUT_OF_RANGE');
  assert.equal(code(() => assertValidFinalScores({ overall: 35.5, criteria: criteria(10.5, 25) })), 'SCORE_OUT_OF_RANGE');
});

test('an overall that is not the out-of-100 score is refused', () => {
  assert.equal(code(() => assertValidFinalScores({ overall: 260, criteria: criteria(30, 25) })), 'OVERALL_MISMATCH');
  const over103 = [{ name: 'A', max: 53, human: 30 }, { name: 'B', max: 50, human: 20 }];
  assert.equal(code(() => assertValidFinalScores({ overall: 50, criteria: over103 })), 'OVERALL_MISMATCH');
  assert.equal(code(() => assertValidFinalScores({ overall: 49, criteria: over103 })), null);
});
