// Issue #27 AC-7 — a comparison snapshot must say when its members changed after it was generated.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { memberStateKey, changedSinceSnapshot } = require('../dist/comparisons/member-state');

const base = {
  evaluation: { id: 'e1', overallScore: 82 },
  concerns: [{ id: 'c1', status: 'open' }, { id: 'c2', status: 'open' }],
  verificationItems: [{ id: 'v1', status: 'open' }],
  decision: null,
};

test('the key ignores ordering but changes with anything a reviewer acts on', () => {
  const k = memberStateKey(base);
  assert.equal(memberStateKey({ ...base, concerns: [...base.concerns].reverse() }), k);
  for (const change of [
    { concerns: [{ id: 'c1', status: 'dismissed' }, { id: 'c2', status: 'open' }] }, // concern resolved on the detail page
    { verificationItems: [{ id: 'v1', status: 'resolved' }] },
    { decision: { id: 'd1', status: 'approved' } },
    { evaluation: { id: 'e2', overallScore: 82 } },
    { evaluation: { id: 'e1', overallScore: 85 } },
    { evaluation: null },
  ]) {
    assert.notEqual(memberStateKey({ ...base, ...change }), k, JSON.stringify(change));
  }
});

test('lists members that changed or joined after the latest snapshot', () => {
  const a = memberStateKey(base);
  const b = memberStateKey({ ...base, evaluation: { id: 'e9', overallScore: 70 } });
  const entries = [{ applicationId: 'app-a', stateKey: a }, { applicationId: 'app-b', stateKey: b }];
  const now = new Map([['app-a', a], ['app-b', b], ['app-c', a]]);
  assert.deepEqual(changedSinceSnapshot(['app-a', 'app-b'], entries, now), []);

  now.set('app-a', memberStateKey({ ...base, concerns: [{ id: 'c1', status: 'dismissed' }, { id: 'c2', status: 'open' }] }));
  assert.deepEqual(changedSinceSnapshot(['app-a', 'app-b'], entries, now), ['app-a']);
  assert.deepEqual(changedSinceSnapshot(['app-a', 'app-b', 'app-c'], entries, now), ['app-a', 'app-c'], 'added after the snapshot');
});

test('snapshots taken before keys were recorded make no claim', () => {
  const legacy = [{ applicationId: 'app-a', overall: 80 }, { applicationId: 'app-b', overall: 70 }];
  assert.deepEqual(changedSinceSnapshot(['app-a', 'app-b'], legacy, new Map([['app-a', 'x'], ['app-b', 'y']])), []);
  assert.deepEqual(changedSinceSnapshot(['app-a'], null, new Map()), []);
});
