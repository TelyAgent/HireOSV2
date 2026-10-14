// Answers are refused once the round's deadline (plus a one-minute grace) has passed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertBeforeDeadline } = require('../dist/invitations/rounds');
const { InvitationsService } = require('../dist/invitations/invitations.service');

const code = (fn) => { try { fn(); return null; } catch (e) { return e.response?.code; } };

test('rule: accepted until the deadline plus one minute, refused after', () => {
  const deadline = new Date('2026-10-15T15:42:00Z');
  assert.equal(code(() => assertBeforeDeadline(deadline, new Date('2026-10-15T15:41:59Z'))), null);
  assert.equal(code(() => assertBeforeDeadline(deadline, new Date('2026-10-15T15:42:59Z'))), null);
  assert.equal(code(() => assertBeforeDeadline(deadline, new Date('2026-10-15T15:43:01Z'))), 'DEADLINE_PASSED');
  assert.equal(code(() => assertBeforeDeadline(null, new Date('2099-01-01T00:00:00Z'))), null);
});

test('a late submission is refused and nothing is stored', async () => {
  const created = [];
  const db = {
    invitation: { findUnique: async () => ({ id: 'inv-1', caseId: 'c1', deadline: new Date(Date.now() - 3600_000), submission: null, questions: [] }) },
    submission: { create: (args) => { created.push(args); return args; } },
    $transaction: async (ops) => ops,
  };
  const service = new InvitationsService(db, {}, { get: (_k, d) => d }, {}, {});
  await assert.rejects(service.submit('tok', { answers: [] }), (e) => e.response?.code === 'DEADLINE_PASSED');
  assert.equal(created.length, 0);
});
