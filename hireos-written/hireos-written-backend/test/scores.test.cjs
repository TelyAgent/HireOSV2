// A finalized evaluation's scores must stay within each criterion's max and add up to the overall.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertValidFinalScores } = require('../dist/invitations/scores');

const code = (fn) => { try { fn(); return null; } catch (e) { return e.response?.code; } };
const criteria = (h1, h2) => [{ name: '任务理解', max: 35, human: h1 }, { name: '方案设计', max: 65, human: h2 }];

test('in-range whole scores whose sum is the overall are accepted', () => {
  assert.equal(code(() => assertValidFinalScores({ overall: 60, criteria: criteria(35, 25) })), null);
  assert.equal(code(() => assertValidFinalScores({ overall: 0, criteria: criteria(0, 0) })), null);
});

test('a score above the max, below zero or fractional is refused', () => {
  assert.equal(code(() => assertValidFinalScores({ overall: 105, criteria: criteria(80, 25) })), 'SCORE_OUT_OF_RANGE');
  assert.equal(code(() => assertValidFinalScores({ overall: 24, criteria: criteria(-1, 25) })), 'SCORE_OUT_OF_RANGE');
  assert.equal(code(() => assertValidFinalScores({ overall: 35.5, criteria: criteria(10.5, 25) })), 'SCORE_OUT_OF_RANGE');
});

test('an overall that is not the sum is refused', () => {
  assert.equal(code(() => assertValidFinalScores({ overall: 260, criteria: criteria(30, 25) })), 'OVERALL_MISMATCH');
});
