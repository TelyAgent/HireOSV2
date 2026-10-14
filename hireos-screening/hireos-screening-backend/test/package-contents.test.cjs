// Issue #22 — the delivery package returns the five promised items, frozen at package creation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { packageContents, ACCESS_LIMITATIONS } = require('../dist/deliveries/package-contents');

const frozen = { id: 'ev-1', overall: 81.5, coverage: 0.9, eligibilityStatus: 'eligible', version: 2, generatedAt: '2026-10-14T02:00:00.000Z',
  dimensionScores: [{ dimensionId: 'd1', name: 'Skills', score: 85, status: 'evaluated', reason: 'x' }] };

test('AC-1: all four fields are present and non-empty', () => {
  const c = packageContents({ kind: 'create_interview', reviewStatus: 'human_reviewed', decisionId: 'dec-1', payload: { evaluation: frozen } });
  assert.equal(c.requestedAction, 'create_interview');
  assert.deepEqual(c.accessLimitations, [...ACCESS_LIMITATIONS]);
  assert.ok(c.accessLimitations.length > 0);
  assert.equal(c.reviewStatus, 'human_reviewed');
  assert.deepEqual(
    { version: c.evaluationSnapshot.version, overall: c.evaluationSnapshot.overall, coverage: c.evaluationSnapshot.coverage, eligibilityStatus: c.evaluationSnapshot.eligibilityStatus, generatedAt: c.evaluationSnapshot.generatedAt },
    { version: 2, overall: 81.5, coverage: 0.9, eligibilityStatus: 'eligible', generatedAt: '2026-10-14T02:00:00.000Z' },
  );
});

test('AC-2: the snapshot is what was frozen in the package, not the current evaluation', () => {
  // A later re-screen produced v5 with a different score; the package still reports what it sent.
  const c = packageContents({ kind: 'create_interview', reviewStatus: null, decisionId: 'dec-1', payload: { evaluation: frozen } },
    { version: 5, completedAt: new Date('2026-10-20T00:00:00Z'), createdAt: new Date('2026-10-20T00:00:00Z') });
  assert.equal(c.evaluationSnapshot.version, 2);
  assert.equal(c.evaluationSnapshot.overall, 81.5);
  assert.equal(c.evaluationSnapshot.generatedAt, '2026-10-14T02:00:00.000Z');
});

test('older packages backfill version/time from their own evaluation and infer the review status', () => {
  const { version, generatedAt, ...legacy } = frozen;
  void version; void generatedAt;
  const c = packageContents({ kind: 'create_assessment', reviewStatus: null, decisionId: 'dec-9', payload: { evaluation: legacy } },
    { version: 2, completedAt: new Date('2026-10-14T02:00:00Z'), createdAt: new Date('2026-10-14T01:00:00Z') });
  assert.equal(c.evaluationSnapshot.version, 2);
  assert.equal(c.evaluationSnapshot.generatedAt, '2026-10-14T02:00:00.000Z');
  assert.equal(c.reviewStatus, 'human_reviewed');
  assert.equal(packageContents({ kind: 'review_only', reviewStatus: null, decisionId: null, payload: {} }).evaluationSnapshot, null);
});
