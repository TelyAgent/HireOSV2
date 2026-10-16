// #152 AC-4 -- an identity decision takes effect once: a repeated or concurrent confirmation finds the review
// already resolved and gets the decision that stands, with nothing written a second time.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DuplicatesService } = require('../dist/duplicates/duplicates.service');

function setup() {
  const check = {
    id: 'd-1', workspaceId: 'ws-1', kind: 'new_resume_version', status: 'open', confidence: 1, basis: [],
    existingCandidateId: 'c-1', materialId: 'm-2', resolutionOutcome: null, resolutionNote: null, resolvedBy: null, resolvedAt: null,
    material: { id: 'm-2', name: 'nina-2026.txt', createdAt: new Date(), readStatus: 'available', errorCode: null, confirmedIdentity: null, sourceType: 'paste', segments: [] },
    existingCandidate: { id: 'c-1', displayName: 'Nina Torres', email: null, phone: null, createdAt: new Date(), resumeVersions: [], profiles: [] },
  };
  const writes = { versions: 0, candidates: 0 };
  let locked = Promise.resolve();
  const db = {
    duplicateCheck: {
      findFirst: async () => check,
      // Compare-and-set, serialized like the row lock it stands for.
      updateMany: async ({ where, data }) => {
        const prev = locked;
        let release;
        locked = new Promise((r) => (release = r));
        await prev;
        const count = where.status?.not === 'resolved' && check.status !== 'resolved' ? 1 : 0;
        if (count) Object.assign(check, data);
        release();
        return { count };
      },
      update: async ({ data }) => Object.assign(check, data),
    },
    resumeVersion: {
      findFirst: async () => ({ version: 1 }),
      updateMany: async () => ({}),
      create: async () => { writes.versions += 1; return {}; },
      findUnique: async () => null,
    },
    candidate: { create: async () => { writes.candidates += 1; return { id: 'c-new' }; } },
    libraryEntry: { create: async () => ({}) },
    candidateSource: { updateMany: async () => ({}) },
    auditRecord: { create: async () => ({}) },
    importItem: { findFirst: async () => null },
    humanTask: { updateMany: async () => ({}) },
  };
  db.$transaction = async (fn) => fn(db);
  const service = new DuplicatesService(db, { enqueue: async () => {}, extractIdentitySignals: () => ({ displayName: 'Nina Torres', email: null, phone: null, location: null }) }, { finalizeBatch: async () => {} });
  return { service, writes, check };
}
const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };

test('#152 AC-3/AC-4: two concurrent "same person" confirmations add exactly one version; the second gets the outcome that stands', async () => {
  const { service, writes, check } = setup();
  const [a, b] = await Promise.all([
    service.resolve(identity, 'd-1', 'same_person_new_version'),
    service.resolve(identity, 'd-1', 'same_person_new_version'),
  ]);
  assert.equal(writes.versions, 1);
  assert.equal(check.status, 'resolved');
  assert.deepEqual([a.alreadyResolved, b.alreadyResolved].sort(), [false, true]);
  for (const r of [a, b]) assert.equal(r.status, 'resolved');
});

test('#152 AC-4: a "different person" confirmation repeated after it landed creates no second candidate', async () => {
  const { service, writes } = setup();
  const first = await service.resolve(identity, 'd-1', 'different_person');
  const again = await service.resolve(identity, 'd-1', 'different_person');
  assert.equal(writes.candidates, 1);
  assert.equal(first.alreadyResolved, false);
  assert.equal(again.alreadyResolved, true);
  assert.equal(again.resolutionOutcome, 'different_person');
});
