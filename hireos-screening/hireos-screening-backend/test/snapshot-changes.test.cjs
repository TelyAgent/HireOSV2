// #206 -- a comparison snapshot records what changed since the previous one: nothing to compare with on the first,
// an empty list when nothing changed, and every member-level change (score, rank, eligibility, dimension) otherwise.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateChanges } = require('../dist/comparisons/comparisons.service');

const entry = (id, name, overall, rank, eligibilityStatus, dims) => ({ applicationId: id, candidateName: name, overall, rank, eligibilityStatus, dimensions: dims.map(([did, dname, score]) => ({ id: did, name: dname, score })) });
const v1 = [entry('a', 'Ann', 80, 1, 'eligible', [['d1', 'Skills', 80], ['d2', 'Seniority', 70]]), entry('b', 'Ben', 60, 2, 'needs_verification', [['d1', 'Skills', 60]])];

test('AC-1: the first snapshot has nothing to compare with (null), an unchanged refresh has no changes ([])', () => {
  assert.equal(calculateChanges(undefined, v1), null);
  assert.equal(calculateChanges(null, v1), null);
  assert.deepEqual(calculateChanges(v1, structuredClone(v1)), []);
});

test('AC-2: a refresh lists every change of each member, plus members added and removed', () => {
  const v3 = [
    entry('a', 'Ann', 70, 2, 'eligible', [['d1', 'Skills', 65], ['d2', 'Seniority', 70]]),
    entry('c', 'Cai', 90, 1, 'not_eligible', [['d1', 'Skills', 90]]),
  ];
  assert.deepEqual(calculateChanges(v1, v3), [
    { kind: 'overall', applicationId: 'a', candidateName: 'Ann', from: 80, to: 70 },
    { kind: 'rank', applicationId: 'a', candidateName: 'Ann', from: 1, to: 2 },
    { kind: 'dimension', applicationId: 'a', candidateName: 'Ann', dimension: 'Skills', from: 80, to: 65 },
    { kind: 'added', applicationId: 'c', candidateName: 'Cai' },
    { kind: 'removed', applicationId: 'b', candidateName: 'Ben' },
  ]);
});

test('an eligibility change alone is reported', () => {
  const next = structuredClone(v1);
  next[1].eligibilityStatus = 'not_eligible';
  assert.deepEqual(calculateChanges(v1, next), [{ kind: 'eligibility', applicationId: 'b', candidateName: 'Ben', from: 'needs_verification', to: 'not_eligible' }]);
});
