// #134 -- who finalized a written-test evaluation is the authenticated caller, never a name sent in the body.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { InvitationsService } = require('../dist/invitations/invitations.service');

function setup(finalizedAt = null) {
  const writes = [];
  const submission = { id: 's-1', finalizedAt, finalizedBy: null };
  const db = {
    invitation: {
      findFirst: async ({ where }) => (where.workspaceId === 'ws-1' ? { id: 'i-1', submission } : null),
    },
    submission: { update: async ({ data }) => { writes.push(data); return { ...submission, ...data }; } },
  };
  const lifecycle = { advance: async () => {} };
  return { service: new InvitationsService(db, {}, { get: (_k, d) => d }, {}, lifecycle), writes };
}
const body = (extra = {}) => ({ overall: 80, criteria: [{ name: 'Design', max: 10, ai: 7, human: 8 }], ...extra });
const userA = { workspaceId: 'ws-1', actorId: 'user-a', roles: [], kind: 'user' };

test('#134 AC-1: a finalizedBy naming someone else is not recorded — the session user is', async () => {
  const { service, writes } = setup();
  await service.finalizeEvaluation(userA, 'c-1', body({ finalizedBy: 'user-b' }));
  assert.equal(writes[0].finalizedBy, 'user-a');
});

test('#134 AC-2: without finalizedBy the real actor is recorded; a trusted service call records the user it acts for', async () => {
  const a = setup();
  await a.service.finalizeEvaluation(userA, 'c-1', body());
  assert.equal(a.writes[0].finalizedBy, 'user-a');
  const s = setup();
  await s.service.finalizeEvaluation({ workspaceId: 'ws-1', actorId: 'user-c', roles: [], kind: 'service' }, 'c-1', body({ finalizedBy: 'someone-else' }));
  assert.equal(s.writes[0].finalizedBy, 'user-c');
});

test('#134 AC-3: an already finalized evaluation is left as it is — nothing is rewritten', async () => {
  const { service, writes } = setup(new Date('2026-10-01'));
  await assert.rejects(service.finalizeEvaluation(userA, 'c-1', body()), (e) => e.getStatus() === 409 && e.response.code === 'ALREADY_FINALIZED');
  assert.deepEqual(writes, []);
});
